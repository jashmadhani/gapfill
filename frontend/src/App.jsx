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
        <div className="glass pointer-events-auto mx-auto grid max-w-md grid-cols-4 rounded-full p-1.5 shadow-float ring-1 ring-white/60">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + (embed ? '?embed=1' : '')} end={end}
              className={({ isActive }) => cx('flex min-h-12 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition',
                isActive ? 'bg-rani-600 text-white shadow-[0_6px_16px_rgb(31_79_143_/_0.35)]' : 'text-stone-500 hover:text-stone-900')}>
              {({ isActive }) => (<><Icon size={19} aria-hidden /><span className={cx(isActive ? 'inline' : 'sr-only sm:not-sr-only')}>{label}</span></>)}
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
