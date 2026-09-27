"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Bar, Card, cx } from "@/components/ui";
import type { FitSummary, MemberFit } from "@/types";

type Tone = "green" | "amber" | "red" | "stone";

export const fitTone = (f: number): Tone => (f >= 75 ? "green" : f >= 55 ? "amber" : "red");

const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  stone: "bg-stone-100 text-stone-600 ring-stone-200",
};

const initials = (n: string) =>
  (n || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Avatar({ name, age, tone = "stone", size = "h-8 w-8" }: { name: string; age?: number; tone?: Tone; size?: string }) {
  const bg: Record<Tone, string> = { green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-900", red: "bg-red-100 text-red-700", stone: "bg-rani-100 text-rani-700" };
  return (
    <span className={cx("relative grid shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ring-white", size, bg[tone])} title={age != null ? `${name}, ${age}` : name}>
      {initials(name)}
    </span>
  );
}

export function FitBadge({ fit, label = "group fit", className }: { fit: number; label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1", TONE[fitTone(fit)], className)}>
      {fit}% <span className="font-medium">{label}</span>
    </span>
  );
}

/** One pill per traveller: predicted fit from the model, or a safety veto. Tap "Why" to see the reasons. */
export function FitChips({ members, className }: { members?: MemberFit[] | null; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!members?.length) return null;
  const why = members.some((m) => m.veto || m.reasons?.length || m.positive);
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {members.map((m) => (
          <span key={m.name} className={cx("inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-semibold ring-1", m.veto ? TONE.stone : TONE[fitTone(m.fit)])}>
            <Avatar name={m.name} age={m.age} tone={m.veto ? "stone" : fitTone(m.fit)} size="h-5 w-5 text-xs" />
            {m.name} {m.age} · {m.veto ? "not for them" : `${m.fit}%`}
            {m.fit >= 85 && !m.veto ? " ★" : ""}
          </span>
        ))}
        {why && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-full px-2 text-sm font-semibold text-rani-600 hover:underline"
          >
            Why <ChevronDown size={13} className={cx("transition", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-2 space-y-1 rounded-2xl bg-sand-50 p-2.5 text-sm text-stone-600">
          {members.map((m) => (
            <li key={m.name}>
              <b className="text-stone-800">
                {m.name} ({m.age}, {m.band?.toLowerCase()})
              </b>
              :{" "}
              {m.veto ? (
                <span className="text-red-700">{m.veto}</span>
              ) : (
                [m.positive, ...(m.reasons || []).map((r) => `held back by ${r}`)].filter(Boolean).join("; ") || "good all-round fit"
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** How the whole plan works for each person (fairness across the trip). */
export function GroupFairness({ summary }: { summary?: FitSummary | null }) {
  if (!summary?.members?.length) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="h3-title text-ink">Works for everyone?</h2>
          <p className="text-sm text-stone-600">Predicted enjoyment per person across the trip · ML model</p>
        </div>
        <FitBadge fit={summary.fairness} label="fairness" className="shrink-0" />
      </div>
      <ul className="mt-3 space-y-2.5">
        {summary.members.map((m) => (
          <li key={m.name} className="flex items-center gap-2.5">
            <Avatar name={m.name} age={m.age} tone={fitTone(m.avg)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[15px]">
                <span className="truncate font-semibold">
                  {m.name}{" "}
                  <span className="font-normal text-stone-600">
                    {m.age} · {m.band}
                    {m.stepFree ? " · step-free" : ""}
                  </span>
                </span>
                <span className="shrink-0 font-bold">{m.avg}%</span>
              </div>
              <Bar value={m.avg} max={100} tone={fitTone(m.avg)} className="mt-1" />
              {m.highlights.length > 0 && <div className="mt-0.5 truncate text-sm text-stone-600">★ {m.highlights.join(" · ")}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
