"""Dynamic tour management: detect the impact of a change (direct + downstream), generate 2-3 feasible recovery
options, score them on cost / time / convenience / preference fit, and apply the chosen one.

Triggers: weather, unavailable (activity/vendor), vendor_declined, transport_delay (or cancellation),
hotel_issue (overbooked), running_late, budget_change.
"""
import copy
from datetime import datetime, timedelta

from sqlalchemy import select

from . import planner as P
from .ml.priors import MOOD_LABEL as ML_MOOD_LABEL
from .models import ChangeEvent, ChatMessage, Offering, Tour, TourItem, Vendor
from .services import (add_task, cancel_fee, ctx_for, current_day, get_state, is_past, item_dict, item_start_dt, load_items,
                       new_row, retime_row, retire_row)

LABELS = {"mood_change": "Mood check-in", "weather": "Weather alert", "unavailable": "No longer available", "vendor_declined": "Vendor declined",
          "transport_delay": "Transport delay", "transport_cancel": "Transport cancelled", "hotel_issue": "Hotel overbooked",
          "running_late": "Running late", "budget_change": "Budget change"}
CAUSE = {"mood_change": "traveler", "weather": "weather", "unavailable": "vendor", "vendor_declined": "vendor", "transport_delay": "transport",
         "transport_cancel": "transport", "hotel_issue": "vendor", "running_late": "traveler", "budget_change": "traveler"}


# ---------------------------------------------------------------- simulation + scoring
def simulate(items, changes, tour, st, cause):
    sim = copy.deepcopy(items)
    by_id = {i["id"]: i for i in sim}
    fees = 0
    for c in changes:
        i = by_id.get(c.get("item_id"))
        if c["op"] in ("replace", "remove") and i:
            fees += cancel_fee(tour, i, st, cause)
            i["status"] = "replaced" if c["op"] == "replace" else "cancelled"
            if c["op"] == "replace":
                sim.append({**c["new"], "id": -len(sim), "status": "planned"})
        elif c["op"] == "retime" and i:
            i.update(day=c["day"], start_min=c["start_min"], end_min=c["end_min"])
        elif c["op"] == "add":
            sim.append({**c["new"], "id": -len(sim), "status": "planned"})
    if fees:
        sim.append({"id": -999, "day": 1, "kind": "fee", "price": fees, "status": "planned", "start_min": 0, "end_min": 0})
    return sim, fees


def pref_score(sim, ctx, days) -> int:
    """How well the resulting plan suits the whole group on the affected days: mean ML group fit of its activities."""
    acts = [i for i in sim if P.live(i) and i["kind"] == "activity" and i["day"] in days and P.off(i["offering_id"])]
    if not acts:
        return 35
    fits = [P.evaluate(P.off(a["offering_id"]), ctx, a["day"], a["start_min"], P.item_members(a, ctx))["fit_eligible"] for a in acts]
    return int(round(sum(fits) / len(fits)))


def movable(i) -> bool:
    return i["kind"] == "activity" and not (i.get("meta") or {}).get("split")


def fixed_blocks(items, day, exclude=()) -> list:
    """Rest breaks and split-track pairs stay where they are when a day is re-sequenced."""
    return [(i["start_min"], i["end_min"]) for i in items if P.live(i) and i["day"] == day and i["id"] not in exclude
            and (i["kind"] == "rest" or (i["kind"] == "activity" and (i.get("meta") or {}).get("split")))]


