"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Crown, Globe, Heart, IndianRupee, Mail, MapPin, Phone, Ruler, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageBody, PageHero } from "@/components/page";
import { PACE_LABEL, Spinner, cx } from "@/components/ui";
import type { User } from "@/types";

const KEY = "toure-settings";
type Settings = { alerts: boolean; email: boolean; lang: string; units: string };
const loadLocal = (): Settings => {
  try {
    return { alerts: true, email: false, lang: "English", units: "km", ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { alerts: true, email: false, lang: "English", units: "km" };
  }
};

interface MyGroupTrip {
  id: string;
  title: string;
  destination: string;
  status: string;
  startDate: string;
  role: "admin" | "member";
  people: number;
}

interface ProfileResponse {
  user: User;
  tripsCount: number;
  savedCount: number;
  travelersCount: number;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-[0.12em] text-stone-500">{title}</h2>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-[1.6rem] bg-white shadow-soft">{children}</div>
    </section>
  );
}

function Row({
  Icon,
  label,
  value,
  to,
  children,
}: {
  Icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: string;
  to?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rani-50 text-rani-600">
        <Icon size={19} aria-hidden />
      </span>
      <span className="flex-1 text-[16px] font-semibold text-ink">{label}</span>
      {value && <span className="max-w-[45%] truncate text-[15px] text-stone-600">{value}</span>}
      {children}
      {to && !children && <ChevronRight size={18} className="text-stone-400" aria-hidden />}
    </>
  );
  const cls = "flex min-h-16 w-full items-center gap-3.5 px-4 text-left";
  if (to) return <Link href={to} className={cls}>{body}</Link>;
  return <div className={cls}>{body}</div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative grid h-11 w-16 shrink-0 place-items-center">
      <span className={cx("relative block h-8 w-14 rounded-full transition", on ? "bg-rani-600" : "bg-stone-300")}>
        <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-7" : "left-1")} />
      </span>
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [groups, setGroups] = useState<MyGroupTrip[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [s, setS] = useState<Settings>(() => (typeof window === "undefined" ? { alerts: true, email: false, lang: "English", units: "km" } : loadLocal()));

  useEffect(() => {
    api.get<ProfileResponse>("/api/profile").then(setData);
    api.get<{ trips: MyGroupTrip[] }>("/api/groups").then((r) => setGroups(r.trips)).catch(() => {});
  }, []);

  const set = (k: keyof Settings, v: Settings[keyof Settings]) => {
    const n = { ...s, [k]: v };
    setS(n);
    try {
      localStorage.setItem(KEY, JSON.stringify(n));
    } catch {
      /* ignore */
    }
  };

  const join = async () => {
    setJoinError(null);
    try {
      const r = await api.post<{ tripId: string }>("/api/groups/join", { code: joinCode.trim() });
      router.push(`/plan?tripId=${r.tripId}`);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Couldn't join");
    }
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    router.push("/auth/login");
  };

  if (!data) return <PageBody><Spinner /></PageBody>;
  const { user } = data;

  return (
    <div>
      <PageHero size="sm" img={undefined} eyebrow="Profile & settings" title={user.name}>
        {user.homeCity && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-white/85">
            <MapPin size={15} aria-hidden /> {user.homeCity}
          </p>
        )}
      </PageHero>
      <PageBody width="narrow">
        <div className="space-y-7">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Trips", data.tripsCount, "/plan"],
              ["Saved", data.savedCount, "/discover"],
              ["Travelers", data.travelersCount, "/plan"],
            ].map(([l, n, to]) => (
              <Link key={l as string} href={to as string} className="rounded-[1.4rem] bg-white p-4 text-center shadow-soft">
                <span className="block font-display text-2xl font-bold text-ink">{n}</span>
                <span className="text-sm font-semibold text-stone-600">{l}</span>
              </Link>
            ))}
          </div>

          <Group title="Your details">
            <Row Icon={Mail} label="Email" value={user.email} />
            <Row Icon={Phone} label="Phone" value={user.phoneNumber || "Not set"} />
            <Row Icon={Users} label="Travel group" value={`${data.travelersCount} traveler${data.travelersCount > 1 ? "s" : ""}`} to="/plan" />
          </Group>

          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-[0.12em] text-stone-500">Trips &amp; groups</h2>
            <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-soft">
              {groups.length === 0 && <p className="px-4 py-4 text-[15px] text-stone-600">No trips yet. Plan one, or join a friend&apos;s with their code.</p>}
              <ul className="divide-y divide-stone-100">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link href={g.status === "active" ? "/trip" : `/plan?tripId=${g.id}`} className="flex min-h-16 items-center gap-3 px-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rani-50 text-rani-600">{g.role === "admin" ? <Crown size={18} aria-hidden /> : <Users size={18} aria-hidden />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold text-ink">{g.title}</span>
                        <span className="block truncate text-sm text-stone-600">
                          {g.role === "admin" ? "You're the admin" : "Member"} · {g.people} {g.people === 1 ? "person" : "people"}
                        </span>
                      </span>
                      <ChevronRight size={18} className="text-stone-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); if (joinCode.trim().length >= 4) void join(); }} className="flex gap-2 border-t border-stone-100 p-3">
                <label className="sr-only" htmlFor="join-code">Invite code</label>
                <input id="join-code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Join with an invite code" maxLength={20} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-4 text-[16px] text-ink placeholder:text-stone-400 outline-none focus:border-rani-500 focus:ring-2 focus:ring-rani-100" />
                <button type="submit" disabled={joinCode.trim().length < 4} className="min-h-12 shrink-0 rounded-full bg-rani-600 px-5 font-bold text-white disabled:opacity-50">Join</button>
              </form>
              {joinError && <p role="alert" className="px-4 pb-3 text-sm font-medium text-red-700">{joinError}</p>}
            </div>
          </section>

          <Group title="Travel preferences">
            <Row Icon={Heart} label="Pace" value={PACE_LABEL[user.preferences?.preferredPace] || "Not set"} />
            <Row Icon={IndianRupee} label="Budget style" value={user.preferences?.budgetSkew || "Not set"} />
          </Group>

          <Group title="Settings">
            <Row Icon={Bell} label="Trip alerts">
              <Toggle label="Trip alerts" on={s.alerts} onChange={(v) => set("alerts", v)} />
            </Row>
            <Row Icon={Mail} label="Email summaries">
              <Toggle label="Email summaries" on={s.email} onChange={(v) => set("email", v)} />
            </Row>
            <Row Icon={Globe} label="Language">
              <select value={s.lang} onChange={(e) => set("lang", e.target.value)} aria-label="Language" className="min-h-10 rounded-full bg-stone-100 px-3 text-[15px] font-semibold text-ink">
                {["English", "हिन्दी", "Français", "Deutsch"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Row>
            <Row Icon={Ruler} label="Distance">
              <select value={s.units} onChange={(e) => set("units", e.target.value)} aria-label="Distance units" className="min-h-10 rounded-full bg-stone-100 px-3 text-[15px] font-semibold text-ink">
                <option value="km">Kilometres</option>
                <option value="mi">Miles</option>
              </select>
            </Row>
            <Row Icon={IndianRupee} label="Currency" value={`${user.preferences?.homeCurrency || "INR"}`} />
          </Group>

          <Group title="More">
            <button type="button" onClick={logout} className="flex min-h-16 w-full items-center gap-3.5 px-4 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
                <ChevronRight size={19} aria-hidden />
              </span>
              <span className="flex-1 text-[16px] font-semibold text-red-600">Sign out</span>
            </button>
          </Group>
          <p className="text-center text-sm text-stone-500">Toure · your trip, replanned as it happens</p>
        </div>
      </PageBody>
    </div>
  );
}
