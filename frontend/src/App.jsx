import { useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Compass, Map, MessageCircle, Plane, UserRound } from 'lucide-react'
import { TourProvider, useTour } from './store'
import ChangeCard from './components/ChangeCard'
import ApprovalSheet from './components/ApprovalSheet'
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
import Profile from './pages/Profile'
import Checkout from './pages/Checkout'
import Tickets from './pages/Tickets'
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
  { to: '/profile', label: 'Profile', Icon: UserRound },
]

function Brand() {
  return (
    <span className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-rani-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>
      TourCraft
    </span>
  )
}

function TravelerShell({ children }) {
  const { error, tour } = useTour()
  const embed = new URLSearchParams(useLocation().search).has('embed')
  const q = embed ? '?embed=1' : ''
  const initials = (tour?.customer?.name || 'You').split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <div className="flex min-h-dvh w-full flex-col">
      {/* Web: a real top navigation bar */}
      <header className="sticky top-0 z-30 hidden border-b border-stone-200/70 bg-white/90 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-10">
          <NavLink to={'/' + q}><Brand /></NavLink>
          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            {TABS.slice(0, 4).map(({ to, label, end }) => (
              <NavLink key={to} to={to + q} end={end}
                className={({ isActive }) => cx('rounded-full px-4 py-2 text-[15px] font-semibold transition', isActive ? 'bg-rani-50 text-rani-700' : 'text-stone-600 hover:text-ink')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <NavLink to={'/personalize' + q} className="rounded-full bg-rani-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rani-700">Plan a trip</NavLink>
          <NavLink to={'/profile' + q} aria-label="Profile and settings" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">{initials}</NavLink>
        </div>
      </header>

      {error && <div role="alert" className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">{error}</div>}
      <main className="flex-1 pb-32 lg:pb-16">{children}</main>

      {/* Phone: floating glass pill, not a flush box — the active tab morphs into a filled capsule. */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.9rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="tab-glass flex items-center gap-1 rounded-full px-1.5 py-1.5">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + q} end={end}
              className={({ isActive }) => cx('flex min-h-12 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-all duration-200', isActive ? 'bg-ink pl-3.5 pr-4 text-white shadow-float' : 'text-stone-500 hover:text-ink')}>
              {({ isActive }) => (<><Icon size={21} strokeWidth={isActive ? 2.3 : 2} aria-hidden /><span className={isActive ? '' : 'sr-only'}>{label}</span></>)}
            </NavLink>
          ))}
        </div>
      </nav>
      <ChangeCard />
      <ApprovalSheet />
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
        <Route path="/profile" element={T(<Profile />)} />
        <Route path="/tickets" element={T(<Tickets />)} />
        <Route path="/checkout/:pid" element={<><Checkout /><Toast /></>} />
        <Route path="/vendor" element={<VendorPortal />} />
        <Route path="/vendor/:id" element={<VendorPortal />} />
        <Route path="/operator/*" element={<OperatorApp />} />
        <Route path="/ops" element={<LiveOps />} />
      </Routes>
    </TourProvider>
  )
}
