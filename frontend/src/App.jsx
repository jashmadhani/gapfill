import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { BellRing, CalendarDays, House, MonitorPlay, Search, Settings2, Store } from 'lucide-react'
import { TravelerProvider, useTraveler } from './store'
import DisruptionCard from './components/DisruptionCard'
import { ThemeToggle, cx } from './components/ui'
import { LiveStatus, Logo } from './components/brand'
import RightNow from './pages/RightNow'
import Timeline from './pages/Timeline'
import ExperienceDetail from './pages/ExperienceDetail'
import BundleSummary from './pages/BundleSummary'
import Ask from './pages/Ask'
import Booking from './pages/Booking'
import TripSetup from './pages/TripSetup'
import VendorChat from './pages/VendorChat'
import VendorConsole from './pages/VendorConsole'
import LiveOps from './pages/LiveOps'

const TABS = [
  { to: '/', label: 'Now', Icon: House, end: true },
  { to: '/timeline', label: 'My day', Icon: CalendarDays },
  { to: '/ask', label: 'Ask', Icon: Search },
  { to: '/trip', label: 'Trip', Icon: Settings2 },
]

function Toast() {
  const { toast } = useTraveler()
  const tone = { success: 'bg-success text-on-brand', error: 'bg-danger text-on-brand', info: 'bg-ink text-canvas' }[toast?.tone]
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      {toast && <div className={cx('animate-toast max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg', tone)}>{toast.msg}</div>}
    </div>
  )
}

function SnoozedBanner() {
  const { events, snoozed, unsnooze } = useTraveler()
  const waiting = events.filter((e) => snoozed.includes(e.id)).length
  if (!waiting || waiting < events.length) return null
  return (
    <button type="button" onClick={unsnooze}
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto flex min-h-12 max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 text-left text-sm font-medium text-canvas shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <span className="inline-flex items-center gap-2"><BellRing size={18} aria-hidden /> {waiting} replan{waiting > 1 ? 's' : ''} waiting for you</span>
      <span className="font-semibold text-brand-soft">Review</span>
    </button>
  )
}

function TravelerShell({ children }) {
  const { error } = useTraveler()
  const embed = new URLSearchParams(useLocation().search).has('embed')
  const q = embed ? '?embed=1' : ''
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-4 py-6 lg:flex">
        <Logo className="px-2" />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + q} end={end}
              className={({ isActive }) => cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
              <Icon size={20} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <LiveStatus className="px-2" />
          <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
            <NavLink to="/vendor/1" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-ink-2 hover:bg-surface-2 hover:text-ink"><Store size={18} aria-hidden /> Vendor console</NavLink>
            <NavLink to="/ops" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-ink-2 hover:bg-surface-2 hover:text-ink"><MonitorPlay size={18} aria-hidden /> Live Ops</NavLink>
            <ThemeToggle className="justify-start px-3" />
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {error && <div role="alert" className="bg-danger px-4 py-2 text-center text-sm font-medium text-on-brand">{error}</div>}
        <main id="main" className="mx-auto w-full max-w-xl flex-1 pb-28 md:max-w-2xl lg:max-w-5xl lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* Mobile / tablet tab bar */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + q} end={end}
              className={({ isActive }) => cx('flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors', isActive ? 'text-brand' : 'text-ink-3 hover:text-ink')}>
              {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden /> {label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
      <SnoozedBanner />
      <DisruptionCard />
      <Toast />
    </div>
  )
}

export default function App() {
  const T = (el) => <TravelerShell>{el}</TravelerShell>
  return (
    <TravelerProvider>
      <Routes>
        <Route path="/" element={T(<RightNow />)} />
        <Route path="/timeline" element={T(<Timeline />)} />
        <Route path="/experience/:id" element={T(<ExperienceDetail />)} />
        <Route path="/bundle" element={T(<BundleSummary />)} />
        <Route path="/ask" element={T(<Ask />)} />
        <Route path="/booking" element={T(<Booking />)} />
        <Route path="/trip" element={T(<TripSetup />)} />
        <Route path="/vendor" element={<VendorConsole />} />
        <Route path="/vendor/chat" element={<VendorChat />} />
        <Route path="/vendor/:id" element={<VendorConsole />} />
        <Route path="/ops" element={<LiveOps />} />
      </Routes>
    </TravelerProvider>
  )
}
