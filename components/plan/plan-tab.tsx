"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, Sparkles, X } from "lucide-react";
import { api, fmtDate } from "@/lib/api-client";
import { PageBody, SectionHead } from "@/components/page";
import { Button, Card, INTEREST, Segmented, Spinner, TOP_INTERESTS, cx } from "@/components/ui";
import type { ChatMessage, GroupType } from "@/types";

const inputClass = "min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-[16px] text-ink placeholder:text-stone-400 outline-none focus:border-rani-500 focus:ring-2 focus:ring-rani-100";

const GROUPS: { value: GroupType; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "large_group", label: "Group" },
];

interface Traveller {
  name: string;
  age: number;
  stepFree: boolean;
}

// Sensible starting travellers per group type; the traveller can rename and change every one.
const DEFAULT_TRAVELLERS: Record<GroupType, Traveller[]> = {
  solo: [{ name: "You", age: 32, stepFree: false }],
  couple: [{ name: "You", age: 32, stepFree: false }, { name: "Partner", age: 31, stepFree: false }],
  family: [{ name: "Parent 1", age: 38, stepFree: false }, { name: "Parent 2", age: 36, stepFree: false }, { name: "Child", age: 9, stepFree: false }],
  large_group: [28, 31, 34, 37, 40].map((age, i) => ({ name: `Traveller ${i + 1}`, age, stepFree: false })),
};

