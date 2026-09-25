import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CloudRain, IndianRupee, Radio, RotateCcw, Smartphone, Store, Sun } from 'lucide-react'
import { api, inr } from '../api'
import { useLive } from '../live'
import { Button, cx } from '../components/ui'

const Panel = ({ className, ...p }) => <div className={cx('rounded-2xl bg-stone-900 p-4 text-stone-100 ring-1 ring-stone-800', className)} {...p} />

function Phone({ src, title }) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
        {title === 'Traveler' ? <Smartphone size={13} /> : <Store size={13} />} {title}
      </div>
      <div className="rounded-[2.4rem] bg-stone-900 p-2.5 shadow-2xl ring-1 ring-stone-700">
        <iframe title={title} src={src} className="h-[760px] w-[375px] rounded-[1.9rem] bg-white" />
      </div>
    </div>
  )
}

// Side-by-side traveler + vendor, with manual triggers so every disruption can be demoed live.
export default function LiveOps() {
  const [st, setSt] = useState(null)
  const [itin, setItin] = useState(null)
  const [exps, setExps] = useState([])
  const [vendors, setVendors] = useState([])
  const [expId, setExpId] = useState('')
  const [vendorId, setVendorId] = useState('1')
  const [late, setLate] = useState(45)
  const [budget, setBudget] = useState(500)
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await api.state()
    const [it, ex, vs] = await Promise.all([s.active_itinerary_id ? api.itinerary(s.active_itinerary_id) : null, api.experiences(), api.vendors()])
    setSt(s); setItin(it); setExps(ex); setVendors(vs)
  }, [])
  useEffect(() => { load() }, [load])

  const planned = itin?.items.filter((i) => i.experience && i.status === 'confirmed') || []
  useEffect(() => { if (!expId && planned[0]) setExpId(String(planned[0].experience.id)) }, [planned, expId])

  const addLog = (text, tone = 'stone') => setLog((l) => [{ t: new Date().toLocaleTimeString(), text, tone }, ...l].slice(0, 30))
  const live = useLive((m) => {
    if (m.type === 'disruption') addLog(`→ pushed replan card: ${m.event.trigger_label} (“${m.event.original.title}”)`, 'rani')
    else if (m.type === 'disruption_resolved') addLog(`← traveler ${m.action === 'accept' ? 'accepted' : 'dismissed'} card #${m.event_id}`, 'green')
    else if (m.type === 'vendor_status') addLog('vendor status changed')
    else if (m.type === 'listing_published') addLog('new listing published via chat', 'green')
    if (m.type !== 'hello' && m.type !== 'pong') load()
  })

  const fire = async (label, body) => {
    setBusy(true)
    addLog(`⚡ ${label}`, 'amber')
    try {
      const r = await api.trigger(body)
      if (r.note) addLog(r.note)
      if (!r.events.length && !r.note) addLog('no planned item affected')
    } catch (e) { addLog(`error: ${e.message}`, 'red') } finally { setBusy(false); load() }
  }

  const reset = async () => {
    setBusy(true)
    await api.reset()
    setLog([]); setExpId('')
    addLog('demo data reset', 'green')
    setBusy(false)
    load()
  }

  const setClock = async (v) => { await api.setClock(v); load() }

  return (
    <div className="min-h-full bg-stone-950 text-stone-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-rani-600 font-black">G</div>
          <div>
            <div className="font-bold">GapFill · Live Ops</div>
            <div className="text-xs text-stone-400">Trigger real-world disruptions and watch the traveler replan live</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={cx('inline-flex items-center gap-1', live === 'live' ? 'text-emerald-400' : 'text-amber-400')}><Radio size={13} /> {live}</span>
          <span className="text-stone-500">{st?.db} · intent: {st?.llm}</span>
          <Link to="/" className="text-stone-400 hover:text-white">Traveler ↗</Link>
          <Link to="/vendor/chat" className="text-stone-400 hover:text-white">Vendor chat ↗</Link>
        </div>
      </header>

      <div className="flex flex-wrap justify-center gap-8 p-6">
        <Phone title="Traveler" src="/?embed=1" />

        <div className="w-[340px] space-y-3">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-stone-400">Triggers</div>
          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Demo clock</span>
              <select value={st?.demo_now || ''} onChange={(e) => setClock(e.target.value)} className="rounded bg-stone-800 px-2 py-1 text-sm">
                {['08:00', '09:00', '11:30', '13:00', '15:00', '16:30'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Button variant="secondary" className="w-full" onClick={reset} disabled={busy}><RotateCcw size={15} /> Reset demo data</Button>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Store size={15} className="text-rani-500" /> Vendor unavailable</div>
            <select value={expId} onChange={(e) => setExpId(e.target.value)} className="w-full rounded bg-stone-800 px-2 py-1.5 text-sm">
              {exps.map((e) => <option key={e.id} value={e.id}>{planned.some((p) => p.experience.id === e.id) ? '★ ' : ''}{e.title}{e.capacity_left === 0 ? ' (sold out)' : ''}</option>)}
            </select>
            <Button className="w-full" disabled={busy || !expId} onClick={() => fire('Experience marked unavailable', { trigger_type: 'unavailable', experience_id: Number(expId) })}>Mark experience unavailable</Button>
            <div className="flex gap-2">
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="min-w-0 flex-1 rounded bg-stone-800 px-2 py-1.5 text-sm">
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.status})</option>)}
              </select>
              <Button variant="secondary" disabled={busy} onClick={() => fire('Vendor closed', { trigger_type: 'unavailable', vendor_id: Number(vendorId) })}>Close</Button>
            </div>
            <p className="text-[11px] text-stone-500">★ = in the traveler’s plan. Vendors can also do this from their console.</p>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">{st?.weather_bad ? <CloudRain size={15} className="text-sky-400" /> : <Sun size={15} className="text-amber-400" />} Weather: {st?.weather_bad ? 'Rain' : 'Clear'}</div>
            <Button className="w-full" disabled={busy} onClick={() => fire(st?.weather_bad ? 'Weather cleared' : 'Weather turned bad', { trigger_type: 'weather', weather_bad: !st?.weather_bad })}>
              {st?.weather_bad ? 'Clear the skies' : 'Make it rain'}
            </Button>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-rani-500" /> Traveler running late</div>
            <div className="flex gap-2">
              <select value={late} onChange={(e) => setLate(Number(e.target.value))} className="rounded bg-stone-800 px-2 py-1.5 text-sm">
                {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
              <Button className="flex-1" disabled={busy} onClick={() => fire(`Running ${late} min late`, { trigger_type: 'time_shrink', minutes: late })}>Simulate “running late”</Button>
            </div>
          </Panel>

          <Panel className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><IndianRupee size={15} className="text-rani-500" /> Budget change <span className="font-normal text-stone-400">(now {inr(itin?.session?.budget_envelope)})</span></div>
            <div className="flex gap-2">
              <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-24 rounded bg-stone-800 px-2 py-1.5 text-sm" />
              <Button className="flex-1" disabled={busy} onClick={() => fire(`Budget set to ${inr(budget)}`, { trigger_type: 'budget_shrink', new_budget: budget })}>Change budget</Button>
            </div>
          </Panel>

          <Panel>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Event log</div>
            <ul className="max-h-52 space-y-1 overflow-y-auto font-mono text-[11px]">
              {log.length === 0 && <li className="text-stone-500">Waiting for triggers…</li>}
              {log.map((l, i) => (
                <li key={i} className={{ rani: 'text-rani-200', green: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-400', stone: 'text-stone-300' }[l.tone]}>
                  <span className="text-stone-500">{l.t}</span> {l.text}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Phone title="Vendor" src={`/vendor/${vendorId}?embed=1`} />
      </div>
    </div>
  )
}
