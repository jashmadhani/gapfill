/** Strip anything secret before it can be stored in chat history or reach the AI model.
 * The assistant never needs a card number, UPI PIN, OTP, password or API key; if someone types one by mistake it is
 * removed here and they are told not to share it. (Same rules as agent-service/app/safety.py.) */
const PATTERNS: [string, RegExp, string][] = [
  ["api_key", /\b(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{16,}|rzp_(live|test)_[A-Za-z0-9]{8,})\b/g, "[secret removed]"],
  ["password", /\b(password|passcode|passwd|pwd|login pin)\b\s*(is|:|=|-)?\s*\S+/gi, "[password removed]"],
  ["pin_otp", /\b(upi\s*pin|m-?pin|atm\s*pin|pin|otp|one[- ]time\s*(pass(word|code)?|code)|verification\s*code)\b\s*(is|:|=|-|of)?\s*\d{3,8}\b/gi, "[PIN/OTP removed]"],
  ["cvv", /\b(cvv2?|cvc|security\s*code)\b\s*(is|:|=|-)?\s*\d{3,4}\b/gi, "[CVV removed]"],
  ["expiry", /\b(exp(iry|iration)?(\s*date)?)\b\s*(is|:|=|-)?\s*(0[1-9]|1[0-2])\s*\/\s*\d{2,4}\b/gi, "[card expiry removed]"],
];
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const AADHAAR = /(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)/g;

function luhn(digits: string) {
  let total = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (alt) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    total += d;
    alt = !alt;
  }
  return total % 10 === 0;
}

export function redact(text: string): { text: string; found: string[] } {
  const found = new Set<string>();
  let out = text;
  for (const [kind, rx, repl] of PATTERNS) {
    rx.lastIndex = 0;
    if (rx.test(out)) {
      found.add(kind);
      rx.lastIndex = 0;
      out = out.replace(rx, repl);
    }
  }
  out = out.replace(CARD, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      found.add("card_number");
      return "[card number removed]";
    }
    return m;
  });
  AADHAAR.lastIndex = 0;
  if (AADHAAR.test(out)) {
    found.add("id_number");
    AADHAAR.lastIndex = 0;
    out = out.replace(AADHAAR, "[ID number removed]");
  }
  return { text: out, found: [...found].sort() };
}

export const SECRET_WARNING =
  "I removed something that looked like a card number, PIN, OTP or password from your message. Please never share those with me or anyone in chat: I can't use them and don't need them. You'll only ever enter payment details on the payment provider's own page.";
