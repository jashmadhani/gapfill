import { Link, useLocation } from 'react-router-dom'
import { CheckCheck, Phone, Ticket } from 'lucide-react'
import { inr } from '../api'
import { useTour } from '../store'
import { Button, Card } from '../components/ui'

export default function Booking() {
  const booking = useLocation().state?.booking
  const { tour } = useTour()
  if (!booking) return <div className="p-6 text-sm text-stone-500">No booking to show. <Link className="underline" to="/">Back</Link></div>
  return (
    <div className="px-4 pt-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCheck size={32} /></div>
      <h1 className="mt-3 text-2xl font-bold">Your tour is booked!</h1>
      <p className="text-sm text-stone-500">{booking.refs.length} components booked with {new Set(booking.refs.map((r) => r.vendor)).size} vendors. They’ll confirm each one, you’ll see ✓ as they do.</p>
      {tour?.coordinator && (
        <Card className="mt-4 flex items-center justify-between p-3 text-left">
          <div>
            <div className="text-xs text-stone-500">Your tour coordinator</div>
            <div className="font-semibold">{tour.coordinator.name}</div>
            <div className="text-xs text-stone-500">{tour.coordinator.languages.join(', ')}</div>
          </div>
          <a href={`tel:${tour.coordinator.phone}`} className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white"><Phone size={18} /></a>
        </Card>
      )}
      <div className="mt-3 space-y-2 text-left">
        {booking.refs.map((b) => (
          <Card key={b.item_id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{b.title}</div>
              <div className="text-xs text-stone-500">Day {b.day} · {b.kind === 'hotel' ? 'check-in' : b.start_label} · {b.vendor}</div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs text-white"><Ticket size={12} /> {b.ref}</span>
          </Card>
        ))}
      </div>
      <Card className="mt-3 flex items-center justify-between p-4 text-left">
        <div>
          <div className="text-xs text-stone-500">Paid now</div>
          <div className="text-xl font-bold">{inr(booking.paid)}</div>
          <div className="text-xs text-stone-500">of {inr(booking.total)} total</div>
        </div>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Demo · no payment taken</span>
      </Card>
      <Link to="/trip"><Button className="mt-5 w-full">Prepare for your trip</Button></Link>
    </div>
  )
}
