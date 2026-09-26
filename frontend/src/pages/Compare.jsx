import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, TriangleAlert } from 'lucide-react'
import { api, inr, signedInr } from '../api'
import { useTour } from '../store'
import { Button, Card, Chip, IOBadge, KindIcon, MODE, Rating, Spinner, TIER_LABEL, cx } from '../components/ui'
import { FitBadge, FitChips } from '../components/group'

// Compare alternatives for one component (activity / hotel / transfer) and swap in one tap.
export default function Compare() {
  const { itemId } = useParams()
  const nav = useNavigate()
  const { tour, refresh, notify } = useTour()
  const [data, setData] = useState(null)
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (tour) api.alternatives(tour.id, itemId).then(setData).catch((e) => notify(e.message, 'error')) }, [tour?.id, itemId]) // eslint-disable-line
  if (!data) return <Spinner label="Comparing options…" />
  const it = data.item
  const alts = data.alternatives
  const booked = tour.status === 'booked'

  const swap = async () => {
    const a = alts[pick]
    setBusy(true)
    try {
      const r = await api.swap(tour.id, it.id, it.kind === 'transport' ? { mode: a.mode } : { offering_id: a.offering.id })
      notify(`Swapped in ${r.result.title}${r.result.fee ? ` · fee ${inr(r.result.fee)}` : ''}${r.result.booking_ref ? ` · ${r.result.booking_ref} sent to vendor` : ''}`, 'success')
      await refresh()
      nav('/plan')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="px-4 pt-4">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500"><ArrowLeft size={16} /> Back</button>
      <div className="text-xs font-semibold uppercase tracking-wider text-rani-600">Compare alternatives · Day {it.day}</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{it.kind === 'hotel' ? `Stay in ${it.dest_name}` : it.kind === 'transport' ? `${it.from_name} → ${it.dest_name}` : 'Swap this experience'}</h1>

      <Card className="mt-3 p-3 ring-2 ring-stone-300">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Current</div>
        <div className="mt-0.5 flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 font-semibold"><KindIcon item={it} className="mt-0.5 shrink-0 text-stone-400" size={15} /> {it.title}</div>
          <div className="shrink-0 font-semibold">{inr(it.price)}</div>
        </div>
        <div className="mt-1 text-xs text-stone-500">
          {it.kind === 'hotel' ? `${TIER_LABEL[it.meta.tier]} · ${it.nights} nights · ${it.qty} room(s)` : `${it.start_label} – ${it.end_label}`}
          {it.offering?.rating && it.kind !== 'transport' ? ` · ${it.offering.rating.toFixed(1)}★` : ''}
        </div>
        {booked && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Already booked — {it.policy}</p>}
      </Card>

      <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{alts.length} alternative{alts.length === 1 ? '' : 's'} that fit</div>
      {alts.length === 0 && <Card className="p-4 text-sm text-stone-600">Nothing else fits this slot right now. Try another day, or remove it to free the time.</Card>}
      <div className="space-y-2">
        {alts.map((a, idx) => (
          <button key={idx} type="button" onClick={() => setPick(idx)}
            className={cx('w-full rounded-xl p-3 text-left ring-1 transition', pick === idx ? 'bg-rani-50 ring-2 ring-rani-500' : 'bg-white ring-stone-200 hover:ring-stone-300')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold leading-snug">
                  {pick === idx && <Check size={15} className="text-rani-600" />}
                  {it.kind === 'transport' ? MODE[a.mode]?.label : a.offering.title}
                  {idx === 0 && <Chip tone="green">Best fit</Chip>}
                </div>
                <div className="mt-0.5 text-xs text-stone-500">{a.reason}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cx('font-bold', a.delta > 0 ? 'text-red-600' : a.delta < 0 ? 'text-emerald-600' : 'text-stone-700')}>{a.delta === 0 ? 'same' : signedInr(a.delta_gross)}</div>
                <div className="text-xs text-stone-400">incl. taxes</div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
              {a.start_label && <span className="inline-flex items-center gap-1"><Clock size={12} /> {a.start_label} – {a.end_label}</span>}
              {a.arrive_label && <span className="inline-flex items-center gap-1"><Clock size={12} /> {Math.floor(a.duration_min / 60)}h {a.duration_min % 60}m · arrive {a.arrive_label}</span>}
              {it.kind === 'hotel' && <Chip>{TIER_LABEL[a.offering.tier]}</Chip>}
              {it.kind !== 'transport' && <Rating value={a.offering.rating} count={a.offering.rating_count} className="text-xs" />}
              {it.kind === 'activity' && <IOBadge io={a.offering.indoor_outdoor} />}
              {a.clashes?.length > 0 && <Chip tone="red"><TriangleAlert size={12} /> clashes with {a.clashes.length}</Chip>}
              {a.fit != null && <FitBadge fit={a.fit} />}
              {a.crowd != null && <Chip tone={a.crowd >= 68 ? 'red' : a.crowd >= 45 ? 'amber' : 'green'}>{a.crowd}% busy</Chip>}
            </div>
            {pick === idx && a.members && <div className="mt-2" onClick={(e) => e.stopPropagation()}><FitChips members={a.members} /></div>}
          </button>
        ))}
      </div>
      {alts.length > 0 && (
        <div className="sticky bottom-16 mt-4 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent pb-3 pt-4">
          <Button className="w-full" disabled={pick === null || busy} onClick={swap}>
            {pick === null ? 'Pick an option' : busy ? 'Swapping…' : booked ? 'Swap & rebook' : 'Swap into my plan'}
          </Button>
        </div>
      )}
    </div>
  )
}
