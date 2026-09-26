import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle, MonitorPlay, Store } from 'lucide-react'
import { api } from '../api'
import { useTraveler } from '../store'
import { ACCESS, Button, Card, Field, GROUP_LABEL, Segmented, ThemeToggle, cx, inputCls } from '../components/ui'
import { clearSkipped } from './RightNow'

// Trip Context Capture. Accessibility flags are opt-in: none are preselected.
export default function TripSetup() {
  const { state, itinerary, refresh, notify, setEvents } = useTraveler()
  const nav = useNavigate()
  const [form, setForm] = useState({
    display_name: 'Aanya', location_key: 'hotel', trip_date: new Date().toISOString().slice(0, 10),
    group_type: 'couple', accessibility_flags: [], budget_envelope: 3000, source: 'sample',
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (itinerary) setForm((f) => ({ ...f, group_type: itinerary.user.group_type, accessibility_flags: itinerary.user.accessibility_flags }))
  }, [itinerary?.id]) // eslint-disable-line
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (flag) => set('accessibility_flags', form.accessibility_flags.includes(flag) ? form.accessibility_flags.filter((x) => x !== flag) : [...form.accessibility_flags, flag])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.startSession({ ...form, budget_envelope: Number(form.budget_envelope) })
      await api.createItinerary({ source: form.source, trip_date: form.trip_date })
      clearSkipped()
      setEvents([])
      await refresh()
      nav('/')
    } catch (err) { notify(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="px-4 pt-6 md:px-6 lg:px-0 lg:pt-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold lg:text-4xl">Plan your day</h1>
          <p className="mt-1 text-ink-2">A few details so every suggestion actually fits.</p>
        </div>
        <ThemeToggle className="lg:hidden" />
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-4 p-5">
          <h2 className="text-base font-semibold">About the trip</h2>
          <Field label="Your name"><input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} autoComplete="given-name" className={inputCls} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Staying near">
              <select value={form.location_key} onChange={(e) => set('location_key', e.target.value)} className={inputCls}>
                {state?.locations.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.trip_date} onChange={(e) => set('trip_date', e.target.value)} className={inputCls} /></Field>
          </div>
          <div>
            <span className="text-sm font-semibold">Who’s coming?</span>
            <div className="mt-1.5"><Segmented label="Group type" value={form.group_type} onChange={(v) => set('group_type', v)} options={Object.entries(GROUP_LABEL).map(([value, label]) => ({ value, label }))} /></div>
          </div>
          <Field label="Budget for experiences today" hint="₹ per person">
            <input type="number" inputMode="numeric" min="0" step="100" value={form.budget_envelope} onChange={(e) => set('budget_envelope', e.target.value)} className={inputCls} />
          </Field>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Accessibility needs <span className="font-normal text-ink-3">(optional)</span></h2>
            <p className="text-sm text-ink-3">We’ll only show places that meet every need you pick.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(ACCESS).map(([k, { label, Icon }]) => {
                const on = form.accessibility_flags.includes(k)
                return (
                  <button type="button" key={k} onClick={() => toggle(k)} aria-pressed={on}
                    className={cx('flex min-h-12 items-center gap-2.5 rounded-xl px-3.5 text-left text-[15px] ring-1 transition-colors',
                      on ? 'bg-success-soft text-success ring-2 ring-success' : 'bg-surface text-ink-2 ring-line hover:bg-surface-2')}>
                    <Icon size={18} aria-hidden /> {label}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Start from</h2>
            <div className="mt-2"><Segmented label="Starting itinerary" value={form.source} onChange={(v) => set('source', v)} options={[{ value: 'sample', label: 'Sample day' }, { value: 'fresh', label: 'Blank day' }]} /></div>
            <p className="mt-2 text-sm text-ink-3">{form.source === 'sample' ? 'Amber Fort, City Palace and dinner are booked. GapFill fills the idle time in between.' : 'Your whole day (7 AM – 10 PM) starts as one open window.'}</p>
          </Card>

          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Setting up…' : 'Start my day'}</Button>
        </div>
      </form>

      <Card as="nav" aria-label="Other views" className="mt-6 divide-y divide-line lg:hidden">
        {[['/vendor/1', 'Vendor console', Store], ['/vendor/chat', 'List an experience (vendor chat)', MessageCircle], ['/ops', 'Live Ops demo', MonitorPlay]].map(([to, label, Icon]) => (
          <Link key={to} to={to} className="flex min-h-14 items-center gap-3 px-4 text-ink hover:bg-surface-2">
            <Icon size={18} className="text-ink-3" aria-hidden /> <span className="flex-1">{label}</span> <ChevronRight size={18} className="text-ink-3" aria-hidden />
          </Link>
        ))}
      </Card>
    </div>
  )
}
