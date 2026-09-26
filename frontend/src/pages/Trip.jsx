import { Suspense, lazy, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight, ArrowRight, ArrowUpRight, BellRing, Check, Navigation, CircleCheck, Clock, CloudRain, IndianRupee, MapPin, MessageCircle, Phone, Smile, Sparkles, Star, Ticket,
} from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { useTour } from '../store'
import DayTimeline, { VENDOR_CHIP, useTagAction } from '../components/DayTimeline'
import { MOOD } from '../components/group'
import { Button, Card, Chip, Empty, JourneyStrip, KindIcon, Photo, Segmented, Sheet, Spinner, StartTripButton, cx } from '../components/ui'
import { destImage } from '../media'
import { buildTripMap } from '../lib/tripMap'

const RouteMap = lazy(() => import('../components/RouteMap'))

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const live = (i) => !['replaced', 'cancelled'].includes(i.status) && i.kind !== 'fee'

function Coordinator({ c }) {
  if (!c) return null
  return (
    <div className="flex items-center gap-4 rounded-[1.75rem] bg-white p-3 pr-4 shadow-soft">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-rani-50 font-display text-xl font-bold text-rani-700">{c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-500">Your coordinator</span>
        <span className="block truncate text-lg font-bold text-ink">{c.name}</span>
        <span className="block truncate text-sm text-stone-600">{c.languages.join(' · ')}</span>
      </span>
      <a href={`tel:${c.phone}`} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-green-600 text-white" aria-label={`Call ${c.name}`}><Phone size={22} /></a>
    </div>
  )
}

function Risks({ tour, onFix }) {
  // "Vendor hasn't confirmed yet" is the operator's job, so travelers see one quiet line, not a list.
  const pending = tour.risks.filter((r) => r.kind === 'unconfirmed').length
  const shown = tour.risks.filter((r) => r.kind !== 'unconfirmed')
  if (!shown.length && !pending) return null
  const tone = { high: 'bg-red-50 ring-red-200 text-red-800', medium: 'bg-amber-50 ring-amber-200 text-amber-900', low: 'bg-sky-50 ring-sky-200 text-sky-900' }
  return (
    <div className="space-y-2">
      {shown.map((r, i) => (
        <div key={i} className={cx('flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ring-1', tone[r.level])}>
          <span className="flex items-start gap-2"><BellRing size={16} className="mt-0.5 shrink-0" aria-hidden /> {r.text}</span>
          {['weather', 'unavailable', 'declined', 'connection'].includes(r.kind) && (
            <button type="button" onClick={() => onFix(r)} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/70 px-4 font-semibold">{r.kind === 'connection' ? 'Options' : 'Fix'}</button>
          )}
        </div>
      ))}
      {pending > 0 && <p className="flex items-center gap-2 px-1 text-sm text-stone-500"><CircleCheck size={15} aria-hidden /> {pending} booking{pending > 1 ? 's' : ''} being confirmed by local partners. Nothing for you to do.</p>}
    </div>
  )
}

