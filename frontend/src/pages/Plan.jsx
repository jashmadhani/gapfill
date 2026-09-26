import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, CircleAlert, Lightbulb, Plus, RefreshCw, TriangleAlert, Wallet, Wand2 } from 'lucide-react'
import { api, fmtDate, inr } from '../api'
import { useTour } from '../store'
import DayTimeline, { useTagAction } from '../components/DayTimeline'
import Considered from '../components/Considered'
import { GroupFairness } from '../components/group'
import { Bar, Button, Card, Empty, JourneyStrip, MODE, PACE_LABEL, Spinner, TIER_LABEL, cx } from '../components/ui'

function AddPicker({ tour, d, onDone }) {
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(null)
  const { notify } = useTour()
  const load = async () => {
    const dest = await api.destination(d.dest)
    const inPlan = new Set(tour.days_detail.flatMap((x) => x.items.filter((i) => !['replaced', 'cancelled'].includes(i.status)).map((i) => i.offering_id)))
    setList(dest.experiences.filter((e) => !inPlan.has(e.id)))
  }
  if (!list) return <button onClick={load} className="ml-7 inline-flex items-center gap-1 text-xs font-semibold text-rani-600"><Plus size={13} /> Add an experience on day {d.day}</button>
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
  const { tour, state, refresh, notify } = useTour()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [history, setHistory] = useState(false)
  const [tagBusy, onTag] = useTagAction(tour, refresh, notify)
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="No tour yet" action={<Link to="/personalize"><Button>Design a tour</Button></Link>}>Tell us your dates, budget and interests to get an optimised plan.</Empty></div>

  const draft = tour.status === 'draft'
  const editable = ['plan', 'prepare', 'operate'].includes(tour.stage)
  const p = tour.pricing
  const errors = tour.conflicts.filter((c) => c.level === 'error')

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
      <header className="px-4 pt-5 pb-3">
        <div className="text-xs font-medium uppercase tracking-wider text-stone-500">{tour.code} · {draft ? 'Draft plan' : 'Booked'}</div>
        <h1 className="font-display text-3xl leading-tight">{tour.title}</h1>
        <p className="text-sm text-stone-500">
          {fmtDate(tour.start_date)} – {fmtDate(tour.end_date)} · {tour.days} days · {tour.members?.length || tour.travelers} travelers
          {tour.members?.length > 0 && <> ({tour.members.map((m) => `${m.name} ${m.age}`).join(', ')})</>}
        </p>
        <p className="mt-0.5 text-xs text-stone-500">{TIER_LABEL[tour.prefs.hotel_tier]} stays · {MODE[tour.prefs.transport]?.label} · {PACE_LABEL[tour.prefs.pace]} pace</p>
      </header>
      <JourneyStrip stage={tour.stage} />

      <section className="space-y-3 px-4 pt-4">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {tour.route.map((r, idx) => (
            <div key={r.dest} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs leading-tight ring-1 ring-stone-200">
              <div className="font-semibold">{idx + 1}. {r.name}</div>
              <div className="text-stone-500">{r.nights} night{r.nights > 1 ? 's' : ''} · from {fmtDate(r.from_date)}</div>
            </div>
          ))}
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

        <GroupFairness group={tour.group_fit} members={tour.members} />

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
            <DayTimeline key={d.day} d={d} editable={editable} onRemove={remove} onAction={onTag} busy={tagBusy} risks={tour.risks} showHistory={history}>
              {editable && (!tour.current_day || d.day >= tour.current_day) && <AddPicker tour={tour} d={d} onDone={refresh} />}
            </DayTimeline>
          ))}
        </div>

        <div className="pt-4"><Considered tour={tour} editable={editable} onChanged={refresh} /></div>
      </section>

      <div className="sticky bottom-24 z-20 mt-4 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-4 pb-3 pt-4">
        {draft ? (
          <Button className="w-full" disabled={busy} onClick={() => nav('/price')}>
            {errors.length ? `Fix ${errors.length} issue${errors.length > 1 ? 's' : ''} to book` : `Review price & book · ${inr(p.total)}`}
          </Button>
        ) : <Link to="/trip"><Button className="w-full">Open my trip</Button></Link>}
      </div>
    </div>
  )
}
