"use client";

import { useEffect, useState } from "react";
import { CloudRain, Info, Wind } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageBody, PageHero } from "@/components/page";
import { Button, Card, Chip, Spinner, cx } from "@/components/ui";

interface CityWeather {
  city: string;
  temperature: number;
  condition: string;
  precipitation_mm: number;
  wind_speed: number;
  is_live: boolean;
  risk: number;
  level: "low" | "moderate" | "high";
}

interface Overview {
  cities: CityWeather[];
  live: boolean;
}

interface Simulation {
  probabilistic_predictions: Record<string, number>;
  entities: { id: string; name: string; category: string; status: string; risk_score: number; cascading_effect: string }[];
  recommended_actions: { title: string; description: string; impact: string }[];
  social_signals: { id: string; handle: string; platform: string; text: string; sentiment: string; illustrative?: boolean }[];
}


/** Live weather across the catalog's destinations, and a what-if simulator for how rain, heat and flooding cascade
 * onto attractions, transport and hotels. The simulator is a transparent rule model with stated uncertainty, not a
 * trained model; the social feed below is illustrative, not a live feed - both are labelled as such in the UI. */
export default function DigitalTwinPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [rain, setRain] = useState(20);
  const [temp, setTemp] = useState(34);
  const [flood, setFlood] = useState<"None" | "Low" | "Moderate" | "Severe">("None");
  const [sim, setSim] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Overview>("/api/agent/twin").then((o) => {
      setOverview(o);
      if (o.cities[0]) setCity(o.cities[0].city);
    });
  }, []);

  const run = async (c: string) => {
    setBusy(true);
    try {
      setSim(await api.post<Simulation>("/api/agent/twin", { city: c, rain_mm: rain, temp, storm_duration_hrs: 3, flood_level: flood, wind_speed: 15 }));
    } finally {
      setBusy(false);
    }
  };

  if (!overview) return <PageBody><Spinner /></PageBody>;
  return (
    <div>
      <PageHero size="sm" eyebrow="Operations" title="Weather digital twin">
        <p className="mt-1 text-[15px] text-white/85">{overview.live ? "Live weather" : "Weather API is rate-limited right now; showing the stated fallback"} across {overview.cities.length} destinations.</p>
      </PageHero>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.cities.map((c) => (
            <button key={c.city} type="button" onClick={() => { setCity(c.city); setSim(null); }} className={cx("rounded-2xl bg-white p-4 text-left shadow-soft ring-2 transition", city === c.city ? "ring-rani-500" : "ring-transparent")}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{c.city}</span>
                <Chip tone={c.level === "high" ? "red" : c.level === "moderate" ? "amber" : "green"}>{c.level} risk</Chip>
              </div>
              <p className="mt-1 text-sm text-stone-600">{c.temperature.toFixed(0)}°C · {c.condition} · {c.precipitation_mm.toFixed(1)}mm rain</p>
              {!c.is_live && <p className="mt-1 text-xs text-stone-500">Fallback value, not live</p>}
            </button>
          ))}
        </div>

        <Card className="mt-6 space-y-4 p-5">
          <h2 className="h3-title text-ink">What-if simulator</h2>
          <p className="flex items-start gap-1.5 text-sm text-stone-600"><Info size={15} className="mt-0.5 shrink-0" aria-hidden /> A transparent rule model with stated uncertainty margins, not a trained model. Move the sliders and re-run.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-stone-700">Rain (mm): {rain}
              <input type="range" min={0} max={100} value={rain} onChange={(e) => setRain(Number(e.target.value))} className="mt-1 block w-full accent-rani-600" style={{ height: 44 }} />
            </label>
            <label className="text-sm font-semibold text-stone-700">Temp (°C): {temp}
              <input type="range" min={15} max={48} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="mt-1 block w-full accent-rani-600" style={{ height: 44 }} />
            </label>
            <label className="text-sm font-semibold text-stone-700">Flood level
              <select value={flood} onChange={(e) => setFlood(e.target.value as typeof flood)} className="mt-1 block min-h-11 w-full rounded-2xl border border-stone-200 bg-white px-3 text-[16px]">
                {(["None", "Low", "Moderate", "Severe"] as const).map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
          </div>
          <Button disabled={!city || busy} onClick={() => city && run(city)}><CloudRain size={16} aria-hidden /> {busy ? "Simulating..." : `Simulate for ${city ?? "..."}`}</Button>

          {sim && (
            <div className="space-y-4 border-t border-stone-100 pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(sim.probabilistic_predictions).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-stone-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-stone-500">{k.replace(/_pct$|_/g, " ").trim()}</p>
                    <p className="text-lg font-bold text-ink">{v}{k.includes("pct") ? "%" : k.includes("minutes") ? " min" : ""}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Cascading impact</h3>
                <ul className="space-y-2">
                  {sim.entities.map((e) => (
                    <li key={e.id} className="rounded-2xl bg-white p-3 ring-1 ring-stone-200/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{e.name}</span>
                        <Chip tone={e.risk_score > 60 ? "red" : e.risk_score > 30 ? "amber" : "green"}>{e.status}</Chip>
                      </div>
                      <p className="mt-0.5 text-sm text-stone-600">{e.cascading_effect}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Recommended actions</h3>
                <ul className="space-y-2">
                  {sim.recommended_actions.map((a) => (
                    <li key={a.title} className="rounded-2xl bg-rani-50 p-3">
                      <p className="font-semibold text-rani-900">{a.title}</p>
                      <p className="text-sm text-rani-800">{a.description}</p>
                      <p className="text-xs text-rani-700">{a.impact}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500">
                  Social signals <Chip tone="stone">Illustrative, not live</Chip>
                </h3>
                <ul className="space-y-1.5">
                  {sim.social_signals.map((s) => (
                    <li key={s.id} className="rounded-2xl bg-stone-50 p-2.5 text-sm text-stone-700">
                      <span className="font-semibold">{s.handle}</span> · {s.platform}: {s.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </PageBody>
    </div>
  );
}
