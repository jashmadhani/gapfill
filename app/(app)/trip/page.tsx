"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BellRing, Check, CalendarRange, Clock, IndianRupee, MessageCircle, Phone, Ticket } from "lucide-react";
import { api, fmtDate, inr } from "@/lib/api-client";
import { PageBody, PageHero } from "@/components/page";
import { Button, Card, Chip, Empty, Sheet, Spinner, cx } from "@/components/ui";
import DayTimeline from "@/components/day-timeline";
import RouteMap from "@/components/route-map";
import ApprovalCard, { type PaymentsData } from "@/components/plan/approval-card";
import PendingChanges, { type PendingChange } from "@/components/plan/pending-changes";
import type { TripStage } from "@/lib/trip-helpers";
import type { PlanDocument, Trip } from "@/types";

interface OtherTrip {
  id: string;
  title: string;
  status: string;
  startDate: string;
}

interface TripResponse {
  trip: Trip | null;
  plan: PlanDocument | null;
  stage: TripStage | null;
  role: "admin" | "member" | null;
  others: OtherTrip[];
}

function dayIndexFor(trip: Trip) {
  const start = new Date(trip.startDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.max(0, diff);
}

function dateLabelForDay(trip: Trip, dayIdx: number) {
  const d = new Date(trip.startDate);
  d.setDate(d.getDate() + dayIdx);
  return fmtDate(d.toISOString(), { weekday: "long", day: "numeric", month: "short" });
}

function Coordinator({ c }: { c: Trip["coordinator"] }) {
  if (!c) return null;
  return (
    <div className="flex items-center gap-4 rounded-[1.75rem] bg-white p-3 pr-4 shadow-soft">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-rani-50 font-display text-xl font-bold text-rani-700">
        {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-500">Your coordinator</span>
        <span className="block truncate text-lg font-bold text-ink">{c.name}</span>
        <span className="block truncate text-sm text-stone-600">{c.languages.join(" · ")}</span>
      </span>
      <a href={`tel:${c.phone}`} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-green-600 text-white" aria-label={`Call ${c.name}`}>
        <Phone size={22} />
      </a>
    </div>
  );
}

function Risks({ trip }: { trip: Trip }) {
  if (!trip.risks.length) return null;
  const tone: Record<string, string> = { high: "bg-red-50 ring-red-200 text-red-800", medium: "bg-amber-50 ring-amber-200 text-amber-900", low: "bg-sky-50 ring-sky-200 text-sky-900" };
  return (
    <div className="space-y-2">
      {trip.risks.map((r, i) => (
        <div key={i} className={cx("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1", tone[r.level])}>
          <BellRing size={16} className="mt-0.5 shrink-0" aria-hidden /> {r.text}
        </div>
      ))}
    </div>
  );
}

function Changes({ trip }: { trip: Trip }) {
  if (!trip.changes.length) return null;
  return (
    <details className="rounded-[1.75rem] bg-white p-4 shadow-soft">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-lg font-bold text-ink">
        Plan changes <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{trip.changes.length}</span>
      </summary>
      <ul className="mt-2 space-y-2">
        {trip.changes.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 text-[15px]">
            <span className="text-stone-700">
              <b className="text-ink">{c.label}</b> {c.status === "accepted" ? `· ${c.chosenLabel || "applied"}` : c.status === "pending" ? "· waiting for you" : "· kept original"}
            </span>
            <Chip tone={c.status === "accepted" ? "green" : c.status === "pending" ? "rani" : "stone"}>{c.status}</Chip>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Weather and running-late go through the real disruption engine (POST /api/disruptions): it scores every
 * affected stop with the ML fit model and prepares 2-3 options, shown below in <PendingChanges>. Only the trip
 * admin applies one - this button just reports the problem, anyone on the trip can do that. */
function ReportChange({ trip, day, onReported, onBudgetDone, isAdmin }: { trip: Trip; day: number; onReported: () => void; onBudgetDone: (note: string) => void; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "budget">("menu");
  const [budget, setBudget] = useState(trip.totalBudget);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setView("menu");
  };

  const report = async (type: "weather" | "running_late", extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await api.post("/api/disruptions", { tripId: trip._id, type, day, ...extra });
      onReported();
    } finally {
      setBusy(false);
      close();
    }
  };

  const applyBudget = async () => {
    setBusy(true);
    try {
      const r = await api.patch<{ note: string }>("/api/trip", { tripId: trip._id, action: "report_budget", newBudget: budget });
      onBudgetDone(r.note);
    } finally {
      setBusy(false);
      close();
    }
  };

  const opt = (Icon: typeof Clock, title: string, sub: string, onClick: () => void) => (
    <button type="button" onClick={onClick} disabled={busy} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left shadow-soft ring-1 ring-stone-200/70 transition hover:ring-stone-300 disabled:opacity-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rani-50 text-rani-600">
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-stone-500">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <BellRing size={16} aria-hidden /> Report a change
      </Button>
      <Sheet open={open} onClose={close} title={view === "budget" ? "New total budget" : "What changed?"}>
        {view === "menu" && (
          <div className="space-y-2">
            {opt(Clock, "Running late", "Scores today's stops and prepares options", () => report("running_late", { minutes: 45 }))}
            {opt(Clock, "It's raining", "Prepares indoor swaps for today", () => report("weather"))}
            {isAdmin && opt(IndianRupee, "Change my budget", "Update your trip total", () => setView("budget"))}
            {opt(MessageCircle, "Something else", "Tell the trip assistant", () => close())}
          </div>
        )}
        {view === "budget" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="font-display text-4xl">{inr(budget)}</div>
              <div className="text-sm text-stone-500">currently {inr(trip.totalBudget)}</div>
            </div>
            <input
              type="range"
              style={{ height: 44 }}
              min={Math.round(trip.totalBudget * 0.5)}
              max={Math.round(trip.totalBudget * 1.3)}
              step={1000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="New budget"
              className="w-full accent-rani-600"
            />
            <Button className="w-full" disabled={busy} onClick={applyBudget}>
              Apply budget
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function TripPageInner() {
  const router = useRouter();
  const tripId = useSearchParams().get("tripId");
  const [data, setData] = useState<TripResponse | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullTrip, setFullTrip] = useState(false);
  const [payments, setPayments] = useState<PaymentsData | null>(null);
  const [changes, setChanges] = useState<PendingChange[]>([]);

  const load = () => {
    api.get<TripResponse>(tripId ? `/api/trip?tripId=${tripId}` : "/api/trip").then((d) => {
      setData(d);
      if (d.trip) {
        api.get<PaymentsData>(`/api/payments?tripId=${d.trip._id}`).then(setPayments).catch(() => {});
        api.get<{ changes: PendingChange[] }>(`/api/disruptions?tripId=${d.trip._id}`).then((r) => setChanges(r.changes)).catch(() => {});
      }
    });
  };
  useEffect(() => {
    load();
    // The group's admin might apply a change or approve a payment from elsewhere while this is open.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const onSeed = async () => {
    setBusy(true);
    try {
      await api.post("/api/seed");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleChecklist = async (key: string) => {
    if (!data?.trip) return;
    await api.patch("/api/trip", { tripId: data.trip._id, action: "toggle_checklist", key });
    load();
  };

  const startTrip = async () => {
    if (!data?.trip) return;
    setBusy(true);
    try {
      await api.patch("/api/trip", { tripId: data.trip._id, action: "start_trip" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const today = useMemo(() => {
    if (!data?.trip || !data?.plan) return null;
    const idx = Math.min(dayIndexFor(data.trip), data.plan.days.length - 1);
    return { idx, cards: data.plan.days[idx] ?? [] };
  }, [data]);

  // The map's own day tabs used to drive only the map - the timeline/tickets below always stayed on
  // "today" regardless of which day tab was tapped, so switching to Day 2 showed Day 1's activities.
  // viewDay is the single source of truth for both now; it resets to "today" whenever the actual
  // current day changes (trip reload, or a different trip switched to).
  const [viewDay, setViewDay] = useState(0);
  useEffect(() => {
    if (today) setViewDay(today.idx);
  }, [today?.idx, data?.trip?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <PageBody><Spinner /></PageBody>;
  const { trip, plan, stage, role } = data;
  const isAdmin = role !== "member";

  if (!trip) {
    return (
      <div className="px-5 pt-8">
        {data.others.length > 0 && (
          <div className="no-scrollbar -mb-2 mb-6 flex gap-2 overflow-x-auto">
            {data.others.map((t) => (
              <button key={t.id} type="button" onClick={() => router.push(`/trip?tripId=${t.id}`)} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-700 ring-1 ring-stone-200">
                {t.title}
              </button>
            ))}
          </div>
        )}
        <Empty
          title="No trip yet"
          action={
            <Button onClick={onSeed} disabled={busy}>
              {busy ? "Setting up…" : "Try a demo trip"}
            </Button>
          }
        >
          Plan a trip to see your live trip hub here.
        </Empty>
      </div>
    );
  }

  const currentArea = trip.route[Math.min(dayIndexFor(trip), Math.max(0, trip.route.length - 1))]?.name || trip.destination;
  const title =
    stage === "operate" ? `Day ${(today?.idx ?? 0) + 1} in ${currentArea}` : stage === "prepare" ? "Get ready" : stage === "complete" ? "Welcome home" : "Not booked yet";

  return (
    <div>
      <PageHero size="md" img={trip.coverImageUrl} eyebrow={fmtDate(new Date().toISOString(), { weekday: "short", day: "numeric", month: "short" })} title={title} subtitle={trip.title} />
      <PageBody>
        {data.others.length > 1 && (
          <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
            {data.others.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(`/trip?tripId=${t.id}`)}
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", t.id === trip._id ? "bg-ink text-white" : "bg-white text-stone-700 ring-1 ring-stone-200")}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
        {note && (
          <div className="mb-4 rounded-2xl bg-rani-50 px-4 py-3 text-sm font-semibold text-rani-700">{note}</div>
        )}
        <section className="space-y-5">
          {stage === "plan" && (
            <Empty title="Your plan isn't booked yet" action={<Link href="/plan"><Button>Review your plan</Button></Link>}>
              Once booked, this becomes your live trip hub: checklist, alerts and replanning.
            </Empty>
          )}

          {stage === "prepare" && (
            <>
              <div className="rounded-[1.75rem] bg-ink p-5 text-white shadow-float">
                <p className="text-lg font-bold">Ready when you are</p>
                <p className="mt-1 text-[15px] text-white/80">
                  Your trip goes live on {fmtDate(trip.startDate, { day: "numeric", month: "short" })}: live day plan and instant replanning.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/plan" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 font-semibold text-white">
                    Preview day 1
                  </Link>
                  <button type="button" onClick={startTrip} disabled={busy} className="inline-flex min-h-12 items-center justify-center rounded-full bg-white font-bold text-ink">
                    {busy ? "Starting…" : "Start my trip"}
                  </button>
                </div>
              </div>
              <Risks trip={trip} />
              <Card className="p-4">
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Pre-trip checklist</p>
                <ul className="space-y-2">
                  {trip.checklist.map((c) => (
                    <li key={c.key}>
                      <button type="button" onClick={() => toggleChecklist(c.key)} disabled={c.auto} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-sand-50 px-4 text-left">
                        <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg", c.done ? "bg-green-600 text-white" : "ring-2 ring-stone-300")}>{c.done && <Check size={16} />}</span>
                        <span className={cx("text-[15px] font-semibold", c.done ? "text-stone-500" : "text-ink")}>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-500">Balance due</span>
                  <span className="block text-lg font-bold text-ink">{inr(trip.payments.balance)}</span>
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-rani-50 text-rani-600">
                  <Ticket size={22} aria-hidden />
                </span>
              </Card>
              {payments && <ApprovalCard data={payments} onChanged={load} />}
              <PendingChanges tripId={trip._id} changes={changes} isAdmin={isAdmin} onChanged={load} showReportButtons={false} />
              <Coordinator c={trip.coordinator} />
              <Changes trip={trip} />
            </>
          )}

          {stage === "operate" && today && (
            <>
              <Risks trip={trip} />
              <button
                type="button"
                onClick={() => setFullTrip((v) => !v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-stone-700 shadow-soft ring-1 ring-stone-200/70 hover:text-ink"
              >
                <CalendarRange size={16} aria-hidden />
                {fullTrip ? "Show today only" : "Show full trip"}
              </button>

              {plan && plan.days.length > 0 && (
                <RouteMap key={plan.planId} days={plan.days} hotel={plan.hotel} considered={plan.considered} day={viewDay} onDayChange={setViewDay} />
              )}

              {fullTrip ? (
                <div className="space-y-5">
                  {(plan?.days ?? []).map((cards, i) => (
                    <DayTimeline
                      key={i}
                      title={`Day ${i + 1}`}
                      dateLabel={dateLabelForDay(trip, i)}
                      cards={cards}
                      editable={i >= today.idx}
                      now={new Date()}
                      risks={trip.risks}
                    />
                  ))}
                </div>
              ) : (
                <DayTimeline
                  title={`Day ${viewDay + 1}`}
                  dateLabel={dateLabelForDay(trip, viewDay)}
                  cards={plan?.days[viewDay] ?? []}
                  editable={viewDay >= today.idx}
                  now={new Date()}
                  risks={viewDay === today.idx ? trip.risks : []}
                />
              )}

              {payments && <ApprovalCard data={payments} onChanged={load} />}
              <PendingChanges tripId={trip._id} changes={changes} isAdmin={isAdmin} onChanged={load} showReportButtons={false} />
              <ReportChange trip={trip} day={viewDay + 1} isAdmin={isAdmin} onReported={load} onBudgetDone={(n) => { setNote(n); load(); }} />
              <Coordinator c={trip.coordinator} />
              <Changes trip={trip} />
              {!fullTrip && plan && plan.days[today.idx + 1] && (
                <Link href="/plan" className="flex items-center gap-4 rounded-[1.75rem] bg-white p-4 shadow-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-stone-500">Tomorrow</span>
                    <span className="block truncate text-lg font-bold text-ink">{plan.days[today.idx + 1].length} plans</span>
                  </span>
                </Link>
              )}
            </>
          )}

          {stage === "complete" && (
            <Card className="p-5 text-center">
              <h2 className="font-semibold">
                {Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000) + 1} days · {trip.route.length} stops
              </h2>
              <p className="mt-1 text-sm text-stone-500">Hope it was a great trip.</p>
              <Link href="/plan" className="inline-block">
                <Button className="mt-3 w-full">Plan your next trip</Button>
              </Link>
            </Card>
          )}
        </section>
      </PageBody>
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={<PageBody><Spinner /></PageBody>}>
      <TripPageInner />
    </Suspense>
  );
}
