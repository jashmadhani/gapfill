import { Suspense, lazy, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BedDouble, CalendarDays, ChevronDown, CircleAlert, Gauge, Lightbulb, Plus, RefreshCw, TriangleAlert, Users, Wallet, Wand2 } from 'lucide-react'
import { api, fmtDate, inr } from '../api'
import { useTour } from '../store'
import DayTimeline from '../components/DayTimeline'
import { Bar, Button, Card, Empty, JourneyStrip, PACE_LABEL, Photo, Spinner, TIER_LABEL, cx } from '../components/ui'
import { destImage } from '../media'
import { buildTripMap } from '../lib/tripMap'

const RouteMap = lazy(() => import('../components/RouteMap'))

function AddPicker({ tour, d, onDone }) {
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(null)
  const { notify } = useTour()
  const load = async () => {
    const dest = await api.destination(d.dest)
    const inPlan = new Set(tour.days_detail.flatMap((x) => x.items.filter((i) => !['replaced', 'cancelled'].includes(i.status)).map((i) => i.offering_id)))
    setList(dest.experiences.filter((e) => !inPlan.has(e.id)))
  }
  if (!list) return <button type="button" onClick={load} className="ml-8 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-rani-600 shadow-soft"><Plus size={16} aria-hidden /> Add to day {d.day}</button>
  const add = async (e) => {
    setBusy(e.id)
    try {
      const r = await api.addItem(tour.id, e.id, d.day)
      notify(`${e.title} added at ${r.result.start_label}`, 'success')
      onDone()
    } catch (err) { notify(err.message, 'error') } finally { setBusy(null) }
  }
  return (
    <div className="ml-7 space-y-1.5">
      {list.length === 0 && <p className="text-xs text-stone-500">Everything here is already in your plan.</p>}
      {list.slice(0, 6).map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-sand-100 px-2.5 py-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{e.title}</div>
            <div className="text-xs text-stone-500">{e.duration_min} min · {inr(e.price)} pp · {e.rating.toFixed(1)}★ · {e.indoor_outdoor}</div>
          </div>
          <Button variant="secondary" className="shrink-0 px-2.5 py-1 text-xs" disabled={busy === e.id} onClick={() => add(e)}>Add</Button>
        </div>
      ))}
      <button onClick={() => setList(null)} className="text-xs text-stone-500">Close</button>
    </div>
  )
}

