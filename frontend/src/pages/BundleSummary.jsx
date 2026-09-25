import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Layers, Navigation } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Spinner } from '../components/ui'

// Shown only when the composer found a multi-stop bundle that fits the slot and the remaining budget.
export default function BundleSummary() {
  const [params] = useSearchParams()
  const slotId = Number(params.get('slot'))
  const nav = useNavigate()
  const { itinerary, notify, refresh } = useTraveler()
  const [rec, setRec] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.recommendations(slotId).then(setRec).catch(() => setRec({})) }, [slotId])
  if (!rec) return <Spinner />
  const b = rec.bundle
  if (!b) return <div className="p-6 text-sm text-stone-500">No combo fits this window any more. <button className="underline" onClick={() => nav('/')}>Back</button></div>
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
    <div className="px-4 pt-4">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500"><ArrowLeft size={16} /> Back</button>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700"><Layers size={14} /> Combo for your free window</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{b.experiences.length} stops · {inr(b.total_price)}</h1>
      <p className="text-sm text-stone-500">{rec.slot.start} – {rec.slot.end} · back at {rec.slot.dest.name} by {b.back_by_label}</p>

      <Card className="mt-4 p-4">
        <ol className="space-y-4">
          <li className="flex gap-3 text-sm text-stone-500"><Navigation size={16} className="mt-0.5" /> Leave {rec.slot.origin.name} at {rec.slot.start}</li>
          {b.legs.map((leg, i) => {
            const e = byId[leg.experience_id]
            return (
              <li key={leg.experience_id}>
                <div className="ml-7 mb-1 text-xs text-stone-400">{leg.travel_to} min ride</div>
                <div className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rani-600 text-xs font-bold text-white">{i + 1}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{e.title}</div>
                    <div className="text-xs text-stone-500">{leg.start_label} – {leg.end_label} · {e.location?.name} · {inr(e.price)}</div>
                  </div>
                </div>
              </li>
            )
          })}
          <li className="flex gap-3 text-sm text-stone-500"><Navigation size={16} className="mt-0.5" /> {b.legs.at(-1).travel_back} min to {rec.slot.dest.name}, arrive {b.back_by_label}</li>
        </ol>
      </Card>
      <p className="mt-3 text-xs text-stone-500">Picked by best trust-per-rupee, keeping {rec.slot.buffer_min} min of buffer in your {rec.slot.length_label} window.</p>
      <Button className="mt-4 w-full" onClick={book} disabled={busy}>{busy ? 'Booking…' : `Book combo · ${inr(b.total_price)} / person`}</Button>
    </div>
  )
}
