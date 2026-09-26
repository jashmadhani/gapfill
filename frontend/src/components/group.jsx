import { useState } from 'react'
import { ChevronDown, Flame, Gem, Heart, Info, Moon, Smile, Sparkles, Sun, Ticket, TriangleAlert, Users, Utensils, Zap } from 'lucide-react'
import { Bar, Card, Chip, cx } from './ui'

// Moods the model understands (see backend app/ml/priors.py)
export const MOOD = {
  tired: { label: 'Tired', Icon: Moon }, energetic: { label: 'Energetic', Icon: Zap }, relaxed: { label: 'Relaxed', Icon: Smile },
  adventurous: { label: 'Adventurous', Icon: Flame }, cultural: { label: 'Cultural', Icon: Sparkles }, foodie: { label: 'Hungry', Icon: Utensils },
  romantic: { label: 'Romantic', Icon: Heart }, restless_kids: { label: 'Kids restless', Icon: Users }, hot: { label: 'Feeling the heat', Icon: Sun },
}

export const fitTone = (f) => (f >= 75 ? 'green' : f >= 55 ? 'amber' : 'red')
const TONE = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200', amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200', stone: 'bg-stone-100 text-stone-600 ring-stone-200',
}
const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export function Avatar({ name, age, tone = 'stone', size = 'h-8 w-8' }) {
  return (
    <span className={cx('relative grid shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ring-white', size,
      { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-red-100 text-red-700', stone: 'bg-rani-100 text-rani-700' }[tone])}
      title={age != null ? `${name}, ${age}` : name}>
      {initials(name)}
    </span>
  )
}

export function FitBadge({ fit, label = 'group fit', className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1', TONE[fitTone(fit)], className)}>
      {fit}% <span className="font-medium">{label}</span>
    </span>
  )
}

// One pill per traveler: predicted fit from the ML model, or a safety veto. Tap to see why.
export function FitChips({ members, className }) {
  const [open, setOpen] = useState(false)
  if (!members?.length) return null
  const why = members.some((m) => m.veto || m.reasons?.length || m.positive)
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {members.map((m) => (
          <span key={m.name} className={cx('inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-semibold ring-1', m.veto ? TONE.stone : TONE[fitTone(m.fit)])}>
            <Avatar name={m.name} age={m.age} tone={m.veto ? 'stone' : fitTone(m.fit)} size="h-5 w-5 text-[10px]" />
            {m.name} {m.age} · {m.veto ? 'not for them' : `${m.fit}%`}{m.fit >= 85 && !m.veto ? ' ★' : ''}
          </span>
        ))}
        {why && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="inline-flex min-h-7 items-center gap-0.5 rounded-full px-1.5 text-xs font-semibold text-rani-600 hover:underline">
            Why <ChevronDown size={13} className={cx('transition', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-2 space-y-1 rounded-2xl bg-sand-50 p-2.5 text-xs text-stone-600">
          {members.map((m) => (
            <li key={m.name}>
              <b className="text-stone-800">{m.name} ({m.age}, {m.band?.toLowerCase()})</b>:{' '}
              {m.veto ? <span className="text-red-700">{m.veto}</span>
                : [m.positive, ...(m.reasons || []).map((r) => `held back by ${r}`)].filter(Boolean).join('; ') || 'good all-round fit'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TAG_ICON = { crowded: Users, heat: Sun, gem: Gem, sunrise: Sun, kids: Smile, senior: Heart, pricey: TriangleAlert, book: Ticket }
const TAG_TONE = { red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-900', green: 'bg-emerald-50 text-emerald-800', blue: 'bg-sky-50 text-sky-700' }

// Smart tags with the advice behind them and an optional one-tap fix ("go here instead", "move to 8 AM").
export function TagList({ tags, onAction, busy }) {
  const [open, setOpen] = useState(null)
  if (!tags?.length) return null
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const I = TAG_ICON[t.key] || Info
          return (
            <button type="button" key={t.key} onClick={() => setOpen(open === t.key ? null : t.key)} aria-expanded={open === t.key}
              className={cx('inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold', TAG_TONE[t.tone] || TAG_TONE.blue,
                t.action && 'ring-1 ring-current/20')}>
              <I size={12} aria-hidden /> {t.label}{t.action ? ' · tip' : ''}
            </button>
          )
        })}
      </div>
      {tags.filter((t) => t.key === open).map((t) => (
        <div key={t.key} className={cx('animate-fade mt-2 rounded-2xl p-3 text-xs leading-relaxed', TAG_TONE[t.tone] || TAG_TONE.blue)}>
          {t.comment}
          {t.action && onAction && (
            <button type="button" disabled={busy} onClick={() => onAction(t.action)}
              className="mt-2 flex min-h-9 w-full items-center justify-center rounded-full bg-white/80 px-3 font-semibold text-stone-900 ring-1 ring-black/5 hover:bg-white disabled:opacity-50">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// Hourly crowd forecast from the crowd model.
export function CrowdChart({ curve, mark }) {
  if (!curve?.length) return null
  const quiet = curve.reduce((a, b) => (b.crowd < a.crowd ? b : a))
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]" role="img" aria-label={`Crowd forecast by hour; quietest around ${quiet.hour}:00`}>
        {curve.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className={cx('w-full rounded-t-md', h.hour === mark ? 'bg-rani-600' : h.crowd >= 68 ? 'bg-red-300' : h.crowd >= 45 ? 'bg-amber-300' : 'bg-emerald-300')}
              style={{ height: `${Math.max(6, h.crowd)}%` }} title={`${h.hour}:00 · ${h.crowd}% busy`} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-stone-500"><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>9 PM</span></div>
    </div>
  )
}

// How the whole plan works for each person (fairness across the trip).
export function GroupFairness({ group, members }) {
  if (!group?.members?.length) return null
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Works for everyone?</h2>
          <p className="text-xs text-stone-500">Predicted enjoyment per person across the trip · ML model</p>
        </div>
        <FitBadge fit={group.fairness} label="fairness" />
      </div>
      <ul className="mt-3 space-y-2.5">
        {group.members.map((m) => {
          const info = members?.find((x) => x.name === m.name)
          return (
            <li key={m.name} className="flex items-center gap-2.5">
              <Avatar name={m.name} age={m.age} tone={fitTone(m.avg)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{m.name} <span className="font-normal text-stone-500">{m.age} · {info?.band || m.band}{info?.step_free ? ' · step-free' : ''}</span></span>
                  <span className="shrink-0 font-bold">{m.avg}%</span>
                </div>
                <Bar value={m.avg} max={100} tone={fitTone(m.avg)} className="mt-1" />
                {m.highlights.length > 0 && <div className="mt-0.5 truncate text-xs text-stone-500">★ {m.highlights.join(' · ')}</div>}
              </div>
            </li>
          )
        })}
      </ul>
      {group.moods?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">Tuned for mood:
          {group.moods.map((k) => { const M = MOOD[k]; return M ? <Chip key={k} tone="rani"><M.Icon size={12} aria-hidden /> {M.label}</Chip> : null })}
        </div>
      )}
    </Card>
  )
}
