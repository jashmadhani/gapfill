import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Compass, Map, MessageCircle, Plane } from 'lucide-react'
import { TourProvider, useTour } from './store'
import ChangeCard from './components/ChangeCard'
import { cx } from './components/ui'
import Discover from './pages/Discover'
import DestinationDetail from './pages/DestinationDetail'
import ExperienceDetail from './pages/ExperienceDetail'
import Personalize from './pages/Personalize'
import Plan from './pages/Plan'
import Compare from './pages/Compare'
import Price from './pages/Price'
import Booking from './pages/Booking'
import Trip from './pages/Trip'
import Assist from './pages/Assist'
import Review from './pages/Review'
import Tours from './pages/Tours'
import VendorPortal from './pages/VendorPortal'
import LiveOps from './pages/LiveOps'
import OperatorApp from './operator/OperatorApp'

function Toast() {
  const { toast } = useTour()
  if (!toast) return null
  const tone = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-stone-900' }[toast.tone]
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className={cx('animate-slide-up max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg', tone)}>{toast.msg}</div>
    </div>
  )
}

function TravelerShell({ children }) {
  const { error } = useTour()
  const embed = new URLSearchParams(useLocation().search).has('embed')
  const tabs = [
    { to: '/', label: 'Discover', Icon: Compass, end: true },
    { to: '/plan', label: 'Plan', Icon: Map },
    { to: '/trip', label: 'Trip', Icon: Plane },
    { to: '/assist', label: 'Assist', Icon: MessageCircle },
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
      <ChangeCard />
      <Toast />
    </div>
  )
}

export default function App() {
  const T = (el) => <TravelerShell>{el}</TravelerShell>
  return (
    <TourProvider>
      <Routes>
        <Route path="/" element={T(<Discover />)} />
        <Route path="/destination/:key" element={T(<DestinationDetail />)} />
        <Route path="/experience/:id" element={T(<ExperienceDetail />)} />
        <Route path="/personalize" element={T(<Personalize />)} />
        <Route path="/plan" element={T(<Plan />)} />
        <Route path="/compare/:itemId" element={T(<Compare />)} />
        <Route path="/price" element={T(<Price />)} />
        <Route path="/booking" element={T(<Booking />)} />
        <Route path="/trip" element={T(<Trip />)} />
        <Route path="/assist" element={T(<Assist />)} />
        <Route path="/review" element={T(<Review />)} />
        <Route path="/tours" element={T(<Tours />)} />
        <Route path="/vendor" element={<VendorPortal />} />
        <Route path="/vendor/:id" element={<VendorPortal />} />
        <Route path="/operator/*" element={<OperatorApp />} />
        <Route path="/ops" element={<LiveOps />} />
      </Routes>
    </TourProvider>
  )
}
