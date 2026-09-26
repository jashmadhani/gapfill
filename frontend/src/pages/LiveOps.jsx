import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CloudRain, ExternalLink, IndianRupee, Radio, RotateCcw, Smartphone, Store, Sun } from 'lucide-react'
import { api, inr } from '../api'
import { useLive } from '../live'
import { Logo } from '../components/brand'
import { Button, ThemeToggle, cx } from '../components/ui'

const Panel = ({ title, Icon, children, className }) => (
  <section className={cx('rounded-2xl bg-surface p-4 ring-1 ring-line shadow-card', className)}>
    {title && <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Icon size={17} className="text-brand" aria-hidden /> {title}</h2>}
    {children}
  </section>
)
const selectCls = 'min-h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-ink ring-1 ring-line'

function Phone({ src, title, Icon }) {
  return (
    <figure className="flex w-full flex-col items-center">
      <figcaption className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-ink-3"><Icon size={15} aria-hidden /> {title}</figcaption>
      <div className="w-full max-w-[395px] rounded-[2.5rem] bg-ink p-2.5 shadow-2xl">
        <iframe title={`${title} view`} src={src} className="block h-[min(760px,78dvh)] w-full rounded-[2rem] bg-canvas" />
      </div>
    </figure>
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
  useEffect(() => { const first = planned[0]?.experience.id ?? exps[0]?.id; if (!expId && first) setExpId(String(first)) }, [planned, exps, expId])

  const addLog = (text, tone = 'neutral') => setLog((l) => [{ t: new Date().toLocaleTimeString(), text, tone }, ...l].slice(0, 30))
  const live = useLive((m) => {
    if (m.type === 'disruption') addLog(`Pushed replan card: ${m.event.trigger_label} (“${m.event.original.title}”)`, 'brand')
    else if (m.type === 'disruption_resolved') addLog(`Traveler ${m.action === 'accept' ? 'accepted' : 'dismissed'} card #${m.event_id}`, 'success')
    else if (m.type === 'vendor_status') addLog('Vendor status changed')
    else if (m.type === 'listing_published') addLog('New listing published via chat', 'success')
    if (m.type !== 'hello' && m.type !== 'pong') load()
  })

  const fire = async (label, body) => {
    setBusy(true)
    addLog(`Trigger: ${label}`, 'warn')
    try {
      const r = await api.trigger(body)
      if (r.note) addLog(r.note)
      if (!r.events.length && !r.note) addLog('No planned item affected')
    } catch (e) { addLog(`Error: ${e.message}`, 'danger') } finally { setBusy(false); load() }
  }

  const reset = async () => {
    setBusy(true)
    await api.reset()
    setLog([]); setExpId('')
    addLog('Demo data reset', 'success')
    setBusy(false)
    load()
  }

  const setClock = async (v) => { await api.setClock(v); load() }
  const toneCls = { brand: 'text-brand-ink', success: 'text-success', warn: 'text-warn', danger: 'text-danger', neutral: 'text-ink-2' }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-sm text-ink-3 md:inline">Live Ops · trigger disruptions and watch the traveler replan</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', live === 'live' ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn')}><Radio size={13} aria-hidden /> {live}</span>
            <span className="hidden text-xs text-ink-3 sm:inline">{st?.db} · intent: {st?.llm}</span>
            <Link to="/" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-ink-2 hover:bg-surface-2 hover:text-ink">Traveler <ExternalLink size={14} aria-hidden /></Link>
            <Link to="/vendor/chat" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-ink-2 hover:bg-surface-2 hover:text-ink">Vendor chat <ExternalLink size={14} aria-hidden /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-6 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-[1fr_360px_1fr]">
        <div className="md:col-span-2 xl:col-span-1 xl:order-2">
          <h2 className="sr-only">Triggers</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Panel title="Demo controls" Icon={RotateCcw}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="clock" className="text-sm font-medium">Demo clock</label>
                <select id="clock" value={st?.demo_now || ''} onChange={(e) => setClock(e.target.value)} className={cx(selectCls, 'w-28')}>
                  {['08:00', '09:00', '11:30', '13:00', '15:00', '16:30'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <Button variant="secondary" className="mt-3 w-full" onClick={reset} disabled={busy}><RotateCcw size={16} aria-hidden /> Reset demo data</Button>
            </Panel>

            <Panel title="Vendor unavailable" Icon={Store}>
              <label htmlFor="exp" className="sr-only">Experience</label>
              <select id="exp" value={expId} onChange={(e) => setExpId(e.target.value)} className={selectCls}>
                {exps.map((e) => <option key={e.id} value={e.id}>{planned.some((p) => p.experience.id === e.id) ? '★ ' : ''}{e.title}{e.capacity_left === 0 ? ' (sold out)' : ''}</option>)}
              </select>
              <Button className="mt-2 w-full" disabled={busy || !expId} onClick={() => fire('Experience marked unavailable', { trigger_type: 'unavailable', experience_id: Number(expId) })}>Mark experience unavailable</Button>
              <div className="mt-2 flex gap-2">
                <label htmlFor="vendor" className="sr-only">Vendor</label>
                <select id="vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={cx(selectCls, 'min-w-0 flex-1')}>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.status})</option>)}
                </select>
                <Button variant="secondary" disabled={busy} onClick={() => fire('Vendor closed', { trigger_type: 'unavailable', vendor_id: Number(vendorId) })}>Close</Button>
              </div>
              <p className="mt-2 text-xs text-ink-3">★ = in the traveler’s plan. Vendors can also do this from their console.</p>
            </Panel>

            <Panel title={`Weather: ${st?.weather_bad ? 'Rain' : 'Clear'}`} Icon={st?.weather_bad ? CloudRain : Sun}>
              <Button className="w-full" disabled={busy} onClick={() => fire(st?.weather_bad ? 'Weather cleared' : 'Weather turned bad', { trigger_type: 'weather', weather_bad: !st?.weather_bad })}>
                {st?.weather_bad ? 'Clear the skies' : 'Make it rain'}
              </Button>
            </Panel>

            <Panel title="Traveler running late" Icon={Clock}>
              <div className="flex gap-2">
                <label htmlFor="late" className="sr-only">Minutes late</label>
                <select id="late" value={late} onChange={(e) => setLate(Number(e.target.value))} className={cx(selectCls, 'w-28')}>
                  {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
                <Button className="flex-1" disabled={busy} onClick={() => fire(`Running ${late} min late`, { trigger_type: 'time_shrink', minutes: late })}>Simulate</Button>
              </div>
            </Panel>

            <Panel title="Budget change" Icon={IndianRupee}>
              <p className="-mt-2 mb-2 text-sm text-ink-3">Now {inr(itin?.session?.budget_envelope)} per person</p>
              <div className="flex gap-2">
                <label htmlFor="budget" className="sr-only">New budget</label>
                <input id="budget" type="number" inputMode="numeric" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={cx(selectCls, 'w-28')} />
                <Button className="flex-1" disabled={busy} onClick={() => fire(`Budget set to ${inr(budget)}`, { trigger_type: 'budget_shrink', new_budget: budget })}>Apply</Button>
              </div>
            </Panel>

            <Panel title="Event log" Icon={Radio}>
              <ul className="max-h-56 space-y-1 overflow-y-auto font-mono text-xs" aria-live="polite">
                {log.length === 0 && <li className="text-ink-3">Waiting for triggers…</li>}
                {log.map((l, i) => <li key={i} className={toneCls[l.tone]}><span className="text-ink-3">{l.t}</span> {l.text}</li>)}
              </ul>
            </Panel>
          </div>
        </div>

        <div className="xl:order-1"><Phone title="Traveler" Icon={Smartphone} src="/?embed=1" /></div>
        <div className="xl:order-3"><Phone title="Vendor" Icon={Store} src={`/vendor/${vendorId}?embed=1`} /></div>
      </main>
    </div>
  )
}