interface TripChip {
  id: string;
  title: string;
  status: string;
  startDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function PlanTab({ initialDestination }: { initialDestination: string }) {
  const router = useRouter();
  const [destination, setDestination] = useState(initialDestination);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState(40000);
  const [group, setGroup] = useState<GroupType>("solo");
  const [travellers, setTravellers] = useState<Traveller[]>(DEFAULT_TRAVELLERS.solo);
  const pickGroup = (g: GroupType) => {
    setGroup(g);
    setTravellers(DEFAULT_TRAVELLERS[g]);
  };
  const setTraveller = (i: number, patch: Partial<Traveller>) => setTravellers((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const [tags, setTags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripChip[]>([]);

  const [aiSession, setAiSession] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ trips: TripChip[] }>("/api/plan").then((r) => setTrips(r.trips)).catch(() => {});
  }, []);

  useEffect(() => {
    aiEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [aiMessages, aiBusy]);

  const toggleTag = (k: string) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const canSubmit = destination.trim() && startDate && endDate && endDate >= startDate && !generating;

  const submitForm = async () => {
    if (!canSubmit) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await api.post<{ tripId: string }>("/api/plan/generate", {
        destination: destination.trim(),
        startDate,
        endDate,
        budget,
        groupType: group,
        themeTags: tags,
        members: travellers.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), age: Math.max(0, Math.min(110, Math.round(t.age) || 0)), stepFree: t.stepFree })),
      });
      router.push(`/plan?tripId=${r.tripId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate a plan");
      setGenerating(false);
    }
  };

  const sendAi = async () => {
    const t = aiText.trim();
    if (!t || aiBusy) return;
    setAiText("");
    setAiMessages((m) => [...m, { role: "user", content: t, createdAt: new Date().toISOString() }]);
    setAiBusy(true);
    try {
      let id = aiSession;
      if (!id) {
        const created = await api.post<{ id: string }>("/api/chat/sessions", { tag: "plan" });
        id = created.id;
        setAiSession(id);
      }
      const r = await api.post<{ messages: ChatMessage[]; planTripId: string | null }>(`/api/chat/sessions/${id}/messages`, { text: t });
      setAiMessages(r.messages);
      if (r.planTripId) setTimeout(() => router.push(`/plan?tripId=${r.planTripId}`), 900);
    } catch (e) {
      setAiMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", createdAt: new Date().toISOString() }]);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      <PageBody width="narrow">
        <div className="space-y-6 pb-24">
          {trips.length > 0 && (
            <section>
              <SectionHead title="Your planned trips" />
              <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {trips.map((t) => (
                  <li key={t.id} className="shrink-0">
                    <Link href={`/plan?tripId=${t.id}`} className="block rounded-2xl bg-white px-4 py-2.5 shadow-soft ring-1 ring-stone-200/70">
                      <span className="block text-sm font-bold text-ink">{t.title}</span>
                      <span className="block text-xs text-stone-500">{fmtDate(t.startDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card className="space-y-4 p-5">
            <h2 className="h2-section text-ink">Plan a trip</h2>
            <div>
              <label htmlFor="dest" className="mb-1.5 block text-sm font-semibold text-stone-700">Destination</label>
              <input id="dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Where to?" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start" className="mb-1.5 block text-sm font-semibold text-stone-700">From</label>
                <input id="start" type="date" min={today()} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(e.target.value); }} className={inputClass} />
              </div>
              <div>
                <label htmlFor="end" className="mb-1.5 block text-sm font-semibold text-stone-700">To</label>
                <input id="end" type="date" min={startDate || today()} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="budget" className="mb-1.5 block text-sm font-semibold text-stone-700">Budget: Rs. {budget.toLocaleString("en-IN")}</label>
              <input id="budget" type="range" min={5000} max={300000} step={5000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ height: 44 }} className="w-full accent-rani-600" />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">Who&apos;s going</span>
              <Segmented options={GROUPS} value={group} onChange={pickGroup} />
              <p className="mt-2 text-sm text-stone-600">Ages and step-free needs shape which places suit each person, so the plan works for everyone.</p>
              <ul className="mt-3 space-y-2">
                {travellers.map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`tn-${i}`}>Name of traveller {i + 1}</label>
                    <input id={`tn-${i}`} value={t.name} onChange={(e) => setTraveller(i, { name: e.target.value })} placeholder="Name" maxLength={40} className={cx(inputClass, "min-w-0 flex-1")} />
                    <label className="sr-only" htmlFor={`ta-${i}`}>Age of {t.name || `traveller ${i + 1}`}</label>
                    <input id={`ta-${i}`} type="number" inputMode="numeric" min={0} max={110} value={Number.isFinite(t.age) ? t.age : ""} onChange={(e) => setTraveller(i, { age: Number(e.target.value) })} className={cx(inputClass, "w-20 shrink-0 text-center")} />
                    <button type="button" aria-pressed={t.stepFree} onClick={() => setTraveller(i, { stepFree: !t.stepFree })} title="Needs step-free access" className={cx("min-h-12 shrink-0 rounded-2xl px-3 text-sm font-semibold ring-1 transition", t.stepFree ? "bg-rani-600 text-white ring-rani-600" : "bg-white text-stone-700 ring-stone-200")}>
                      Step-free
                    </button>
                    {travellers.length > 1 && (
                      <button type="button" aria-label={`Remove ${t.name || `traveller ${i + 1}`}`} onClick={() => setTravellers((all) => all.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
                        <X size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {travellers.length < 8 && (
                <button type="button" onClick={() => setTravellers((t) => [...t, { name: `Traveller ${t.length + 1}`, age: 30, stepFree: false }])} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rani-600 hover:bg-rani-50">
                  <Plus size={16} aria-hidden /> Add a traveller
                </button>
              )}
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">What you love</span>
              <div className="flex flex-wrap gap-2">
                {TOP_INTERESTS.map((k) => {
                  const { label, Icon } = INTEREST[k];
                  const on = tags.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => toggleTag(k)} aria-pressed={on} className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition", on ? "bg-rani-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200")}>
                      <Icon size={15} aria-hidden /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            <Button className="w-full" disabled={!canSubmit} onClick={submitForm}>
              {generating ? "Building your itinerary..." : "Generate my plan"}
            </Button>
            {generating && <p className="text-center text-xs text-stone-500">This can take up to a minute while we pick places and lay out your days.</p>}
          </Card>
        </div>
      </PageBody>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-4">
        <div className="mx-auto max-w-2xl space-y-2">
          {aiMessages.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-[1.4rem] bg-white p-3 shadow-float ring-1 ring-stone-200/70">
              {aiMessages.map((m, i) => (
                <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cx("max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] leading-snug", m.role === "user" ? "rounded-br-md bg-rani-600 text-white" : "rounded-bl-md bg-stone-100 text-stone-800")}>{m.content}</div>
                </div>
              ))}
              {aiBusy && <Spinner label="Planning..." />}
              <div ref={aiEnd} />
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendAi();
            }}
            className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-float ring-1 ring-stone-200/70"
          >
            <Sparkles size={18} className="shrink-0 text-violet-500" aria-hidden />
            <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="plan with AI" aria-label="Plan with AI" className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none" />
            <button type="submit" disabled={aiBusy || !aiText.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rani-600 text-white disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
