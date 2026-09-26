import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, Clock, CloudRain, IndianRupee, Radio, RotateCcw, Smartphone, Store, Sun, TrainFront } from 'lucide-react'
import { api, inr } from '../api'
import { useLive } from '../live'
import { Button, cx } from '../components/ui'

const Panel = ({ className, ...p }) => <div className={cx('rounded-2xl bg-stone-900 p-4 text-stone-100 ring-1 ring-stone-800', className)} {...p} />
const Sel = (p) => <select {...p} className={cx('min-w-0 rounded bg-stone-800 px-2 py-1.5 text-sm', p.className)} />

function Phone({ src, title }) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
        {title === 'Traveler' ? <Smartphone size={13} /> : <Store size={13} />} {title}
      </div>
      <div className="rounded-[2.4rem] bg-stone-900 p-2.5 shadow-2xl ring-1 ring-stone-700">
        <iframe title={title} src={src} className="h-[min(760px,78dvh)] w-[min(375px,calc(100vw-3rem))] rounded-[1.9rem] bg-white" />
      </div>
    </div>
  )
}

// Traveler + vendor side by side, with triggers for every kind of real-world disruption.
export default function LiveOps() {
  const [st, setSt] = useState(null)
  const [tour, setTour] = useState(null)
  const [vendors, setVendors] = useState([])
  const [vendorId, setVendorId] = useState('')
  const [sel, setSel] = useState({ act: '', transport: '', hotel: '', rainDay: '', late: 45, delay: 120, budget: 0 })
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setSel((s) => ({ ...s, [k]: v }))

  const load = useCallback(async () => {
    const s = await api.state()
    const [t, vs] = await Promise.all([s.active_tour_id ? api.tour(s.active_tour_id) : null, api.vendors()])
    setSt(s); setTour(t); setVendors(vs)
    setVendorId((v) => v || String(vs.find((x) => x.pending)?.id || vs[0]?.id || ''))
  }, [])
  useEffect(() => { load() }, [load])

  const items = (tour?.days_detail || []).flatMap((d) => d.items).filter((i) => !['replaced', 'cancelled'].includes(i.status) && !i.is_past)
  const acts = items.filter((i) => i.kind === 'activity')
  const transports = items.filter((i) => i.kind === 'transport')
  const hotels = (tour?.days_detail || []).flatMap((d) => d.items).filter((i) => i.kind === 'hotel' && !['replaced', 'cancelled'].includes(i.status))
  const upcomingDays = (tour?.days_detail || []).filter((d) => !tour.current_day || d.day >= tour.current_day)
  const pick = (k, list) => sel[k] || String(list[0]?.id || '')
  const rainDay = sel.rainDay || String(upcomingDays[0]?.day || '')
  const rainD = tour?.days_detail.find((d) => String(d.day) === rainDay)
  const raining = rainD && st?.rain.some((r) => r.dest === rainD.dest && r.date === rainD.date)

  const addLog = (text, tone = 'stone') => setLog((l) => [{ t: new Date().toLocaleTimeString(), text, tone }, ...l].slice(0, 40))
  const live = useLive((m) => {
    if (m.type === 'change') addLog(`→ ${m.event.tour_code}: pushed “${m.event.label}” with ${m.event.options.length} options`, 'rani')
    else if (m.type === 'change_resolved') addLog(`← ${m.by} ${m.action === 'accept' ? `applied plan ${m.option}` : 'kept original'} (change #${m.event_id})`, 'green')
    else if (m.type === 'vendor_status') addLog('vendor updated availability / a booking')
    else if (m.type === 'bookings') addLog(`tour booked, requests sent to vendors`, 'green')
    if (!['hello', 'pong'].includes(m.type)) load()
  })

  const fire = async (label, body) => {
    setBusy(true)
    addLog(`⚡ ${label}`, 'amber')
    try {
      const r = await api.trigger({ tour_id: tour?.id, ...body })
      if (r.note) addLog(r.note)
      if (!r.events.length && !r.note) addLog('nothing affected')
    } catch (e) { addLog(`error: ${e.message}`, 'red') } finally { setBusy(false); load() }
  }
  const reset = async () => {
    setBusy(true)
    await api.reset()
    setLog([]); setSel((s) => ({ ...s, act: '', transport: '', hotel: '', rainDay: '' })); setVendorId('')
    addLog('demo data reset', 'green')
    setBusy(false)
    load()
  }
  const clock = async (body) => { await api.setClock(body); load() }

  return (
    <div className="min-h-full bg-stone-950 text-stone-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-rani-600 font-black">T</div>
          <div>
            <div className="font-bold">TourCraft · Live Ops</div>
            <div className="text-xs text-stone-400">Trigger real-world disruptions and watch the tour adapt for traveler, vendor and operator</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={cx('inline-flex items-center gap-1', live === 'live' ? 'text-emerald-400' : 'text-amber-400')}><Radio size={13} /> {live}</span>
          <span className="text-stone-500">{st?.db} · assistant: {st?.assistant}</span>
          <Link to="/operator" className="text-stone-400 hover:text-white">Operator console ↗</Link>
          <Link to="/" className="text-stone-400 hover:text-white">Traveler ↗</Link>
        </div>
      </header>

      <div className="flex flex-wrap justify-center gap-8 p-6">
        <Phone title="Traveler" src="/trip?embed=1" />

        <div className="w-[340px] space-y-3">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-stone-400">Triggers · {tour?.code} {tour?.customer?.name}</div>
          <Panel className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Demo clock</span>
              <div className="flex gap-1.5">
                <Sel value={tour?.current_day ?? (tour && st && st.demo_date < tour.start_date ? 0 : 99)} onChange={(e) => clock({ day: Number(e.target.value) === 99 ? tour.days + 2 : Number(e.target.value) === 0 ? -4 : Number(e.target.value) })}>
                  <option value={0}>Before trip</option>
                  {tour?.days_detail.map((d) => <option key={d.day} value={d.day}>Day {d.day} · {d.dest_name}</option>)}
                  <option value={99}>After trip</option>
                </Sel>
                <Sel value={st?.demo_time || ''} onChange={(e) => clock({ time: e.target.value })}>
                  {['07:00', '09:00', '11:30', '13:00', '15:00', '17:30', '20:00'].map((t) => <option key={t}>{t}</option>)}
                </Sel>
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={reset} disabled={busy}><RotateCcw size={15} /> Reset demo data</Button>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">{raining ? <CloudRain size={15} className="text-sky-400" /> : <Sun size={15} className="text-amber-400" />} Weather</div>
            <div className="flex gap-2">
              <Sel value={rainDay} onChange={(e) => set('rainDay', e.target.value)} className="flex-1">
                {upcomingDays.map((d) => <option key={d.day} value={d.day}>Day {d.day} · {d.dest_name}{d.rain ? ' (rain)' : ''}</option>)}
              </Sel>
              <Button className="shrink-0" disabled={busy || !rainD} onClick={() => fire(raining ? `Skies clear in ${rainD.dest_name}` : `Heavy rain in ${rainD.dest_name}, day ${rainD.day}`, { trigger_type: 'weather', dest: rainD.dest, date: rainD.date, clear: raining })}>
                {raining ? 'Clear' : 'Make it rain'}
              </Button>
            </div>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Store size={15} className="text-rani-500" /> Provider can’t deliver</div>
            <Sel value={pick('act', acts)} onChange={(e) => set('act', e.target.value)} className="w-full">
              {acts.map((a) => <option key={a.id} value={a.id}>D{a.day} {a.start_label} · {a.title}</option>)}
            </Sel>
            <Button className="w-full" disabled={busy || !acts.length} onClick={() => fire('Activity cancelled by provider', { trigger_type: 'unavailable', item_id: Number(pick('act', acts)) })}>Cancel this activity</Button>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><TrainFront size={15} className="text-rani-500" /> Transport disruption</div>
            <Sel value={pick('transport', transports)} onChange={(e) => set('transport', e.target.value)} className="w-full">
              {transports.map((t) => <option key={t.id} value={t.id}>D{t.day} {t.start_label} · {t.from_name} → {t.dest_name} ({t.meta.mode})</option>)}
            </Sel>
            <div className="flex gap-2">
              <Sel value={sel.delay} onChange={(e) => set('delay', Number(e.target.value))}>{[60, 120, 180, 240].map((m) => <option key={m} value={m}>{m} min</option>)}</Sel>
              <Button className="flex-1" disabled={busy || !transports.length} onClick={() => fire(`Transport delayed ${sel.delay} min`, { trigger_type: 'transport_delay', item_id: Number(pick('transport', transports)), minutes: sel.delay })}>Delay</Button>
              <Button variant="secondary" disabled={busy || !transports.length} onClick={() => fire('Transport cancelled', { trigger_type: 'transport_cancel', item_id: Number(pick('transport', transports)) })}>Cancel</Button>
            </div>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><BedDouble size={15} className="text-rani-500" /> Hotel overbooked</div>
            <div className="flex gap-2">
              <Sel value={pick('hotel', hotels)} onChange={(e) => set('hotel', e.target.value)} className="flex-1">
                {hotels.map((h) => <option key={h.id} value={h.id}>D{h.day} · {h.title}</option>)}
              </Sel>
              <Button className="shrink-0" disabled={busy || !hotels.length} onClick={() => fire('Hotel overbooked', { trigger_type: 'hotel_issue', item_id: Number(pick('hotel', hotels)) })}>Overbook</Button>
            </div>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-rani-500" /> Traveler changes</div>
            <div className="flex gap-2">
              <Sel value={sel.late} onChange={(e) => set('late', Number(e.target.value))}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</Sel>
              <Button className="flex-1" disabled={busy} onClick={() => fire(`Traveler running ${sel.late} min late`, { trigger_type: 'running_late', minutes: sel.late })}>Running late</Button>
            </div>
            <div className="flex gap-2">
              <input type="number" value={sel.budget || Math.round((tour?.pricing.total || 0) * 0.85 / 1000) * 1000} onChange={(e) => set('budget', Number(e.target.value))} className="w-28 rounded bg-stone-800 px-2 py-1.5 text-sm" />
              <Button className="flex-1" disabled={busy} onClick={() => { const b = sel.budget || Math.round((tour?.pricing.total || 0) * 0.85 / 1000) * 1000; fire(`Budget cut to ${inr(b)}`, { trigger_type: 'budget_change', new_budget: b }) }}>
                <IndianRupee size={14} /> Cut budget
              </Button>
            </div>
            <p className="text-xs text-stone-500">Current total {inr(tour?.pricing.total)} · budget {inr(tour?.pricing.budget)}</p>
          </Panel>

          <Panel>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Event log</div>
            <ul className="max-h-52 space-y-1 overflow-y-auto font-mono text-xs">
              {log.length === 0 && <li className="text-stone-500">Waiting for triggers…</li>}
              {log.map((l, i) => (
                <li key={i} className={{ rani: 'text-rani-200', green: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-400', stone: 'text-stone-300' }[l.tone]}>
                  <span className="text-stone-500">{l.t}</span> {l.text}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col items-center">
          <Phone title="Vendor" src={`/vendor/${vendorId}?embed=1`} />
          <Sel value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-2 w-full max-w-[375px]">
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.pending ? ` · ${v.pending} pending` : ''} ({v.status})</option>)}
          </Sel>
        </div>
      </div>
    </div>
  )
}
