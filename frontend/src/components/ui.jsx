import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useTour } from '../store'
import {
  Check, Coffee, Accessibility, Baby, BedDouble, Bike, Binoculars, Camera, Car, CloudRain, Compass, Flame, Landmark, Leaf, Moon, Palette,
  Plane, ShoppingBag, Sparkles, Star, Sun, TrainFront, Umbrella, UtensilsCrossed,
} from 'lucide-react'

export const INTEREST = {
  heritage: { label: 'Heritage', Icon: Landmark },
  culture: { label: 'Culture', Icon: Sparkles },
  food: { label: 'Food', Icon: UtensilsCrossed },
  adventure: { label: 'Adventure', Icon: Bike },
  wildlife: { label: 'Wildlife', Icon: Binoculars },
  nature: { label: 'Nature', Icon: Leaf },
  shopping: { label: 'Shopping', Icon: ShoppingBag },
  spiritual: { label: 'Spiritual', Icon: Flame },
  relaxation: { label: 'Relaxation', Icon: Umbrella },
  photography: { label: 'Photography', Icon: Camera },
  nightlife: { label: 'Nightlife', Icon: Moon },
  workshop: { label: 'Workshops', Icon: Palette },
}
export const TIER_LABEL = { budget: 'Budget', standard: 'Standard', premium: 'Premium', luxury: 'Luxury' }
export const PACE_LABEL = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'Packed' }
export const MODE = { car: { label: 'Private car', Icon: Car }, train: { label: 'Train', Icon: TrainFront }, flight: { label: 'Flight', Icon: Plane }, best: { label: 'Best mix', Icon: Compass } }

// The full lifecycle from the problem statement; the traveler app always shows where this tour is in it.
export const JOURNEY = [
  ['discover', 'Discover'], ['personalize', 'Personalize'], ['plan', 'Plan'], ['price', 'Price'], ['book', 'Book'], ['prepare', 'Prepare'],
  ['operate', 'Operate'], ['assist', 'Assist'], ['adapt', 'Adapt'], ['complete', 'Complete'], ['review', 'Review'],
]
export const STAGE_INDEX = { plan: 2, prepare: 5, operate: 6, complete: 9, review: 11, cancelled: 0 }
export const STAGE_CHIP = {
  plan: ['Planning', 'amber'], prepare: ['Upcoming', 'blue'], operate: ['On tour', 'green'], complete: ['Completed', 'stone'],
  review: ['Reviewed', 'rani'], cancelled: ['Cancelled', 'red'],
}

export function cx(...a) {
  return a.filter(Boolean).join(' ')
}

// Full-bleed photo with a brand-blue gradient underneath, so a slow or failed image still looks intentional.
export function Photo({ src, alt = '', className, children, scrim = 'b' }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={cx('relative overflow-hidden bg-gradient-to-br from-rani-500 via-rani-700 to-stone-900', className)}>
      {src && ok && <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setOk(false)} className="animate-fade absolute inset-0 h-full w-full object-cover" />}
      {scrim && <div className={cx('absolute inset-0', scrim === 'b' ? 'scrim-b' : scrim === 't' ? 'scrim-t' : 'scrim-b')} aria-hidden />}
      {scrim === 'both' && <div className="scrim-t absolute inset-0" aria-hidden />}
      {children && <div className="relative h-full">{children}</div>}
    </div>
  )
}

// Round frosted button for use over photos (back, save, share).
export function GlassIconButton({ label, children, className, ...p }) {
  return (
    <button type="button" aria-label={label} className={cx('glass grid h-11 w-11 place-items-center rounded-full text-stone-900 shadow-soft transition hover:bg-white', className)} {...p}>
      {children}
    </button>
  )
}

export function Button({ variant = 'primary', className, ...p }) {
  const styles = {
    primary: 'bg-rani-600 text-white hover:bg-rani-700 active:bg-rani-900 shadow-[0_8px_20px_rgb(31_79_143_/_0.28)]',
    secondary: 'bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100',
    dark: 'bg-stone-900 text-white hover:bg-stone-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none', styles[variant], className)}
      {...p}
    />
  )
}

export function Card({ className, ...p }) {
  return <div className={cx('rounded-3xl bg-white ring-1 ring-stone-200/70 shadow-soft', className)} {...p} />
}

