"""Group-aware insights on top of the ML models: per-person fit (with reasons), smart tags with advice
("overcrowded — skip it, go here instead"), the "considered but not added" list, fairness summary, feedback logging."""


from . import planner as P
from .ml import infer as ML
from .ml.features import row
from .ml.priors import MONTH_HEAT
from .models import Feedback

WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _brief(members):
    return [{k: m.get(k) for k in ("name", "age", "band", "fit", "veto", "reasons", "positive")} for m in members]


# ---------------------------------------------------------------- tags
def tags_for(o, ctx, day, start, fit, members, items=None, item=None, crowd=None) -> list:
    """Smart tags with a comment and, where useful, a one-tap action (swap / retime)."""
    out = []
    d = P.day_date(ctx, day) if day else ctx["start_date"]
    rain = P.rain_on(ctx, o["dest_key"], day) if day else False
    c = crowd if crowd is not None else ML.crowd(o["place"], d, start / 60 + o["duration_min"] / 120, rain)
    curve = [h for h in ML.crowd_curve(o["place"], d, rain) if P.hm(o["open"]) <= h["hour"] * 60 and h["hour"] * 60 + o["duration_min"] <= P.hm(o["close"])]
    quiet = min(curve, key=lambda h: h["crowd"]) if curve else None
    ages = [m["age"] for m in members]
    outdoor = o["indoor_outdoor"] != "indoor"

    if c >= 68:
        comment = f"Around {P.label(start)} it's about {c}% busy."
        action = None
        alts = []
        if items is not None and item is not None:
            alts = [a for a in P.activity_alternatives(items, item, ctx, limit=8)
                    if a["crowd"] <= c - 25 and a["fit"] >= fit - 5 and (set(a["offering"]["tags"]) & set(o["tags"]) or a["offering"].get("category") == o.get("category"))]
        if alts:
            a = alts[0]
            comment += f" Skip it — {a['offering']['title']} is only {a['crowd']}% busy then and suits your group ({a['fit']}% fit)."
            action = {"type": "swap", "offering_id": a["offering"]["id"], "title": a["offering"]["title"], "label": f"Go to {a['offering']['title']} instead"}
        elif quiet and quiet["crowd"] <= c - 20:
            comment += f" Much quieter around {P.label(quiet['hour'] * 60)} ({quiet['crowd']}%)."
            if item is not None and item.get("id"):
                action = {"type": "retime", "start_min": quiet["hour"] * 60, "label": f"Move to {P.label(quiet['hour'] * 60)}"}
        out.append({"key": "crowded", "label": "Overcrowded", "tone": "red", "comment": comment, "action": action})
    if outdoor and day and 12 * 60 <= start <= 16 * 60 and MONTH_HEAT.get(d.month, 0.3) >= 0.5 and any(a <= 7 or a >= 60 for a in ages):
        who = ", ".join(f"{m['name']} ({m['age']})" for m in members if m["age"] <= 7 or m["age"] >= 60)
        out.append({"key": "heat", "label": "Midday heat", "tone": "amber", "comment": f"Hot and exposed at this hour — hard on {who}. Mornings are cooler.", "action": None})
    if o["rating"] >= 4.6 and (o.get("popularity") or 0) <= 0.05 and c <= 40:
        out.append({"key": "gem", "label": "Hidden gem", "tone": "green", "comment": f"Rated {o['rating']:.1f}★ by the few who find it, and rarely busy.", "action": None})
    if outdoor and quiet and quiet["hour"] <= 8 and o.get("category") in ("heritage", "viewpoint", "religious", "nature") and not any(t["key"] == "crowded" for t in out):
        out.append({"key": "sunrise", "label": "Best at sunrise", "tone": "blue", "comment": f"Emptiest and softest light around {P.label(quiet['hour'] * 60)}.", "action": None})
    kids = [m for m in members if m["age"] <= 12 and m.get("fit", 0) >= 72 and not m.get("veto")]
    if kids:
        out.append({"key": "kids", "label": "Kid favourite", "tone": "green", "comment": " & ".join(f"{m['name']} ({m['age']})" for m in kids) + " should love this.", "action": None})
    elders = [m for m in members if m["age"] >= 60 and m.get("fit", 0) >= 68 and not m.get("veto")]
    if elders and o.get("stairs", 1) <= 0.3 and o.get("seating", 0) >= 0.5:
        out.append({"key": "senior", "label": "Senior-friendly", "tone": "green", "comment": "Plenty of seating and few stairs.", "action": None})
    if o["price"] >= 1500 and fit < 60:
        out.append({"key": "pricey", "label": "Pricey for the fit", "tone": "amber",
                    "comment": f"{P.fmt_inr(o['price'])} per person for a {fit}% group fit — there are better-value picks nearby.", "action": None})
    if (o.get("popularity") or 0) >= 1.0 or o.get("capacity", 99) <= 12:
        out.append({"key": "book", "label": "Book ahead", "tone": "blue", "comment": "Sells out on busy days — booking early matters.", "action": None})
    return out[:3]


# ---------------------------------------------------------------- per item
def item_insight(tour, it, items, ctx) -> dict | None:
    if it["kind"] != "activity" or not P.live(it):
        return None
    o = P.off(it["offering_id"])
    if not o:
        return None
    who = P.item_members(it, ctx)
    ev = P.evaluate(o, ctx, it["day"], it["start_min"], who, reasons=True)
    return {"fit": ev["fit_eligible"], "crowd": ev["crowd"], "members": _brief(ev["members"]),
            "tags": tags_for(o, ctx, it["day"], it["start_min"], ev["fit_eligible"], ev["members"], items, it, ev["crowd"])}


