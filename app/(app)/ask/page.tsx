"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Mail, Map, Plus, Send, Settings, Smile, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Empty, Spinner, cx } from "@/components/ui";
import type { ChatMessage } from "@/types";

const SUGGEST = ["How much have I spent?", "Show my plan", "I'm running late", "It's raining", "Call my coordinator"];
const CHIP_ICONS = [Mail, Smile, Map, Clock, Sparkles];

interface AskResponse {
  trip: { id: string; title: string } | null;
  messages: ChatMessage[];
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
      <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
    </svg>
  );
}

export default function AskPage() {
  const [data, setData] = useState<AskResponse | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<AskResponse>("/api/ask").then(setData);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [data, busy]);

  if (!data) return <Spinner />;

  const send = async (q?: string) => {
    const t = (q ?? text).trim();
    if (!t || busy || !data.trip) return;
    setText("");
    setData((d) => (d ? { ...d, messages: [...d.messages, { role: "user", text: t, at: new Date().toISOString() }] } : d));
    setBusy(true);
    try {
      const r = await api.post<{ messages: ChatMessage[] }>("/api/ask", { tripId: data.trip.id, text: t });
      setData((d) => (d ? { ...d, messages: r.messages } : d));
    } finally {
      setBusy(false);
    }
  };

  if (!data.trip) {
    return (
      <div className="px-5 pt-8">
        <Empty title="No trip yet" action={<Link href="/plan"><Button>Plan a trip</Button></Link>}>
          The assistant works on your trip once you have one.
        </Empty>
      </div>
    );
  }

  const empty = data.messages.length <= 1;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] lg:px-8">
        <span className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
          <span className="text-rani-600">
            <Logo />
          </span>
          Toure Assist
        </span>
        <Link href="/profile" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-600 hover:text-ink">
          <Settings size={19} />
        </Link>
      </header>

      {empty ? (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="px-5 pt-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-1.5 text-sm font-semibold text-stone-600">
              <Sparkles size={14} className="text-violet-500" aria-hidden /> AI assistant
            </span>
            <h1 className="mt-5 text-[2rem] font-bold leading-[1.15] text-ink md:text-4xl">
              Ask about {data.trip.title}
            </h1>
          </div>
          <div className="relative mt-auto px-5 pb-3 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <div className="flex flex-wrap gap-2">
              {SUGGEST.map((q, i) => {
                const Icon = CHIP_ICONS[i % CHIP_ICONS.length];
                return (
                  <button key={q} onClick={() => send(q)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-stone-700 shadow-soft ring-1 ring-white/70 backdrop-blur hover:ring-rani-300">
                    <Icon size={15} className="text-stone-500" aria-hidden />
                    {q}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
          <div className="space-y-2.5">
            {data.messages.map((m, i) => (
              <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] whitespace-pre-line rounded-[1.3rem] px-4 py-2.5 text-[16px] leading-snug shadow-soft", m.role === "user" ? "rounded-br-md bg-rani-600 text-white" : "rounded-bl-md bg-stone-100 text-stone-800")}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-stone-400">•••</div>
              </div>
            )}
            <div ref={end} />
          </div>
        </div>
      )}

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 lg:static lg:block lg:bg-white lg:px-5 lg:pb-3 lg:pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full bg-stone-100 py-1.5 pl-1.5 pr-2 shadow-float ring-1 ring-white/70 lg:shadow-none lg:ring-0"
        >
          <button type="button" aria-label="Attach" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-200">
            <Plus size={20} />
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Got questions…" className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none" />
          <Button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="!min-h-11 !w-11 !p-0">
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
