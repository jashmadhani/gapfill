import { Accessibility, Armchair, Bath, CloudRain, Star, Sun, Umbrella, VolumeX } from 'lucide-react'

export const ACCESS = {
  step_free: { label: 'Step-free', Icon: Accessibility },
  seating_available: { label: 'Seating', Icon: Armchair },
  restroom_onsite: { label: 'Restroom', Icon: Bath },
  sensory_friendly: { label: 'Quiet / sensory-friendly', Icon: VolumeX },
}

export const GROUP_LABEL = { solo: 'Solo', couple: 'Couple', family: 'Family', large_group: 'Large group' }

export function cx(...a) {
  return a.filter(Boolean).join(' ')
}

export function Button({ variant = 'primary', className, ...p }) {
  const styles = {
    primary: 'bg-rani-600 text-white hover:bg-rani-700 active:bg-rani-900 shadow-sm',
    secondary: 'bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100',
    dark: 'bg-stone-900 text-white hover:bg-stone-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none', styles[variant], className)}
      {...p}
    />
  )
}

export function Card({ className, ...p }) {
  return <div className={cx('rounded-2xl bg-white ring-1 ring-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,.04)]', className)} {...p} />
}

export function Chip({ className, children, tone = 'stone' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    rani: 'bg-rani-50 text-rani-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export function TrustBadge({ exp, showSummary = false }) {
  const s = exp.trust_score ?? 0
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-800">
        <Star size={14} className="fill-amber-400 text-amber-400" /> {s.toFixed(1)}
        <span className="font-normal text-stone-500">({exp.trust_meta?.count ?? 0})</span>
      </span>
      {showSummary && <span className="text-xs text-stone-500">{exp.trust_meta?.summary}</span>}
    </span>
  )
}

export function AccessIcons({ attrs, full = false, highlight = [] }) {
  const on = Object.entries(ACCESS).filter(([k]) => attrs?.[k])
  if (!on.length) return full ? <span className="text-xs text-stone-500">No accessibility features listed</span> : null
  return (
    <span className={cx('flex flex-wrap gap-1.5', full && 'gap-2')}>
      {on.map(([k, { label, Icon }]) => (
        <span key={k} title={label}
          className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
            highlight.includes(k) ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600')}>
          <Icon size={13} /> {full && label}
        </span>
      ))}
    </span>
  )
}

export function IOBadge({ io }) {
  if (io === 'outdoor') return <Chip tone="amber"><Sun size={12} /> Outdoor</Chip>
  if (io === 'mixed') return <Chip tone="blue"><Umbrella size={12} /> Indoor + outdoor</Chip>
  return <Chip tone="blue"><CloudRain size={12} /> Indoor</Chip>
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
    <div className="grid rounded-xl bg-stone-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-2 py-2 text-xs font-semibold transition', value === o.value ? 'bg-white shadow text-stone-900' : 'text-stone-500')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