# ---------------------------------------------------------------- considered but not added
def considered(tour, items, ctx, st, total, current_day=None) -> list:
    live_acts = [i for i in items if P.live(i) and i["kind"] == "activity"]
    in_plan = {i["offering_id"] for i in live_acts}
    first = max(1, current_day or 1)
    out = []
    for s in ctx["route"]:
        dest = s["dest"]
        days = [d for d in range(max(first, s["first_day"]), s["first_day"] + s["nights"] + 1)
                if d <= ctx["days"] and P.dest_for_day(ctx, d) == dest]
        if not days:
            continue
        planned = [i for i in live_acts if i["dest_key"] == dest and i["day"] in days and not (i.get("meta") or {}).get("split")]
        pfits = {i["id"]: P.evaluate(P.off(i["offering_id"]), ctx, i["day"], i["start_min"], P.item_members(i, ctx))["fit_eligible"] for i in planned}
        low = min(pfits.values()) if pfits else None
        cands = []
        for o in P.acts_in(dest):
            if o["id"] in in_plan:
                continue
            ev = P.evaluate(o, ctx, days[0])
            code, why, add_day, note = "fit", None, None, None
            if not o["available"]:
                code, why = "unavailable", "Closed or fully booked right now."
            elif ev["vetoed"]:
                v = ev["vetoed"][0]
                code, why = "access", f"Not for {v['name']} ({v['age']}) — {v['veto']}."
                ok = [m for m in ev["members"] if not m["veto"]]
                if ok and ev["fit_eligible"] >= 70:
                    note = "Works as a split track for " + ", ".join(m["name"] for m in ok) + "."
            elif all(P.day_date(ctx, d).weekday() in (o.get("closed_weekdays") or []) for d in days):
                code, why = "closed", f"Closed on {', '.join(sorted({WEEKDAY[P.day_date(ctx, d).weekday()] for d in days}))} — your day(s) here."
            else:
                add_day = next((d for d in days if not P.act_allowed(o, ctx, d) and P.free_slot(items, d, o, ctx)), None)
                extra = P.gross(o["price"] * ctx["travelers"])
                if ctx["budget"] and total + extra > ctx["budget"]:
                    code, why = "budget", f"Would take you {P.fmt_inr(total + extra - ctx['budget'])} over budget."
                elif low is not None and ev["fit_eligible"] < low:
                    code, why = "fit", f"Group fit {ev['fit_eligible']}% — below everything planned here (lowest {low}%)."
                elif not add_day:
                    code, why = "full", f"Your {len(days)} day(s) in {P.W['dests'][dest]['name']} are already full."
                else:
                    code, why = "room", f"Good fit ({ev['fit_eligible']}%) and there's room on day {add_day}."
            reps = sorted([{"item_id": i["id"], "title": i["title"], "day": i["day"], "fit": pfits[i["id"]], "gain": ev["fit_eligible"] - pfits[i["id"]]}
                           for i in planned if not ev["vetoed"]], key=lambda r: -r["gain"])
            cands.append({"offering": {k: o[k] for k in ("id", "title", "price", "duration_min", "rating", "rating_count", "indoor_outdoor", "tags", "category", "source")},
                          "fit": ev["fit_eligible"], "crowd": ev["crowd"], "members": _brief(ev["members"]), "reason_code": code, "reason": why,
                          "note": note, "add_day": add_day, "replace": reps[:4],
                          "tags": tags_for(o, ctx, days[0], ev["start"], ev["fit_eligible"], ev["members"], crowd=ev["crowd"])})
        cands.sort(key=lambda c: (c["reason_code"] in ("unavailable",), -c["fit"]))
        out.append({"dest": dest, "name": P.W["dests"][dest]["name"], "days": days, "candidates": cands})
    return out


# ---------------------------------------------------------------- group summary
def group_summary(items, ctx, insights: dict) -> dict:
    per = {m["name"]: {"name": m["name"], "age": m["age"], "fits": [], "highlights": []} for m in ctx["members"]}
    for i in items:
        ins = insights.get(i.get("id"))
        if not ins:
            continue
        for r in ins["members"]:
            if r["name"] in per and not r["veto"]:
                per[r["name"]]["fits"].append(r["fit"])
                if r["fit"] >= 82:
                    per[r["name"]]["highlights"].append(i["title"])
    rows = []
    for p in per.values():
        avg = round(sum(p["fits"]) / len(p["fits"])) if p["fits"] else 0
        rows.append({"name": p["name"], "age": p["age"], "band": ML.BAND_LABEL[ML.band_of(p["age"])] if hasattr(ML, "BAND_LABEL") else "",
                     "avg": avg, "count": len(p["fits"]), "highlights": p["highlights"][:3]})
    avgs = [r["avg"] for r in rows if r["count"]]
    return {"members": rows, "fairness": round(min(avgs) / max(avgs) * 100) if avgs and max(avgs) else 100,
            "moods": ctx.get("moods", [])}


def compute(tour, items, ctx, st, total, current_day=None) -> dict:
    per = {}
    for it in items:
        ins = item_insight(tour, it, items, ctx)
        if ins:
            per[it["id"]] = ins
    return {"items": per, "considered": considered(tour, items, ctx, st, total, current_day), "group": group_summary(items, ctx, per)}


# ---------------------------------------------------------------- feedback for retraining
def log_feedback(db, tour, ctx, offering_id: int, day: int, start_min: int, rating: float, signal: str, members=None):
    o = P.off(offering_id)
    if not o:
        return
    mc = P.ml_ctx(o, ctx, day, start_min)
    for m in members or ctx["members"]:
        if ML.veto(m, o["place"]):
            continue
        db.add(Feedback(tour_id=tour.id, offering_id=offering_id, member=m["name"], age=m["age"], rating=float(rating), signal=signal,
                        features=[float(x) for x in row(m, o["place"], mc)]))
