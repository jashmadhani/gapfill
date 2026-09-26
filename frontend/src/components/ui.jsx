import { Accessibility, Armchair, Bath, CloudRain, Moon, Monitor, Star, Sun, Umbrella, VolumeX } from 'lucide-react'
import { useTheme } from '../theme'

export const ACCESS = {
  step_free: { label: 'Step-free', Icon: Accessibility },
  seating_available: { label: 'Seating', Icon: Armchair },
  restroom_onsite: { label: 'Restroom', Icon: Bath },
  sensory_friendly: { label: 'Quiet space', Icon: VolumeX },
}

export const GROUP_LABEL = { solo: 'Solo', couple: 'Couple', family: 'Family', large_group: 'Group' }

export function cx(...a) {
  return a.filter(Boolean).join(' ')
}

const BTN = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover shadow-card',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  accent: 'bg-accent text-on-brand hover:opacity-90',
  danger: 'bg-danger text-on-brand hover:opacity-90',
}

export function Button({ variant = 'primary', size = 'md', className, ...p }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'min-h-11 px-3 text-sm' : 'min-h-12 px-4 text-[15px]',
        BTN[variant], className)}
      {...p}
    />
  )
}

export function Card({ className, as: Tag = 'div', ...p }) {
  return <Tag className={cx('rounded-2xl bg-surface ring-1 ring-line shadow-card', className)} {...p} />
}

const CHIP = {
  neutral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand-ink',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}

export function Chip({ className, children, tone = 'neutral' }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', CHIP[tone], className)}>{children}</span>
}

export function TrustBadge({ exp, showSummary = false }) {
  const s = exp.trust_score ?? 0
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink" aria-label={`Trust score ${s.toFixed(1)} out of 5 from ${exp.trust_meta?.count ?? 0} reviews`}>
        <Star size={15} className="fill-amber-400 text-amber-400" aria-hidden /> {s.toFixed(1)}
        <span className="font-normal text-ink-3">({exp.trust_meta?.count ?? 0})</span>
      </span>
      {showSummary && <span className="text-xs text-ink-3">{exp.trust_meta?.summary}</span>}
    </span>
  )
}

export function AccessIcons({ attrs, highlight = [] }) {
  const on = Object.entries(ACCESS).filter(([k]) => attrs?.[k])
  if (!on.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Accessibility features">
      {on.map(([k, { label, Icon }]) => (
        <li key={k} title={label}
          className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
            highlight.includes(k) ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-2')}>
          <Icon size={14} aria-hidden /> {label}
        </li>
      ))}
    </ul>
  )
}

export function IOBadge({ io }) {
  if (io === 'outdoor') return <Chip tone="warn"><Sun size={13} aria-hidden /> Outdoor</Chip>
  if (io === 'mixed') return <Chip tone="accent"><Umbrella size={13} aria-hidden /> Indoor + outdoor</Chip>
  return <Chip tone="accent"><CloudRain size={13} aria-hidden /> Indoor</Chip>
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-3">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" aria-hidden /> {label}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none', className)} aria-hidden />
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-11 rounded-lg px-2 text-sm font-semibold transition-colors', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

export const inputCls = 'w-full min-h-12 rounded-xl bg-surface px-3.5 text-ink ring-1 ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent'

export function ThemeToggle({ className }) {
  const [theme, setTheme] = useTheme()
  const next = { system: 'light', light: 'dark', dark: 'system' }[theme]
  const Icon = { system: Monitor, light: Sun, dark: Moon }[theme]
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`}
      className={cx('inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink', className)}>
      <Icon size={18} aria-hidden /><span className="sr-only lg:not-sr-only lg:text-sm capitalize">{theme} theme</span>
    </button>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  )
}
