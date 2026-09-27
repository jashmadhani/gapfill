"use client";

import { useState } from "react";
import { ChevronDown, Clock, Plus, Star } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { Button, Card, Chip, Photo, cx } from "@/components/ui";
import { FitBadge, FitChips } from "@/components/group";
import type { ConsideredPlace } from "@/types";

const hours = (m: number) => (m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`);

function Candidate({ place, days, editable, busy, onAdd }: { place: ConsideredPlace; days: number; editable: boolean; busy: boolean; onAdd: (day: number) => void }) {
  const [first, ...more] = place.reasons;
  const excluded = place.verdict === "excluded";
  const [day, setDay] = useState(1);

  return (
    <li className="rounded-3xl bg-white p-3 shadow-soft ring-1 ring-stone-200/70">
      <div className="flex gap-3">
        <Photo src={place.imageUrl ?? undefined} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="h3-title text-ink">{place.name}</p>
            {place.rank != null && <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600">#{place.rank}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-stone-600">
            {place.durationMin ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden /> {hours(place.durationMin)}
              </span>
            ) : null}
            <span className="font-semibold text-ink">
              {place.price ? `${inr(place.price)} pp` : "Free entry"}
              {place.priceSource === "estimate" && <span className="ml-1 font-normal text-stone-500">(est.)</span>}
            </span>
            {place.rating ? (
              <span className="inline-flex items-center gap-0.5">
                <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden /> {place.rating.toFixed(1)}
              </span>
            ) : null}
            {place.distanceKm != null && <span>{place.distanceKm} km away</span>}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2 text-sm">
        <Chip tone={excluded ? "red" : "amber"} className="shrink-0">
          {excluded ? "Can't fit" : "Left out"}
        </Chip>
        <span className="text-stone-700">{first}</span>
      </div>
      {place.memberFits?.length ? (
        <div className="mt-2.5 space-y-2">
          {place.groupFit != null && !excluded && <FitBadge fit={place.groupFit} />}
          <FitChips members={place.memberFits} />
        </div>
      ) : null}
      {more.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-1 text-sm text-stone-600">
          {more.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      )}

      {editable && !excluded && days > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor={`day-${place.key}`}>
            Day to add to
          </label>
          <select
            id={`day-${place.key}`}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="min-h-11 rounded-full bg-stone-100 px-3 text-[15px] font-semibold text-ink"
          >
            {Array.from({ length: days }, (_, i) => (
              <option key={i} value={i + 1}>
                Day {i + 1}
              </option>
            ))}
          </select>
          <Button variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={() => onAdd(day)}>
            <Plus size={15} aria-hidden /> Add to plan
          </Button>
        </div>
      )}
    </li>
  );
}

/** "Left out, and why": every place the planner looked at and did not put in the itinerary, with its
 * price and plain-language reasons. Ported from the original app's "Considered, not added" section;
 * the data now lives on the plan document (PlanDocument.considered). */
export default function LeftOut({ tripId, places, days, editable, onChanged }: { tripId: string; places: ConsideredPlace[]; days: number; editable: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (places.length === 0) return null;

  const add = async (p: ConsideredPlace, day: number) => {
    setBusy(p.key);
    setError(null);
    try {
      await api.patch("/api/plan", { tripId, action: "add_considered", key: p.key, day });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that");
    } finally {
      setBusy(null);
    }
  };

  const nearMisses = places.filter((p) => p.verdict === "left_out").length;

  return (
    <section aria-labelledby="left-out-h" className="space-y-3">
      <div>
        <h2 id="left-out-h" className="h2-section text-ink">
          Left out, and why
        </h2>
        <p className="mt-1 text-[15px] text-stone-600">Everything else we looked at for your trip, what it costs, and why it didn&apos;t make the plan. Add any of it back.</p>
      </div>
      <Card className="overflow-hidden">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
          <span className="flex-1 font-bold text-ink">
            {nearMisses} near-miss{nearMisses === 1 ? "" : "es"}
            {places.length > nearMisses && <span className="font-normal text-stone-600"> · {places.length - nearMisses} that can&apos;t fit</span>}
          </span>
          <ChevronDown size={18} className={cx("shrink-0 text-stone-400 transition", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <ul className="space-y-2.5 bg-stone-50/60 p-3">
            {places.map((p) => (
              <Candidate key={p.key} place={p} days={days} editable={editable} busy={busy === p.key} onAdd={(d) => add(p, d)} />
            ))}
          </ul>
        )}
      </Card>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