// One entry point for every "something changed" report; options only appear when needed.
function ReportChange({ tour, today, fire, busy }) {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('menu')
  const [late, setLate] = useState(30)
  const total = Math.round(tour.pricing.total)
  const [budget, setBudget] = useState(total)
  const [moodText, setMoodText] = useState('')
  const [moods, setMoods] = useState([])
  const { notify, refresh } = useTour()
  const close = () => { setOpen(false); setView('menu') }
  // Mood check-in: free text is read by the mood model, then the rest of the day is re-scored for each person.
  const checkIn = async () => {
    try {
      const r = await api.moodCheckin(tour.id, { text: moodText, moods })
      if (!r.events.length) notify(r.note || 'Noted, your plan already suits that.')
      setMoodText(''); setMoods([]); close(); refresh()
    } catch (e) { notify(e.message, 'error') }
  }
  const go = async (body, fallback) => { await fire(body, fallback); close() }
  const opt = (Icon, title, sub, onClick) => (
    <button type="button" onClick={onClick} disabled={busy}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left shadow-soft ring-1 ring-stone-200/70 transition hover:ring-stone-300 disabled:opacity-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rani-50 text-rani-600"><Icon size={18} aria-hidden /></span>
      <span className="min-w-0"><span className="block font-semibold">{title}</span><span className="block text-sm text-stone-500">{sub}</span></span>
    </button>
  )
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}><BellRing size={16} aria-hidden /> Report a change</Button>
      <Sheet open={open} onClose={close} title={view === 'late' ? 'How late are you?' : view === 'budget' ? 'New total budget' : view === 'mood' ? 'How’s everyone feeling?' : 'What changed?'}>
        {view === 'menu' && (
          <div className="space-y-2">
            {opt(Smile, 'How’s everyone feeling?', 'We’ll re-score the day for each person', () => setView('mood'))}
            {opt(Clock, 'Running late', 'We’ll shift or swap what’s affected', () => setView('late'))}
            {opt(CloudRain, 'It’s raining', 'Swap outdoor plans for indoor ones', () => go({ trigger_type: 'weather', dest: today.dest, date: today.date }, 'No outdoor plans affected.'))}
            {opt(IndianRupee, 'Change my budget', 'We’ll re-price and suggest savings', () => setView('budget'))}
            {opt(MessageCircle, 'Something else', 'Tell the trip assistant', () => { close(); nav('/assist') })}
          </div>
        )}
        {view === 'mood' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(MOOD).map(([k, { label, Icon }]) => (
                <button key={k} type="button" aria-pressed={moods.includes(k)} onClick={() => setMoods((m) => m.includes(k) ? m.filter((x) => x !== k) : [...m, k])}
                  className={cx('inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1', moods.includes(k) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-700 ring-stone-200')}>
                  <Icon size={15} aria-hidden /> {label}
                </button>
              ))}
            </div>
            <input value={moodText} onChange={(e) => setMoodText(e.target.value)} placeholder="or say it: “Paati is worn out and it’s boiling”"
              className="min-h-12 w-full rounded-full bg-white px-4 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
            <Button className="w-full" disabled={busy || (!moodText.trim() && !moods.length)} onClick={checkIn}>Check in</Button>
          </div>
        )}
        {view === 'late' && (
          <div className="space-y-4">
            <Segmented value={late} onChange={setLate} options={[15, 30, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} />
            <Button className="w-full" disabled={busy} onClick={() => go({ trigger_type: 'running_late', minutes: late }, 'Nothing is affected, you’re fine.')}>Update my day</Button>
          </div>
        )}
        {view === 'budget' && (
          <div className="space-y-4">
            <div className="text-center"><div className="font-display text-4xl">{inr(budget)}</div><div className="text-sm text-stone-500">currently {inr(total)}</div></div>
            <input type="range" min={Math.round(total * 0.5)} max={Math.round(total * 1.3)} step={1000} value={budget} onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="New budget" className="w-full accent-rani-600" />
            <div className="grid grid-cols-3 gap-2">
              {[[-0.1, '−10%'], [-0.2, '−20%'], [0.1, '+10%']].map(([f, l]) => (
                <button key={l} type="button" onClick={() => setBudget(Math.round(total * (1 + f) / 1000) * 1000)} className="min-h-11 rounded-full bg-white text-sm font-semibold ring-1 ring-stone-200">{l}</button>
              ))}
            </div>
            <Button className="w-full" disabled={busy} onClick={() => go({ trigger_type: 'budget_change', new_budget: budget }, 'Budget updated')}>Apply budget</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

function Changes({ tour }) {
  if (!tour.changes.length) return null
  return (
    <details className="rounded-[1.75rem] bg-white p-4 shadow-soft">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-lg font-bold text-ink">Plan changes <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{tour.changes.length}</span></summary>
      <ul className="mt-2 space-y-2">
        {tour.changes.slice(0, 6).map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 text-[15px]">
            <span className="text-stone-700"><b className="text-ink">{c.label}</b> · {c.status === 'accepted' ? `applied “${c.chosen_label}”` : c.status === 'pending' ? 'waiting for you' : 'kept original'}</span>
            <Chip tone={c.status === 'accepted' ? 'green' : c.status === 'pending' ? 'rani' : 'stone'}>{c.status}</Chip>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Operate({ tour, state, onFix }) {
  const { notify, events, refresh } = useTour()
  const [tagBusy, onTag] = useTagAction(tour, refresh, notify)
  const [sel, setSel] = useState(null)
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
  const cities = Object.fromEntries((state.destinations || []).map((d) => [d.key, d]))
  const model = buildTripMap({ tour, state, cities, events })
  const selAct = sel?.type === 'activity' ? model.today.find((a) => a.id === sel.id) : null
  return (
    <>
      {hero ? (
        <Link to={hero.kind === 'activity' && hero.offering_id ? `/experience/${hero.offering_id}` : '#timeline'} className="block">
          <Photo src={destImage(hero.dest_key || hero.dest_name)} alt={hero.dest_name} scrim="both" className="rounded-[2.25rem] shadow-float">
            <div className="flex min-h-[18rem] flex-col justify-between p-5 text-white">
              <div className="flex items-center justify-between">
                <span className={cx('rounded-full px-3 py-1.5 text-sm font-bold', current ? 'bg-white text-ink' : 'glass text-ink')}>{current ? 'Happening now' : `In ${Math.max(0, hero.start_min - now)} min`}</span>
                {hero.booking_ref && <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm"><Ticket size={14} aria-hidden /> {hero.booking_ref}</span>}
              </div>
              <div>
                <p className="font-display text-3xl font-bold">{hero.start_label.replace(/ (AM|PM)/, '')}<span className="ml-1 text-base">{hero.start_label.slice(-2)}</span></p>
                <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{hero.title}</h2>
                <p className="mt-1 text-[15px] text-white/85">{hero.vendor_name}</p>
              </div>
            </div>
          </Photo>
        </Link>
      ) : <Empty title="You’re done for today">Rest up, tomorrow is ready below.</Empty>}

      {hero && (
        <div className="grid grid-cols-3 gap-2">
          <Link to={`/compare/${hero.id}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-3xl bg-white text-sm font-bold text-ink shadow-soft"><ArrowLeftRight size={20} aria-hidden /> Swap</Link>
          <Link to="/assist" className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-3xl bg-white text-sm font-bold text-ink shadow-soft"><MessageCircle size={20} aria-hidden /> Ask</Link>
          <a href={hero.offering?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${hero.offering.lat},${hero.offering.lng}` : '#'} target="_blank" rel="noreferrer"
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-3xl bg-white text-sm font-bold text-ink shadow-soft"><Navigation size={20} aria-hidden /> Directions</a>
        </div>
      )}

      <Risks tour={tour} onFix={onFix} />

      <section aria-labelledby="today-map">
        <h2 id="today-map" className="mb-3 text-2xl font-bold text-ink">Today’s route</h2>
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-soft">
          <Suspense fallback={<div className="h-72 animate-pulse bg-stone-200" />}>
            <RouteMap model={model} initialMode={model.today.length ? 'today' : 'route'} selected={sel} onSelect={setSel} className="h-72" />
          </Suspense>
          {selAct && (
            <Link to={selAct.item.offering_id ? `/experience/${selAct.item.offering_id}` : '#timeline'} className="animate-fade flex items-center gap-4 p-3 pr-5">
              <Photo src={destImage(selAct.item.dest_key)} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
              <span className="min-w-0 flex-1"><span className="block truncate text-lg font-bold text-ink">{selAct.title}</span><span className="text-[15px] text-stone-600">{selAct.start} – {selAct.end}</span></span>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-white"><ArrowUpRight size={20} aria-hidden /></span>
            </Link>
          )}
        </div>
      </section>

      <div id="timeline"><DayTimeline d={today} title="Today" editable now={now} risks={tour.risks} onAction={onTag} busy={tagBusy} onRemove={(i) => confirm(`Remove ${i.title}?\n\n${i.policy}`) && api.removeItem(tour.id, i.id).then(() => notify('Removed'))} /></div>

      <ReportChange tour={tour} today={today} fire={fire} busy={busy} />

      {tomorrow && (
        <Link to="/plan" className="flex items-center gap-4 rounded-[1.75rem] bg-white p-3 pr-4 shadow-soft">
          <Photo src={destImage(tomorrow.dest)} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-stone-500">Tomorrow</span>
            <span className="block truncate text-lg font-bold text-ink">{tomorrow.dest_name} · {tomorrow.items.filter((i) => live(i) && i.kind === 'activity').length} plans</span>
          </span>
          <ArrowRight size={20} className="text-stone-500" aria-hidden />
        </Link>
      )}
      <Coordinator c={tour.coordinator} />
      <Changes tour={tour} />
    </>
  )
}

function Prepare({ tour, state, onFix }) {
  const { refresh } = useTour()
  const [open, setOpen] = useState(null)
  const days = Math.round((new Date(tour.start_date) - new Date(state.demo_date)) / 864e5)
  const vouchers = tour.days_detail.flatMap((d) => d.items).filter((i) => live(i) && i.booking_ref)
  const toggle = async (c) => { if (!c.auto) { await api.checklist(tour.id, c.key, !c.done); refresh() } }
  const todo = tour.checklist.filter((c) => !c.done)
  const done = tour.checklist.length - todo.length
  return (
    <>
      <Photo src={destImage(tour.route[0]?.dest)} alt={tour.route[0]?.name} scrim="both" className="rounded-[2.25rem] shadow-float">
        <div className="flex min-h-[16rem] flex-col justify-between p-5 text-white">
          <span className="w-fit rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink">Starts in {days} day{days === 1 ? '' : 's'}</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/80">{fmtDate(tour.start_date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <h2 className="mt-1 text-[1.75rem] font-bold leading-tight">{tour.route.map((r) => r.name).join(' → ')}</h2>
          </div>
        </div>
      </Photo>
      <div className="rounded-[1.75rem] bg-ink p-5 text-white shadow-float">
        <p className="text-lg font-bold">Ready when you are</p>
        <p className="mt-1 text-[15px] text-white/80">Your trip goes live on {fmtDate(tour.start_date, { day: 'numeric', month: 'short' })}: live day plan, route map and instant replanning.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/plan" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 font-semibold text-white">Preview day 1</Link>
          <StartTripButton className="inline-flex min-h-12 items-center justify-center rounded-full bg-white font-bold text-ink">Start my trip</StartTripButton>
        </div>
      </div>
      <Risks tour={tour} onFix={onFix} />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setOpen('check')} className="flex flex-col items-start rounded-[1.75rem] bg-white p-4 text-left shadow-soft">
          <span className="relative grid h-14 w-14 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden><circle cx="18" cy="18" r="15.5" fill="none" stroke="#e9eef5" strokeWidth="4" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={todo.length ? '#1f4f8f' : '#16a34a'} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(done / Math.max(1, tour.checklist.length)) * 97.4} 97.4`} /></svg>
            <span className="font-display text-base font-bold text-ink">{done}/{tour.checklist.length}</span>
          </span>
          <span className="mt-3 text-lg font-bold text-ink">{todo.length ? `${todo.length} to do` : 'All set'}</span>
          <span className="text-sm text-stone-600">Pre-trip checklist</span>
        </button>
        <button type="button" onClick={() => setOpen('vouchers')} className="flex flex-col items-start rounded-[1.75rem] bg-white p-4 text-left shadow-soft">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-rani-50 text-rani-600"><Ticket size={24} aria-hidden /></span>
          <span className="mt-3 text-lg font-bold text-ink">{vouchers.length} vouchers</span>
          <span className="text-sm text-stone-600">Ready to show</span>
        </button>
      </div>
      {todo.slice(0, 2).map((c) => (
        <button key={c.key} type="button" onClick={() => (c.key === 'balance' ? null : toggle(c))} className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-white px-4 text-left shadow-soft">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-2 ring-stone-300" aria-hidden />
          <span className="flex-1 text-[15px] font-semibold text-ink">{c.label}</span>
          {c.key === 'balance' && <Link to="/price" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">Pay {inr(tour.payments.balance)}</Link>}
        </button>
      ))}
      <Coordinator c={tour.coordinator} />
      <Changes tour={tour} />

      <Sheet open={open === 'check'} onClose={() => setOpen(null)} title="Pre-trip checklist">
        <ul className="space-y-2">
          {tour.checklist.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => toggle(c)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left">
                <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', c.done ? 'bg-green-600 text-white' : 'ring-2 ring-stone-300')}>{c.done && <Check size={16} />}</span>
                <span className={cx('text-[15px] font-semibold', c.done ? 'text-stone-500' : 'text-ink')}>{c.label.split(':')[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={open === 'vouchers'} onClose={() => setOpen(null)} title={`${vouchers.length} vouchers`}>
        <ul className="divide-y divide-stone-200 rounded-2xl bg-white">
          {vouchers.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0"><span className="block text-sm font-semibold text-stone-500">Day {v.day}</span><span className="block truncate font-semibold text-ink">{v.title}</span></span>
              <span className="shrink-0 rounded-lg bg-ink px-2.5 py-1 font-mono text-sm text-white">{v.booking_ref}</span>
            </li>
          ))}
        </ul>
      </Sheet>
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
      <header className="pt-safe px-5 pt-6 pb-4 md:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-rani-600">{fmtDate(state.demo_date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(state.demo_time)}</p>
        <h1 className="mt-1 text-[2.25rem] font-extrabold leading-[1.05] text-ink">{tour.stage === 'operate' ? `Day ${tour.current_day} in ${tour.days_detail[tour.current_day - 1].dest_name}` : title}</h1>
      </header>
      <JourneyStrip stage={tour.stage} day={tour.current_day} days={tour.days} hideAction />
      <section className="space-y-5 px-5 pt-5 md:px-6">
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
