import { Link } from 'react-router-dom'
import { ArrowLeftRight, BedDouble, CloudRain, Ticket, Trash2 } from 'lucide-react'
import { fmtDate, inr } from '../api'
import { Chip, KindIcon, MODE, TIER_LABEL, cx } from './ui'

export const VENDOR_CHIP = {
  pending: <Chip tone="amber">Awaiting vendor</Chip>,
  confirmed: <Chip tone="green">Confirmed</Chip>,
  declined: <Chip tone="red">Declined</Chip>,
}
const STATUS_CHIP = {
  disrupted: <Chip tone="red">Disrupted — options ready</Chip>,
  replaced: <Chip>Replaced</Chip>,
  cancelled: <Chip>Cancelled</Chip>,
}
const dead = (i) => ['replaced', 'cancelled'].includes(i.status)

export function ItemRow({ i, editable, onRemove, risk, compact }) {
  if (i.kind === 'fee') {
    return <li className="relative mb-2 pl-5 text-xs text-amber-700"><span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-amber-400" />{i.title} · {inr(i.price)}</li>
  }
  const canEdit = editable && !i.is_past && !dead(i)
  const sub = i.kind === 'hotel'
    ? `${i.nights} night${i.nights > 1 ? 's' : ''} · ${i.qty} room${i.qty > 1 ? 's' : ''} · ${TIER_LABEL[i.meta?.tier] || ''}`
    : i.kind === 'transport' ? `${MODE[i.meta?.mode]?.label || ''} · ${i.meta?.km} km${i.meta?.vehicle ? ` · ${i.meta.vehicle}` : ''}`
      : `${i.offering?.duration_min} min · ${i.qty} × ${inr(i.unit_price)}`
  return (
    <li className={cx('relative mb-2.5 pl-5', i.is_past && !dead(i) && 'opacity-50')}>
      <span className={cx('absolute -left-[7px] top-3 h-3 w-3 rounded-full ring-4 ring-sand-50',
        i.status === 'disrupted' ? 'bg-red-500' : dead(i) ? 'bg-stone-300' : i.kind === 'hotel' ? 'bg-sky-500' : i.kind === 'transport' ? 'bg-amber-500' : 'bg-rani-600')} />
      <div className={cx('rounded-xl bg-white px-3 py-2.5 ring-1', i.status === 'disrupted' || risk ? 'ring-red-300' : 'ring-stone-200', dead(i) && 'bg-stone-50')}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-stone-500">
            {i.kind === 'hotel' ? `Check-in ${i.start_label}` : `${i.start_label} – ${i.end_label}`}
          </div>
          <div className="flex flex-wrap justify-end gap-1">{STATUS_CHIP[i.status] || (!compact && VENDOR_CHIP[i.vendor_status])}</div>
        </div>
        <div className={cx('mt-0.5 flex items-start gap-1.5 font-semibold leading-snug', dead(i) && 'text-stone-400 line-through')}>
          <KindIcon item={i} size={15} className="mt-0.5 shrink-0 text-stone-400" />
          {i.kind === 'activity' ? <Link to={`/experience/${i.offering_id}`} className="hover:underline">{i.title}</Link> : i.title}
        </div>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-stone-500">
            <span>{sub}</span>
            <span className="font-medium text-stone-700">{inr(i.price)}</span>
            {i.booking_ref && <span className="inline-flex items-center gap-1"><Ticket size={12} /> {i.booking_ref}</span>}
          </div>
        )}
        {risk && <p className="mt-1.5 text-xs text-red-600">{risk.text}</p>}
        {canEdit && (
          <div className="mt-1.5 flex gap-3">
            <Link to={`/compare/${i.id}`} className="-my-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-rani-600"><ArrowLeftRight size={14} aria-hidden /> Swap</Link>
            {i.kind === 'activity' && onRemove && (
              <button onClick={() => onRemove(i)} type="button" className="-my-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-red-600"><Trash2 size={14} aria-hidden /> Remove</button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export default function DayTimeline({ d, editable, onRemove, risks = [], showHistory = false, compact = false, children }) {
  const items = d.items.filter((i) => showHistory || !dead(i))
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-sm font-bold">Day {d.day} · {d.dest_name}</div>
          <div className="text-xs text-stone-500">{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}
            {d.stay && <> · <BedDouble size={11} className="inline" /> {d.stay.title} (night {d.stay.night}/{d.stay.nights})</>}
          </div>
        </div>
        {d.rain && <Chip tone="blue"><CloudRain size={12} /> Rain</Chip>}
      </div>
      <ol className="relative ml-2 border-l-2 border-stone-200">
        {items.length === 0 && <li className="mb-2 pl-5 text-sm text-stone-400">Free day</li>}
        {items.map((i) => <ItemRow key={i.id} i={i} editable={editable} onRemove={onRemove} compact={compact} risk={risks.find((r) => r.item_id === i.id && ['weather', 'unavailable', 'declined', 'connection'].includes(r.kind))} />)}
      </ol>
      {children}
    </div>
  )
}
