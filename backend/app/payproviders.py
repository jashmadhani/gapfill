"""Payment providers. The traveler always pays on the provider's own page; our code never receives card numbers,
UPI PINs or OTPs — only an order id, a payment id and a signature to verify.

- Simulated (default): a clearly-labelled test page with Pay / Cancel buttons and no credential fields at all.
- Razorpay (test mode): used automatically when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in backend/.env.
"""
import hashlib
import hmac

import httpx

from .config import razorpay_keys


class SimulatedProvider:
    name = "simulated"

    async def create(self, intent) -> dict:
        return {"type": "simulated", "url": f"/checkout/{intent.public_id}"}


class RazorpayProvider:
    """Razorpay Orders API + Checkout. Amounts are in paise. Verified with the documented HMAC-SHA256 signature."""
    name = "razorpay"
    API = "https://api.razorpay.com/v1"

    def __init__(self, key_id: str, secret: str):
        self.key_id, self._secret = key_id, secret

    async def create(self, intent) -> dict:
        paise = int(round(intent.amount * 100))
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{self.API}/orders", auth=(self.key_id, self._secret),
                             json={"amount": paise, "currency": "INR", "receipt": intent.public_id[:40],
                                   "notes": {"tour_id": str(intent.tour_id), "kind": intent.kind}})
        if r.status_code >= 300:
            raise RuntimeError(f"Razorpay order failed ({r.status_code})")
        order = r.json()
        intent.provider_order_id = order["id"]
        return {"type": "razorpay", "key_id": self.key_id, "order_id": order["id"], "amount": paise, "currency": "INR",
                "name": "TourCraft", "description": intent.summary.get("title", "Tour payment")}

    def verify(self, order_id: str, payment_id: str, signature: str) -> bool:
        expected = hmac.new(self._secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


def provider():
    keys = razorpay_keys()
    return RazorpayProvider(*keys) if keys else SimulatedProvider()
