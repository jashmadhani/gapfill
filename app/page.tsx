import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth/session";
import {
  Sparkles,
  RefreshCcw,
  Wallet,
  MapPinned,
  ShieldCheck,
  Store,
  Clock,
  Compass,
  ArrowRight,
} from "lucide-react";
import { Button, Chip } from "@/components/ui";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Tell it what you're after",
    body:
      "Type your trip in plain words — dates, budget, vibe — and get a full day-by-day itinerary built around real places, not templates.",
    tone: "rani" as const,
  },
  {
    icon: RefreshCcw,
    title: "Replans itself, mid-trip",
    body:
      "A venue closes, the weather turns, or your budget tightens — the plan reflows automatically and shows you what changed and why.",
    tone: "blue" as const,
  },
  {
    icon: Clock,
    title: "Always know what's now",
    body:
      "A live timeline tracks where you are in the day — done, happening now, up next — so you're never digging through a PDF itinerary.",
    tone: "green" as const,
  },
  {
    icon: Store,
    title: "Book real local vendors",
    body:
      "Every experience is a real, bookable listing from a local vendor — priced per person, with live capacity, not a placeholder link.",
    tone: "amber" as const,
  },
  {
    icon: Wallet,
    title: "Budget that tracks itself",
    body:
      "See exactly what's left to spend as the trip unfolds, and get alternatives that fit when a plan would blow the budget.",
    tone: "rani" as const,
  },
  {
    icon: Compass,
    title: "Learns your taste over time",
    body:
      "Every trip you take sharpens what Toure suggests next — the pace, the themes, the kind of places you actually enjoy.",
    tone: "blue" as const,
  },
  {
    icon: MapPinned,
    title: "Never truly lost",
    body:
      "Lose signal in a crowd or a festival ground and Toure still has your last known position, so help can find you fast.",
    tone: "green" as const,
  },
  {
    icon: ShieldCheck,
    title: "A safety net, not just an app",
    body:
      "Landmark-based recovery and one-tap escalation to your emergency contact — built for the moment your phone can't help you.",
    tone: "red" as const,
  },
];

const STEPS = [
  {
    n: "01",
    title: "Describe the trip",
    body: "Destination, dates, group, budget, and the kind of trip you want — in your own words.",
  },
  {
    n: "02",
    title: "Get a real itinerary",
    body: "A day-by-day plan of bookable places, paced to your group and protected by your budget.",
  },
  {
    n: "03",
    title: "Travel, and let it adapt",
    body: "Toure watches the plan while you live it, and reflows around whatever the day throws at you.",
  },
];

export default async function LandingPage() {
  const session = await getSessionFromCookies();
  if (session) redirect("/discover");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:px-8 lg:px-10">
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
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="btn-label inline-flex min-h-11 items-center justify-center rounded-full px-4 text-stone-600 transition hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/auth/register">
              <Button variant="primary" className="px-4 sm:px-5">
                <span className="hidden sm:inline">Get started</span>
                <span className="sm:hidden">Start</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 pt-12 pb-16 md:px-8 md:pt-20 md:pb-24 lg:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <Chip tone="rani" className="mx-auto">
                <Sparkles size={13} aria-hidden />
                AI-planned, live-adapted itineraries
              </Chip>
              <h1 className="font-serif-display mt-5 text-[2.6rem] leading-[1.05] text-ink md:text-6xl lg:text-7xl">
                Your trip, replanned as it happens.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-stone-600 md:text-lg">
                Toure plans a real, bookable itinerary from a few lines of text — then keeps
                adapting it in real time, all trip long, with a safety net for when signal drops.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/auth/register" className="w-full sm:w-auto">
                  <Button variant="primary" className="w-full px-7 sm:w-auto">
                    Plan your first trip
                    <ArrowRight size={17} aria-hidden />
                  </Button>
                </Link>
                <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full px-7 sm:w-auto">
                    I already have an account
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-stone-500">
                Free to start. No credit card needed.
              </p>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section id="features" className="app-canvas relative">
          <div className="page-sheet-glow" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="h2-section text-ink md:text-3xl">Everything a trip actually needs</h2>
              <p className="mt-2 text-stone-600">
                Not another list of attractions — a plan that holds up once you're actually there.
              </p>
            </div>

            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body, tone }) => (
                <li
                  key={title}
                  className="rounded-[1.6rem] bg-white p-5 shadow-soft ring-1 ring-stone-200/70"
                >
                  <span
                    className={
                      "grid h-11 w-11 place-items-center rounded-2xl " +
                      {
                        rani: "bg-rani-50 text-rani-700",
                        blue: "bg-sky-50 text-sky-700",
                        green: "bg-emerald-50 text-emerald-700",
                        amber: "bg-amber-50 text-amber-800",
                        red: "bg-red-50 text-red-700",
                      }[tone]
                    }
                  >
                    <Icon size={21} strokeWidth={2.1} aria-hidden />
                  </span>
                  <h3 className="h3-title mt-3.5 text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-stone-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="h2-section text-ink md:text-3xl">Three steps, and you're on the road</h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="relative rounded-[1.6rem] bg-sand-50 p-6 ring-1 ring-stone-200/60">
                  <span className="font-display text-3xl font-extrabold text-rani-200">{step.n}</span>
                  <h3 className="h3-title mt-2 text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety callout */}
        <section className="app-canvas relative">
          <div className="page-sheet-glow" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20 lg:px-10">
            <div className="flex flex-col items-center gap-8 rounded-[2rem] bg-ink p-8 text-white md:flex-row md:gap-10 md:p-12">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/10">
                <ShieldCheck size={30} aria-hidden />
              </span>
              <div className="text-center md:text-left">
                <h2 className="font-serif-display text-2xl leading-tight md:text-3xl">
                  Built for the moment your signal drops.
                </h2>
                <p className="mt-2 max-w-xl text-white/75">
                  If you lose connection in a crowd, a market, or a festival ground, Toure already
                  knows your last confirmed position and can help you get found again by what's
                  around you — landmarks, not just coordinates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-stone-200/70 bg-white">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8 md:py-24">
            <h2 className="font-serif-display text-3xl text-ink md:text-4xl">
              Stop building itineraries in tabs and screenshots.
            </h2>
            <p className="mt-3 text-stone-600">
              Describe the trip once. Let it plan itself, and keep planning itself.
            </p>
            <div className="mt-7">
              <Link href="/auth/register">
                <Button variant="primary" className="px-8">
                  Plan your first trip
                  <ArrowRight size={17} aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center text-sm text-stone-500 md:flex-row md:justify-between md:px-8 md:text-left">
          <span>© {new Date().getFullYear()} Toure. Plan less, travel more.</span>
          <div className="flex items-center gap-5">
            <Link href="/auth/login" className="hover:text-ink">
              Log in
            </Link>
            <Link href="/auth/register" className="hover:text-ink">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
