"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Spinner, cx } from "@/components/ui";
import type { ChatMessage } from "@/types";

const storageKey = (tripId: string) => `plan-chat:${tripId}`;

function readStored(tripId: string): string | null {
  try {
    return localStorage.getItem(storageKey(tripId));
  } catch {
    return null;
  }
}

/** Bottom-right chat toggle on the plan-detail page. The intake conversation
 * that generated this plan is read-only by design, so this opens a fresh
 * normal-tagged session (also visible in the Ask tab's history) steered at
 * this trip via an ephemeral `context` the server forwards to the agent. */
export default function FloatingChat({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const context = `This chat is about the user's planned trip "${tripTitle}" (trip id ${tripId}). Use get_trip_details with that id to answer questions about it, and help them refine it.`;

  useEffect(() => {
    if (!open || sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const saved = readStored(tripId);
        if (saved) {
          const existing = await api.get<{ id: string; messages: ChatMessage[] }>(`/api/chat/sessions/${saved}`).catch(() => null);
          if (existing && !cancelled) {
            setSessionId(existing.id);
            setMessages(existing.messages);
            return;
          }
        }
        const created = await api.post<{ id: string }>("/api/chat/sessions", { tag: "normal" });
        try {
          localStorage.setItem(storageKey(tripId), created.id);
        } catch {
          /* private mode - session still works, just isn't resumed next visit */
        }
        if (!cancelled) setSessionId(created.id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, tripId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, open]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy || !sessionId) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content: t, createdAt: new Date().toISOString() }]);
    setBusy(true);
    try {
      const r = await api.post<{ messages: ChatMessage[] }>(`/api/chat/sessions/${sessionId}/messages`, { text: t, context });
      setMessages(r.messages);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong - please try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="animate-slide-up fixed inset-x-4 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-40 flex max-h-[60dvh] flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-float ring-1 ring-stone-200/70 sm:left-auto sm:right-6 sm:w-96 lg:bottom-24">
          <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
            <span className="text-sm font-bold text-ink">Refine this trip</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Hide chat" className="grid h-8 w-8 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {loading && <Spinner />}
            {!loading && messages.length === 0 && <p className="text-sm text-stone-500">Ask about your plan, or tell me what to change.</p>}
            {messages.map((m, i) => (
              <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] leading-snug", m.role === "user" ? "rounded-br-md bg-rani-600 text-white" : "rounded-bl-md bg-stone-100 text-stone-800")}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-stone-400">...</div>}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-stone-100 p-2"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or change something" className="min-h-11 min-w-0 flex-1 rounded-full bg-stone-100 px-4 text-[16px] text-ink placeholder:text-stone-500 focus:outline-none" />
            <button type="submit" disabled={busy || !text.trim() || !sessionId} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rani-600 text-white disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide chat" : "Chat about this trip"}
        aria-expanded={open}
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-float lg:bottom-6 lg:right-6"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
