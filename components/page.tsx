"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Heart, Search, Share2 } from "lucide-react";
import { Photo, cx } from "@/components/ui";

interface PageHeroProps {
  img?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  size?: "lg" | "md" | "sm" | "tall";
  back?: boolean;
  save?: { saved: boolean; onSave: () => void; onShare?: () => void };
  className?: string;
  bottom?: ReactNode;
}

/** Full-bleed photo hero with dual scrims and a serif title - the signature
 * look shared by every top-level screen. */
export function PageHero({ img, eyebrow, title, subtitle, children, size = "md", back = false, save, className, bottom }: PageHeroProps) {
  const router = useRouter();
  const h = {
    lg: "min-h-[31rem] lg:min-h-[34rem]",
    md: "min-h-[17rem] lg:min-h-[20rem]",
    sm: "min-h-[12.5rem] lg:min-h-[15rem]",
    tall: "min-h-[27rem] lg:min-h-[30rem]",
  }[size];

  return (
    <Photo src={img} scrim="both" className={cx("lg:mx-6 lg:mt-5 lg:rounded-[2rem]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" aria-hidden />
      <div
        className={cx(
          "relative mx-auto flex max-w-6xl flex-col px-5 pb-12 pt-[max(1rem,env(safe-area-inset-top))] text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.35)] lg:px-10 lg:pb-12",
          h
        )}
      >
        {(back || save) && (
          <div className="flex items-center justify-between pt-4">
            {back ? (
              <button type="button" onClick={() => router.back()} aria-label="Back" className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                <ArrowLeft size={20} />
              </button>
            ) : (
              <span />
            )}
            {save && (
              <span className="flex gap-2">
                <button type="button" onClick={save.onSave} aria-pressed={save.saved} aria-label={save.saved ? "Saved" : "Save"} className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                  <Heart size={19} className={save.saved ? "fill-rose-500 text-rose-500" : ""} />
                </button>
                {save.onShare && (
                  <button type="button" onClick={save.onShare} aria-label="Share" className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                    <Share2 size={18} />
                  </button>
                )}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto pt-10">
          {eyebrow && <p className="text-[15px] font-medium text-white/85">{eyebrow}</p>}
          <h1 className={cx("font-serif-display leading-[1.02] text-white", size === "lg" ? "text-[2.9rem] md:text-6xl lg:text-7xl" : "text-[2.35rem] md:text-5xl")}>{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-base text-white/85 md:text-lg">{subtitle}</p>}
          {children}
        </div>
        {bottom}
      </div>
    </Photo>
  );
}

interface PageBodyProps {
  children: ReactNode;
  className?: string;
  width?: "wide" | "narrow";
}

/** Rounded content sheet that overlaps the hero on mobile. */
export function PageBody({ children, className, width = "wide" }: PageBodyProps) {
  return (
    <div className="app-canvas relative z-10 -mt-7 min-h-[40dvh] overflow-hidden rounded-t-[1.9rem] lg:mt-0 lg:rounded-none">
      <div className="page-sheet-glow" aria-hidden />
      <div className={cx("relative mx-auto px-5 pt-6 pb-6 md:px-8 lg:pt-8", width === "wide" ? "max-w-6xl" : "max-w-3xl", className)}>{children}</div>
    </div>
  );
}

interface SectionHeadProps {
  title: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}

export function SectionHead({ title, action, onAction }: SectionHeadProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="h2-section text-ink">{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="btn-label min-h-11 text-stone-600 hover:text-ink">
          {action}
        </button>
      )}
    </div>
  );
}

interface SearchPillProps {
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  dark?: boolean;
  trailing?: ReactNode;
}

export function SearchPill({ value, onChange, onSubmit, placeholder = "Where to next?", dark = false, trailing }: SearchPillProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      role="search"
      className={cx("flex min-h-14 w-full items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 shadow-float", dark ? "bg-white" : "bg-white ring-1 ring-stone-200/70")}
    >
      <Search size={19} className="h-5 w-5 shrink-0 text-stone-400" aria-hidden />
      <label className="sr-only" htmlFor="search">
        {placeholder}
      </label>
      <input
        id="search"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none"
      />
      {trailing}
    </form>
  );
}
