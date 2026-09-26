"""The payment gate (human-in-the-loop). Deterministic code, not AI.

Every action that moves money — booking, paying the balance, or a mid-trip change that costs extra or refunds money —
becomes a PaymentIntent first:

  propose  -> quote the exact amount, lock the plan + amount into a hash, expire in 15 minutes
  approve  -> only the traveler's own tap (never the agent); re-checks the hash; opens the provider checkout
  pay      -> the traveler pays on the provider's page; we receive only a verified payment id
  execute  -> re-checks the hash again, then books / rebooks / refunds and issues tickets

If the plan or price changes at any point, the intent goes stale and nothing is charged (or the payment is refunded
in full if it already went through). The agent can only call `propose`.
"""
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta

from sqlalchemy import select

from . import planner as P
from .adapt import CAUSE, apply_changes, resolve_event, simulate
from .config import ticket_secret
from .customize import CustomizeError, plan_add, plan_remove, plan_swap
from .models import AgentAudit, ChangeEvent, Payment, PaymentIntent, Ticket, Tour
from .payproviders import provider
from .safety import redact_obj
from .services import DEPOSIT, book_tour, ctx_for, get_state, item_dict, load_items, payments_summary, policy_text

EXPIRY = timedelta(minutes=15)
OPEN = ("proposed", "awaiting_payment")


class GateError(Exception):
    pass


def _now():
    return datetime.utcnow()


# ---------------------------------------------------------------- audit
def audit(db, tour_id, actor: str, action: str, detail: dict | None = None, outcome: str = "ok", intent_id: str | None = None):
    db.add(AgentAudit(tour_id=tour_id, actor=actor, action=action, detail=redact_obj(detail or {}), outcome=outcome, intent_id=intent_id))


