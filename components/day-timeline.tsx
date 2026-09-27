"use client";

import { BedDouble, Car, Coffee, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { Chip, cx } from "@/components/ui";
import type { EventCard, TripRisk } from "@/types";

const dead = (c: EventCard) => c.status === "dismissed" || c.status === "replaced";

function fmtTime(iso: string) {
  // Card times are stored as the wall-clock time at the destination, written with a "Z" suffix.
  // Read them back in UTC so 09:00 shows as 9:00 am whatever timezone the viewer is in.
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
}

function fmtMoney(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function TypeIcon({ type, size = 22, className }: { type: EventCard["type"]; size?: number; className?: string }) {
  if (type === "accommodation") return <BedDouble size={size} className={className} />;
  if (type === "rest") return <Coffee size={size} className={className} />;
  if (type === "travel") return <Car size={size} className={className} />;
  if (type === "meal") return <UtensilsCrossed size={size} className={className} />;
  return <Sparkles size={size} className={className} />;
}

function RestRow({ card }: { card: EventCard }) {
  return (
    <li className="relative pb-3 pl-8">
      <span className="absolute left-[0.2rem] top-5 h-3.5 w-3.5 rounded-full bg-sky-300 ring-4 ring-sand-50" aria-hidden />
      <div className="rounded-[1.6rem] border-2 border-dashed border-sky-200 bg-sky-50/70 p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sky-700">
            <Coffee size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-sky-800">
              {fmtTime(card.startTime)} – {fmtTime(card.endTime)}
            </span>
            <span className="block text-[17px] font-bold leading-snug text-ink">{card.title}</span>
            {card.fitReason && <span className="mt-0.5 block text-sm text-sky-900">{card.fitReason}</span>}
          </div>
        </div>
      </div>
    </li>
  );
}

interface ItemRowProps {
  card: EventCard;
  editable: boolean;
  onRemove?: (itemId: string) => void;
  risk?: TripRisk;
  now: Date;
}

const TINT = ["bg-rani-50 text-rani-700", "bg-amber-50 text-amber-700", "bg-emerald-50 text-emerald-700", "bg-sky-50 text-sky-700", "bg-orange-50 text-orange-700"];

export function ItemRow({ card, editable, onRemove, risk, now }: ItemRowProps) {
  if (card.type === "rest") return <RestRow card={card} />;
  const start = new Date(card.startTime);
  const end = new Date(card.endTime);
  const isPast = end < now;
  const state = isPast ? "done" : start <= now && now < end ? "current" : "next";
  const canEdit = editable && !isPast && !dead(card) && card.type === "activity";
  const tint = card.type === "accommodation" ? "bg-ink text-white" : card.type === "travel" ? "bg-stone-100 text-stone-700" : TINT[Math.abs(card.itemId.length) % TINT.length];

  return (
    <li className={cx("relative pb-3 pl-8", isPast && !dead(card) && "opacity-55")}>
      <span
        className={cx(
          "absolute left-[0.2rem] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-sand-50",
          state === "done" ? "bg-green-600" : state === "current" ? "bg-rani-600 pulse-ring" : "bg-stone-300"
        )}
        aria-hidden
      />
      <div
        className={cx(
          "rounded-[1.6rem] bg-white p-3.5 shadow-soft",
          state === "current" && "ring-2 ring-rani-600",
          (risk || card.status === "disrupted") && "ring-2 ring-orange-500"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl font-bold leading-none text-ink">{fmtTime(card.startTime)}</span>
            {state === "current" && <span className="rounded-full bg-rani-600 px-2.5 py-0.5 text-xs font-bold text-white">Now</span>}
            {card.status === "disrupted" && <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-bold text-white">Needs a decision</span>}
            {card.status === "suggested" && <Chip tone="amber">Suggested</Chip>}
            {card.status === "confirmed" && card.booking && <Chip tone="green">Confirmed</Chip>}
            {dead(card) && <Chip tone="stone">{card.status === "replaced" ? "Replaced" : "Removed"}</Chip>}
          </span>
          {canEdit && onRemove && (
            <button type="button" onClick={() => onRemove(card.itemId)} aria-label={`Remove ${card.title}`} className="-my-2 -mr-2 grid h-11 w-11 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <span className="flex min-w-0 items-center gap-3">
          <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tint)}>
            <TypeIcon type={card.type} />
          </span>
          <span className="min-w-0">
            <span className={cx("block text-[17px] font-bold leading-snug text-ink", dead(card) && "text-stone-400 line-through")}>{card.title}</span>
            <span className="mt-0.5 block text-[15px] text-stone-600">
              {card.durationMin} min {card.typicalSpend > 0 ? `· ${fmtMoney(card.typicalSpend)}` : ""}
            </span>
          </span>
        </span>
        {card.fitReason && !dead(card) && <p className="mt-2 text-sm text-stone-600">{card.fitReason}</p>}
        {risk && <p className="mt-2 text-sm font-medium text-orange-700">{risk.text}</p>}
      </div>
    </li>
  );
}

interface DayTimelineProps {
  title: string;
  dateLabel: string;
  cards: EventCard[];
  editable?: boolean;
  onRemove?: (itemId: string) => void;
  risks?: TripRisk[];
  now?: Date;
  children?: React.ReactNode;
  showDismissed?: boolean;
}

export default function DayTimeline({ title, dateLabel, cards, editable = false, onRemove, risks = [], now = new Date(), children, showDismissed = false }: DayTimelineProps) {
  const items = cards.filter((c) => showDismissed || !dead(c));
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold text-ink">{title}</h3>
          <p className="text-[15px] text-stone-600">{dateLabel}</p>
        </div>
      </div>
      <ol className="relative">
        <span className="absolute bottom-3 left-[0.62rem] top-5 w-0.5 bg-stone-200" aria-hidden />
        {items.length === 0 && <li className="py-3 pl-8 text-[15px] text-stone-500">Free day, nothing planned.</li>}
        {items.map((c) => (
          <ItemRow key={c.itemId} card={c} editable={editable} onRemove={onRemove} now={now} risk={risks.find((r) => r.itemId === c.itemId)} />
        ))}
      </ol>
      {children}
    </section>
  );
}
