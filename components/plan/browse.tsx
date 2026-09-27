"use client";

import { useEffect, useState } from "react";
import { MapPin, Sparkles, Sun } from "lucide-react";
import { api } from "@/lib/api-client";
import { SearchPill, SectionHead } from "@/components/page";
import { Photo, Spinner } from "@/components/ui";

export interface PlaceRef {
  name: string;
  lat: number;
  lng: number;
  imageUrl?: string;
}

interface FeedItem extends PlaceRef {
  key: string;
  region: string;
  subtitle: string;
}

interface Feed {
  recommended: FeedItem[];
  goodWeather: FeedItem[];
  hasHistory: boolean;
}

interface SearchPlace extends PlaceRef {
  id: string;
  categories: string[];
  address?: string;
}

function categoryLabel(categories: string[]) {
  const c = categories.find((x) => x.includes(".")) ?? categories[0] ?? "place";
  return c.split(".").pop()!.replace(/_/g, " ");
}

function Carousel({ title, items, onOpen }: { title: string; items: FeedItem[]; onOpen: (p: PlaceRef) => void }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <SectionHead title={title} />
      <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        {items.map((it) => (
          <li key={it.key} className="w-[58vw] max-w-[15rem] shrink-0 snap-start">
            <button type="button" onClick={() => onOpen({ name: it.name, lat: it.lat, lng: it.lng, imageUrl: it.imageUrl })} className="block w-full text-left">
              <Photo src={it.imageUrl} alt={it.name} className="aspect-[3/4] rounded-[1.6rem] shadow-soft">
                <div className="flex h-full flex-col justify-end p-3.5 text-white">
                  <p className="font-serif-display text-[1.3rem] leading-tight">{it.name}</p>
                  <p className="text-sm text-white/85">{it.region}</p>
                  <p className="mt-1 text-sm font-semibold text-white/90">{it.subtitle}</p>
                </div>
              </Photo>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Browse({ onOpen }: { onOpen: (p: PlaceRef) => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");

  useEffect(() => {
    api.get<Feed>("/api/browse/feed").then(setFeed).catch(() => setFeed({ recommended: [], goodWeather: [], hasHistory: false }));
  }, []);

  const search = async () => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const r = await api.get<{ places: SearchPlace[] }>(`/api/places/search?q=${encodeURIComponent(term)}`);
      setResults(r.places);
    } catch {
      setResults([]);
    } finally {
      setSearchedFor(term);
      setSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      <SearchPill
        value={q}
        onChange={(v) => {
          setQ(v);
          if (!v.trim()) setResults(null);
        }}
        onSubmit={search}
        placeholder="Search a city or place"
      />

      {searching && <Spinner label="Searching..." />}

      {!searching && results && (
        <section aria-label="Search results">
          <SectionHead title={`Around "${searchedFor}"`} />
          {results.length === 0 ? (
            <p className="rounded-[1.6rem] bg-white p-6 text-center text-stone-600 shadow-soft">No places found. Try a city name.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-3.5 rounded-[1.4rem] bg-white p-2.5 pr-4 text-left shadow-soft">
                    <Photo src={p.imageUrl} scrim={false} className="h-[4.6rem] w-[5.4rem] shrink-0 rounded-2xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate h3-title text-ink">{p.name}</span>
                      <span className="mt-0.5 block truncate text-sm capitalize text-stone-600">{categoryLabel(p.categories)}</span>
                      {p.address && (
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
                          <MapPin size={12} aria-hidden /> <span className="truncate">{p.address}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!searching && !results && (
        <>
          {!feed ? (
            <Spinner />
          ) : (
            <>
              <Carousel title="Recommended trips for you" items={feed.recommended} onOpen={onOpen} />
              <div>
                <Carousel title="Good weather ahead" items={feed.goodWeather} onOpen={onOpen} />
                {feed.goodWeather.length > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                    <Sun size={12} aria-hidden /> Based on this week&apos;s forecast{feed.hasHistory ? ", your past destinations first" : ""}. We don&apos;t have a live events feed yet.
                  </p>
                )}
              </div>
              {feed.recommended.length === 0 && feed.goodWeather.length === 0 && (
                <p className="flex items-center justify-center gap-2 rounded-[1.6rem] bg-white p-6 text-center text-stone-600 shadow-soft">
                  <Sparkles size={16} aria-hidden /> Search for a city above to start exploring.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
