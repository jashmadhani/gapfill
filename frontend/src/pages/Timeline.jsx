import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Pencil, Ticket, Wallet } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Chip, Spinner, cx } from '../components/ui'

const STATUS = {
  confirmed: null,
  pending: null,
  disrupted: <Chip tone="red">Disrupted — replan offered</Chip>,
  replaced: <Chip tone="stone">Replaced</Chip>,
}

export default function Timeline() {
  const { itinerary, notify, events } = useTraveler()
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState('')
  if (!itinerary) return <Spinner />
  const env = itinerary.session?.budget_envelope ?? 0

  const saveBudget = async (e) => {
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
    <div className="px-4 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">Your day</h1>
      <p className="text-sm text-stone-500">{new Date(itinerary.trip_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Jaipur</p>

      <Card className="mt-4 flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm">
          <Wallet size={16} className="text-rani-600" />
          <span><b>{inr(itinerary.spent)}</b> planned of <b>{inr(env)}</b> / person</span>
        </div>
        {!editing && <Button variant="ghost" className="px-2 py-1" onClick={() => { setBudget(String(env)); setEditing(true) }}><Pencil size={14} /> Budget</Button>}
      </Card>
      {editing && (
        <form onSubmit={saveBudget} className="mt-2 flex gap-2">
          <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus
            className="flex-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
          <Button type="submit">Save</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      )}

      <ol className="relative mt-5 ml-2 border-l-2 border-stone-200">
        {itinerary.items.map((i) => {
          const gap = i.type === 'gap'
          const pendingEv = events.find((e) => e.itinerary_item_id === i.id)
          return (
            <li key={i.id} className={cx('relative mb-3 pl-5', i.is_past && 'opacity-50')}>
              <span className={cx('absolute -left-[7px] top-3 h-3 w-3 rounded-full ring-4 ring-sand-50',
                gap ? 'bg-white border-2 border-dashed border-rani-500' : i.status === 'disrupted' ? 'bg-red-500' :
                  i.status === 'replaced' ? 'bg-stone-300' : i.type === 'suggested' ? 'bg-emerald-500' : 'bg-stone-700')} />
              {gap ? (
                <Link to={`/?slot=${i.id}`} className="flex items-center justify-between rounded-xl border-2 border-dashed border-rani-200 bg-rani-50/60 px-3 py-3 text-rani-700">
                  <div>
                    <div className="text-xs font-semibold">{i.start_label} – {i.end_label}</div>
                    <div className="text-sm font-medium">{i.minutes} min free · tap for the best fit</div>
                  </div>
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <div className={cx('rounded-xl bg-white px-3 py-2.5 ring-1',
                  i.status === 'disrupted' ? 'ring-red-300' : 'ring-stone-200', i.status === 'replaced' && 'bg-stone-50')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-stone-500">{i.start_label}{i.minutes > 0 && ` – ${i.end_label}`}</div>
                    <div className="flex gap-1">
                      {i.type === 'suggested' && i.status === 'confirmed' && <Chip tone="green">GapFill pick</Chip>}
                      {i.type === 'booked' && i.status === 'confirmed' && i.minutes > 0 && <Chip>Booked</Chip>}
                      {STATUS[i.status]}
                    </div>
                  </div>
                  <div className={cx('mt-0.5 font-semibold', i.status === 'replaced' && 'line-through text-stone-400')}>
                    {i.experience ? <Link to={`/experience/${i.experience.id}`}>{i.title}</Link> : i.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-stone-500">
                    {i.location?.name && i.location.name !== 'Unknown' && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {i.location.name}</span>}
                    {i.booking_ref && <span className="inline-flex items-center gap-1"><Ticket size={12} /> {i.booking_ref}</span>}
                    {i.price_paid != null && <span>{inr(i.price_paid)}</span>}
                  </div>
                  {pendingEv && <p className="mt-1.5 text-xs text-red-600">{pendingEv.trigger_label}: a replacement is waiting for you.</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
