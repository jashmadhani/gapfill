import { CloudRain, Sun, Wifi, WifiOff } from 'lucide-react'
import { useTraveler } from '../store'
import { cx } from './ui'

export function Logo({ className }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-display text-xl font-bold text-ink', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand" aria-hidden>
        <svg viewBox="0 0 32 32" className="h-6 w-6"><path d="M7 16h5M20 16h5" stroke="white" strokeWidth="3" strokeLinecap="round" /><circle cx="16" cy="16" r="2.8" fill="#67e8f9" /></svg>
      </span>
      GapFill
    </span>
  )
}

export function LiveStatus({ className }) {
  const { live, itinerary } = useTraveler()
  const ok = live === 'live'
  return (
    <div className={cx('flex flex-wrap items-center gap-2 text-xs font-medium', className)}>
      <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-1', ok ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn')}>
        {ok ? <Wifi size={13} aria-hidden /> : <WifiOff size={13} aria-hidden />} {ok ? 'Live' : live === 'polling' ? 'Polling' : 'Connecting'}
      </span>
      {itinerary && (itinerary.weather_bad
        ? <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-accent-ink"><CloudRain size={13} aria-hidden /> Rain</span>
        : <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-1 text-warn"><Sun size={13} aria-hidden /> Clear</span>)}
    </div>
  )
}

