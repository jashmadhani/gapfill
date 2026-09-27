"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Menu, MessageSquarePlus, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button, Spinner, cx } from "@/components/ui";
import type { ChatMessage, NavigateTarget } from "@/types";

const SUGGEST = [
  "What's on my current trip?",
  "How have my preferences changed over past trips?",
  "Show me my day-by-day plan",
  "Recommend something new to do",
];

interface SessionSummary {
  id: string;
  title: string;
  tag: "normal" | "plan";
  readOnly: boolean;
  updatedAt: string;
  lastMessage: string;
}

interface SessionDetail {
  id: string;
  title: string;
  readOnly?: boolean;
  messages: ChatMessage[];
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
      <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
    </svg>
  );
}

function HistoryDrawer({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  sessions: SessionSummary[] | null;
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="animate-fade fixed inset-0 z-50 bg-stone-900/45 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-[85vw] max-w-xs flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <h2 className="text-lg font-bold text-ink">Chats</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
            <X size={19} />
          </button>
        </div>
        <div className="px-4 pb-3">
          <Button variant="secondary" className="w-full" onClick={onNew}>
            <MessageSquarePlus size={16} /> New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {sessions === null && <Spinner />}
          {sessions?.length === 0 && <p className="px-3 py-2 text-sm text-stone-500">No chats yet.</p>}
          {sessions?.map((s) => (
            <div
              key={s.id}
              className={cx("group flex items-center gap-1 rounded-2xl px-1", s.id === activeId ? "bg-rani-50" : "hover:bg-stone-50")}
            >
              <button type="button" onClick={() => onSelect(s.id)} className="min-w-0 flex-1 px-3 py-3 text-left">
                <span className={cx("flex items-center gap-1.5 truncate text-sm font-semibold", s.id === activeId ? "text-rani-700" : "text-ink")}>
                  {s.tag === "plan" && <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">Plan</span>}
                  <span className="truncate">{s.title}</span>
                  {s.readOnly && <Lock size={12} className="shrink-0 text-stone-400" aria-label="Read-only" />}
                </span>
                <span className="block truncate text-xs text-stone-500">{s.lastMessage || "No messages yet"}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                aria-label={`Delete ${s.title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AskPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [active, setActive] = useState<SessionDetail | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    const r = await api.get<{ sessions: SessionSummary[] }>("/api/chat/sessions");
    setSessions(r.sessions);
    return r.sessions;
  };

  const openSession = async (id: string) => {
    const r = await api.get<SessionDetail>(`/api/chat/sessions/${id}`);
    setActive(r);
    setMenuOpen(false);
  };

  const newSession = async () => {
    const r = await api.post<{ id: string }>("/api/chat/sessions");
    await openSession(r.id);
    await loadSessions();
  };

  const deleteSession = async (id: string) => {
    await api.delete(`/api/chat/sessions/${id}`);
    const list = await loadSessions();
    if (active?.id === id) {
      if (list.length) await openSession(list[0].id);
      else await newSession();
    }
  };

  useEffect(() => {
    (async () => {
      const list = await loadSessions();
      const firstNormal = list.find((x) => x.tag === "normal");
      if (firstNormal) await openSession(firstNormal.id);
      else await newSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [active, busy]);

  const send = async (q?: string) => {
    const t = (q ?? text).trim();
    if (!t || busy || !active || active.readOnly) return;
    setText("");
    setActive((a) => (a ? { ...a, messages: [...a.messages, { role: "user", content: t, createdAt: new Date().toISOString() }] } : a));
    setBusy(true);
    try {
      const r = await api.post<{ messages: ChatMessage[]; navigate: { target: NavigateTarget; reason?: string } | null }>(
        `/api/chat/sessions/${active.id}/messages`,
        { text: t }
      );
      setActive((a) => (a ? { ...a, messages: r.messages } : a));
      loadSessions();
      if (r.navigate) {
        setTimeout(() => router.push(`/${r.navigate!.target}`), 900);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!active) return <Spinner />;

  const empty = active.messages.length === 0;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-white pb-[calc(5rem+env(safe-area-inset-bottom))] lg:static lg:inset-auto lg:z-auto lg:min-h-dvh lg:pb-0">
      <header className="shrink-0 flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] lg:px-8">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Chat history" className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-600 hover:text-ink">
          <Menu size={19} />
        </button>
        <span className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
          <span className="text-rani-600">
            <Logo />
          </span>
          Toure Assist
        </span>
        <button type="button" onClick={newSession} aria-label="New chat" className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-600 hover:text-ink">
          <MessageSquarePlus size={19} />
        </button>
      </header>

      {empty ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-5 pt-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-1.5 text-sm font-semibold text-stone-600">
              <Sparkles size={14} className="text-violet-500" aria-hidden /> AI assistant
            </span>
            <h1 className="mt-5 text-[2rem] font-bold leading-[1.15] text-ink md:text-4xl">Ask me anything about your trips.</h1>
          </div>
          <div className="assist-glow pointer-events-none absolute inset-x-0 bottom-0 h-[60%]" aria-hidden />
          <div className="relative mt-auto px-5 pb-3 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <div className="flex flex-wrap gap-2">
              {SUGGEST.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-stone-700 shadow-soft ring-1 ring-white/70 backdrop-blur hover:ring-rani-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
          <div className="space-y-2.5">
            {active.messages.map((m, i) => (
              <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cx(
                    "max-w-[85%] whitespace-pre-line rounded-[1.3rem] px-4 py-2.5 text-[16px] leading-snug shadow-soft",
                    m.role === "user" ? "rounded-br-md bg-rani-600 text-white" : "rounded-bl-md bg-stone-100 text-stone-800"
                  )}
                >
                  {m.content}
                  {m.navigate && <span className="mt-1 block text-xs opacity-70">Opening {m.navigate.target}…</span>}
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

      <div className="shrink-0 flex justify-center px-4 pt-2 lg:block lg:bg-white lg:px-5 lg:pb-3">
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
          <input
            value={text}
            disabled={active.readOnly}
            onChange={(e) => setText(e.target.value)}
            placeholder={active.readOnly ? "This plan chat is read-only" : "Got questions…"}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none"
          />
          <Button type="submit" disabled={busy || !text.trim() || active.readOnly} aria-label="Send" className="!min-h-11 !w-11 !p-0">
            <Send size={16} />
          </Button>
        </form>
      </div>

      <HistoryDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        sessions={sessions}
        activeId={active.id}
        onSelect={openSession}
        onNew={newSession}
        onDelete={deleteSession}
      />
    </div>
  );
}
