"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, CircleAlert, Lightbulb, Plus, TriangleAlert, Users, Wallet } from "lucide-react";
import { api, fmtDate, inr } from "@/lib/api-client";
import { PageBody, PageHero } from "@/components/page";
import { Bar, Button, Card, Empty, Photo, Spinner, cx } from "@/components/ui";
import FloatingChat from "@/components/plan/floating-chat";
import DayTimeline from "@/components/day-timeline";
import RouteMap from "@/components/route-map";
import LeftOut from "@/components/plan/left-out";
import { GroupFairness } from "@/components/group";
import type { PlanDocument, Trip } from "@/types";

interface PlanResponse {
  trips: { id: string; title: string; status: string; startDate: string; coverImageUrl?: string }[];
  trip: Trip | null;
  plan: PlanDocument | null;
}

export default function PlanDetail({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PlanResponse | null>(null);

  const load = () => {
    api.get<PlanResponse>(`/api/plan?tripId=${tripId}`).then(setData);
  };
  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const remove = async (itemId: string) => {
    if (!data?.trip) return;
    if (!confirm("Remove this from the plan?")) return;
    await api.patch("/api/plan", { tripId: data.trip._id, itemId, action: "remove" });
    load();
  };

  if (!data) return <PageBody><Spinner /></PageBody>;

  const { trip, plan } = data;
  if (!trip || trip._id !== tripId) {
    return (
      <div className="px-5 pt-8">
        <Empty title="Trip not found" action={<Link href="/plan?tab=plan"><Button>Back to planning</Button></Link>}>
          It may have started already - ongoing trips live on the Trip tab.
        </Empty>
      </div>
    );
  }

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
            <Link href="/plan?tab=plan" className="shrink-0 rounded-full bg-rani-50 px-4 py-2 text-sm font-semibold text-rani-700">
              <Plus size={14} className="mr-1 inline" /> New
            </Link>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10 [&>*]:min-w-0">
          <section className="space-y-5 lg:sticky lg:top-24">
            {plan && plan.days.length > 0 && (
              <RouteMap
                days={plan.days}
                hotel={plan.hotel}
                considered={plan.considered}
                dayLabels={plan.days.map((_, i) => fmtDate(new Date(new Date(trip.startDate).getTime() + i * 86400000).toISOString(), { weekday: "short", day: "numeric" }))}
              />
            )}
            <GroupFairness summary={plan?.fitSummary} />
            {plan?.hotel && (
              <Card className="flex items-center gap-4 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white">
                  <BedDouble size={22} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-500">Where you&apos;re staying</span>
                  <span className="block truncate text-lg font-bold text-ink">{plan.hotel.name}</span>
                  {plan.hotel.address && <span className="block truncate text-sm text-stone-600">{plan.hotel.address}</span>}
                </span>
              </Card>
            )}
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
            {plan && plan.considered.length > 0 && (
              <LeftOut tripId={trip._id} places={plan.considered} days={plan.days.length} editable={draft || trip.status === "upcoming"} onChanged={load} />
            )}
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
      <FloatingChat tripId={trip._id} tripTitle={trip.title} />
    </div>
  );
}
