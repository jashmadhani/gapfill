"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, Lightbulb, Plus, ThumbsUp, Trash2, UserPlus, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/group";
import { Button, Card, Chip, cx } from "@/components/ui";

export interface GroupData {
  role: "admin" | "member";
  inviteCode?: string;
  members: { name: string; age?: number; stepFree?: boolean; userId?: string; role?: "admin" | "member"; isMe?: boolean }[];
  suggestions: { id: string; userName: string; name: string; note?: string; status: "open" | "accepted" | "dismissed"; votes: number; iVoted: boolean }[];
  votes: Record<string, { count: number; iVoted: boolean }>;
}

const field = "min-h-11 rounded-2xl border border-stone-200 bg-white px-3.5 text-[16px] text-ink placeholder:text-stone-400 outline-none focus:border-rani-500 focus:ring-2 focus:ring-rani-100";

/** Who is on the trip, what each role can do, the invite link, and the group's ideas and votes. */
export default function GroupPanel({ tripId, group, onChanged }: { tripId: string; group: GroupData; onChanged: () => void }) {
  const router = useRouter();
  const admin = group.role === "admin";
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [idea, setIdea] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const me = group.members.find((m) => m.isMe);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ tone: "ok", text: ok });
      onChanged();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  };

  const link = typeof window !== "undefined" && group.inviteCode ? `${window.location.origin}/join?code=${group.inviteCode}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMsg({ tone: "err", text: `Copy this link: ${link}` });
    }
  };

  return (
    <Card className="space-y-5 p-4">
      <div>
        <h2 className="h3-title text-ink">Your group</h2>
        <p className="mt-0.5 text-sm text-stone-600">
          {admin ? "You're the admin: only you can change the plan. Everyone else can view it live, suggest places and vote." : "You can view the plan live, suggest places and vote. The admin makes the changes."}
        </p>
      </div>

      <ul className="space-y-2.5">
        {group.members.map((m, i) => (
          <li key={m.userId ?? `${m.name}-${i}`} className="flex items-center gap-2.5">
            <Avatar name={m.name} age={m.age} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">
                {m.name}
                {m.isMe && <span className="font-normal text-stone-500"> (you)</span>}
              </span>
              <span className="block truncate text-sm text-stone-600">
                {m.age != null ? `${m.age}` : ""}
                {m.stepFree ? " · step-free" : ""}
                {!m.userId ? " · not on the app" : ""}
              </span>
            </span>
            {m.role === "admin" ? (
              <Chip tone="rani">
                <Crown size={12} aria-hidden /> Admin
              </Chip>
            ) : m.userId ? (
              <Chip>Member</Chip>
            ) : null}
            {((admin && m.userId && m.role !== "admin") || (m.isMe && !admin)) && m.userId && (
              <button
                type="button"
                aria-label={m.isMe ? "Leave this trip" : `Remove ${m.name}`}
                disabled={busy}
                onClick={() => {
                  if (confirm(m.isMe ? "Leave this trip?" : `Remove ${m.name} from the trip?`)) void run(() => api.delete(`/api/groups/${tripId}/members?userId=${m.userId}`), m.isMe ? undefined : `${m.name} removed`).then(() => m.isMe && router.push("/plan"));
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={17} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {me && (
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="text-sm font-semibold text-ink">Your details</p>
          <p className="text-sm text-stone-600">Used to work out which places suit you when the plan is built.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="my-age">Your age</label>
            <input id="my-age" type="number" inputMode="numeric" min={0} max={110} defaultValue={me.age} className={cx(field, "w-24 text-center")}
              onBlur={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v) && v !== me.age) void run(() => api.patch(`/api/groups/${tripId}/me`, { age: v }), "Saved"); }} />
            <button type="button" aria-pressed={!!me.stepFree} disabled={busy} onClick={() => run(() => api.patch(`/api/groups/${tripId}/me`, { stepFree: !me.stepFree }), "Saved")}
              className={cx("min-h-11 rounded-2xl px-3.5 text-sm font-semibold ring-1 transition", me.stepFree ? "bg-rani-600 text-white ring-rani-600" : "bg-white text-stone-700 ring-stone-200")}>
              Needs step-free access
            </button>
          </div>
        </div>
      )}

      {admin && (
        <div className="space-y-3 rounded-2xl bg-rani-50/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><UserPlus size={15} aria-hidden /> Add your friends</p>
          {group.inviteCode && (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-sm font-bold tracking-widest text-ink">{group.inviteCode}</code>
              <Button variant="secondary" className="min-h-11 shrink-0" onClick={copy}>
                {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          )}
          <p className="text-sm text-stone-600">Share the link. Friends sign in (or sign up) and join with one tap. Or add someone who already has an account:</p>
          <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) void run(() => api.post(`/api/groups/${tripId}/members`, { email }), "Added to the trip").then(() => setEmail("")); }} className="flex gap-2">
            <label className="sr-only" htmlFor="add-email">Friend&apos;s email</label>
            <input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" className={cx(field, "min-w-0 flex-1")} />
            <Button type="submit" variant="secondary" disabled={busy || !email.trim()} className="shrink-0">Add</Button>
          </form>
          <Link href={`/plan?tab=plan&fromTrip=${tripId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-rani-700 hover:underline">
            Re-plan for the whole group
          </Link>
        </div>
      )}

      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Lightbulb size={15} aria-hidden /> Ideas from the group</p>
        <ul className="mt-2 space-y-2">
          {group.suggestions.filter((s) => s.status !== "dismissed").length === 0 && <li className="text-sm text-stone-600">Nothing yet. Suggest a place you&apos;d love to visit.</li>}
          {group.suggestions.filter((s) => s.status !== "dismissed").map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-2xl bg-white p-2.5 ring-1 ring-stone-200/70">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{s.name}</span>
                <span className="block text-sm text-stone-600">
                  {s.userName}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
                {s.status === "accepted" && <Chip tone="green" className="mt-1"><Check size={12} aria-hidden /> Admin will add it</Chip>}
              </span>
              <button type="button" aria-pressed={s.iVoted} disabled={busy} onClick={() => run(() => api.post(`/api/groups/${tripId}/votes`, { key: s.id }))}
                className={cx("inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold ring-1 transition", s.iVoted ? "bg-rani-600 text-white ring-rani-600" : "bg-white text-stone-700 ring-stone-200")}>
                <ThumbsUp size={14} aria-hidden /> {s.votes}
              </button>
              {admin && s.status === "open" && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Accept idea" disabled={busy} onClick={() => run(() => api.patch(`/api/groups/${tripId}/suggestions`, { id: s.id, status: "accepted" }))} className="grid h-11 w-11 place-items-center rounded-full text-emerald-700 hover:bg-emerald-50"><Check size={18} /></button>
                  <button type="button" aria-label="Dismiss idea" disabled={busy} onClick={() => run(() => api.patch(`/api/groups/${tripId}/suggestions`, { id: s.id, status: "dismissed" }))} className="grid h-11 w-11 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><X size={18} /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (idea.trim().length >= 2) void run(() => api.post(`/api/groups/${tripId}/suggestions`, { name: idea, note }), "Idea shared with the group").then(() => { setIdea(""); setNote(""); }); }} className="mt-2.5 space-y-2">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="idea">Suggest a place</label>
            <input id="idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Suggest a place or activity" maxLength={80} className={cx(field, "min-w-0 flex-1")} />
            <Button type="submit" variant="secondary" disabled={busy || idea.trim().length < 2} className="shrink-0" aria-label="Share idea"><Plus size={16} aria-hidden /> Share</Button>
          </div>
          {idea.trim().length >= 2 && (
            <>
              <label className="sr-only" htmlFor="idea-note">Why</label>
              <input id="idea-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional)" maxLength={200} className={cx(field, "w-full")} />
            </>
          )}
        </form>
      </div>

      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={cx("rounded-2xl px-3.5 py-2.5 text-sm font-medium", msg.tone === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}
