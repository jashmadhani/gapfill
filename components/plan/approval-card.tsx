"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Ticket } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { Button, Card, Chip } from "@/components/ui";

export interface PaymentsData {
  role: "admin" | "member";
  intents: { id: string; kind: string; mode?: string; amount: number; status: string; createdBy: "agent" | "traveller"; expiresAt: string; summary: { title: string; subtitle: string; lines: { label: string; amount: number; strong?: boolean }[]; policy: string } }[];
  tickets: { code: string; title: string; startTime: string; holders: number; status: string }[];
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });

/** The human-in-the-loop step: whatever prepared this card (you, or the assistant), nothing is charged until you approve it
 * here and pay on the provider's page. Also lists the tickets once a trip is booked. */
export default function ApprovalCard({ data, onChanged }: { data: PaymentsData; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!data.intents.length && !data.tickets.length) return null;
  return (
    <div className="space-y-4">
      {data.intents.map((i) => (
        <Card key={i.id} className="space-y-3 border-2 border-rani-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-rani-700"><ShieldCheck size={15} aria-hidden /> Waiting for your approval</p>
              <h2 className="h3-title mt-0.5 text-ink">{i.summary.title}</h2>
              <p className="text-sm text-stone-600">{i.summary.subtitle}</p>
            </div>
            {i.createdBy === "agent" && <Chip tone="rani">Prepared by the assistant</Chip>}
          </div>
          <ul className="space-y-1">
            {i.summary.lines.map((l) => (
              <li key={l.label} className={`flex justify-between gap-3 text-[15px] ${l.strong ? "font-bold text-ink" : "text-stone-700"}`}>
                <span>{l.label}</span>
                <span>{inr(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-stone-600">{i.summary.policy}</p>
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">Nothing has been charged. It only happens after you approve and pay.</p>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => act(async () => { const r = await api.post<{ checkoutUrl: string }>(`/api/payments/${i.id}/approve`); router.push(r.checkoutUrl); })}>
              Approve and pay {inr(i.amount)}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => act(async () => { await api.post(`/api/payments/${i.id}/cancel`); onChanged(); })}>Not now</Button>
          </div>
        </Card>
      ))}
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      {data.tickets.length > 0 && (
        <Card className="space-y-2 p-4">
          <h2 className="h3-title flex items-center gap-2 text-ink"><Ticket size={18} aria-hidden /> Your tickets</h2>
          <ul className="space-y-2">
            {data.tickets.map((t) => (
              <li key={t.code} className="rounded-2xl bg-stone-50 p-3">
                <p className="text-[15px] font-semibold text-ink">{t.title}</p>
                <p className="text-sm text-stone-600">{when(t.startTime)} · {t.holders} {t.holders === 1 ? "person" : "people"}{t.status !== "valid" ? " · void" : ""}</p>
                <p className="mt-1 break-all font-mono text-sm tracking-wider text-ink">{t.code}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-stone-600">Show the code at entry. It can be checked at /api/tickets/verify.</p>
        </Card>
      )}
    </div>
  );
}
