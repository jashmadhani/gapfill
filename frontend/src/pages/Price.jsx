import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BedDouble, Car, CircleAlert, Receipt, ShieldCheck, Sparkles } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Bar, Button, Card, Chip, Empty, JourneyStrip, Segmented, Spinner, cx } from '../components/ui'

const CATS = [['stays', 'Stays', BedDouble], ['transport', 'Transfers', Car], ['experiences', 'Experiences', Sparkles], ['fees', 'Change fees', Receipt]]

// Price → Book: transparent breakdown, budget check, payment plan and one-tap booking of every component.
export default function Price() {
  const { tour, state, refresh, notify } = useTour()
  const nav = useNavigate()
  const [pay, setPay] = useState('deposit')
  const [method, setMethod] = useState('upi')
  const [busy, setBusy] = useState(false)
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="Nothing to price yet" action={<Link to="/personalize"><Button>Design a tour</Button></Link>}>Build a tour first.</Empty></div>
  const p = tour.pricing
  const draft = tour.status === 'draft'
  const errors = tour.conflicts.filter((c) => c.level === 'error')
  const maxDay = Math.max(...p.by_day.map((d) => d.amount), 1)

  const book = async () => {
    setBusy(true)
    try {
      const r = await api.book(tour.id, pay, method)
      await refresh()
      nav('/booking', { state: { booking: r } })
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  const payBalance = async () => {
    setBusy(true)
    try { await api.pay(tour.id, { amount: tour.payments.balance, method, note: 'Balance' }); await refresh(); notify('Balance paid ✓', 'success') }
    catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <div className="text-xs font-medium uppercase tracking-wider text-stone-500">{draft ? 'Price & book' : 'Payments'}</div>
        <h1 className="text-2xl font-bold tracking-tight">{inr(p.total)}</h1>
        <p className="text-sm text-stone-500">{inr(p.per_person)} per person · {tour.travelers} traveler{tour.travelers > 1 ? 's' : ''} · {tour.days} days</p>
      </header>
      <JourneyStrip stage={draft ? 'plan' : tour.stage} hideAction />

      <section className="space-y-3 px-4 pt-4">
        <Card className="p-4">
          <ul className="space-y-2 text-sm">
            {CATS.filter(([k]) => k !== 'fees' || p.categories.fees).map(([k, label, Icon]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-stone-600"><Icon size={15} className="text-stone-400" /> {label}</span>
                <span className="font-medium">{inr(p.categories[k])}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-stone-100 pt-2 text-stone-600"><span>Coordination & support (8%)</span><span>{inr(p.service_fee)}</span></li>
            <li className="flex items-center justify-between text-stone-600"><span>GST (5%)</span><span>{inr(p.gst)}</span></li>
            <li className="flex items-center justify-between border-t border-stone-100 pt-2 text-base font-bold"><span>Total</span><span>{inr(p.total)}</span></li>
          </ul>
          {p.budget > 0 && (
            <div className="mt-3">
              <Bar value={p.total} max={p.budget} tone={p.within_budget ? 'green' : 'red'} />
              <div className={cx('mt-1 text-xs', p.within_budget ? 'text-emerald-700' : 'text-red-600')}>
                {p.within_budget ? `Within your ${inr(p.budget)} budget — ${inr(p.budget - p.total)} to spare` : `${inr(p.over_by)} over your ${inr(p.budget)} budget`}
                {!p.within_budget && draft && <> · <Link to="/plan" className="underline">optimise</Link></>}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cost by day</div>
          <div className="mt-2 space-y-1.5">
            {p.by_day.map((d) => (
              <div key={d.day} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 text-xs">
                <span className="text-stone-500">Day {d.day}</span>
                <Bar value={d.amount} max={maxDay} />
                <span className="text-right font-medium">{inr(d.amount)}</span>
              </div>
            ))}
          </div>
        </Card>

        {draft ? (
          <>
            {errors.length > 0 && (
              <Card className="space-y-1 p-3 ring-red-200">
                {errors.map((c, i) => <div key={i} className="flex items-start gap-1.5 text-xs text-red-700"><CircleAlert size={14} className="shrink-0" /> {c.text}</div>)}
                <Link to="/plan" className="text-xs font-semibold text-rani-600">Fix in plan →</Link>
              </Card>
            )}
            <Card className="space-y-3 p-4">
              <div className="text-sm font-medium">Payment plan</div>
              <Segmented value={pay} onChange={setPay} options={[{ value: 'deposit', label: `30% now · ${inr(p.total * 0.3)}` }, { value: 'full', label: `Pay in full · ${inr(p.total)}` }]} />
              <Segmented value={method} onChange={setMethod} options={[{ value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' }, { value: 'netbanking', label: 'Net banking' }]} />
              <p className="flex items-start gap-1.5 text-xs text-stone-500"><ShieldCheck size={14} className="shrink-0 text-emerald-600" /> Every hotel, transfer and experience is booked with its vendor in one go. Free cancellation windows apply per component; vendor, weather and transport disruptions are covered.</p>
            </Card>
            <Button className="w-full" disabled={busy || errors.length > 0} onClick={book}>{busy ? 'Booking all components…' : `Confirm & book · pay ${inr(pay === 'full' ? p.total : p.total * 0.3)}`}</Button>
            <p className="text-center text-xs text-stone-400">Demo · no real payment is taken</p>
          </>
        ) : (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-stone-500">Paid so far</div>
                <div className="text-xl font-bold">{inr(tour.payments.net_paid)}</div>
              </div>
              <Chip tone={tour.payments.balance <= 0 ? 'green' : 'amber'}>{tour.payments.balance <= 0 ? (tour.payments.balance < 0 ? `${inr(-tour.payments.balance)} credit` : 'Fully paid') : `${inr(tour.payments.balance)} due`}</Chip>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-stone-600">
              {tour.payments.ledger.map((l) => <li key={l.id} className="flex justify-between"><span>{new Date(l.at).toLocaleDateString('en-IN')} · {l.note} · {l.method}</span><span className={l.kind === 'refund' ? 'text-emerald-600' : ''}>{l.kind === 'refund' ? '−' : ''}{inr(l.amount)}</span></li>)}
            </ul>
            {tour.payments.balance > 0 && <Button className="mt-3 w-full" disabled={busy} onClick={payBalance}>Pay balance · {inr(tour.payments.balance)}</Button>}
          </Card>
        )}
      </section>
    </div>
  )
}
