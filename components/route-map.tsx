"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Eye, EyeOff } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { cx } from "@/components/ui";
import type { ConsideredPlace, EventCard, PlanHotel } from "@/types";

// Free vector tiles (OpenFreeMap, no key). Road geometry comes from /api/roads (OSRM, cached).
const STYLE = "https://tiles.openfreemap.org/styles/positron";
type LngLat = [number, number];
interface Leg {
  coords: LngLat[];
  km: number;
  min: number;
  source: string;
}

interface Stop {
  id: string;
  title: string;
  kind: "activity" | "meal";
  start: string;
  lngLat: LngLat;
}

/** A day's mappable stops in visit order (travel/free-time cards have no place). */
function stopsOf(cards: EventCard[]): Stop[] {
  return cards
    .filter((c) => c.status !== "dismissed" && c.location && (c.type === "activity" || c.type === "meal"))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((c) => ({ id: c.itemId, title: c.title, kind: c.type as "activity" | "meal", start: c.startTime.slice(11, 16), lngLat: [c.location!.lng, c.location!.lat] }));
}

function pinEl(opts: { label: string; kind: string; text: string; sub?: string | null; selected?: boolean; onClick?: () => void }) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", opts.label);
  el.className = "tc-pin";
  el.dataset.kind = opts.kind;
  if (opts.selected) el.dataset.selected = "true";
  const dot = document.createElement("span");
  dot.className = "tc-dot";
  dot.textContent = opts.text;
  el.appendChild(dot);
  if (opts.sub) {
    const l = document.createElement("span");
    l.className = "tc-label";
    l.textContent = opts.sub;
    el.appendChild(l);
  }
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    opts.onClick?.();
  });
  return el;
}

/**
 * Map of a plan: one day at a time, hotel to each stop and back on real roads, with the
 * places the planner left out shown as dashed ghost pins (tap one to see its price and why).
 */
