import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BellRing, CalendarClock, Check, CircleCheck, Clock, CloudRain, IndianRupee, MapPin, MessageCircle, Phone, Sparkles, Star, Ticket,
} from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { useTour } from '../store'
import DayTimeline, { VENDOR_CHIP } from '../components/DayTimeline'
import { Button, Card, Chip, Empty, JourneyStrip, KindIcon, Segmented, Spinner, cx } from '../components/ui'

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const live = (i) => !['replaced', 'cancelled'].includes(i.status) && i.kind !== 'fee'

function Coordinator({ c }) {
  if (!c) return null
  return (
    <Card className="flex items-center justify-between p-3">
      <div>
        <div className="text-xs text-stone-500">Your tour coordinator</div>
        <div className="font-semibold">{c.name}</div>
        <div className="text-xs text-stone-500">{c.phone} · {c.languages.join(', ')}</div>
      </div>
      <a href={`tel:${c.phone}`} className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white" aria-label="Call"><Phone size={18} /></a>
    </Card>
  )
}

function Risks({ tour, onFix }) {
  if (!tour.risks.length) return null
  const tone = { high: 'bg-red-50 ring-red-200 text-red-800', medium: 'bg-amber-50 ring-amber-200 text-amber-900', low: 'bg-sky-50 ring-sky-200 text-sky-900' }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><BellRing size={14} /> Heads-up</div>
      {tour.risks.map((r, i) => (
        <div key={i} className={cx('flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-xs ring-1', tone[r.level])}>
          <span>{r.text}</span>
          {['weather', 'unavailable', 'declined', 'connection'].includes(r.kind) && (
            <button onClick={() => onFix(r)} className="shrink-0 font-semibold underline">{r.kind === 'connection' ? 'Options' : 'Fix'}</button>
          )}
        </div>
      ))}
    </div>
  )
}

