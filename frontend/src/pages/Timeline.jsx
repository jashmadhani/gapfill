import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Pencil, Ticket, Wallet } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Chip, Skeleton, cx, inputCls } from '../components/ui'

function BudgetCard({ itinerary, notify }) {
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState('')
  const env = itinerary.session?.budget_envelope ?? 0
  const pct = env ? Math.min(100, Math.round((itinerary.spent / env) * 100)) : 0

  const save = async (e) => {
    e.preventDefault()
    const n = Number(budget)
    if (!n) return
    try {
      const r = await api.trigger({ trigger_type: 'budget_shrink', new_budget: n })
      if (r.note) notify(r.note)
      setEditing(false)
    } catch (err) { notify(err.message, 'error') }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Wallet size={18} className="text-brand" aria-hidden /> Budget</h2>
        {!editing && <Button variant="ghost" size="sm" onClick={() => { setBudget(String(env)); setEditing(true) }}><Pencil size={15} aria-hidden /> Edit</Button>}
      </div>
      <p className="mt-2 text-ink-2"><b className="text-ink">{inr(itinerary.spent)}</b> planned of <b className="text-ink">{inr(env)}</b> per person</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
        <div className={cx('h-full rounded-full', pct > 90 ? 'bg-danger' : 'bg-brand')} style={{ width: `${pct}%` }} />
      </div>
      {editing && (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label htmlFor="budget" className="text-sm font-medium">New budget (₹ per person)</label>
          <input id="budget" type="number" inputMode="numeric" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

function Legend() {
  const rows = [['bg-ink-3', 'Booked'], ['bg-success', 'GapFill pick'], ['border-2 border-dashed border-brand', 'Free time'], ['bg-danger', 'Needs a replan']]
  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold">Legend</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
        {rows.map(([c, l]) => <li key={l} className="flex items-center gap-2"><span className={cx('h-3 w-3 rounded-full', c)} aria-hidden /> {l}</li>)}
      </ul>
    </Card>
  )
}

export default function Timeline() {
  const { itinerary, notify, events } = useTraveler()
  if (!itinerary) return <div className="space-y-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>

  return (
    <div className="px-4 pt-6 md:px-6 lg:px-0 lg:pt-10">
      <h1 className="text-3xl font-bold lg:text-4xl">Your day</h1>
      <p className="text-ink-3">{new Date(itinerary.trip_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Jaipur</p>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        <div className="mb-5 lg:order-2 lg:sticky lg:top-8 lg:mb-0 lg:space-y-4">
          <BudgetCard itinerary={itinerary} notify={notify} />
          <div className="hidden lg:block"><Legend /></div>
        </div>

        <ol className="relative ml-2 border-l-2 border-line lg:order-1" aria-label="Itinerary">
          {itinerary.items.map((i) => {
            const gap = i.type === 'gap'
            const pendingEv = events.find((e) => e.itinerary_item_id === i.id)
            const time = `${i.start_label}${i.minutes > 0 ? ` – ${i.end_label}` : ''}`
            return (
              <li key={i.id} className={cx('relative mb-3 pl-6', i.is_past && 'opacity-60')}>
                <span className={cx('absolute -left-[8px] top-4 h-3.5 w-3.5 rounded-full ring-4 ring-canvas',
                  gap ? 'border-2 border-dashed border-brand bg-surface' : i.status === 'disrupted' ? 'bg-danger' :
                    i.status === 'replaced' ? 'bg-line' : i.type === 'suggested' ? 'bg-success' : 'bg-ink-3')} aria-hidden />
                {gap ? (
                  <Link to={`/?slot=${i.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft px-4 py-3 text-brand-ink transition-colors hover:border-brand">
                    <div>
                      <div className="text-sm font-semibold">{time}</div>
                      <div className="font-medium">{i.minutes} min free · {i.is_past ? 'passed' : 'tap for the best fit'}</div>
                    </div>
                    <ChevronRight size={20} aria-hidden />
                  </Link>
                ) : (
                  <Card className={cx('px-4 py-3', i.status === 'disrupted' && 'ring-2 ring-danger/60', i.status === 'replaced' && 'bg-surface-2 shadow-none')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-ink-3">{time}</div>
                      <div className="flex flex-wrap gap-1">
                        {i.type === 'suggested' && i.status === 'confirmed' && <Chip tone="success">GapFill pick</Chip>}
                        {i.type === 'booked' && i.status === 'confirmed' && i.minutes > 0 && <Chip>Booked</Chip>}
                        {i.status === 'disrupted' && <Chip tone="danger">Replan offered</Chip>}
                        {i.status === 'replaced' && <Chip>Replaced</Chip>}
                      </div>
                    </div>
                    <h3 className={cx('mt-0.5 text-[17px] font-semibold', i.status === 'replaced' && 'text-ink-3 line-through')}>
                      {i.experience ? <Link to={`/experience/${i.experience.id}`} className="inline-flex min-h-11 items-center hover:underline">{i.title}</Link> : i.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                      {i.location?.name && i.location.name !== 'Unknown' && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {i.location.name}</span>}
                      {i.booking_ref && <span className="inline-flex items-center gap-1"><Ticket size={14} aria-hidden /> {i.booking_ref}</span>}
                      {i.price_paid != null && <span>{inr(i.price_paid)}</span>}
                    </div>
                    {pendingEv && <p className="mt-2 text-sm font-medium text-danger">{pendingEv.trigger_label}: a replacement is waiting for you.</p>}
                  </Card>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
