"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { AuthShell, FieldLabel, inputClassName } from "@/components/auth-shell";
import { Button } from "@/components/ui";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [age, setAge] = useState("");
  const [stepFree, setStepFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const here = `/join?code=${encodeURIComponent(code)}`;

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...(age ? { age: Number(age) } : {}), stepFree }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setNeedsSignIn(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't join this trip");
      router.push(`/plan?tripId=${data.tripId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this trip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="You're invited"
      title="Join a group trip"
      subtitle="You'll see the plan as it's built, suggest places and vote. The trip admin makes the changes."
      footer={<Link href="/discover" className="font-semibold text-rani-600 hover:text-rani-700">Not now</Link>}
    >
      <form onSubmit={(e) => { e.preventDefault(); void join(); }} className="space-y-4">
        <div>
          <FieldLabel htmlFor="code">Invite code</FieldLabel>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={inputClassName} maxLength={20} autoComplete="off" required />
        </div>
        <div>
          <FieldLabel htmlFor="age">Your age (helps pick places that suit you)</FieldLabel>
          <input id="age" type="number" inputMode="numeric" min={0} max={110} value={age} onChange={(e) => setAge(e.target.value)} className={inputClassName} />
        </div>
        <button type="button" aria-pressed={stepFree} onClick={() => setStepFree((v) => !v)} className={`min-h-12 w-full rounded-2xl px-4 text-left text-[16px] font-semibold ring-1 transition ${stepFree ? "bg-rani-600 text-white ring-rani-600" : "bg-white text-stone-700 ring-stone-200"}`}>
          I need step-free access
        </button>
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        {needsSignIn && (
          <div className="space-y-2 rounded-2xl bg-rani-50 p-4 text-[15px] text-rani-900">
            <p className="font-semibold">Sign in first, then you&apos;ll come straight back here.</p>
            <div className="flex gap-2">
              <Link href={`/auth/login?next=${encodeURIComponent(here)}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-rani-600 font-bold text-white">Sign in</Link>
              <Link href={`/auth/register?next=${encodeURIComponent(here)}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-white font-bold text-rani-700 ring-1 ring-rani-200">Create account</Link>
            </div>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy || code.trim().length < 4}>
          <Users size={17} aria-hidden /> {busy ? "Joining..." : "Join the trip"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