function Changes({ tour }) {
  if (!tour.changes.length) return null
  return (
    <Card className="p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Plan changes</div>
      <ul className="mt-2 space-y-1.5 text-xs">
        {tour.changes.slice(0, 5).map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2">
            <span className="text-stone-600"><b className="text-stone-800">{c.label}</b> · {c.status === 'accepted' ? `applied “${c.chosen_label}”` : c.status === 'pending' ? 'waiting for you' : 'kept original'}{c.resolved_by && c.resolved_by !== 'traveler' ? ` by ${c.resolved_by}` : ''}</span>
            <Chip tone={c.status === 'accepted' ? 'green' : c.status === 'pending' ? 'rani' : 'stone'}>{c.status}</Chip>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Operate({ tour, state, onFix }) {
  const { notify } = useTour()
  const [late, setLate] = useState(30)
  const [busy, setBusy] = useState(false)
  const today = tour.days_detail[tour.current_day - 1]
  const now = toMin(state.demo_time)
  const items = today.items.filter((i) => live(i) && i.kind !== 'hotel')
  const current = items.find((i) => i.start_min <= now && now < i.end_min)
  const next = items.find((i) => i.start_min > now)
  const hero = current || next
  const tomorrow = tour.days_detail[tour.current_day]

  const fire = async (body, fallback) => {
    setBusy(true)
    try {
      const r = await api.trigger({ ...body, tour_id: tour.id, source: 'traveler' })
      if (!r.events.length) notify(r.note || fallback)
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  const budget = () => {
    const v = prompt('New total budget for the tour (₹)', Math.round(tour.pricing.total * 0.9))
    if (v) fire({ trigger_type: 'budget_change', new_budget: Number(v) }, 'Budget updated')
  }

  return (
    <>
      {hero ? (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-rani-600 to-rani-700 px-4 pt-4 pb-3 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rani-100"><Sparkles size={13} /> {current ? 'Happening now' : 'Up next'}</div>
            <h2 className="mt-1 flex items-start gap-2 text-xl font-bold leading-tight"><KindIcon item={hero} size={20} className="mt-0.5 shrink-0" /> {hero.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-rani-50">
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {hero.start_label} – {hero.end_label}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {hero.dest_name}</span>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {hero.booking_ref && <span className="inline-flex items-center gap-1 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs text-white"><Ticket size={12} /> {hero.booking_ref}</span>}
              {VENDOR_CHIP[hero.vendor_status]}
              <span className="text-xs text-stone-500">{hero.vendor_name}</span>
            </div>
            {!current && <p className="text-sm text-stone-600">Starts in {Math.max(0, hero.start_min - now)} min{hero.kind === 'activity' ? ` · ${hero.offering?.duration_min} min experience` : ''}.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Link to={`/compare/${hero.id}`}><Button variant="secondary" className="w-full">Swap</Button></Link>
              <Link to="/assist"><Button variant="secondary" className="w-full"><MessageCircle size={15} /> Ask</Button></Link>
            </div>
          </div>
        </Card>
      ) : <Empty title="You're done for today">Rest up — tomorrow is ready below.</Empty>}

      <Risks tour={tour} onFix={onFix} />

      <Card className="space-y-2 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Something changed?</div>
        <div className="flex items-center gap-2">
          <div className="flex-1"><Segmented value={late} onChange={setLate} options={[15, 30, 60].map((m) => ({ value: m, label: `${m} min` }))} /></div>
          <Button variant="secondary" disabled={busy} onClick={() => fire({ trigger_type: 'running_late', minutes: late }, 'Nothing is affected — you’re fine.')}><Clock size={15} /> Running late</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => fire({ trigger_type: 'weather', dest: today.dest, date: today.date }, 'No outdoor plans affected.')}><CloudRain size={15} /> It’s raining</Button>
          <Button variant="secondary" disabled={busy} onClick={budget}><IndianRupee size={15} /> New budget</Button>
        </div>
      </Card>

      <DayTimeline d={today} editable risks={tour.risks} onRemove={(i) => confirm(`Remove ${i.title}?\n\n${i.policy}`) && api.removeItem(tour.id, i.id).then(() => notify('Removed'))} />
      {tomorrow && <div className="opacity-80"><DayTimeline d={tomorrow} compact risks={tour.risks} /></div>}
      <Changes tour={tour} />
      <Coordinator c={tour.coordinator} />
    </>
  )
}

function Prepare({ tour, state, onFix }) {
  const { refresh } = useTour()
  const days = Math.round((new Date(tour.start_date) - new Date(state.demo_date)) / 864e5)
  const vouchers = tour.days_detail.flatMap((d) => d.items).filter((i) => live(i) && i.booking_ref)
  const toggle = async (c) => { if (!c.auto) { await api.checklist(tour.id, c.key, !c.done); refresh() } }
  const done = tour.checklist.filter((c) => c.done).length
  return (
    <>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-rani-600 to-rani-700 px-4 py-4 text-white">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rani-100"><CalendarClock size={13} /> Starts in {days} day{days === 1 ? '' : 's'}</div>
          <h2 className="mt-1 text-xl font-bold leading-tight">{tour.title}</h2>
          <p className="mt-1 text-sm text-rani-50">{fmtDate(tour.start_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {tour.route.map((r) => r.name).join(' → ')}</p>
        </div>
      </Card>
      <Risks tour={tour} onFix={onFix} />
      <Card className="p-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-500"><span>Pre-trip checklist</span><span>{done}/{tour.checklist.length}</span></div>
        <ul className="mt-2 space-y-1.5">
          {tour.checklist.map((c) => (
            <li key={c.key}>
              <button onClick={() => toggle(c)} className="flex w-full items-start gap-2 text-left text-sm">
                <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1', c.done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white ring-stone-300')}>{c.done && <Check size={13} />}</span>
                <span className={cx(c.done && 'text-stone-400 line-through')}>{c.label}</span>
              </button>
              {c.key === 'balance' && !c.done && <Link to="/price" className="ml-7 text-xs font-semibold text-rani-600">Pay {inr(tour.payments.balance)} →</Link>}
            </li>
          ))}
        </ul>
      </Card>
      <Coordinator c={tour.coordinator} />
      <Card className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Vouchers ({vouchers.length})</div>
        <ul className="mt-2 divide-y divide-stone-100">
          {vouchers.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <span className="min-w-0 truncate"><span className="text-stone-400">D{v.day}</span> {v.title}</span>
              <span className="flex shrink-0 items-center gap-1.5">{VENDOR_CHIP[v.vendor_status]}<span className="font-mono">{v.booking_ref}</span></span>
            </li>
          ))}
        </ul>
      </Card>
      <Changes tour={tour} />
    </>
  )
}

export default function Trip() {
  const { tour, state, notify } = useTour()
  const nav = useNavigate()
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="No tour yet" action={<Link to="/personalize"><Button>Design a tour</Button></Link>}>Your trip hub appears once you book.</Empty></div>

  const onFix = async (r) => {
    if (r.kind === 'weather') {
      const d = tour.days_detail.find((x) => x.items.some((i) => i.id === r.item_id))
      const res = await api.trigger({ trigger_type: 'weather', dest: d.dest, date: d.date, tour_id: tour.id, source: 'traveler' })
      if (!res.events.length) notify(res.note)
    } else if (r.kind === 'connection') {
      const d = tour.days_detail.find((x) => x.items.some((i) => i.id === r.item_id))
      const tr = d.items.find((i) => i.kind === 'transport' && live(i))
      nav(`/compare/${tr?.id || r.item_id}`)
    } else {
      nav(`/compare/${r.item_id}`)
    }
  }

  const title = { plan: 'Not booked yet', prepare: 'Get ready', operate: `Day ${tour.current_day} of ${tour.days}`, complete: 'Welcome home', review: 'Thanks for travelling' }[tour.stage]
  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <div className="text-xs font-medium uppercase tracking-wider text-stone-500">{fmtDate(state.demo_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(state.demo_time)}</div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {tour.stage === 'operate' && <p className="text-sm text-stone-500">{tour.days_detail[tour.current_day - 1].dest_name} · {tour.title}</p>}
      </header>
      <JourneyStrip stage={tour.stage} />
      <section className="space-y-3 px-4 pt-4">
        {tour.stage === 'plan' && <Empty title="Your plan isn't booked yet" action={<Link to="/price"><Button>Review price & book</Button></Link>}>Once booked, this becomes your live trip hub: vouchers, checklist, alerts and replanning.</Empty>}
        {tour.stage === 'prepare' && <Prepare tour={tour} state={state} onFix={onFix} />}
        {tour.stage === 'operate' && <Operate tour={tour} state={state} onFix={onFix} />}
        {tour.stage === 'complete' && (
          <>
            <Card className="p-5 text-center">
              <CircleCheck className="mx-auto text-emerald-600" size={32} />
              <h2 className="mt-2 font-semibold">{tour.days} days · {tour.route.length} cities · {tour.days_detail.flatMap((d) => d.items).filter((i) => live(i) && i.kind === 'activity').length} experiences</h2>
              <p className="mt-1 text-sm text-stone-500">How was it? Your ratings help us and our local partners improve.</p>
              <Link to="/review"><Button className="mt-3 w-full"><Star size={15} /> Rate your tour</Button></Link>
            </Card>
            <Changes tour={tour} />
          </>
        )}
        {tour.stage === 'review' && (
          <Card className="p-5 text-center">
            <div className="flex justify-center">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={22} className={i < (tour.review?.overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />)}</div>
            <p className="mt-2 text-sm text-stone-600">“{tour.review?.text || 'Thank you!'}”</p>
            <Link to="/personalize"><Button className="mt-3 w-full">Plan your next tour</Button></Link>
          </Card>
        )}
      </section>
    </div>
  )
}
