"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { api, inr } from "@/lib/api-client";
import { Button, Card, Spinner } from "@/components/ui";

interface Intent {
  id: string;
  amount: number;
  status: string;
  summary: { title: string; subtitle: string; lines: { label: string; amount: number; strong?: boolean }[] };
}

/** The payment provider's own page (sandbox). Card details are only ever entered on a page like this, never in chat.
 * In sandbox mode there is nothing to type and no real money moves: one tap confirms the test payment. */
export default function SandboxCheckout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tripId, setTripId] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ trips: { id: string }[] }>("/api/groups").then(async (g) => {
      for (const t of g.trips) {
        const r = await api.get<{ intents: Intent[] }>(`/api/payments?tripId=${t.id}`).catch(() => ({ intents: [] as Intent[] }));
        const hit = r.intents.find((i) => i.id === id);
        if (hit) {
          setIntent(hit);
          setTripId(t.id);
          return;
        }
      }
      setError("This payment isn't open any more.");
    });
  }, [id]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/payments/${id}/pay`);
      router.push(`/plan?tripId=${tripId}&paid=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  };

  if (!intent && !error) return <Spinner />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-stone-500">Secure checkout · sandbox</p>
      {intent && (
        <Card className="space-y-4 p-5">
          <div>
            <h1 className="h2-section text-ink">{intent.summary.title}</h1>
            <p className="text-[15px] text-stone-600">{intent.summary.subtitle}</p>
          </div>
          <ul className="space-y-1.5">
            {intent.summary.lines.map((l) => (
              <li key={l.label} className={`flex justify-between gap-3 text-[15px] ${l.strong ? "font-bold text-ink" : "text-stone-700"}`}>
                <span>{l.label}</span>
                <span>{inr(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 rounded-2xl bg-rani-50 p-3 text-sm text-rani-900">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden /> Test mode: no real money moves. On a live provider you would enter your card or UPI here, on their page. The assistant never sees it.
          </p>
          <Button className="w-full" disabled={busy} onClick={pay}>
            {busy ? "Confirming..." : `Pay ${inr(intent.amount)} (test)`}
          </Button>
        </Card>
      )}
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
