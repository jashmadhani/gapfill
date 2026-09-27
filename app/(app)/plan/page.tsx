"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CircleAlert, Lightbulb, Plus, TriangleAlert, Users, Wallet } from "lucide-react";
import { api, fmtDate, inr } from "@/lib/api-client";
import { PageBody, PageHero } from "@/components/page";
import { Bar, Button, Card, Empty, Photo, Sheet, Spinner, cx } from "@/components/ui";
import DayTimeline from "@/components/day-timeline";
import type { PlanDocument, Trip } from "@/types";

interface PlanResponse {
  trips: { id: string; title: string; status: string; startDate: string; coverImageUrl?: string }[];
  trip: Trip | null;
  plan: PlanDocument | null;
}

function NewTripSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState(50000);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!destination || !startDate || !endDate) return;
    setBusy(true);
    try {
      const r = await api.post<{ trip: Trip }>("/api/plan", {
        title: title || `${destination} trip`,
        destination,
        startDate,
        endDate,
        groupType: "solo",
        adults: 1,
        children: 0,
        totalBudget: budget,
        themeTags: [],
      });
      onCreated(r.trip._id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Plan a new trip">
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trip name (optional)" className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[16px]" />
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[16px]" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[16px]" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[16px]" />
        </div>
        <label className="block text-sm font-semibold text-stone-600">
          Budget: {inr(budget)}
          <input type="range" min={10000} max={300000} step={5000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-2 w-full accent-rani-600" />
        </label>
        <Button className="w-full" disabled={busy || !destination || !startDate || !endDate} onClick={submit}>
          {busy ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </Sheet>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<PageBody><Spinner /></PageBody>}>
      <PlanPageInner />
    </Suspense>
  );
}

function PlanPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = () => {
    const tripId = params.get("tripId");
    api.get<PlanResponse>(`/api/plan${tripId ? `?tripId=${tripId}` : ""}`).then(setData);
  };
  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onSeed = async () => {
    await api.post("/api/seed");
    load();
  };

  const remove = async (itemId: string) => {
    if (!data?.trip) return;
    if (!confirm("Remove this from the plan?")) return;
    await api.patch("/api/plan", { tripId: data.trip._id, itemId, action: "remove" });
    load();
  };

  if (!data) return <PageBody><Spinner /></PageBody>;

  if (data.trips.length === 0) {
    return (
      <div className="px-5 pt-8">
        <Empty title="No trips being planned" action={<Button onClick={onSeed}>Try a demo trip</Button>}>
          Start a new draft, or explore Discover to find something to build a trip around.
        </Empty>
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            <Plus size={16} /> Plan a new trip
          </Button>
        </div>
        <NewTripSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onCreated={(id) => router.push(`/plan?tripId=${id}`)} />
      </div>
    );
  }

  const { trip, plan } = data;
  if (!trip) return null;

  const draft = trip.status === "planning";
  const errors = (plan?.conflicts ?? []).filter((c) => c.level === "error");

  return (
    <div>
      <PageHero size="md" img={trip.coverImageUrl} eyebrow={`${draft ? "Draft plan" : "Booked"} · ${trip.code}`} title={trip.title}>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="glass-dark inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-white">
            <CalendarDays size={16} aria-hidden /> {fmtDate(trip.startDate)} to {fmtDate(trip.endDate)}
          </span>
          <span className="glass-dark inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-white">
            <Users size={16} aria-hidden /> {trip.group.adults + trip.group.children} travelers
          </span>
        </div>
      </PageHero>
      <PageBody>
        {data.trips.length > 1 && (
          <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
            {data.trips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(`/plan?tripId=${t.id}`)}
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", t.id === trip._id ? "bg-ink text-white" : "bg-white text-stone-700 ring-1 ring-stone-200")}
              >
                {t.title}
              </button>
            ))}
            <button type="button" onClick={() => setSheetOpen(true)} className="shrink-0 rounded-full bg-rani-50 px-4 py-2 text-sm font-semibold text-rani-700">
              <Plus size={14} className="mr-1 inline" /> New
            </button>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10 [&>*]:min-w-0">
          <section className="space-y-5 lg:sticky lg:top-24">
            {trip.route.length > 0 && (
              <div className="overflow-hidden rounded-[2rem] bg-white p-3 shadow-soft">
                <ol className="no-scrollbar flex gap-2 overflow-x-auto">
                  {trip.route.map((r, idx) => (
                    <li key={r.areaId} className="shrink-0 rounded-3xl bg-stone-50 p-1.5 pr-4">
                      <span className="flex items-center gap-3">
                        <Photo src={undefined} scrim={false} className="h-12 w-12 rounded-2xl" />
                        <span>
                          <span className="block font-bold">
                            {idx + 1}. {r.name}
                          </span>
                          <span className="block text-sm text-stone-600">
                            {r.nights} night{r.nights > 1 ? "s" : ""} · {fmtDate(r.fromDate)}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base">
                  <Wallet size={16} className="text-rani-600" />
                  <span>
                    <b>{inr(trip.totalSpent)}</b> of <b>{inr(trip.totalBudget)}</b>
                  </span>
                </div>
              </div>
              {trip.totalBudget > 0 && <Bar value={trip.totalSpent} max={trip.totalBudget} tone={trip.totalSpent <= trip.totalBudget ? "green" : "red"} className="mt-2" />}
              <div className="mt-1.5 flex justify-between text-xs text-stone-500">
                <span>incl. taxes</span>
                <span className={trip.totalSpent <= trip.totalBudget ? "text-emerald-600" : "text-red-600"}>
                  {trip.totalSpent <= trip.totalBudget ? `${inr(trip.totalBudget - trip.totalSpent)} under budget` : `${inr(trip.totalSpent - trip.totalBudget)} over`}
                </span>
              </div>
            </Card>

            {plan && plan.notes.length > 0 && (
              <Card className="bg-amber-50/60 p-3 ring-amber-200">
                <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-amber-800">
                  <Lightbulb size={14} /> How we planned this
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-900">
                  {plan.notes.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              </Card>
            )}

            {plan && plan.conflicts.length > 0 && (
              <Card className="space-y-1.5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Checks</div>
                {plan.conflicts.map((c, i) => (
                  <div key={i} className={cx("flex items-start gap-1.5 text-xs", c.level === "error" ? "text-red-700" : "text-amber-700")}>
                    {c.level === "error" ? <CircleAlert size={14} className="shrink-0" /> : <TriangleAlert size={14} className="shrink-0" />} {c.text}
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="mt-6 space-y-5 lg:mt-0">
            <div className="flex items-center justify-between pt-1">
              <h2 className="h2-section text-ink">Day by day</h2>
              <Link href="/discover" className="text-sm font-semibold text-rani-600">
                Add from Discover
              </Link>
            </div>
            <div className="space-y-5">
              {(plan?.days ?? []).map((cards, i) => (
                <DayTimeline
                  key={i}
                  title={`Day ${i + 1}`}
                  dateLabel={fmtDate(new Date(new Date(trip.startDate).getTime() + i * 86400000).toISOString(), { weekday: "long", day: "numeric", month: "short" })}
                  cards={cards}
                  editable={draft || trip.status === "upcoming"}
                  onRemove={remove}
                />
              ))}
              {(!plan || plan.days.length === 0) && <Empty title="Nothing planned yet">Add experiences from Discover to fill in your days.</Empty>}
            </div>
          </section>
        </div>
      </PageBody>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mt-4 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-5 pb-3 pt-4 lg:bottom-0 lg:mx-auto lg:max-w-md lg:bg-none">
        {draft ? (
          <Button className="w-full" disabled={errors.length > 0}>
            {errors.length ? `Fix ${errors.length} issue${errors.length > 1 ? "s" : ""} to book` : `Ready to book · ${inr(trip.totalBudget)}`}
          </Button>
        ) : (
          <Link href="/trip">
            <Button className="w-full">Open my trip</Button>
          </Link>
        )}
      </div>
      <NewTripSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onCreated={(id) => router.push(`/plan?tripId=${id}`)} />
    </div>
  );
}
