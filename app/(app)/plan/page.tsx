"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageBody, PageHero } from "@/components/page";
import { Spinner, cx } from "@/components/ui";
import Browse, { type PlaceRef } from "@/components/plan/browse";
import PlaceDetail from "@/components/plan/place-detail";
import PlanDetail from "@/components/plan/plan-detail";
import PlanTab from "@/components/plan/plan-tab";

const TABS = [
  { key: "browse", label: "Browse" },
  { key: "plan", label: "Plan" },
] as const;

function PlanPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const tripId = params.get("tripId");
  if (tripId) return <PlanDetail tripId={tripId} />;

  const tab = params.get("tab") === "plan" ? "plan" : "browse";
  const destination = params.get("destination") ?? "";
  const placeName = params.get("place");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const place: PlaceRef | null = placeName && Number.isFinite(lat) && Number.isFinite(lng) ? { name: placeName, lat, lng, imageUrl: params.get("img") ?? undefined } : null;

  const openPlace = (p: PlaceRef) => {
    const q = new URLSearchParams({ tab: "browse", place: p.name, lat: String(p.lat), lng: String(p.lng) });
    if (p.imageUrl) q.set("img", p.imageUrl);
    router.push(`/plan?${q.toString()}`);
  };

  return (
    <div>
      <PageHero size="sm" eyebrow="Discover, then plan" title={tab === "plan" ? "Plan a trip" : "Find your next trip"}>
        <div className="mt-4 inline-flex rounded-full bg-black/25 p-1 backdrop-blur" role="tablist" aria-label="Plan sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => router.push(`/plan?tab=${t.key}`)}
              className={cx("min-h-10 rounded-full px-5 text-sm font-semibold transition", tab === t.key ? "bg-white text-ink" : "text-white/85 hover:text-white")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHero>

      {tab === "plan" ? (
        <PlanTab key={destination} initialDestination={destination} />
      ) : (
        <PageBody>{place ? <PlaceDetail place={place} onBack={() => router.push("/plan?tab=browse")} /> : <Browse onOpen={openPlace} />}</PageBody>
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<PageBody><Spinner /></PageBody>}>
      <PlanPageInner />
    </Suspense>
  );
}
