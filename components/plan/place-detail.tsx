"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudSun, ExternalLink, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Card, Photo, Spinner } from "@/components/ui";
import type { PlaceRef } from "@/components/plan/browse";

interface Detail {
  name: string;
  weather: {
    currentTempC: number | null;
    currentCondition: string;
    forecast: { date: string; highC: number; lowC: number; condition: string }[];
  } | null;
  summary: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

export default function PlaceDetail({ place, onBack }: { place: PlaceRef; onBack: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<Detail>(`/api/places/detail?name=${encodeURIComponent(place.name)}&lat=${place.lat}&lng=${place.lng}`)
      .then(setDetail)
      .catch(() => setFailed(true));
  }, [place.name, place.lat, place.lng]);

  const image = detail?.imageUrl ?? place.imageUrl;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Back to browse
      </button>

      <Photo src={image ?? undefined} alt={place.name} scrim="b" className="aspect-[4/3] rounded-[1.9rem] shadow-float md:aspect-[16/7]">
        <div className="flex h-full flex-col justify-end p-5 text-white">
          <p className="font-serif-display text-[2rem] leading-[1.05] md:text-4xl">{place.name}</p>
        </div>
      </Photo>

      {!detail && !failed && <Spinner />}
      {failed && <p className="rounded-[1.6rem] bg-white p-5 text-center text-stone-600 shadow-soft">Couldn&apos;t load details for this place right now.</p>}

      {detail?.weather && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
            <CloudSun size={15} aria-hidden /> Weather
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {detail.weather.currentTempC !== null ? `${Math.round(detail.weather.currentTempC)}C now` : "Now"} - {detail.weather.currentCondition}
          </p>
          <ul className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
            {detail.weather.forecast.map((f) => (
              <li key={f.date} className="w-24 shrink-0 rounded-2xl bg-sand-50 p-2.5 text-center">
                <span className="block text-xs font-semibold text-stone-500">{day(f.date)}</span>
                <span className="mt-1 block text-sm font-bold text-ink">
                  {Math.round(f.highC)}/{Math.round(f.lowC)}C
                </span>
                <span className="block text-xs text-stone-600">{f.condition}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {detail?.summary && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
            <MapPin size={15} aria-hidden /> About
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-700">{detail.summary}</p>
          {detail.sourceUrl && (
            <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-rani-600">
              Read more on Wikipedia <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </Card>
      )}

      <Button className="w-full" onClick={() => router.push(`/plan?tab=plan&destination=${encodeURIComponent(place.name)}`)}>
        Plan a trip to {place.name}
      </Button>
    </div>
  );
}
