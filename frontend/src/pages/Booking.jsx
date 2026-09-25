import { Link, useLocation } from 'react-router-dom'
import { CheckCheck, MapPin, Ticket } from 'lucide-react'
import { inr } from '../api'
import { Button, Card } from '../components/ui'

const fmt = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export default function Booking() {
  const booking = useLocation().state?.booking
  if (!booking) return <div className="p-6 text-sm text-stone-500">No booking to show. <Link className="underline" to="/">Back</Link></div>
  return (
    <div className="px-4 pt-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCheck size={32} /></div>
      <h1 className="mt-3 text-2xl font-bold">You’re booked!</h1>
      <p className="text-sm text-stone-500">Added to your day. Show the reference at the venue.</p>
      <div className="mt-5 space-y-2 text-left">
        {booking.bookings.map((b) => (
          <Card key={b.item_id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs text-white"><Ticket size={12} /> {b.booking_ref}</span>
              <span className="text-sm text-stone-500">{fmt(b.start_time)} – {fmt(b.end_time)}</span>
            </div>
            <div className="mt-2 font-semibold">{b.title}</div>
            <div className="text-xs text-stone-500">{b.vendor}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500"><MapPin size={12} /> {b.location?.name}</div>
            <div className="mt-2 text-sm">{inr(b.price_per_person)} × {b.people} {b.people > 1 ? 'people' : 'person'}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-3 flex items-center justify-between p-4 text-left">
        <div>
          <div className="text-xs text-stone-500">Total due at venue</div>
          <div className="text-xl font-bold">{inr(booking.total)}</div>
        </div>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Demo · no payment taken</span>
      </Card>
      <Link to="/"><Button className="mt-5 w-full">Back to Right Now</Button></Link>
    </div>
  )
}