export default function RouteMap({
  days,
  hotel,
  considered = [],
  dayLabels,
  className,
  initialDay = 0,
  day: controlledDay,
  onDayChange,
}: {
  days: EventCard[][];
  hotel?: PlanHotel;
  considered?: ConsideredPlace[];
  dayLabels?: string[];
  className?: string;
  initialDay?: number;
  /** Pass both to make the day tabs controlled (e.g. so a timeline shown below stays in sync with
   * whichever day is selected here) - otherwise the map tracks its own day, uncontrolled. */
  day?: number;
  onDayChange?: (day: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [uncontrolledDay, setUncontrolledDay] = useState(Math.min(initialDay, Math.max(0, days.length - 1)));
  const day = Math.min(controlledDay ?? uncontrolledDay, Math.max(0, days.length - 1));
  const setDay = (i: number) => {
    if (onDayChange) onDayChange(i);
    else setUncontrolledDay(i);
  };
  const [ghosts, setGhosts] = useState(true);
  const [picked, setPicked] = useState<{ type: "stop"; id: string } | { type: "ghost"; key: string } | null>(null);
  const [legsFor, setLegsFor] = useState<{ key: string; legs: Leg[] } | null>(null);

  const stops = useMemo(() => stopsOf(days[day] ?? []), [days, day]);
  const hotelLng = hotel?.location?.lng;
  const hotelLat = hotel?.location?.lat;
  const hotelPt = useMemo<LngLat | null>(() => (hotelLng != null && hotelLat != null ? [hotelLng, hotelLat] : null), [hotelLng, hotelLat]);
  const path = useMemo<LngLat[]>(() => {
    const pts = stops.map((s) => s.lngLat);
    return hotelPt && pts.length ? [hotelPt, ...pts, hotelPt] : pts;
  }, [stops, hotelPt]);
  const pathKey = path.map((p) => p.join(",")).join(";");

  // Real roads for the day's loop.
  useEffect(() => {
    if (path.length < 2) return;
    let off = false;
    api
      .post<{ legs: Leg[] }>("/api/roads", { points: path })
      .then((r) => !off && setLegsFor({ key: pathKey, legs: r.legs }))
      .catch(() => !off && setLegsFor({ key: pathKey, legs: [] }));
    return () => {
      off = true;
    };
  }, [pathKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Roads that belong to the day on screen (stale ones from a previous day are ignored).
  const legs = legsFor && legsFor.key === pathKey ? legsFor.legs : null;

  // Create the map once (client only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      lib.current = ml;
      ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new ml.Map({ container: box.current, style: STYLE, center: [75.8, 26.9], zoom: 5, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
      m.touchZoomRotate.disableRotation();
      m.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
      m.on("load", () => {
        m.addSource("path", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "path-casing", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
        m.addLayer({ id: "path-line", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2f64b0", "line-width": 4.5 } });
        setReady(true);
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((mk) => mk.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Line
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const coords: LngLat[] = legs && legs.length ? legs.flatMap((l) => l.coords) : path;
    const src = m.getSource("path") as import("maplibre-gl").GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
  }, [ready, legs, path]);

  // Pins
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const add = (lngLat: LngLat, el: HTMLElement) => markers.current.push(new ml.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(m));
    if (hotelPt && stops.length) add(hotelPt, pinEl({ label: `Hotel: ${hotel?.name}`, kind: "hotel", text: "H" }));
    stops.forEach((s, i) => {
      const sel = picked?.type === "stop" && picked.id === s.id;
      add(s.lngLat, pinEl({ label: `${s.title}, ${s.start}`, kind: s.kind, text: String(i + 1), sub: sel ? `${s.start} ${s.title}` : null, selected: sel, onClick: () => setPicked({ type: "stop", id: s.id }) }));
    });
    if (ghosts) {
      considered.filter((c) => c.verdict === "left_out").forEach((c) => {
        const sel = picked?.type === "ghost" && picked.key === c.key;
        add([c.location.lng, c.location.lat], pinEl({ label: `Left out: ${c.name}`, kind: "ghost", text: "+", sub: sel ? c.name : null, selected: sel, onClick: () => setPicked({ type: "ghost", key: c.key }) }));
      });
    }
  }, [ready, stops, hotelPt, hotel?.name, considered, ghosts, picked]);

  // Camera: fit the day's loop.
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    const pts: LngLat[] = [...path, ...(ghosts ? considered.filter((c) => c.verdict === "left_out").map((c) => [c.location.lng, c.location.lat] as LngLat) : [])];
    if (!pts.length) return;
    if (pts.length === 1) {
      m.flyTo({ center: pts[0], zoom: 13, duration: 700 });
      return;
    }
    const b = pts.reduce((acc, p) => acc.extend(p), new ml.LngLatBounds(pts[0], pts[0]));
    m.fitBounds(b, { padding: { top: 60, bottom: 60, left: 40, right: 40 }, maxZoom: 14, duration: 700 });
  }, [ready, pathKey, ghosts, considered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const km = legs?.reduce((s, l) => s + (l.km || 0), 0) ?? 0;
  const approx = legs?.some((l) => l.source === "line");
  const ghost = picked?.type === "ghost" ? considered.find((c) => c.key === picked.key) : null;
  const stop = picked?.type === "stop" ? stops.find((s) => s.id === picked.id) : null;
  const leftOutCount = considered.filter((c) => c.verdict === "left_out").length;

  return (
    <div className={cx("overflow-hidden rounded-[2rem] bg-white shadow-soft", className)}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-3" role="tablist" aria-label="Map day">
        {days.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={day === i}
            onClick={() => {
              setDay(i);
              setPicked(null);
            }}
            className={cx("min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition", day === i ? "bg-ink text-white" : "bg-stone-100 text-stone-700 hover:text-ink")}
          >
            {dayLabels?.[i] ?? `Day ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="relative mt-3 h-[20rem] lg:h-[24rem]">
        {/* maplibre's own CSS forces position: relative on the map element, so size it via a wrapper */}
        <div className="absolute inset-0">
          <div ref={box} className="h-full w-full" role="region" aria-label="Trip map" />
        </div>
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2">
          {leftOutCount > 0 && (
            <button
              type="button"
              aria-pressed={ghosts}
              onClick={() => {
                setGhosts((g) => !g);
                setPicked(null);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white shadow-float"
            >
              {ghosts ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />} Left out ({leftOutCount})
            </button>
          )}
          {km > 0 && <span className="whitespace-nowrap rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-ink shadow-soft">{Math.round(km)} km{approx ? " approx." : " by road"}</span>}
        </div>
        {stops.length === 0 && <p className="pointer-events-none absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-stone-700 shadow-soft">Nothing with a place on this day yet</p>}
      </div>
      {(ghost || stop) && (
        <div className="border-t border-stone-100 px-4 py-3 text-sm">
          {stop && (
            <p>
              <b className="text-ink">{stop.title}</b> <span className="text-stone-600">· {stop.start}</span>
            </p>
          )}
          {ghost && (
            <>
              <p>
                <b className="text-ink">{ghost.name}</b> <span className="text-stone-600">· {ghost.price ? `${inr(ghost.price)} pp` : "Free entry"}{ghost.priceSource === "estimate" ? " (est.)" : ""}</span>
              </p>
              <p className="mt-0.5 text-stone-600">{ghost.reasons[0]}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