// Plan: optimised itinerary, live price vs budget, conflicts, and per-component customisation.
export default function Plan() {
  const { tour, state, refresh, notify, events } = useTour()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)
  const [showNotes, setShowNotes] = useState(true)
  const [history, setHistory] = useState(false)
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="No tour yet" action={<Link to="/personalize"><Button>Design a tour</Button></Link>}>Tell us your dates, budget and interests to get an optimised plan.</Empty></div>

  const draft = tour.status === 'draft'
  const editable = ['plan', 'prepare', 'operate'].includes(tour.stage)
  const p = tour.pricing
  const errors = tour.conflicts.filter((c) => c.level === 'error')
  const cities = Object.fromEntries((state.destinations || []).map((d) => [d.key, d]))
  const model = buildTripMap({ tour, state, cities, events })

  const run = async (fn, msg) => {
    setBusy(true)
    try { await fn(); await refresh(); if (msg) notify(msg, 'success') } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  const remove = (i) => {
    const warn = draft ? '' : `\n\nIt’s booked. ${i.policy}`
    if (confirm(`Remove ${i.title}?${warn}`)) run(() => api.removeItem(tour.id, i.id), 'Removed')
  }

  return (
    <div>
      <header className="pt-safe px-5 pt-6 pb-4 md:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-rani-600">{draft ? 'Draft plan' : 'Booked'} · {tour.code}</p>
        <h1 className="mt-1 text-[2.25rem] font-extrabold leading-[1.05] text-ink">{tour.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {[[CalendarDays, `${fmtDate(tour.start_date)} – ${fmtDate(tour.end_date)}`], [Users, `${tour.group.adults + (tour.group.children || 0)} travelers`],
            [BedDouble, `${TIER_LABEL[tour.prefs.hotel_tier]} stays`], [Gauge, `${PACE_LABEL[tour.prefs.pace]} pace`]].map(([Icon, t]) => (
            <span key={t} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-ink shadow-soft"><Icon size={16} aria-hidden /> {t}</span>
          ))}
        </div>
      </header>
      <JourneyStrip stage={tour.stage} />

      <section className="space-y-5 px-5 pt-5 md:px-6">
        {/* Route as a story: map + stop cards */}
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-soft">
          <Suspense fallback={<div className="h-64 animate-pulse bg-stone-200" />}>
            <RouteMap model={model} selected={sel} onSelect={setSel} className="h-64" />
          </Suspense>
          <ol className="no-scrollbar flex gap-2 overflow-x-auto p-3">
            {tour.route.map((r, idx) => (
              <li key={r.dest} className="shrink-0">
                <button type="button" onClick={() => setSel({ type: 'city', key: r.dest })} aria-pressed={sel?.key === r.dest}
                  className={cx('flex items-center gap-3 rounded-3xl p-1.5 pr-4 text-left transition', sel?.key === r.dest ? 'bg-ink text-white' : 'bg-stone-50 text-ink')}>
                  <Photo src={destImage(r.dest)} scrim={false} className="h-12 w-12 rounded-2xl" />
                  <span><span className="block font-bold">{idx + 1}. {r.name}</span><span className={cx('block text-sm', sel?.key === r.dest ? 'text-white/75' : 'text-stone-600')}>{r.nights} night{r.nights > 1 ? 's' : ''} · {fmtDate(r.from_date)}</span></span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Wallet size={16} className="text-rani-600" />
              <span><b>{inr(p.total)}</b> {p.budget ? <>of <b>{inr(p.budget)}</b></> : ''}</span>
            </div>
            <Link to="/price" className="text-xs font-semibold text-rani-600">Breakdown</Link>
          </div>
          {p.budget > 0 && <Bar value={p.total} max={p.budget} tone={p.within_budget ? 'green' : 'red'} className="mt-2" />}
          <div className="mt-1.5 flex justify-between text-xs text-stone-500">
            <span>{inr(p.per_person)} per person · incl. taxes</span>
            <span className={p.within_budget ? 'text-emerald-600' : 'text-red-600'}>{p.within_budget ? `${inr(p.budget - p.total)} under budget` : `${inr(p.over_by)} over`}</span>
          </div>
          {draft && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => run(() => api.optimise(tour.id), 'Plan optimised')}><Wand2 size={15} /> Optimise</Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(() => api.patchTour(tour.id, { regenerate: true }), 'Fresh plan generated')}><RefreshCw size={15} /> Regenerate</Button>
            </div>
          )}
        </Card>

        {tour.notes.length > 0 && (
          <Card className="bg-amber-50/60 p-3 ring-amber-200">
            <button onClick={() => setShowNotes((s) => !s)} className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-800">
              <span className="inline-flex items-center gap-1.5"><Lightbulb size={14} /> How we optimised this</span>
              <ChevronDown size={15} className={cx('transition', showNotes && 'rotate-180')} />
            </button>
            {showNotes && <ul className="mt-1.5 space-y-1 text-xs text-amber-900">{tour.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>}
          </Card>
        )}

        {tour.conflicts.length > 0 && (
          <Card className="space-y-1.5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Checks</div>
            {tour.conflicts.map((c, i) => (
              <div key={i} className={cx('flex items-start gap-1.5 text-xs', c.level === 'error' ? 'text-red-700' : 'text-amber-700')}>
                {c.level === 'error' ? <CircleAlert size={14} className="shrink-0" /> : <TriangleAlert size={14} className="shrink-0" />} {c.text}
              </div>
            ))}
          </Card>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Day by day</div>
          {!draft && <button onClick={() => setHistory((h) => !h)} className="text-xs text-stone-500 underline">{history ? 'Hide' : 'Show'} change history</button>}
        </div>
        <div className="space-y-5">
          {tour.days_detail.map((d) => (
            <DayTimeline key={d.day} d={d} editable={editable} onRemove={remove} risks={tour.risks} showHistory={history}>
              {editable && (!tour.current_day || d.day >= tour.current_day) && <AddPicker tour={tour} d={d} onDone={refresh} />}
            </DayTimeline>
          ))}
        </div>
      </section>

      <div className="sticky bottom-16 z-20 mt-4 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-4 pb-3 pt-4">
        {draft ? (
          <Button className="w-full" disabled={busy} onClick={() => nav('/price')}>
            {errors.length ? `Fix ${errors.length} issue${errors.length > 1 ? 's' : ''} to book` : `Review price & book · ${inr(p.total)}`}
          </Button>
        ) : <Link to="/trip"><Button className="w-full">Open my trip</Button></Link>}
      </div>
    </div>
  )
}
