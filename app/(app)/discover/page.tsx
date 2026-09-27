"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, Plane, Sparkles, Star } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { PageBody, PageHero, SearchPill, SectionHead } from "@/components/page";
import CoverflowCarousel from "@/components/coverflow";
import { INTEREST, Photo, Spinner, TOP_INTERESTS, cx } from "@/components/ui";

interface Destination {
  key: string;
  name: string;
  region: string;
  imageUrl?: string;
  experiences: number;
}

interface Experience {
  id: string;
  title: string;
  destKey: string;
  destName: string;
  durationMin: number;
  price: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  imageUrl?: string;
}

interface DiscoverResponse {
  destinations: Destination[];
  experiences: Experience[];
  firstName: string;
  savedPoiIds: string[];
  currentTrip: { id: string; title: string; stage: "plan" | "prepare" | "operate" | "complete"; coverImageUrl?: string } | null;
}

const hours = (m: number) => (m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`);

function DestCard({ d }: { d: Destination }) {
  return (
    <Photo src={d.imageUrl} alt={d.name} className="aspect-[3/4] rounded-[1.6rem] shadow-soft">
      <div className="flex h-full flex-col justify-end p-3.5 text-white">
        <p className="font-serif-display text-[1.35rem] leading-tight">{d.name}</p>
        <p className="text-sm text-white/85">{d.region}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
          <Sparkles size={13} aria-hidden /> {d.experiences} experiences
        </p>
      </div>
    </Photo>
  );
}

function ExpRow({ e, saved, onSave }: { e: Experience; saved: boolean; onSave: (id: string) => void }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[1.4rem] bg-white p-2.5 pr-2 shadow-soft">
      <span className="flex min-w-0 flex-1 items-center gap-3.5">
        <Photo src={e.imageUrl} scrim={false} className="h-[5.2rem] w-[6.2rem] shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate h3-title text-ink">{e.title}</span>
          <span className="mt-0.5 block truncate text-sm text-stone-600">
            {hours(e.durationMin)} · {e.destName}
          </span>
          <span className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[16px] font-bold text-ink">{e.price ? inr(e.price) : "Free"}</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700">
              <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
              {e.rating.toFixed(1)}
            </span>
          </span>
        </span>
      </span>
      <button type="button" onClick={() => onSave(e.id)} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
        <Heart size={19} className={saved ? "fill-rose-500 text-rose-500" : ""} />
      </button>
    </li>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [allDest, setAllDest] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const load = (interest = cat) =>
    api.get<DiscoverResponse>(`/api/discover?interest=${interest}`).then((d) => {
      setData(d);
      setSavedIds(new Set(d.savedPoiIds));
    });

  useEffect(() => {
    load(cat); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const toggleSave = async (poiId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(poiId)) next.delete(poiId);
      else next.add(poiId);
      return next;
    });
    await api.post<{ savedPoiIds: string[] }>("/api/saved", { poiId });
  };

  const exps = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = data?.experiences ?? [];
    return list.filter((e) => !t || `${e.title} ${e.destName}`.toLowerCase().includes(t));
  }, [data, q]);
  const hero = exps[0];
  const rest = exps.slice(1, showAll ? 12 : 5);

  const heroImg = data?.currentTrip?.coverImageUrl || data?.destinations[0]?.imageUrl;

  return (
    <div>
      <PageHero
        size="lg"
        img={heroImg}
        eyebrow={data ? `Hi ${data.firstName}` : "Toure"}
        title={
          <>
            Go beyond
            <br />
            the itinerary.
          </>
        }
        subtitle="Tours built around your group, that keep themselves on track while you travel."
      >
        <div className="mt-6 max-w-xl">
          <SearchPill
            dark
            value={q}
            onChange={setQ}
            onSubmit={() => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" })}
            trailing={
              <button type="button" onClick={() => router.push("/plan")} aria-label="Plan a trip" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rani-600 text-white">
                <ArrowRight size={19} />
              </button>
            }
          />
        </div>
      </PageHero>

      <PageBody>
        {!data ? (
          <Spinner />
        ) : (
          <div className="space-y-9">
            {data.currentTrip && (
              <Link
                href={data.currentTrip.stage === "operate" ? "/trip" : data.currentTrip.stage === "complete" ? "/trip" : "/plan"}
                className="flex items-center gap-4 rounded-[1.6rem] bg-ink p-3 pr-5 text-white shadow-float"
              >
                <Photo src={data.currentTrip.coverImageUrl} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-rani-200">
                    {data.currentTrip.stage === "operate" ? "On tour now" : data.currentTrip.stage === "prepare" ? "Your next trip" : "Draft trip"}
                  </span>
                  <span className="block truncate text-lg font-bold">{data.currentTrip.title}</span>
                </span>
                <ArrowRight size={20} aria-hidden />
              </Link>
            )}

            <section aria-label="Popular destinations">
              <SectionHead title="Popular destinations" action={allDest ? "Show less" : "View all"} onAction={() => setAllDest((v) => !v)} />
              <div className="md:hidden">
                <CoverflowCarousel
                  slides={data.destinations.slice(0, allDest ? 12 : 8).map((d) => ({
                    key: d.key,
                    src: d.imageUrl,
                    alt: d.name,
                    title: d.name,
                    subtitle: `${d.region} · ${d.experiences} experiences`,
                  }))}
                />
              </div>
              <ul className="hidden gap-3 md:grid md:grid-cols-4">
                {data.destinations.slice(0, allDest ? 12 : 8).map((d) => (
                  <li key={d.key}>
                    <DestCard d={d} />
                  </li>
                ))}
              </ul>
            </section>

            <section id="explore" aria-labelledby="exp-h" className="scroll-mt-20">
              <h2 id="exp-h" className="sr-only">
                Explore
              </h2>
              <div className="lg:flex lg:items-center lg:gap-4">
                <div className="lg:w-[26rem]">
                  <SearchPill value={q} onChange={setQ} placeholder="Search destinations, tours…" />
                </div>
                <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-0 lg:px-0" role="group" aria-label="Categories">
                  {["all", ...TOP_INTERESTS].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCat(k)}
                      aria-pressed={cat === k}
                      className={cx("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition", cat === k ? "bg-rani-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:text-ink")}
                    >
                      {k === "all" ? "All" : INTEREST[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start [&>*]:min-w-0">
                {hero ? (
                  <Photo src={hero.imageUrl} alt={hero.title} className="aspect-[4/3.3] rounded-[1.9rem] shadow-float lg:aspect-[4/3.6]">
                    <div className="flex h-full flex-col justify-between p-5 text-white">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleSave(hero.id)}
                          aria-label="Save"
                          className="glass-dark grid h-11 w-11 place-items-center rounded-full"
                        >
                          <Heart size={19} className={savedIds.has(hero.id) ? "fill-rose-500 text-rose-500" : ""} />
                        </button>
                      </div>
                      <div>
                        <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
                          <Sparkles size={14} aria-hidden /> Recommended
                        </span>
                        <p className="font-serif-display mt-2 text-[2rem] leading-[1.05] md:text-4xl">{hero.title}</p>
                        <p className="mt-1 text-[15px] text-white/85">{hero.destName}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Star size={15} className="fill-amber-400 text-amber-400" aria-hidden />
                            {hero.rating.toFixed(1)} ({hero.ratingCount})
                          </span>
                          <span className="inline-flex items-center gap-1">{hours(hero.durationMin)}</span>
                          <span>From {hero.price ? inr(hero.price) : "free"}</span>
                        </p>
                      </div>
                    </div>
                  </Photo>
                ) : (
                  <div className="rounded-[1.9rem] bg-white p-8 text-center text-stone-600 shadow-soft">Nothing matches that search yet.</div>
                )}

                <div>
                  <SectionHead title="Best experiences for you" action={exps.length > 5 ? (showAll ? "Show less" : "View all") : null} onAction={() => setShowAll((s) => !s)} />
                  <ul className="space-y-3">
                    {rest.map((e) => (
                      <ExpRow key={e.id} e={e} saved={savedIds.has(e.id)} onSave={toggleSave} />
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {!data.currentTrip && (
              <Link href="/plan" className="flex items-center gap-4 rounded-[1.6rem] bg-white p-5 shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-rani-50 text-rani-600">
                  <Plane size={22} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold text-ink">Plan your trip in a few taps</span>
                  <span className="text-[15px] text-stone-600">Dates, who&apos;s coming, what you love. We do the rest.</span>
                </span>
                <ArrowRight size={20} aria-hidden />
              </Link>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
