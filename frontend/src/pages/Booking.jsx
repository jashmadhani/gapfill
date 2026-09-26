import { Link, useLocation } from 'react-router-dom'
import { CheckCheck, Clock, MapPin, Ticket } from 'lucide-react'
import { inr } from '../api'
import { Card, Chip } from '../components/ui'

const fmt = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export default function Booking() {
  const booking = useLocation().state?.booking
  if (!booking) return <div className="p-6 text-ink-2">No booking to show. <Link className="font-medium text-accent-ink underline" to="/">Back</Link></div>
  return (
    <div className="px-4 pt-10 md:px-6 lg:max-w-xl lg:px-0">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success" aria-hidden><CheckCheck size={32} /></div>
        <h1 className="mt-4 text-3xl font-bold">You’re booked</h1>
        <p className="mt-1 text-ink-2">Added to your day. Show the reference at the venue.</p>
      </div>
      <ul className="mt-6 space-y-3">
        {booking.bookings.map((b) => (
          <Card as="li" key={b.item_id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 font-mono text-sm text-canvas"><Ticket size={14} aria-hidden /> {b.booking_ref}</span>
              <span className="inline-flex items-center gap-1 text-sm text-ink-3"><Clock size={14} aria-hidden /> {fmt(b.start_time)} – {fmt(b.end_time)}</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{b.title}</h2>
            <p className="text-sm text-ink-3">{b.vendor}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-3"><MapPin size={14} aria-hidden /> {b.location?.name}</p>
            <p className="mt-2 text-ink-2">{inr(b.price_per_person)} × {b.people} {b.people > 1 ? 'people' : 'person'}</p>
          </Card>
        ))}
      </ul>
      <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm text-ink-3">Total due at venue</div>
          <div className="font-display text-2xl font-bold">{inr(booking.total)}</div>
        </div>
        <Chip tone="warn">Demo · no payment taken</Chip>
      </Card>
      <Link to="/" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover">Back to Right Now</Link>
    </div>
  )
}
