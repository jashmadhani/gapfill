"""Strip anything secret before it can reach the AI model, the chat history or the audit log.

The agent never needs a card number, UPI PIN, OTP, password or API key, so if a traveler types one by mistake it is
removed before the model sees it and the traveler is told not to share it.
"""
import re

_PATTERNS = [
    ("api_key", re.compile(r"\b(AIza[0-9A-Za-z_\-]{30,}|sk-[A-Za-z0-9_\-]{16,}|rzp_(live|test)_[A-Za-z0-9]{8,})\b"), "[secret removed]"),
    ("password", re.compile(r"\b(password|passcode|passwd|pwd|login pin)\b\s*(is|:|=|-)?\s*\S+", re.I), "[password removed]"),
    ("pin_otp", re.compile(r"\b(upi\s*pin|m-?pin|atm\s*pin|pin|otp|one[- ]time\s*(pass(word|code)?|code)|verification\s*code)\b\s*(is|:|=|-|of)?\s*\d{3,8}\b", re.I),
     "[PIN/OTP removed]"),
    ("cvv", re.compile(r"\b(cvv2?|cvc|security\s*code)\b\s*(is|:|=|-)?\s*\d{3,4}\b", re.I), "[CVV removed]"),
    ("expiry", re.compile(r"\b(exp(iry|iration)?(\s*date)?)\b\s*(is|:|=|-)?\s*(0[1-9]|1[0-2])\s*/\s*\d{2,4}\b", re.I), "[card expiry removed]"),
]
_CARD = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_AADHAAR = re.compile(r"(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)")


def _luhn(digits: str) -> bool:
    total, alt = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if alt:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
        alt = not alt
    return total % 10 == 0


def redact(text: str) -> tuple[str, list[str]]:
    """Returns (safe text, kinds of secret that were removed)."""
    if not text:
        return text, []
    found = []
    for kind, rx, repl in _PATTERNS:
        if rx.search(text):
            found.append(kind)
            text = rx.sub(repl, text)

    def card(m):
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and _luhn(digits):
            found.append("card_number")
            return "[card number removed]"
        return m.group(0)
    text = _CARD.sub(card, text)
    if _AADHAAR.search(text):
        found.append("id_number")
        text = _AADHAAR.sub("[ID number removed]", text)
    return text, sorted(set(found))


def redact_obj(obj):
    """Redact every string inside a JSON-like structure (used for audit details)."""
    if isinstance(obj, str):
        return redact(obj)[0]
    if isinstance(obj, dict):
        return {k: redact_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact_obj(v) for v in obj]
    return obj


WARNING = ("I removed something that looked like a card number, PIN, OTP or password from your message. Please never share "
           "those with me or anyone in chat — I can't use them and don't need them. You'll only ever enter payment details "
           "on the payment provider's own page.")
