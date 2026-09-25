import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useTraveler } from '../store'
import { ACCESS, Button, Card, GROUP_LABEL, Segmented, cx } from '../components/ui'
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
    <form onSubmit={submit} className="space-y-4 px-4 pt-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plan your day</h1>
        <p className="text-sm text-stone-500">A few details so every suggestion actually fits.</p>
      </div>
      <Card className="space-y-4 p-4">
        <label className="block text-sm">
          <span className="font-medium">Your name</span>
          <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-3 py-2 ring-1 ring-stone-200" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium">Staying near</span>
            <select value={form.location_key} onChange={(e) => set('location_key', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-2 py-2 ring-1 ring-stone-200">
              {state?.locations.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Date</span>
            <input type="date" value={form.trip_date} onChange={(e) => set('trip_date', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-2 py-2 ring-1 ring-stone-200" />
          </label>
        </div>
        <div className="text-sm">
          <span className="font-medium">Who’s coming?</span>
          <div className="mt-1"><Segmented value={form.group_type} onChange={(v) => set('group_type', v)} options={Object.entries(GROUP_LABEL).map(([value, label]) => ({ value, label }))} /></div>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Budget for experiences today (₹ per person)</span>
          <input type="number" min="0" step="100" value={form.budget_envelope} onChange={(e) => set('budget_envelope', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-3 py-2 ring-1 ring-stone-200" />
        </label>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium">Accessibility needs <span className="font-normal text-stone-500">(optional)</span></div>
        <p className="text-xs text-stone-500">We’ll only show places that meet every need you pick.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(ACCESS).map(([k, { label, Icon }]) => (
            <button type="button" key={k} onClick={() => toggle(k)}
              className={cx('flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ring-1 transition',
                form.accessibility_flags.includes(k) ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-stone-600 ring-stone-200')}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium">Start from</div>
        <div className="mt-2"><Segmented value={form.source} onChange={(v) => set('source', v)} options={[{ value: 'sample', label: 'Sample itinerary' }, { value: 'fresh', label: 'Blank day' }]} /></div>
        <p className="mt-2 text-xs text-stone-500">{form.source === 'sample' ? 'Amber Fort, City Palace and dinner are booked; GapFill fills the idle time in between.' : 'Your whole day (7 AM – 10 PM) starts as one open window.'}</p>
      </Card>

      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Setting up…' : 'Start my day'}</Button>
    </form>
  )
}
