import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Car, Flag, Layers, MapPin } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Skeleton } from '../components/ui'

// Shown only when the composer found a multi-stop bundle that fits the slot and the remaining budget.
export default function BundleSummary() {
  const [params] = useSearchParams()
  const slotId = Number(params.get('slot'))
  const nav = useNavigate()
  const { itinerary, notify, refresh } = useTraveler()
  const [rec, setRec] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.recommendations(slotId).then(setRec).catch(() => setRec({})) }, [slotId])
  if (!rec) return <div className="space-y-3 p-4"><Skeleton className="h-20" /><Skeleton className="h-80" /></div>
  const b = rec.bundle
  if (!b) return <div className="p-6 text-ink-2">No combo fits this window any more. <button type="button" className="font-medium text-accent-ink underline" onClick={() => nav('/')}>Back</button></div>
  const byId = Object.fromEntries(b.experiences.map((e) => [e.id, e]))

  const book = async () => {
    setBusy(true)
    try {
      const r = await api.addToSlot(itinerary.id, slotId, b.experience_ids)
      const booking = await api.book(r.created_item_ids)
      await refresh()
      nav('/booking', { state: { booking } })
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="px-4 pt-4 md:px-6 lg:max-w-2xl lg:px-0 lg:pt-10">
      <button type="button" onClick={() => nav(-1)} className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-ink-2 hover:bg-surface-2"><ArrowLeft size={18} aria-hidden /> Back</button>
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-warn"><Layers size={16} aria-hidden /> Combo for your free window</p>
      <h1 className="mt-1 text-3xl font-bold">{b.experiences.length} stops · {inr(b.total_price)}</h1>
      <p className="text-ink-2">{rec.slot.start} – {rec.slot.end} · back at {rec.slot.dest.name} by {b.back_by_label}</p>

      <Card className="mt-5 p-5">
        <ol className="space-y-1">
          <li className="flex items-center gap-3 text-ink-2"><MapPin size={18} className="text-ink-3" aria-hidden /> Leave {rec.slot.origin.name} at {rec.slot.start}</li>
          {b.legs.map((leg, i) => {
            const e = byId[leg.experience_id]
            return (
              <li key={leg.experience_id}>
                <div className="ml-2 flex items-center gap-2 border-l-2 border-dashed border-line py-2 pl-5 text-sm text-ink-3"><Car size={15} aria-hidden /> {leg.travel_to} min ride</div>
                <div className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand" aria-hidden>{i + 1}</span>
                  <div className="flex-1">
                    <h2 className="text-[17px] font-semibold">{e.title}</h2>
                    <p className="text-sm text-ink-3">{leg.start_label} – {leg.end_label} · {e.location?.name} · {inr(e.price)}</p>
                  </div>
                </div>
              </li>
            )
          })}
          <li>
            <div className="ml-2 flex items-center gap-2 border-l-2 border-dashed border-line py-2 pl-5 text-sm text-ink-3"><Car size={15} aria-hidden /> {b.legs.at(-1).travel_back} min ride</div>
            <div className="flex items-center gap-3 text-ink-2"><Flag size={18} className="text-ink-3" aria-hidden /> Arrive {rec.slot.dest.name} by {b.back_by_label}</div>
          </li>
        </ol>
      </Card>
      <p className="mt-3 text-sm text-ink-3">Picked by best trust-per-rupee, keeping {rec.slot.buffer_min} min of buffer in your {rec.slot.length_label} window.</p>
      <Button className="mt-5 w-full" onClick={book} disabled={busy}>{busy ? 'Booking…' : `Book combo · ${inr(b.total_price)} per person`}</Button>
    </div>
  )
}