export function Chip({ className, children, tone = 'stone' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    rani: 'bg-rani-50 text-rani-700',
    glass: 'glass text-stone-900',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
    dark: 'bg-stone-800 text-stone-200',
  }
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export function Rating({ value, count, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 text-sm font-semibold text-stone-800', className)}>
      <Star size={14} className="fill-amber-400 text-amber-400" /> {(value ?? 0).toFixed(1)}
      {count != null && <span className="font-normal text-stone-500">({count})</span>}
    </span>
  )
}

export function IOBadge({ io }) {
  if (io === 'outdoor') return <Chip tone="amber"><Sun size={12} /> Outdoor</Chip>
  if (io === 'mixed') return <Chip tone="blue"><Umbrella size={12} /> Indoor + outdoor</Chip>
  return <Chip tone="blue"><CloudRain size={12} /> Indoor</Chip>
}

export function FitIcons({ o }) {
  if (!o) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {o.step_free && <span title="Step-free" className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"><Accessibility size={13} /></span>}
      {o.kid_friendly && <span title="Kid friendly" className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"><Baby size={13} /></span>}
    </span>
  )
}

export function KindIcon({ item, size = 16, className }) {
  if (item.kind === 'hotel') return <BedDouble size={size} className={className} />
  if (item.kind === 'rest') return <Coffee size={size} className={className} />
  if (item.kind === 'transport') {
    const M = MODE[item.meta?.mode]?.Icon || Car
    return <M size={size} className={className} />
  }
  const I = INTEREST[item.offering?.tags?.[0]]?.Icon || Sparkles
  return <I size={size} className={className} />
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-sm text-stone-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rani-500 border-t-transparent" /> {label}
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="grid rounded-full bg-stone-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('min-h-10 rounded-full px-2 text-xs font-semibold transition', value === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-800')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, max, tone = 'rani', className }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  const tones = { rani: 'bg-rani-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', stone: 'bg-stone-400' }
  return <div className={cx('h-2 overflow-hidden rounded-full bg-stone-100', className)}><div className={cx('h-full rounded-full', tones[tone])} style={{ width: `${pct}%` }} /></div>
}

// One line instead of an 11-chip strip: where you are, a thin progress bar, and the single next action.
const NEXT_STEP = {
  plan: ['Planning', 'Review & book', '/price'],
  prepare: ['Booked · getting ready', 'Start my trip', 'start'],
  operate: ['On tour', 'Today’s plan', '/trip'],
  complete: ['Tour complete', 'Rate your tour', '/review'],
  review: ['Reviewed', 'Plan your next trip', '/personalize'],
  cancelled: ['Cancelled', 'Plan a new tour', '/personalize'],
}
export function JourneyStrip({ stage, day, days, hideAction = false }) {
  const at = STAGE_INDEX[stage] ?? 1
  const [label, action, to] = NEXT_STEP[stage] || ['Discover', 'Design your tour', '/personalize']
  const pct = Math.round(((at + 1) / JOURNEY.length) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate font-semibold text-stone-900">{label}{day ? ` · day ${day} of ${days}` : ''}</span>
          <span className="shrink-0 text-xs text-stone-500">step {Math.min(at + 1, JOURNEY.length)} of {JOURNEY.length}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tour progress">
          <div className="h-full rounded-full bg-rani-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {!hideAction && (to === 'start'
        ? <StartTripButton className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-rani-600 px-4 text-sm font-semibold text-white">{action}</StartTripButton>
        : <Link to={to} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-rani-600 px-4 text-sm font-semibold text-white">{action}</Link>)}
    </div>
  )
}

// Step 6 -> 7: a booked tour goes live on its start date. In the demo, move the clock to day 1 so it starts now.
export function StartTripButton({ className, children = 'Start my trip' }) {
  const { refresh, notify } = useTour()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await api.setClock({ day: 1, time: '09:00' })
      await refresh()
      notify('Your trip has started. Have a great day 1!', 'success')
      nav('/trip')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  return <button type="button" onClick={go} disabled={busy} className={className}>{busy ? 'Starting…' : children}</button>
}

// Show the most useful interests first; the rest sit behind "More" so the row stays short.
export const TOP_INTERESTS = ['heritage', 'food', 'culture', 'adventure', 'nature', 'relaxation']
export function InterestPicker({ value, onToggle, size = 'md' }) {
  const [more, setMore] = useState(false)
  const keys = more ? Object.keys(INTEREST) : [...new Set([...TOP_INTERESTS, ...value.filter((k) => !TOP_INTERESTS.includes(k))])]
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const { label, Icon } = INTEREST[k]
        const on = value.includes(k)
        return (
          <button type="button" key={k} onClick={() => onToggle(k)} aria-pressed={on}
            className={cx('inline-flex items-center gap-1.5 rounded-full px-3.5 font-medium transition', size === 'sm' ? 'min-h-10 text-sm' : 'min-h-11 text-sm',
              on ? 'bg-rani-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900')}>
            <Icon size={15} aria-hidden /> {label}
          </button>
        )
      })}
      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
        className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-rani-600 hover:underline">
        {more ? 'Less' : `+${Object.keys(INTEREST).length - keys.length} more`}
      </button>
    </div>
  )
}

// Bottom sheet on phones, centered dialog on tablets+. Escape / backdrop closes.
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-slide-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[2rem]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <Card className="p-5 text-center">
      <Sparkles className="mx-auto text-rani-500" aria-hidden />
      <h2 className="mt-2 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  )
}
