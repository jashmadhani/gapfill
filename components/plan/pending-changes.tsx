"use client";

import { useState } from "react";
import { CloudRain, Clock } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { Button, Card, Chip, cx } from "@/components/ui";

export interface PendingChange {
  id: string;
  kind: string;
  label: string;
  reason: string;
  impact: string[];
  day?: number | null;
  options: { key: string; label: string; summary: string; fit: number; costPerPerson: number; lostMin: number; recommended: boolean }[];
}

/** Something changed (rain, running late, a stop closed, over budget). The disruption engine already prepared 2-3
 * scored options; only the trip admin can apply one, and applying goes through the same payment gate as booking. */
export default function PendingChanges({ tripId, changes, isAdmin, onChanged }: { tripId: string; changes: PendingChange[]; isAdmin: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (eventId: string, key: string) => {
    setBusy(`${eventId}-${key}`);
    setError(null);
    try {
      await api.post(`/api/disruptions/${eventId}/choose`, { option: key });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply that");
    } finally {
      setBusy(null);
    }
  };

  const report = async (type: "weather" | "running_late", extra: Record<string, unknown> = {}) => {
    setBusy(type);
    setError(null);
    try {
      await api.post("/api/disruptions", { tripId, type, ...extra });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyse that");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!!busy} onClick={() => report("weather", { day: 1 })} className="flex-1">
          <CloudRain size={15} aria-hidden /> {busy === "weather" ? "Checking..." : "It's raining"}
        </Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => report("running_late", { minutes: 45 })} className="flex-1">
          <Clock size={15} aria-hidden /> {busy === "running_late" ? "Checking..." : "Running late"}
        </Button>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}

      {changes.map((c) => (
        <Card key={c.id} className="space-y-2.5 border-2 border-amber-200 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">{c.label}{c.day ? ` · day ${c.day}` : ""}</p>
            <p className="text-[15px] text-stone-700">{c.reason}</p>
          </div>
          <ul className="space-y-2">
            {c.options.map((o) => (
              <li key={o.key} className={cx("rounded-2xl p-3", o.recommended ? "bg-rani-50 ring-1 ring-rani-200" : "bg-stone-50")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {o.key}) {o.label} {o.recommended && <Chip tone="rani">Recommended</Chip>}
                    </p>
                    <p className="text-sm text-stone-600">{o.summary}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {o.fit}% fit · {o.costPerPerson === 0 ? "no change in cost" : `${o.costPerPerson > 0 ? "+" : ""}${inr(o.costPerPerson)} pp`}
                      {o.lostMin > 0 ? ` · ${o.lostMin} min lost` : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button variant="secondary" className="min-h-11 shrink-0" disabled={busy === `${c.id}-${o.key}`} onClick={() => choose(c.id, o.key)}>
                      Apply
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!isAdmin && <p className="text-sm text-stone-500">The trip admin decides which option to apply.</p>}
        </Card>
      ))}
    </div>
  );
}
