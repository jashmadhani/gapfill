import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Accessibility, ArrowLeft, Baby, Clock, MapPin, ShieldCheck, Star } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Button, Card, INTEREST, IOBadge, Rating, Spinner, cx } from '../components/ui'

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ExperienceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { tour, notify, refresh } = useTour()
  const [exp, setExp] = useState(null)
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.offering(id).then(setExp) }, [id])
  if (!exp) return <Spinner />

  const editable = tour && ['plan', 'prepare', 'operate'].includes(tour.stage)
  const days = (tour?.days_detail || []).filter((d) => d.dest === exp.dest_key && (!tour.current_day || d.day >= tour.current_day))
  const inPlan = tour?.days_detail?.some((d) => d.items.some((i) => i.offering_id === exp.id && !['replaced', 'cancelled'].includes(i.status)))
  const interests = tour?.prefs?.interests || []

  const add = async () => {
    setBusy(true)
    try {
      const r = await api.addItem(tour.id, exp.id, day ? Number(day) : null)
      notify(`Added to day ${r.result.day} at ${r.result.start_label}${r.result.booking_ref ? ` · ${r.result.booking_ref}` : ''}`, 'success')
      await refresh()
      nav('/plan')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-rani-600 to-rani-900 px-4 pt-4 pb-6 text-white">
        <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-rani-100"><ArrowLeft size={16} /> Back</button>
        <div className="flex flex-wrap gap-1.5">{exp.tags.map((t) => <span key={t} className={cx('rounded-full px-2 py-0.5 text-xs', interests.includes(t) ? 'bg-white text-rani-700' : 'bg-white/15')}>{INTEREST[t]?.label || t}</span>)}</div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{exp.title}</h1>
        <p className="mt-1 text-sm text-rani-100">by {exp.vendor_name} · {exp.dest_name}</p>
      </div>

      <div className="-mt-3 space-y-3 px-4">
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-stone-700">{exp.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-lg font-bold">{inr(exp.price)} <span className="text-xs font-normal text-stone-500">/ person</span></span>
            <span className="inline-flex items-center gap-1 text-stone-600"><Clock size={14} /> {exp.duration_min} min</span>
            <span className="inline-flex items-center gap-1 text-stone-600"><MapPin size={14} /> {exp.dest_name}</span>
            <IOBadge io={exp.indoor_outdoor} />
          </div>
          <div className="mt-2 text-xs text-stone-500">
            Open {exp.open}–{exp.close}{exp.closed_weekdays?.length ? ` · closed ${exp.closed_weekdays.map((d) => WEEKDAY[d]).join(', ')}` : ''} · up to {exp.capacity} guests
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1', exp.step_free ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-50 text-stone-400 line-through')}><Accessibility size={13} /> Step-free</span>
            <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1', exp.kid_friendly ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-50 text-stone-400 line-through')}><Baby size={13} /> Kid friendly</span>
          </div>
        </Card>

        {editable && (
          <Card className="p-4 ring-2 ring-emerald-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"><ShieldCheck size={14} /> Add to {tour.title}</div>
            {inPlan ? <p className="mt-1 text-sm text-stone-600">Already in your tour.</p> : days.length === 0 ? (
              <p className="mt-1 text-sm text-stone-600">{exp.dest_name} isn’t on your route. Add it by building a new tour with this stop.</p>
            ) : (
              <div className="mt-2 flex gap-2">
                <select value={day} onChange={(e) => setDay(e.target.value)} className="flex-1 rounded-lg bg-sand-50 px-2 py-2 text-sm ring-1 ring-stone-200">
                  <option value="">Best day for me</option>
                  {days.map((d) => <option key={d.day} value={d.day}>Day {d.day} · {d.dest_name}{d.rain && exp.indoor_outdoor === 'outdoor' ? ' (rain)' : ''}</option>)}
                </select>
                <Button onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add'}</Button>
              </div>
            )}
            {tour.stage !== 'plan' && !inPlan && days.length > 0 && <p className="mt-2 text-xs text-stone-500">Your tour is booked — this is sent to {exp.vendor_name} for confirmation.</p>}
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ratings & reviews</h3>
            <Rating value={exp.rating} count={exp.rating_count} />
          </div>
          <ul className="mt-3 space-y-2">
            {exp.reviews?.map((r, idx) => (
              <li key={idx} className="rounded-lg bg-stone-50 p-2 text-sm">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />)}</span>
                    {r.author}
                  </span>
                  <span>{r.days_ago === 0 ? 'today' : `${r.days_ago} days ago`}</span>
                </div>
                {r.text && <p className="mt-0.5 text-stone-700">{r.text}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
