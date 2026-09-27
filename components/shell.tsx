"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Compass, Map, MessageCircle, Plane, UserRound } from "lucide-react";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/plan", label: "Plan", Icon: Map },
  { href: "/trip", label: "Trip", Icon: Plane },
  { href: "/ask", label: "Ask", Icon: MessageCircle },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

interface AppShellProps {
  children: ReactNode;
  userInitials?: string;
}

/** Dual-mode navigation: a sticky top bar on desktop, a floating frosted
 * glass tab bar on phones (the app's primary form factor). */
export function AppShell({ children, userInitials = "You" }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-30 hidden border-b border-stone-200/70 bg-white/90 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-10">
          <Link href="/discover" className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-rani-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
              <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
            </svg>
            Toure
          </Link>
          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            {TABS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} className={cx("rounded-full px-4 py-2 text-[15px] font-semibold transition", active ? "bg-rani-50 text-rani-700" : "text-stone-600 hover:text-ink")}>
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link href="/plan" className="rounded-full bg-rani-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-rani-700">
            Plan a trip
          </Link>
          <Link href="/profile" aria-label="Profile and settings" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">
            {userInitials}
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-32 lg:pb-16">{children}</main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="tab-glass flex w-full items-center gap-1 rounded-full px-1.5 py-1.5">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold transition-all duration-200",
                  active ? "bg-ink text-white shadow-float" : "text-stone-500 hover:text-ink"
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.3 : 2} aria-hidden />
                <span className={active ? "" : "sr-only"}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