# ---------------------------------------------------------------- quoting
def _hash(tour, rows, kind, action, amount, refund) -> str:
    state = [(r.id, r.status, r.offering_id, round(r.price or 0, 2), r.day, r.start_min) for r in sorted(rows, key=lambda r: r.id)]
    blob = json.dumps({"tour": [tour.id, tour.status], "items": state, "kind": kind, "action": action,
                       "amount": round(amount, 2), "refund": round(refund, 2)}, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


def _line(label, amount, strong=False):
    return {"label": label, "amount": round(amount), "strong": strong}


async def quote(db, tour: Tour, kind: str, action: dict) -> dict:
    """Work out exactly what an action costs, without changing anything. Raises GateError if it isn't possible."""
    st = await get_state(db)
    rows = await load_items(db, tour.id)
    items = [item_dict(r) for r in rows]
    ctx = ctx_for(tour, st)
    before = P.price(items, ctx)
    pay = await payments_summary(db, tour, before["total"])
    action = dict(action)

    if kind == "booking":
        if tour.status != "draft":
            raise GateError("This tour is already booked.")
        errors = [c["text"] for c in P.conflicts(items, ctx) if c["level"] == "error"]
        if errors:
            raise GateError("Fix these first: " + " ".join(errors[:3]))
        mode = "full" if action.get("pay") == "full" else "deposit"
        action["pay"] = mode
        amount = before["total"] if mode == "full" else round(before["total"] * DEPOSIT)
        live = [i for i in items if P.live(i) and i["kind"] in ("activity", "hotel", "transport")]
        summary = {"title": f"Book {tour.title}",
                   "subtitle": f"{len(live)} bookings with {len({i['vendor_id'] for i in live})} partners · {tour.days} days",
                   "lines": [_line("Trip total (incl. taxes)", before["total"]),
                             _line("Pay now" + (" — 30% deposit" if mode == "deposit" else " — in full"), amount, True)]
                   + ([_line("Balance due before the trip", before["total"] - amount)] if mode == "deposit" else []),
                   "policy": "Each booking has its own free-cancellation window (activities 24h, hotels 72h, cars 24h). "
                             "Vendor, weather and transport disruptions are covered."}
        return {"amount": amount, "refund": 0, "fees": 0, "summary": summary, "action": action, "rows": rows}

    if kind == "balance":
        if tour.status != "booked":
            raise GateError("Only booked tours have a balance.")
        if pay["balance"] <= 0:
            raise GateError("Nothing is due — the tour is fully paid.")
        summary = {"title": "Pay the balance", "subtitle": tour.title,
                   "lines": [_line("Trip total", before["total"]), _line("Paid so far", pay["net_paid"]), _line("Pay now", pay["balance"], True)],
                   "policy": "Paying the balance doesn't change any booking or cancellation window."}
        return {"amount": pay["balance"], "refund": 0, "fees": 0, "summary": summary, "action": action, "rows": rows}

    if kind != "change":
        raise GateError("Unknown payment type.")
    sub = action.get("type")
    label = "Change"
    try:
        if sub == "option":
            ev = await db.get(ChangeEvent, int(action["change_id"]))
            if not ev or ev.tour_id != tour.id or ev.status != "pending":
                raise GateError("That change is no longer waiting for a decision.")
            opt = next((o for o in ev.options if o["key"] == action.get("option")), None)
            if not opt:
                raise GateError("Unknown option.")
            changes, cause, label = opt["changes"], CAUSE.get(ev.trigger_type, "traveler"), f"{ev.label}: {opt['label']}"
            texts = opt.get("details") or []
        elif sub == "swap":
            changes, cause = plan_swap(st, ctx, rows, items, tour, int(action["item_id"]), action.get("offering_id"), action.get("mode")), "traveler"
            label, texts = "Swap", [c["text"] for c in changes]
        elif sub == "add":
            changes, cause = plan_add(st, ctx, items, tour, int(action["offering_id"]), action.get("day")), "traveler"
            label, texts = "Add to your trip", [c["text"] for c in changes]
        elif sub == "remove":
            changes, cause = plan_remove(rows, tour, int(action["item_id"])), "traveler"
            label, texts = "Remove from your trip", [c["text"] for c in changes]
        else:
            raise GateError("Unknown change.")
    except CustomizeError as e:
        raise GateError(str(e))
    if sub != "option":
        action["changes"] = changes  # execution replays exactly the plan the traveler approved
    sim, fees = simulate(items, changes, tour, st, cause)
    after = P.price(sim, ctx)["total"]
    delta = round(after - before["total"])
    charge = max(0, delta)
    refund = round(max(0, pay["net_paid"] - after)) if delta < 0 else 0
    policies = sorted({policy_text(i) for i in items for c in changes if c.get("item_id") == i["id"] and c["op"] in ("replace", "remove")})
    lines = [{"label": t, "amount": None, "strong": False} for t in texts[:4]]
    if fees:
        lines.append(_line("Cancellation fees (vendor policy)", fees))
    lines.append(_line("New trip total", after))
    lines.append(_line("Change to the total", delta))
    if charge:
        lines.append(_line("Pay now", charge, True))
    elif refund:
        lines.append(_line("Refund to your original payment method", refund, True))
    summary = {"title": label, "subtitle": tour.title, "lines": lines,
               "policy": " ".join(policies) or "No cancellation fees apply to this change."}
    return {"amount": charge, "refund": refund, "fees": fees, "summary": summary, "action": action, "rows": rows}


# ---------------------------------------------------------------- lifecycle
def ser(i: PaymentIntent) -> dict:
    left = max(0, int((i.expires_at - _now()).total_seconds())) if i.status in OPEN else 0
    return {"id": i.public_id, "tour_id": i.tour_id, "kind": i.kind, "summary": i.summary, "amount": i.amount, "refund": i.refund,
            "fees": i.fees, "status": i.status, "created_by": i.created_by, "provider": i.provider, "result": i.result,
            "error": i.error, "expires_in": left, "created_at": i.created_at.isoformat() + "Z",
            "action_type": i.action.get("type") or i.kind}


def expire(i: PaymentIntent) -> bool:
    if i.status in OPEN and _now() > i.expires_at:
        i.status = "expired"
        return True
    return False


async def propose(db, tour: Tour, kind: str, action: dict, created_by: str) -> PaymentIntent:
    q = await quote(db, tour, kind, action)
    # one open request per identical action: a repeat returns the existing card instead of stacking duplicates
    for old in (await db.execute(select(PaymentIntent).where(PaymentIntent.tour_id == tour.id, PaymentIntent.status.in_(OPEN)))).scalars():
        expire(old)
        if old.status in OPEN and old.kind == kind and old.action == q["action"]:
            return old
    i = PaymentIntent(public_id="pi_" + secrets.token_urlsafe(12), tour_id=tour.id, kind=kind, action=q["action"],
                      summary=q["summary"], amount=q["amount"], refund=q["refund"], fees=q["fees"],
                      cart_hash=_hash(tour, q["rows"], kind, q["action"], q["amount"], q["refund"]),
                      status="proposed", created_by=created_by, expires_at=_now() + EXPIRY)
    db.add(i)
    await db.flush()
    audit(db, tour.id, created_by, "propose_payment", {"kind": kind, "title": q["summary"]["title"], "amount": q["amount"],
                                                        "refund": q["refund"]}, intent_id=i.public_id)
    return i


async def _still_valid(db, tour, i: PaymentIntent) -> bool:
    try:
        q = await quote(db, tour, i.kind, {k: v for k, v in i.action.items() if k != "changes"} if i.action.get("type") != "option" else i.action)
    except GateError:
        return False
    return _hash(tour, q["rows"], i.kind, q["action"], q["amount"], q["refund"]) == i.cart_hash


async def approve(db, i: PaymentIntent, confirm_amount: float, actor: str = "traveler") -> dict:
    """The traveler's tap. Only ever called from the traveler app's HTTP endpoint — the agent has no path to this."""
    tour = await db.get(Tour, i.tour_id)
    if expire(i):
        audit(db, tour.id, actor, "approve", {"reason": "expired"}, "blocked", i.public_id)
        raise GateError("This request expired. Ask again and I'll re-check prices.")
    if i.status != "proposed":
        raise GateError(f"This request is already {i.status.replace('_', ' ')}.")
    if abs(float(confirm_amount) - i.amount) > 0.5:
        audit(db, tour.id, actor, "approve", {"reason": "amount mismatch", "shown": confirm_amount, "amount": i.amount}, "blocked", i.public_id)
        raise GateError("The amount you approved doesn't match this request.")
    if not await _still_valid(db, tour, i):
        i.status = "stale"
        audit(db, tour.id, actor, "approve", {"reason": "plan or price changed"}, "blocked", i.public_id)
        raise GateError("Your plan or the price changed since this was prepared. Nothing was charged — please review the new quote.")
    i.decided_at = _now()
    audit(db, tour.id, actor, "approve", {"amount": i.amount, "refund": i.refund}, intent_id=i.public_id)
    if i.amount <= 0:  # nothing to pay (e.g. a change that refunds money): approval alone executes it
        await execute(db, i)
        return {"status": i.status, "intent": ser(i)}
    prov = provider()
    i.provider = prov.name
    try:
        checkout = await prov.create(i)
    except Exception as e:  # noqa: BLE001
        i.status, i.error = "failed", "Couldn't reach the payment provider. Nothing was charged."
        audit(db, tour.id, "provider", "create_checkout", {"error": str(e)[:200]}, "error", i.public_id)
        raise GateError(i.error)
    i.status = "awaiting_payment"
    i.expires_at = _now() + EXPIRY
    return {"status": i.status, "checkout": checkout, "intent": ser(i)}


async def decline(db, i: PaymentIntent, actor: str = "traveler"):
    if i.status in OPEN:
        i.status = "declined" if i.status == "proposed" else "cancelled"
        i.decided_at = _now()
        audit(db, i.tour_id, actor, "decline", {"title": i.summary.get("title")}, intent_id=i.public_id)


async def confirm_payment(db, i: PaymentIntent, provider_payment_id: str, method: str) -> PaymentIntent:
    """Called only after the provider has verified the payment (webhook / signature check / simulated page)."""
    tour = await db.get(Tour, i.tour_id)
    if i.status != "awaiting_payment":
        raise GateError(f"This payment request is {i.status.replace('_', ' ')}.")
    i.provider_payment_id = provider_payment_id
    db.add(Payment(tour_id=tour.id, amount=i.amount, kind="payment", method=method,
                   note=f"{i.summary.get('title', 'Payment')} · {i.provider} {provider_payment_id}"))
    audit(db, tour.id, "provider", "payment_received", {"amount": i.amount, "provider": i.provider}, intent_id=i.public_id)
    if not await _still_valid(db, tour, i):
        db.add(Payment(tour_id=tour.id, amount=i.amount, kind="refund", method=method, note=f"Automatic full refund · {i.public_id}"))
        i.status, i.error = "failed", "Your plan changed while you were paying, so the booking wasn't changed and the full amount was refunded."
        audit(db, tour.id, "system", "auto_refund", {"amount": i.amount}, "blocked", i.public_id)
        return i
    await execute(db, i, method)
    return i


async def execute(db, i: PaymentIntent, method: str = "upi"):
    tour = await db.get(Tour, i.tour_id)
    st = await get_state(db)
    result = {}
    if i.kind == "booking":
        result = await book_tour(db, tour, i.action.get("pay", "deposit"), method, record_payment=False)
    elif i.kind == "change":
        if i.action.get("type") == "option":
            ev = await db.get(ChangeEvent, int(i.action["change_id"]))
            result = await resolve_event(db, ev, "accept", i.action["option"], "traveler")
        else:
            rows = {r.id: r for r in await load_items(db, tour.id)}
            result = await apply_changes(db, tour, rows, i.action["changes"], st, "traveler", i.summary.get("title", "Change"))
        if i.refund > 0:
            last = (await db.execute(select(Payment).where(Payment.tour_id == tour.id, Payment.kind == "payment")
                                     .order_by(Payment.created_at.desc()))).scalars().first()
            db.add(Payment(tour_id=tour.id, amount=i.refund, kind="refund", method=last.method if last else method,
                           note=f"Refund · {i.summary.get('title', 'change')}"))
            audit(db, tour.id, "system", "refund_issued", {"amount": i.refund, "to": "original payment method"}, intent_id=i.public_id)
    await db.flush()
    tickets = await sync_tickets(db, tour)
    i.status, i.result = "executed", {k: v for k, v in (result or {}).items() if k in ("refs", "paid", "total", "booked", "fees")} | {
        "tickets_issued": tickets["issued"], "tickets_voided": tickets["voided"]}
    if i.kind == "booking":
        i.result["paid"] = i.amount
    audit(db, tour.id, "system", "executed", {"kind": i.kind, "title": i.summary.get("title"), **tickets}, intent_id=i.public_id)


# ---------------------------------------------------------------- tickets
def _sig(code: str, item_id: int) -> str:
    return hmac.new(ticket_secret(), f"{code}|{item_id}".encode(), hashlib.sha256).hexdigest()[:32]


async def sync_tickets(db, tour: Tour) -> dict:
    """Issue a ticket for every confirmed booking that lacks one; void tickets whose booking was replaced or cancelled."""
    rows = await load_items(db, tour.id)
    tickets = list((await db.execute(select(Ticket).where(Ticket.tour_id == tour.id))).scalars())
    valid = {t.item_id: t for t in tickets if t.status == "valid"}
    issued = voided = 0
    for r in rows:
        bookable = r.kind in ("activity", "hotel", "transport") and r.booking_ref and r.status in ("booked", "disrupted")
        if bookable and r.id not in valid:
            code = "TKT-" + secrets.token_hex(4).upper()
            db.add(Ticket(code=code, tour_id=tour.id, item_id=r.id, signature=_sig(code, r.id)))
            issued += 1
        elif not bookable and r.id in valid:
            t = valid[r.id]
            t.status, t.voided_at = "void", _now()
            t.void_reason = "Booking replaced" if r.status == "replaced" else "Booking cancelled"
            voided += 1
    if issued or voided:
        await db.flush()
    return {"issued": issued, "voided": voided}


def qr_payload(t: Ticket) -> str:
    return f"TOURCRAFT:{t.code}:{t.signature}"


async def verify_ticket(db, payload: str) -> dict:
    try:
        _, code, sig = payload.strip().split(":")
    except ValueError:
        return {"valid": False, "reason": "Not a TourCraft ticket"}
    t = (await db.execute(select(Ticket).where(Ticket.code == code))).scalars().first()
    if not t or not hmac.compare_digest(t.signature, sig) or not hmac.compare_digest(_sig(t.code, t.item_id), sig):
        return {"valid": False, "reason": "Signature doesn't match — possibly forged"}
    if t.status != "valid":
        return {"valid": False, "reason": f"Void: {t.void_reason}", "code": t.code}
    return {"valid": True, "code": t.code, "item_id": t.item_id, "tour_id": t.tour_id}
