import { createContext, useContext, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { BrainCircuit, CalendarDays, ClipboardList, LayoutDashboard, Map, MonitorPlay, Radio, Shuffle, Store, Users, Wallet } from 'lucide-react'
import { useLive } from '../live'
import { cx } from '../components/ui'
import Dashboard from './Dashboard'
import ToursList from './ToursList'
import TourDetail from './TourDetail'
import Schedule from './Schedule'
import Changes from './Changes'
import Vendors from './Vendors'
import People from './People'
import Payments from './Payments'
import Tasks from './Tasks'
import Model from './Model'

const OpsCtx = createContext({ tick: 0 })
export const useOps = () => useContext(OpsCtx)

const NAV = [
  ['/operator', 'Dashboard', LayoutDashboard, true], ['/operator/tours', 'Tours', Map], ['/operator/schedule', 'Today’s operations', CalendarDays],
  ['/operator/changes', 'Changes', Shuffle], ['/operator/tasks', 'Coordination', ClipboardList], ['/operator/vendors', 'Vendors', Store],
  ['/operator/people', 'Customers & team', Users], ['/operator/payments', 'Payments', Wallet], ['/operator/model', 'Planning model', BrainCircuit],
]

// Operator console: one place to run every customised tour, lifecycle, vendors, coordinators, payments and live changes.
export default function OperatorApp() {
  const [tick, setTick] = useState(0)
  const [flash, setFlash] = useState(null)
  const live = useLive((m) => {
    if (['hello', 'pong'].includes(m.type)) return
    if (m.type === 'change') { setFlash(`${m.event.tour_code}: ${m.event.label}, options sent to traveler`); setTimeout(() => setFlash(null), 5000) }
    setTick((t) => t + 1)
  })
  return (
    <OpsCtx.Provider value={{ tick, refresh: () => setTick((t) => t + 1) }}>
      <div className="flex min-h-full bg-stone-100 text-stone-900">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-stone-950 text-stone-300 md:flex">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-rani-600 font-black text-white">T</div>
            <div><div className="font-bold text-white">TourCraft</div><div className="text-xs text-stone-500">Operator console</div></div>
          </div>
          <nav className="flex-1 space-y-0.5 px-2">
            {NAV.map(([to, label, Icon, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-stone-800 font-semibold text-white' : 'hover:bg-stone-900 hover:text-white')}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-1 border-t border-stone-800 px-4 py-3 text-xs">
            <span className={cx('inline-flex items-center gap-1', live === 'live' ? 'text-emerald-400' : 'text-amber-400')}><Radio size={12} /> {live}</span>
            <Link to="/ops" className="flex items-center gap-1.5 text-stone-400 hover:text-white"><MonitorPlay size={13} /> Live Ops demo</Link>
            <Link to="/" className="block text-stone-400 hover:text-white">Traveler app ↗</Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex gap-1 overflow-x-auto bg-stone-950 px-3 py-2 md:hidden">
            {NAV.map(([to, label, , end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('shrink-0 rounded-md px-2.5 py-1 text-xs', isActive ? 'bg-stone-800 text-white' : 'text-stone-400')}>{label}</NavLink>)}
          </div>
          {flash && <div className="animate-slide-up sticky top-0 z-30 bg-rani-600 px-6 py-2 text-sm font-medium text-white">⚡ {flash}</div>}
          <main className="mx-auto max-w-7xl p-4 md:p-6">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="tours" element={<ToursList />} />
              <Route path="tours/:id" element={<TourDetail />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="changes" element={<Changes />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="people" element={<People />} />
              <Route path="payments" element={<Payments />} />
              <Route path="model" element={<Model />} />
            </Routes>
          </main>
        </div>
      </div>
    </OpsCtx.Provider>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-stone-500">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export function Th({ children, className }) {
  return <th className={cx('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500', className)}>{children}</th>
}
export function Td({ children, className, ...p }) {
  return <td className={cx('px-3 py-2.5 align-top', className)} {...p}>{children}</td>
}
