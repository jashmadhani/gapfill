import { Link } from 'react-router-dom'
import { ArrowLeftRight, CloudRain, Trash2 } from 'lucide-react'
import { fmtDate, inr } from '../api'
import { Chip, KindIcon, MODE, TIER_LABEL, cx } from './ui'

export const VENDOR_CHIP = {
  pending: <Chip tone="amber">Awaiting vendor</Chip>,
  confirmed: <Chip tone="green">Confirmed</Chip>,
  declined: <Chip tone="red">Declined</Chip>,
}
const dead = (i) => ['replaced', 'cancelled'].includes(i.status)

// Travelers only hear about a booking when they need to act; "awaiting vendor" is the operator's job.
function Flag({ i, risk }) {
  if (i.status === 'disrupted' || risk) return <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-bold text-white">Needs a decision</span>
  if (i.vendor_status === 'declined') return <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">Declined</span>
  if (dead(i)) return <span className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-600">{i.status === 'replaced' ? 'Replaced' : 'Cancelled'}</span>
  return null
}

function Time({ label }) {
  const [t, ap] = (label || '').split(' ')
  return <span className="block font-display text-xl font-bold leading-none text-ink">{t}<span className="ml-0.5 text-xs font-bold text-stone-500">{ap}</span></span>
}

const TINT = ['bg-rani-50 text-rani-700', 'bg-amber-50 text-amber-700', 'bg-emerald-50 text-emerald-700', 'bg-sky-50 text-sky-700', 'bg-orange-50 text-orange-700']

export function ItemRow({ i, editable, onRemove, risk, compact, now }) {
  if (i.kind === 'fee') return <li className="py-1 pl-8 text-sm font-medium text-amber-700">{i.title} · {inr(i.price)}</li>
  const canEdit = editable && !i.is_past && !dead(i)
  const state = i.is_past ? 'done' : now != null && i.start_min <= now && now < i.end_min ? 'current' : 'next'
  const sub = i.kind === 'hotel'
    ? `${i.nights} night${i.nights > 1 ? 's' : ''} · ${TIER_LABEL[i.meta?.tier] || ''}`
    : i.kind === 'transport' ? `${MODE[i.meta?.mode]?.label || ''} · ${i.meta?.km} km`
      : `${i.offering?.duration_min} min · ${inr(i.price)}`
  const tint = i.kind === 'hotel' ? 'bg-ink text-white' : i.kind === 'transport' ? 'bg-stone-100 text-stone-700' : TINT[(i.offering_id || 0) % TINT.length]
  const main = (
    <span className="flex min-w-0 items-center gap-3">
      <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', tint)}><KindIcon item={i} size={22} /></span>
      <span className="min-w-0">
        <span className={cx('block text-[17px] font-bold leading-snug text-ink', dead(i) && 'text-stone-400 line-through')}>{i.title}</span>
        <span className="mt-0.5 block text-[15px] text-stone-600">{sub}</span>
      </span>
    </span>
  )
  return (
    <li className={cx('relative pb-3 pl-8', i.is_past && !dead(i) && 'opacity-55')}>
      <span className={cx('absolute left-[0.2rem] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-sand-50',
        state === 'done' ? 'bg-green-600' : state === 'current' ? 'bg-rani-600 pulse-ring' : 'bg-stone-300')} aria-hidden />
      <div className={cx('rounded-[1.6rem] bg-white p-3.5 shadow-soft', state === 'current' && 'ring-2 ring-rani-600', (risk || i.status === 'disrupted') && 'ring-2 ring-orange-500')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Time label={i.start_label} />
            {i.kind === 'hotel' && <span className="text-sm font-bold text-stone-500">check-in</span>}
            {state === 'current' && <span className="rounded-full bg-rani-600 px-2.5 py-0.5 text-xs font-bold text-white">Now</span>}
            {!compact && <Flag i={i} risk={risk} />}
          </span>
          {canEdit && (
            <span className="-my-2 -mr-2 flex">
              <Link to={`/compare/${i.id}`} aria-label={`Swap ${i.title}`} className="grid h-11 w-11 place-items-center rounded-full text-rani-600 hover:bg-rani-50"><ArrowLeftRight size={19} /></Link>
              {i.kind === 'activity' && onRemove && (
                <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${i.title}`} className="grid h-11 w-11 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button>
              )}
            </span>
          )}
        </div>
        {i.kind === 'activity' && i.offering_id ? <Link to={`/experience/${i.offering_id}`} className="block">{main}</Link> : main}
        {risk && <p className="mt-2 text-sm font-medium text-orange-700">{risk.text}</p>}
      </div>
    </li>
  )
}

export default function DayTimeline({ d, editable, onRemove, risks = [], showHistory = false, compact = false, now, title, children }) {
  const items = d.items.filter((i) => showHistory || !dead(i))
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold text-ink">{title || `Day ${d.day} · ${d.dest_name}`}</h3>
          <p className="text-[15px] text-stone-600">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}{d.stay ? ` · ${d.stay.title}` : ''}</p>
        </div>
        {d.rain && <Chip tone="blue"><CloudRain size={14} aria-hidden /> Rain</Chip>}
      </div>
      <ol className="relative">
        <span className="absolute bottom-3 left-[0.62rem] top-5 w-0.5 bg-stone-200" aria-hidden />
        {items.length === 0 && <li className="py-3 pl-8 text-[15px] text-stone-500">Free day — nothing planned.</li>}
        {items.map((i) => <ItemRow key={i.id} i={i} editable={editable} onRemove={onRemove} compact={compact} now={now}
          risk={risks.find((r) => r.item_id === i.id && ['weather', 'unavailable', 'declined', 'connection'].includes(r.kind))} />)}
      </ol>
      {children}
    </section>
  )
}