def finish_option(key, label, summary, changes, items, tour, st, ctx, cause, days, lost_min=0, details=None, extra=None):
    sim, fees = simulate(items, changes, tour, st, cause)
    before, after = P.price(items, ctx)["total"], P.price(sim, ctx)["total"]
    affected = len({c.get("item_id") for c in changes if c["op"] in ("replace", "remove", "retime") and c.get("item_id")})
    opt = {"key": key, "label": label, "summary": summary, "changes": changes, "cost_delta": round(after - before),
           "fees": fees, "lost_min": lost_min, "items_affected": affected, "pref_score": pref_score(sim, ctx, days),
           "details": details or [], "new_total": after}
    opt["convenience"] = max(0, 100 - affected * 12 - lost_min // 6)
    opt |= extra or {}
    return opt


def dedupe(options):
    seen, out = [], []
    for o in options:
        sig = sorted((c["op"], c.get("item_id"), c.get("start_min"), (c.get("new") or {}).get("offering_id")) for c in o["changes"])
        if sig in seen:
            continue
        seen.append(sig)
        out.append(o)
    for k, o in zip("ABC", out):
        o["key"] = k
    return out


def mark_recommended(options):
    options = dedupe(options)
    if not options:
        return options
    def val(o):
        return (o["pref_score"] + o["convenience"] * 0.6 - max(0, o["cost_delta"]) / 300 + max(0, -o["cost_delta"]) / 2000
                + (5 if o.get("operator_cost") else 0) - (60 if o.get("within_budget") is False else 0))
    best = max(options, key=val)
    for o in options:
        o["recommended"] = o is best
    return options


def upcoming(tour, items, st):
    return [i for i in items if P.live(i) and not is_past(tour, i, st)]


# ---------------------------------------------------------------- option builders
def keep_group(i, ctx):
    meta = i.get("meta") or {}
    if not meta.get("split"):
        return None, None
    return P.item_members(i, ctx), {k: meta[k] for k in ("split", "track", "partner", "meet") if k in meta}


def replace_change(i, alt, ctx):
    o = alt["offering"]
    who, meta = keep_group(i, ctx)
    return {"op": "replace", "item_id": i["id"], "new": P.activity_item(o, i["day"], alt["start_min"], ctx, who, meta),
            "text": f"{i['title']} → {o['title']} ({P.label(alt['start_min'])})"}


def resequence(work, i, ctx, tour, st, indoor, taken, rank=0):
    """No alternative fits the exact slot: re-pack the rest of that day (not-yet-started activities) around a replacement."""
    day = i["day"]
    now = P.hm(st.demo_time) if tour and current_day(tour, st) == day else 0
    start, end = P.day_window(ctx, day, work)
    start = max(start, now + 20)
    others = [x for x in work if P.live(x) and movable(x) and x["day"] == day and x["id"] != i["id"] and x["start_min"] >= now]
    fixed = [(x["start_min"], x["end_min"]) for x in work if P.live(x) and x["day"] == day and x["kind"] in ("activity", "transport", "rest")
             and x["id"] != i["id"] and x not in others]
    used = {x["offering_id"] for x in work if P.live(x) and x["kind"] == "activity"}
    cands = [o for o in P.acts_in(i["dest_key"]) if o["id"] not in used and o["id"] not in taken and not P.act_allowed(o, ctx, day)
             and not (indoor and o["indoor_outdoor"] == "outdoor")]
    cands.sort(key=lambda o: -P.act_score(o, ctx, day))
    found = 0
    for c in cands[:12]:
        packed = P.pack([P.off(x["offering_id"]) for x in others] + [c], start, end, P.day_anchor(ctx, day, work), fixed=fixed)
        if not packed:
            continue
        if found < rank:
            found += 1
            continue
        by_off = {x["offering_id"]: x for x in others}
        changes, details = [], []
        for o, s_, e_ in packed:
            if o["id"] == c["id"]:
                who, meta = keep_group(i, ctx)
                changes.append({"op": "replace", "item_id": i["id"], "new": P.activity_item(c, day, s_, ctx, who, meta),
                                "text": f"{i['title']} → {c['title']} ({P.label(s_)})"})
                details.append(changes[-1]["text"])
            elif s_ != by_off[o["id"]]["start_min"]:
                x = by_off[o["id"]]
                changes.append({"op": "retime", "item_id": x["id"], "day": day, "start_min": s_, "end_min": e_})
                details.append(f"{x['title']}: {P.label(x['start_min'])} → {P.label(s_)} to make room")
        return c, changes, details
    return None


def activity_swap(items, affected, ctx, rank=0, indoor=False, tour=None, st=None):
    """Replace each affected activity (same slot if possible, otherwise re-sequence its day). Every item changes at most
    once, and the experiences being replaced can't come back as someone else's replacement."""
    pairs, lost, taken = [], 0, {i["offering_id"] for i in affected}
    work = copy.deepcopy(items)
    for i in affected:
        cur = next(w for w in work if w["id"] == i["id"])
        if not P.live(cur):
            continue
        alts = [a for a in P.activity_alternatives(work, cur, ctx, limit=6, indoor_only=indoor, exclude=taken)]
        if len(alts) > rank:
            a = alts[rank]
            c = replace_change(cur, a, ctx)
            taken.add(a["offering"]["id"])
            pairs.append((c, c["text"]))
            cur["status"] = "replaced"
            work.append({**c["new"], "id": -len(work), "status": "planned"})
        elif st is not None and (r := resequence(work, cur, ctx, tour, st, indoor, taken, rank)):
            c, cs, ds = r
            taken.add(c["id"])
            pairs += list(zip(cs, ds))
            for ch in cs:
                w = next(w for w in work if w["id"] == ch["item_id"])
                if ch["op"] == "replace":
                    w["status"] = "replaced"
                    work.append({**ch["new"], "id": -len(work), "status": "planned"})
                else:
                    w.update(start_min=ch["start_min"], end_min=ch["end_min"])
        else:
            pairs.append(({"op": "remove", "item_id": i["id"]}, f"Drop {i['title']}, nothing suitable fits that day"))
            cur["status"] = "cancelled"
            lost += i["end_min"] - i["start_min"]
    gone = {c["item_id"] for c, _ in pairs if c["op"] in ("replace", "remove")}
    pairs = [(c, d) for c, d in pairs if not (c["op"] == "retime" and c["item_id"] in gone)]
    return [c for c, _ in pairs], [d for _, d in pairs], lost


def move_to_other_day(items, affected, ctx, tour, st, avoid_rain=True):
    changes, details, lost = [], [], 0
    work = copy.deepcopy(items)
    cur = current_day(tour, st) or 1
    for i in affected:
        o = P.off(i["offering_id"])
        placed = False
        dest_days = [d for d in range(max(cur, 1), ctx["days"] + 1) if d != i["day"] and P.dest_for_day(ctx, d) == i["dest_key"]
                     and not (avoid_rain and P.rain_on(ctx, i["dest_key"], d)) and not P.act_allowed(o, ctx, d)]
        for d in dest_days:
            others = [w for w in work if w["id"] != i["id"]]
            slot = P.free_slot(others, d, o, ctx)
            if slot:
                changes.append({"op": "retime", "item_id": i["id"], "day": d, "start_min": slot[0], "end_min": slot[1]})
                details.append(f"Move {i['title']} → day {d}, {P.label(slot[0])}")
                for w in work:
                    if w["id"] == i["id"]:
                        w.update(day=d, start_min=slot[0], end_min=slot[1])
                placed = True
                break
        if not placed:
            changes.append({"op": "remove", "item_id": i["id"]})
            details.append(f"Drop {i['title']}, no free slot on another day in {P.W['dests'][i['dest_key']]['name']}")
            lost += i["end_min"] - i["start_min"]
    return changes, details, lost


def repack_after(items, day_acts, start, ctx, end_extra=60):
    """Re-sequence a day's remaining activities from `start`, dropping the lowest-value ones until it fits."""
    _, end = P.day_window(ctx, day_acts[0]["day"], [i for i in items if i["kind"] != "transport"]) if day_acts else (0, 0)
    end = end + end_extra
    keep, best = [], []
    fixed = fixed_blocks(items, day_acts[0]["day"]) if day_acts else []
    for i in sorted(day_acts, key=lambda i: -P.act_score(P.off(i["offering_id"]), ctx)):
        trial = P.pack([P.off(x["offering_id"]) for x in keep + [i]], start, end, P.day_anchor(ctx, day_acts[0]["day"], items), fixed=fixed)
        if trial:
            keep.append(i)
            best = trial
    by_off = {i["offering_id"]: i for i in keep}
    return [(by_off[o["id"]], st, en) for o, st, en in best], [i for i in day_acts if i not in keep]


def shift_changes(packed, dropped):
    changes, details, lost = [], [], 0
    for i, st, en in packed:
        if st != i["start_min"]:
            changes.append({"op": "retime", "item_id": i["id"], "day": i["day"], "start_min": st, "end_min": en})
            details.append(f"{i['title']}: {P.label(i['start_min'])} → {P.label(st)}")
    for i in dropped:
        changes.append({"op": "remove", "item_id": i["id"]})
        details.append(f"Drop {i['title']}, no longer fits the day")
        lost += i["end_min"] - i["start_min"]
    return changes, details, lost


# ---------------------------------------------------------------- per-trigger analysis
def analyse_activities(kind, tour, items, affected, ctx, st, reason):
    cause = CAUSE[kind]
    days = {i["day"] for i in affected}
    rain = kind == "weather"
    direct = [{"item_id": i["id"], "title": i["title"], "when": f"Day {i['day']} · {P.label(i['start_min'])}",
               "why": "Outdoors during forecast rain" if rain else "Provider can't run it"} for i in affected]
    downstream = []
    for i in affected:
        after = [x for x in items if P.live(x) and x["day"] == i["day"] and x["kind"] == "activity" and x["start_min"] > i["end_min"]
                 and x["id"] not in {a["id"] for a in affected}]
        if after:
            downstream.append({"item_id": after[0]["id"], "title": after[0]["title"], "when": f"Day {after[0]['day']} · {P.label(after[0]['start_min'])}",
                               "why": "Keeps its time, replacement is fitted into the same window"})
    opts = []
    c, d, lost = activity_swap(items, affected, ctx, 0, indoor=rain, tour=tour, st=st)
    opts.append(finish_option("A", "Indoor swap" if rain else "Best replacement", "Replace with the best-fitting alternative in the same time window.",
                              c, items, tour, st, ctx, cause, days, lost, d))
    if rain:
        c, d, lost = move_to_other_day(items, affected, ctx, tour, st)
        if any(x["op"] == "retime" for x in c):
                opts.append(finish_option("B", "Move to a dry day", "Keep the same experience, reschedule it to a day without rain.", c, items, tour, st, ctx, cause, days, lost, d))
    else:
        c, d, lost = activity_swap(items, affected, ctx, 1, tour=tour, st=st)
        if c != opts[0]["changes"]:
            opts.append(finish_option("B", "Alternative pick", "Second-best option for the same window.", c, items, tour, st, ctx, cause, days, lost, d))
    lost = sum(i["end_min"] - i["start_min"] for i in affected)
    opts.append(finish_option("C", "Leave it free", "Cancel with a full refund and keep the time open.",
                              [{"op": "remove", "item_id": i["id"]} for i in affected], items, tour, st, ctx, cause, days, lost,
                              [f"Cancel {i['title']}, full refund (disruption cover)" for i in affected]))
    return {"direct": direct, "downstream": downstream}, opts


def analyse_transport(kind, tour, items, t, ctx, st, minutes):
    cause = "transport"
    cancelled = kind == "transport_cancel"
    new_arr = t["end_min"] + (minutes or 0)
    day_acts = sorted([i for i in items if P.live(i) and movable(i) and i["day"] == t["day"] and i["start_min"] >= t["start_min"]],
                      key=lambda i: i["start_min"])
    hotel = next((i for i in items if P.live(i) and i["kind"] == "hotel" and i["day"] == t["day"]), None)
    hit = [i for i in day_acts if i["start_min"] < new_arr + 45] if not cancelled else day_acts
    direct = [{"item_id": t["id"], "title": t["title"], "when": f"Day {t['day']} · {P.label(t['start_min'])}",
               "why": "Cancelled by the operator" if cancelled else f"Now arrives {P.label(new_arr)} ({minutes} min late)"}]
    downstream = [{"item_id": i["id"], "title": i["title"], "when": P.label(i["start_min"]), "why": "Starts before you'd arrive"} for i in hit]
    if hotel:
        downstream.append({"item_id": hotel["id"], "title": hotel["title"], "when": "Check-in", "why": "Late check-in, hotel must hold the room"})
    notify = [{"op": "notify", "item_id": hotel["id"], "text": f"Late arrival ~{P.label(new_arr + 30)}, please hold the room"}] if hotel else []
    days = {t["day"]}
    opts = []
    if not cancelled:
        packed, dropped = repack_after(items, day_acts, new_arr + 45, ctx)
        c, d, lost = shift_changes(packed, dropped)
        c = [{"op": "retime", "item_id": t["id"], "day": t["day"], "start_min": t["start_min"] + minutes, "end_min": new_arr}] + c + notify
        opts.append(finish_option("A", "Wait it out & re-sequence", f"Stay on this {t['meta'].get('mode', 'service')}; the rest of the day is re-timed around the new arrival.",
                                  c, items, tour, st, ctx, cause, days, lost, [f"Arrive {P.label(new_arr)}"] + d))
    depart = max(t["start_min"], P.hm(st.demo_time) + 45 if current_day(tour, st) == t["day"] else t["start_min"])
    for m in ("car", "train", "flight"):
        if m == t["meta"].get("mode"):
            continue
        q = P.transport_quote(m, t["from_key"], t["dest_key"], ctx, depart)
        if not q or (not cancelled and q["arrive"] >= new_arr):
            continue
        new = P.transport_item(q, t["day"], t["from_key"], t["dest_key"], t["meta"].get("phase", "between"))
        packed, dropped = repack_after(items, day_acts, q["arrive"] + 45, ctx)
        c, d, lost = shift_changes(packed, dropped)
        c = [{"op": "replace", "item_id": t["id"], "new": new, "text": new["title"]}] + c + notify
        opts.append(finish_option("B" if len(opts) < 2 else "C", f"Switch to {m}", f"Rebook as {q['title'].split(' by ')[-1] if m != 'flight' else 'a flight'}, arrives {P.label(q['arrive'])}.",
                                  c, items, tour, st, ctx, cause, days, lost, [f"{new['title']} · departs {P.label(q['depart'])}, arrives {P.label(q['arrive'])}"] + d))
    if not cancelled and hit and len(opts) < 3:
        c, d, lost = move_to_other_day(items, hit, ctx, tour, st)
        c = [{"op": "retime", "item_id": t["id"], "day": t["day"], "start_min": t["start_min"] + minutes, "end_min": new_arr}] + c + notify
        opts.append(finish_option("C", "Move missed activities", "Keep the transport and move whatever you'd miss to another day here.",
                                  c, items, tour, st, ctx, cause, days | {x["day"] for x in items}, lost, d))
    for k, o in zip("ABC", opts):
        o["key"] = k
    return {"direct": direct, "downstream": downstream}, opts


def analyse_hotel(tour, items, h, ctx, st):
    cur = P.TIERS.index(h["meta"].get("tier", "standard"))
    alts = [a for a in P.hotel_alternatives(h, ctx)]
    same = sorted([a for a in alts if a["offering"]["tier"] == P.TIERS[cur]], key=lambda a: -a["score"])
    up = [a for a in alts if P.TIERS.index(a["offering"]["tier"]) == cur + 1]
    down = [a for a in alts if P.TIERS.index(a["offering"]["tier"]) == cur - 1]
    direct = [{"item_id": h["id"], "title": h["title"], "when": f"Day {h['day']} · {h['nights']} night(s)", "why": "Hotel overbooked, room not available"}]
    downstream = [{"item_id": None, "title": "Airport/station pickups", "when": "", "why": "Driver drop-off address changes"}]
    opts = []

    def mk(key, label, summary, a, keep_price=False):
        o = a["offering"]
        new = P.hotel_item(o, h["day"], h["nights"], ctx, h["start_min"])
        extra = {}
        if keep_price:
            extra = {"operator_cost": new["price"] - h["price"]}
            new["price"], new["unit_price"] = h["price"], h["unit_price"]
            new["meta"] = {**new["meta"], "comp_upgrade": True}
        c = [{"op": "replace", "item_id": h["id"], "new": new, "text": f"{h['title']} → {o['title']}"}]
        return finish_option(key, label, summary, c, items, tour, st, ctx, "vendor", {h["day"]}, 0,
                             [f"{o['title']} · {o['tier']} · {o['rating']:.1f}★"], extra)
    if up:
        opts.append(mk("A", "Free upgrade", f"Operator covers the difference, {up[0]['offering']['title']}.", up[0], keep_price=True))
    if same:
        opts.append(mk("B", "Similar hotel", "Same category, nearby.", same[0]))
    if down:
        opts.append(mk("C", "Save money", "One category lower, difference refunded.", down[0]))
    for k, o in zip("ABC", opts):
        o["key"] = k
    return {"direct": direct, "downstream": downstream}, opts


def analyse_late(tour, items, ctx, st, minutes):
    d = current_day(tour, st)
    now = P.hm(st.demo_time)
    if not d:
        return None, []
    acts = sorted([i for i in items if P.live(i) and movable(i) and i["day"] == d and i["start_min"] >= now], key=lambda i: i["start_min"])
    hit = [i for i in acts if i["start_min"] < now + minutes + 15]
    if not hit:
        return None, []
    direct = [{"item_id": i["id"], "title": i["title"], "when": P.label(i["start_min"]), "why": f"You'd arrive ~{minutes} min late"} for i in hit]
    downstream = [{"item_id": i["id"], "title": i["title"], "when": P.label(i["start_min"]), "why": "May shift later"} for i in acts if i not in hit]
    opts = []
    packed, dropped = repack_after(items, acts, now + minutes, ctx)
    c, det, lost = shift_changes(packed, dropped)
    opts.append(finish_option("A", "Shift the day", "Push everything back; drop only what no longer fits.", c, items, tour, st, ctx, "traveler", {d}, lost, det))
    c = [{"op": "remove", "item_id": i["id"]} for i in hit]
    opts.append(finish_option("B", "Skip & stay on time", "Skip what you'd be late for, keep the rest as planned.", c, items, tour, st, ctx, "traveler", {d},
                              sum(i["end_min"] - i["start_min"] for i in hit), [f"Skip {i['title']}" for i in hit]))
    c, det, lost = move_to_other_day(items, hit, ctx, tour, st, avoid_rain=False)
    opts.append(finish_option("C", "Do it another day", "Move what you'd miss to a later day in this city.", c, items, tour, st, ctx, "traveler",
                              set(range(1, ctx["days"] + 1)), lost, det))
    return {"direct": direct, "downstream": downstream}, opts


def analyse_mood(tour, items, ctx, st, moods):
    """Re-score the rest of today (or tomorrow, late in the day) under the new mood with the ML model and offer changes."""
    d = current_day(tour, st) or 1
    now = P.hm(st.demo_time) if current_day(tour, st) else 0
    new = {**ctx, "moods": moods, "_fit": {}, "_weights": {}}
    left_today = [i for i in items if P.live(i) and movable(i) and i["day"] == d and i["start_min"] >= now]
    days = [d] if now < 17 * 60 and left_today else [min(ctx["days"], d + 1)]  # nothing left today -> adapt tomorrow
    acts = [i for i in items if P.live(i) and movable(i) and i["day"] in days and (i["day"] > d or i["start_min"] >= now)]
    if not acts:
        return None, []
    rows = []
    for i in acts:
        o = P.off(i["offering_id"])
        before = P.evaluate(o, ctx, i["day"], i["start_min"])["fit_eligible"]
        after = P.evaluate(o, new, i["day"], i["start_min"])["fit_eligible"]
        rows.append((i, before, after))
    worse = [(i, b, a) for i, b, a in rows if a < 62 or a <= b - 6]
    names = ", ".join(ML_MOOD_LABEL.get(m, m).lower() for m in moods) or "neutral"
    direct = [{"item_id": i["id"], "title": i["title"], "when": f"Day {i['day']} · {P.label(i['start_min'])}",
               "why": f"Fit {b}% → {a}% for a {names} group"} for i, b, a in worse]
    downstream = [{"item_id": i["id"], "title": i["title"], "when": P.label(i["start_min"]), "why": f"Still a good fit ({a}%)"} for i, b, a in rows if (i, b, a) not in worse]
    opts = []
    target = [i for i, _, _ in worse]
    if target:
        c, det, lost = activity_swap(items, target, new, 0, indoor="hot" in moods, tour=tour, st=st)
        if any(x["op"] == "replace" for x in c):
            opts.append(finish_option("A", "Tune the day to the mood", "Swap what no longer suits how everyone feels for the best-fitting alternatives.",
                                      c + [{"op": "prefs", "fields": {"mood": moods}}], items, tour, st, new, "traveler", set(days), lost, det))
    if set(moods) & {"tired", "relaxed", "hot", "restless_kids"}:
        hardest = max(acts, key=lambda i: (P.off(i["offering_id"]).get("intensity", 2), -[a for x, _, a in rows if x is i][0]))
        c = [{"op": "remove", "item_id": hardest["id"]}]
        det = [f"Skip {hardest['title']} (the most demanding thing left)"]
        day = hardest["day"]
        if not any(i["kind"] == "rest" and P.live(i) and i["day"] == day for i in items):
            rest = P.rest_item(day, hardest["dest_key"], "Mood check-in: time to recharge")
            if not any(13 * 60 + 30 < i["end_min"] and 15 * 60 > i["start_min"] for i in items if P.live(i) and i["day"] == day and i["id"] != hardest["id"]
                       and i["kind"] in ("activity", "transport")):
                c.append({"op": "add", "new": rest})
                det.append("Add a rest break 1:30–3:00 PM")
        opts.append(finish_option("B", "Make it a lighter day", "Drop the most tiring stop and build in a proper break.",
                                  c + [{"op": "prefs", "fields": {"mood": moods}}], items, tour, st, new, "traveler", set(days),
                                  hardest["end_min"] - hardest["start_min"], det))
    if set(moods) & {"energetic", "adventurous", "foodie", "cultural"}:
        dest = P.dest_for_day(new, days[0])
        used = {i["offering_id"] for i in items if P.live(i) and i["kind"] == "activity"}
        cands = sorted([o for o in P.acts_in(dest) if o["id"] not in used and not P.act_allowed(o, new, days[0])],
                       key=lambda o: -P.act_score(o, new, days[0]))
        for o in cands[:6]:
            slot = P.free_slot(items, days[0], o, new)
            if slot and (days[0] > d or slot[0] >= now + 30):
                it = P.activity_item(o, days[0], slot[0], new)
                opts.append(finish_option("C", f"Add {o['title']}", "Use the extra energy: the best mood-matched experience that fits a free slot.",
                                          [{"op": "add", "new": it}, {"op": "prefs", "fields": {"mood": moods}}], items, tour, st, new, "traveler",
                                          set(days), 0, [f"Add {o['title']} at {P.label(slot[0])}"]))
                break
    return {"direct": direct, "downstream": downstream}, opts


def analyse_budget(tour, items, ctx, st, new_budget):
    ctx2 = {**ctx, "budget": new_budget}
    now = datetime.combine(st.demo_date, datetime.min.time()) + timedelta(minutes=P.hm(st.demo_time))
    frozen = {i["id"] for i in items if i["kind"] == "fee" or item_start_dt(tour, i) <= now}
    before = P.price(items, ctx2)
    if before["within_budget"]:
        return None, []
    direct = [{"item_id": None, "title": "Tour total", "when": P.fmt_inr(before["total"]), "why": f"{P.fmt_inr(before['over_by'])} over the new {P.fmt_inr(new_budget)} budget"}]
    opts = []
    for key, label, kinds, summary in (("A", "Downgrade stays", ("hotel", "transport"), "Keep every experience; cheaper hotels and transfers."),
                                       ("B", "Trim experiences", ("activity",), "Keep hotels; drop the lowest-value activities."),
                                       ("C", "Balanced", ("transport", "hotel", "activity"), "Lowest-impact savings across everything.")):
        target, opt = new_budget, None
        for _ in range(4):  # cancellation fees eat into savings, so aim lower until the real total fits
            work = copy.deepcopy(items)
            notes = P.optimise(work, {**ctx2, "budget": target}, frozen=frozen, kinds=kinds)
            orig = {i["id"]: i for i in items}
            changes = []
            for w in work:
                o = orig.get(w.get("id"))
                if not o:
                    continue
                if w["status"] == "cancelled" and o["status"] != "cancelled":
                    changes.append({"op": "remove", "item_id": o["id"]})
                elif w["offering_id"] != o["offering_id"] or w["price"] != o["price"]:
                    changes.append({"op": "replace", "item_id": o["id"], "new": {k: w[k] for k in w if k not in ("id", "status", "booking_ref", "vendor_status", "created_at", "rating", "tour_id")},
                                    "text": f"{o['title']} → {w['title']}"})
            if not changes:
                break
            changes.append({"op": "prefs", "fields": {"budget": new_budget}})
            lost = sum(orig[c["item_id"]]["end_min"] - orig[c["item_id"]]["start_min"] for c in changes if c["op"] == "remove")
            opt = finish_option(key, label, summary, changes, items, tour, st, ctx2, "traveler", set(range(1, ctx["days"] + 1)), lost,
                                [n for n in notes if not n.startswith(("Now", "Still"))])
            opt["within_budget"] = opt["new_total"] <= new_budget
            if opt["within_budget"]:
                break
            target -= opt["new_total"] - new_budget + 500
        if opt:
            opts.append(opt)
    return {"direct": direct, "downstream": []}, opts


# ---------------------------------------------------------------- create + apply
async def create_event(db, tour, kind, reason, impact, options, source="system"):
    if not options:
        return None
    rows = {r.id: r for r in await load_items(db, tour.id)}
    prev = {}
    for d in impact["direct"]:
        r = rows.get(d.get("item_id"))
        if r and r.status in ("booked", "planned"):
            prev[r.id] = r.status
            if tour.status == "booked":
                r.status = "disrupted"
    impact["prev_status"] = prev
    # supersede an older pending card about the same items
    olds = (await db.execute(select(ChangeEvent).where(ChangeEvent.tour_id == tour.id, ChangeEvent.status == "pending"))).scalars().all()
    for o in olds:
        if o.trigger_type == kind or set(map(str, prev)) & set(map(str, o.impact.get("prev_status", {}))):
            o.status, o.resolved_by, o.resolved_at = "dismissed", "superseded", datetime.utcnow()
            for k, v in o.impact.get("prev_status", {}).items():
                if int(k) not in prev and (r := rows.get(int(k))) and r.status == "disrupted":
                    r.status = v
    ev = ChangeEvent(tour_id=tour.id, trigger_type=kind, label=LABELS.get(kind, kind), reason=reason, impact=impact,
                     options=mark_recommended(options), source=source)
    db.add(ev)
    await db.flush()
    await add_task(db, "notify", f"{tour.code}: {LABELS.get(kind, kind)}, {reason[:120]}", tour.id, None, tour.coordinator_id)
    return ev


async def run_trigger(db, body: dict, active_tour_id: int | None) -> tuple[list, str | None]:
    """Returns (events, note)."""
    st = await get_state(db)
    kind = body["trigger_type"]
    events, note = [], None

    async def tours_booked():
        return list((await db.execute(select(Tour).where(Tour.status == "booked"))).scalars())

    if kind == "weather":
        dest, day_date = body.get("dest"), body.get("date") or st.demo_date.isoformat()
        rain = [r for r in (st.rain or []) if not (r["dest"] == dest and r["date"] == day_date)]
        if body.get("clear"):
            st.rain = rain
            return [], f"Clear skies in {P.W['dests'][dest]['name']}"
        st.rain = rain + [{"dest": dest, "date": day_date}]
        await db.flush()
        for tour in await tours_booked():
            items = [item_dict(r) for r in await load_items(db, tour.id)]
            ctx = ctx_for(tour, st)
            hit = [i for i in upcoming(tour, items, st) if i["kind"] == "activity" and i["dest_key"] == dest
                   and (tour.start_date.toordinal() + i["day"] - 1) == datetime.fromisoformat(day_date).toordinal()
                   and (P.off(i["offering_id"]) or {}).get("indoor_outdoor") == "outdoor"]
            if not hit:
                continue
            reason = (f"Heavy rain is forecast in {P.W['dests'][dest]['name']} on day {hit[0]['day']}. "
                      f"{len(hit)} outdoor experience{'s are' if len(hit) > 1 else ' is'} affected: {', '.join(i['title'] for i in hit)}.")
            impact, opts = analyse_activities("weather", tour, items, hit, ctx, st, reason)
            if ev := await create_event(db, tour, "weather", reason, impact, opts):
                events.append(ev)
        return events, None if events else f"Rain set for {P.W['dests'][dest]['name']}, no booked outdoor plans affected."

    if kind in ("unavailable", "vendor_declined"):
        affected_by_tour: dict[int, list] = {}
        if body.get("item_id"):
            r = await db.get(TourItem, body["item_id"])
            if kind == "vendor_declined":
                r.vendor_status = "declined"
            else:
                o = await db.get(Offering, r.offering_id)
                o.status = "full"
            affected_by_tour[r.tour_id] = [r.id]
        else:
            if body.get("offering_id"):
                o = await db.get(Offering, body["offering_id"])
                o.status = "closed"
                match = lambda i: i["offering_id"] == o.id  # noqa: E731
                who = o.title
            else:
                v = await db.get(Vendor, body["vendor_id"])
                v.status = "closed"
                match = lambda i: i["vendor_id"] == v.id  # noqa: E731
                who = v.name
            await db.flush()
            await P.load_world(db)
            for tour in await tours_booked():
                items = [item_dict(r) for r in await load_items(db, tour.id)]
                ids = [i["id"] for i in upcoming(tour, items, st) if i["kind"] != "fee" and match(i)]
                if ids:
                    affected_by_tour[tour.id] = ids
            if not affected_by_tour:
                note = f"{who} marked unavailable, no upcoming bookings affected."
        await db.flush()
        await P.load_world(db)
        for tid, ids in affected_by_tour.items():
            tour = await db.get(Tour, tid)
            items = [item_dict(r) for r in await load_items(db, tid)]
            ctx = ctx_for(tour, st)
            hit = [i for i in items if i["id"] in ids]
            for h in [i for i in hit if i["kind"] == "hotel"]:
                reason = f"{h['title']} can no longer honour your {h['nights']}-night stay from day {h['day']}."
                impact, opts = analyse_hotel(tour, items, h, ctx, st)
                if ev := await create_event(db, tour, "hotel_issue", reason, impact, opts, "vendor"):
                    events.append(ev)
            for t in [i for i in hit if i["kind"] == "transport"]:
                reason = f"{t['title']} on day {t['day']} is cancelled by the provider."
                impact, opts = analyse_transport("transport_cancel", tour, items, t, ctx, st, 0)
                if ev := await create_event(db, tour, "transport_cancel", reason, impact, opts, "vendor"):
                    events.append(ev)
            acts = [i for i in hit if i["kind"] == "activity"]
            if acts:
                verb = "declined the booking for" if kind == "vendor_declined" else "can no longer run"
                reason = f"{acts[0]['vendor_name'] if acts[0].get('vendor_name') else P.W['vendors'][acts[0]['vendor_id']]['name']} {verb} {', '.join(i['title'] for i in acts)} (day {acts[0]['day']}, {P.label(acts[0]['start_min'])})."
                impact, opts = analyse_activities(kind, tour, items, acts, ctx, st, reason)
                if ev := await create_event(db, tour, kind, reason, impact, opts, "vendor"):
                    events.append(ev)
        return events, note

    tour = await db.get(Tour, body.get("tour_id") or active_tour_id)
    if not tour:
        return [], "No active tour."
    items = [item_dict(r) for r in await load_items(db, tour.id)]
    ctx = ctx_for(tour, st)

    if kind in ("transport_delay", "transport_cancel"):
        cand = [i for i in upcoming(tour, items, st) if i["kind"] == "transport"]
        t = next((i for i in cand if i["id"] == body.get("item_id")), cand[0] if cand else None)
        if not t:
            return [], "No upcoming transport to delay."
        minutes = int(body.get("minutes") or 0)
        if kind == "transport_cancel":
            reason = f"Your {t['meta'].get('mode', 'transfer')} {t['from_name'] if t.get('from_name') else P.W['dests'][t['from_key']]['name']} → {P.W['dests'][t['dest_key']]['name']} on day {t['day']} has been cancelled."
        else:
            reason = (f"Your {t['meta'].get('mode', 'transfer')} to {P.W['dests'][t['dest_key']]['name']} (day {t['day']}) is running {minutes} min late, "
                      f"now arriving {P.label(t['end_min'] + minutes)} instead of {P.label(t['end_min'])}.")
        impact, opts = analyse_transport(kind, tour, items, t, ctx, st, minutes)
    elif kind == "hotel_issue":
        cand = [i for i in items if P.live(i) and i["kind"] == "hotel" and not is_past(tour, i, st)]
        h = next((i for i in cand if i["id"] == body.get("item_id")), cand[0] if cand else None)
        if not h:
            return [], "No upcoming hotel stay."
        reason = f"{h['title']} has overbooked and can't honour your {h['nights']}-night stay from day {h['day']}."
        impact, opts = analyse_hotel(tour, items, h, ctx, st)
    elif kind == "running_late":
        minutes = int(body.get("minutes") or 45)
        impact, opts = analyse_late(tour, items, ctx, st, minutes)
        if not impact:
            return [], "Nothing in the next stretch is affected, no changes needed."
        reason = f"You're running about {minutes} min late. {len(impact['direct'])} upcoming plan{'s' if len(impact['direct']) > 1 else ''} would be affected."
    elif kind == "mood_change":
        moods = [m for m in (body.get("moods") or []) if m in ML_MOOD_LABEL]
        tour.prefs = {**tour.prefs, "mood": moods, "mood_text": body.get("text") or ""}
        impact, opts = analyse_mood(tour, items, ctx, st, moods)
        label = ", ".join(ML_MOOD_LABEL[m].lower() for m in moods) or "neutral"
        if not impact or not opts:
            return [], f"Noted, everyone's feeling {label}. Today's plan already suits that."
        reason = f"Everyone's feeling {label}. {len(impact['direct']) or 'None'} of the upcoming plans fit less well now, here's how to adapt."
    elif kind == "budget_change":
        nb = float(body.get("new_budget") or 0)
        impact, opts = analyse_budget(tour, items, ctx, st, nb)
        if not impact:
            tour.prefs = {**tour.prefs, "budget": nb}
            return [], f"Budget set to {P.fmt_inr(nb)}, your plan already fits."
        reason = f"New budget {P.fmt_inr(nb)}, the tour is currently {P.fmt_inr(P.price(items, ctx)['total'])}. Here are three ways to fit it."
    else:
        return [], f"Unknown trigger {kind}"
    ev = await create_event(db, tour, kind, reason, impact, opts, body.get("source", "system"))
    return ([ev] if ev else []), None if ev else "No feasible alternatives found."


async def resolve_event(db, ev: ChangeEvent, action: str, option_key: str | None, by: str):
    st = await get_state(db)
    tour = await db.get(Tour, ev.tour_id)
    rows = {r.id: r for r in await load_items(db, tour.id)}
    prev = {int(k): v for k, v in (ev.impact or {}).get("prev_status", {}).items()}
    for k, v in prev.items():
        if rows.get(k) and rows[k].status == "disrupted":
            rows[k].status = v
    out = {"booked": [], "fees": 0}
    if action == "accept":
        opt = next((o for o in ev.options if o["key"] == (option_key or next((x["key"] for x in ev.options if x.get("recommended")), "A"))), None)
        if not opt:
            raise ValueError("Unknown option")
        cause = CAUSE.get(ev.trigger_type, "traveler")
        booked = tour.status == "booked"
        for c in opt["changes"]:
            r = rows.get(c.get("item_id"))
            if c["op"] == "replace" and r:
                out["fees"] += await retire_row(db, tour, r, st, cause, "replaced", ev.label)
                nr = await new_row(db, tour, c["new"], booked)
                out["booked"].append({"title": nr.title, "ref": nr.booking_ref})
            elif c["op"] == "remove" and r:
                out["fees"] += await retire_row(db, tour, r, st, cause, "cancelled", ev.label)
            elif c["op"] == "retime" and r:
                await retime_row(db, tour, r, c["day"], c["start_min"], c["end_min"], ev.label)
            elif c["op"] == "add":
                nr = await new_row(db, tour, c["new"], booked)
                if nr.booking_ref:
                    out["booked"].append({"title": nr.title, "ref": nr.booking_ref})
            elif c["op"] == "notify" and r:
                await add_task(db, "notify", f"{r.booking_ref or ''} {r.title}: {c['text']}", tour.id, r.vendor_id, tour.coordinator_id)
            elif c["op"] == "prefs":
                tour.prefs = {**tour.prefs, **c["fields"]}
        if opt.get("operator_cost"):
            await add_task(db, "payment", f"{tour.code}: operator absorbs {P.fmt_inr(opt['operator_cost'])} for comp upgrade", tour.id, None, tour.coordinator_id)
        ev.chosen = opt["key"]
        db.add(ChatMessage(tour_id=tour.id, role="assistant",
                           text=f"✅ {ev.label}: applied “{opt['label']}”. " + "; ".join(opt["details"][:3])
                           + (f" · Total change {'+' if opt['cost_delta'] > 0 else ''}{P.fmt_inr(opt['cost_delta'])}." if opt["cost_delta"] else "")))
    ev.status = "accepted" if action == "accept" else "dismissed"
    ev.resolved_by, ev.resolved_at = by, datetime.utcnow()
    return out
