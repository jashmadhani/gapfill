import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarDays, House, MonitorPlay, Search, Settings2, Store } from 'lucide-react'
import { TravelerProvider, useTraveler } from './store'
import DisruptionCard from './components/DisruptionCard'
import { cx } from './components/ui'
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

function Toast() {
  const { toast } = useTraveler()
  if (!toast) return null
  const tone = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-stone-900' }[toast.tone]
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className={cx('animate-slide-up max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg', tone)}>{toast.msg}</div>
    </div>
  )
}

function TravelerShell({ children }) {
  const { error } = useTraveler()
  const embed = new URLSearchParams(useLocation().search).has('embed')
  const tabs = [
    { to: '/', label: 'Now', Icon: House, end: true },
    { to: '/timeline', label: 'Day', Icon: CalendarDays },
    { to: '/ask', label: 'Ask', Icon: Search },
    { to: '/trip', label: 'Trip', Icon: Settings2 },
  ]
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-sand-50">
      {error && <div className="bg-red-600 px-4 py-2 text-center text-xs font-medium text-white">{error}</div>}
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + (embed ? '?embed=1' : '')} end={end}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-rani-600' : 'text-stone-500')}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <DisruptionCard />
      <Toast />
    </div>
  )
}

function Home() {
  // Small switcher so judges can jump between the three surfaces from the root of the app.
  return (
    <div className="mx-auto max-w-md p-4">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <NavLink to="/" className="rounded-lg bg-white p-2 text-center ring-1 ring-stone-200">Traveler</NavLink>
        <NavLink to="/vendor" className="flex items-center justify-center gap-1 rounded-lg bg-white p-2 ring-1 ring-stone-200"><Store size={14} /> Vendor</NavLink>
        <NavLink to="/ops" className="flex items-center justify-center gap-1 rounded-lg bg-white p-2 ring-1 ring-stone-200"><MonitorPlay size={14} /> Live Ops</NavLink>
      </div>
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
        <Route path="/trip" element={T(<><TripSetup /><Home /></>)} />
        <Route path="/vendor" element={<VendorConsole />} />
        <Route path="/vendor/chat" element={<VendorChat />} />
        <Route path="/vendor/:id" element={<VendorConsole />} />
        <Route path="/ops" element={<LiveOps />} />
      </Routes>
    </TravelerProvider>
  )
}
