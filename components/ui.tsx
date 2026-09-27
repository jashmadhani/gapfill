"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import {
  Bike,
  Binoculars,
  Camera,
  Flame,
  Landmark,
  Leaf,
  Moon,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  Umbrella,
  UtensilsCrossed,
} from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-rani-600 text-white hover:bg-rani-700 active:bg-rani-900 shadow-[0_8px_20px_rgb(31_79_143_/_0.28)]",
    secondary: "bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50",
    ghost: "text-stone-600 hover:bg-stone-100",
    dark: "bg-stone-900 text-white hover:bg-stone-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      className={cx(
        "btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-3xl bg-white ring-1 ring-stone-200/70 shadow-soft", className)}
      {...props}
    />
  );
}

type ChipTone = "stone" | "rani" | "glass" | "green" | "amber" | "red" | "blue" | "dark";

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}

export function Chip({ children, tone = "stone", className }: ChipProps) {
  const tones: Record<ChipTone, string> = {
    stone: "bg-stone-100 text-stone-700",
    rani: "bg-rani-50 text-rani-700",
    glass: "glass text-stone-900",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-700",
    dark: "bg-stone-800 text-stone-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const TIER_LABEL: Record<string, string> = { budget: "Budget", standard: "Standard", premium: "Premium", luxury: "Luxury" };
export const PACE_LABEL: Record<string, string> = { slow: "Relaxed", moderate: "Balanced", packed: "Packed" };

export const INTEREST: Record<string, { label: string; Icon: typeof Landmark }> = {
  heritage: { label: "Heritage", Icon: Landmark },
  culture: { label: "Culture", Icon: Sparkles },
  food: { label: "Food", Icon: UtensilsCrossed },
  adventure: { label: "Adventure", Icon: Bike },
  wildlife: { label: "Wildlife", Icon: Binoculars },
  nature: { label: "Nature", Icon: Leaf },
  shopping: { label: "Shopping", Icon: ShoppingBag },
  spiritual: { label: "Spiritual", Icon: Flame },
  relaxation: { label: "Relaxation", Icon: Umbrella },
  photography: { label: "Photography", Icon: Camera },
  nightlife: { label: "Nightlife", Icon: Moon },
  workshop: { label: "Workshops", Icon: Palette },
};
export const TOP_INTERESTS = ["heritage", "food", "culture", "adventure", "nature", "relaxation"];

interface PhotoProps {
  src?: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
  scrim?: "b" | "t" | "both" | false;
}

/** Full-bleed photo with a brand-blue gradient underneath, so a slow or
 * failed image still looks intentional. */
export function Photo({ src, alt = "", className, children, scrim = "b" }: PhotoProps) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cx("relative overflow-hidden bg-gradient-to-br from-rani-500 via-rani-700 to-stone-900", className)}>
      {src && ok && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setOk(false)} className="animate-fade absolute inset-0 h-full w-full object-cover" />
      )}
      {scrim && <div className={cx("absolute inset-0", scrim === "t" ? "scrim-t" : "scrim-b")} aria-hidden />}
      {scrim === "both" && <div className="scrim-t absolute inset-0" aria-hidden />}
      {children && <div className="relative h-full">{children}</div>}
    </div>
  );
}

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-sm font-semibold text-stone-800", className)}>
      <Star size={14} className="fill-amber-400 text-amber-400" /> {(value ?? 0).toFixed(1)}
      {count != null && <span className="font-normal text-stone-500">({count})</span>}
    </span>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rani-500 border-t-transparent" /> {label}
    </div>
  );
}

interface SegmentedOption<T> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-full bg-stone-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx("min-h-10 rounded-full px-2 text-xs font-semibold transition", value === o.value ? "bg-white text-stone-900 shadow-soft" : "text-stone-500 hover:text-stone-800")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type BarTone = "rani" | "green" | "amber" | "red" | "stone";

export function Bar({ value, max, tone = "rani", className }: { value: number; max: number; tone?: BarTone; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const tones: Record<BarTone, string> = { rani: "bg-rani-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", stone: "bg-stone-400" };
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-stone-100", className)}>
      <div className={cx("h-full rounded-full transition-all duration-300", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-slide-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[2rem]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-5 text-center">
      <Sparkles className="mx-auto text-rani-500" aria-hidden />
      <h2 className="mt-2 font-semibold">{title}</h2>
      {children && <p className="mt-1 text-sm text-stone-500">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}
