import { useEffect } from 'react'
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
  const tone = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-stone-900' }[toast?.tone]
  return (
    <div role="status" aria-live="polite" className="pt-safe pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      {toast && <div className={cx('animate-slide-up max-w-sm rounded-full px-5 py-3 text-sm font-medium text-white shadow-float', tone)}>{toast.msg}</div>}
    </div>
  )
}

const TABS = [
  { to: '/', label: 'Discover', Icon: Compass, end: true },
  { to: '/plan', label: 'Plan', Icon: Map },
  { to: '/trip', label: 'Trip', Icon: Plane },
  { to: '/assist', label: 'Assist', Icon: MessageCircle },
]

function TravelerShell({ children }) {
  const { error } = useTour()
  const embed = new URLSearchParams(useLocation().search).has('embed')
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-2xl lg:max-w-3xl">
      {error && <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">{error}</div>}
      <main className="flex-1 pb-32">{children}</main>
      {/* Floating frosted tab bar; sits above the iOS home indicator / Android gesture bar. */}
      <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-md gap-1 rounded-full bg-ink p-2 shadow-float">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + (embed ? '?embed=1' : '')} end={end} aria-label={label}
              className={({ isActive }) => cx('flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition', isActive ? 'flex-[1.8] px-4' : 'flex-1',
                isActive ? 'bg-white text-ink' : 'text-white/70 hover:text-white')}>
              {({ isActive }) => (<><Icon size={21} strokeWidth={2.2} aria-hidden />{isActive && <span>{label}</span>}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
      <ChangeCard />
      <Toast />
    </div>
  )
}

// Every screen opens at the top (the browser keeps the old scroll position otherwise).
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const T = (el) => <TravelerShell>{el}</TravelerShell>
  return (
    <TourProvider>
      <ScrollToTop />
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
