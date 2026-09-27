import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:pt-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-rani-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
          </svg>
          Toure
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-8">
        <div className="animate-slide-up w-full max-w-md">
          <div className="rounded-[1.9rem] bg-white p-6 shadow-soft ring-1 ring-stone-200/70 md:p-8">
            <p className="caption text-rani-600 uppercase">{eyebrow}</p>
            <h1 className="font-serif-display mt-1.5 text-3xl leading-tight text-ink">{title}</h1>
            <p className="mt-1.5 text-sm text-stone-600">{subtitle}</p>

            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-5 text-center text-sm text-stone-600">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-stone-700">
      {children}
    </label>
  );
}

export const inputClassName =
  "min-h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-[16px] text-ink placeholder:text-stone-400 outline-none transition focus:border-rani-500 focus:bg-white focus:ring-2 focus:ring-rani-100";
