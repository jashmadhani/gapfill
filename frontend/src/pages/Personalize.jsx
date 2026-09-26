import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Accessibility, Minus, Plus } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Button, Card, INTEREST, MODE, PACE_LABEL, Segmented, TIER_LABEL, cx } from '../components/ui'

function Stepper({ value, onChange, min = 0, max = 30 }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-9 w-9 place-items-center rounded-lg bg-sand-50 ring-1 ring-stone-200"><Minus size={14} /></button>
      <span className="w-8 text-center text-lg font-bold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="grid h-9 w-9 place-items-center rounded-lg bg-sand-50 ring-1 ring-stone-200"><Plus size={14} /></button>
    </div>
  )
}

const PACE_HINT = { relaxed: 'Late starts, 2 things a day', balanced: '3 things a day, evenings free-ish', packed: 'Early starts, up to 4 a day' }

// Personalize: every preference the planner uses. Destinations are optional — leave empty and we pick from your interests.
export default function Personalize() {
  const { state, tour, notify, activate } = useTour()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const inThreeWeeks = state ? new Date(new Date(state.demo_date).getTime() + 21 * 864e5).toISOString().slice(0, 10) : ''
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!state || f) return
    const dest = params.get('dest')
    setF({
      name: tour?.customer?.name || 'Aanya Sharma', start_date: inThreeWeeks, days: 7, start_city: 'delhi',
      destinations: dest ? [dest] : [], adults: 2, children: 0, budget: 120000, hotel_tier: 'standard', transport: 'best',
      interests: tour?.prefs?.interests || ['heritage', 'food'], pace: 'balanced', needs: { step_free: false },
    })
  }, [state]) // eslint-disable-line
  if (!f) return null
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v])
  const travelers = f.adults + f.children

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const t = await api.plan({ ...f, budget: Number(f.budget) })
      await activate(t.id)
      nav('/plan')
    } catch (err) { notify(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 pt-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personalize your tour</h1>
        <p className="text-sm text-stone-500">Tell us how you like to travel. We’ll build and optimise the whole trip — you can change any part after.</p>
      </div>

      <Card className="space-y-4 p-4">
        <label className="block text-sm">
          <span className="font-medium">Lead traveler</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-3 py-2 ring-1 ring-stone-200" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium">Start date</span>
            <input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-2 py-2 ring-1 ring-stone-200" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Starting from</span>
            <select value={f.start_city} onChange={(e) => set('start_city', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-2 py-2 ring-1 ring-stone-200">
              {state.destinations.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="font-medium">Days</span><Stepper value={f.days} onChange={(v) => set('days', v)} min={2} max={16} /></div>
          <div><span className="font-medium">Adults</span><Stepper value={f.adults} onChange={(v) => set('adults', v)} min={1} max={20} /></div>
          <div><span className="font-medium">Children</span><Stepper value={f.children} onChange={(v) => set('children', v)} max={8} /></div>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Total budget (₹, whole group)</span>
          <input type="number" min="0" step="5000" value={f.budget} onChange={(e) => set('budget', e.target.value)} className="mt-1 w-full rounded-lg bg-sand-50 px-3 py-2 ring-1 ring-stone-200" />
          <span className="mt-1 block text-xs text-stone-500">≈ {inr(f.budget / Math.max(1, travelers))} per person · {inr(f.budget / Math.max(1, travelers) / Math.max(1, f.days))} per person per day</span>
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="text-sm">
          <span className="font-medium">Where to?</span> <span className="text-stone-500">(optional — leave empty and we’ll choose)</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.destinations.map((d) => (
              <button type="button" key={d.key} onClick={() => toggle('destinations', d.key)}
                className={cx('rounded-full px-3 py-1.5 text-xs ring-1', f.destinations.includes(d.key) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
                {f.destinations.includes(d.key) && `${f.destinations.indexOf(d.key) + 1}. `}{d.name}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm">
          <span className="font-medium">Interests</span>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {Object.entries(INTEREST).map(([k, { label, Icon }]) => (
              <button type="button" key={k} onClick={() => toggle('interests', k)}
                className={cx('flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-xs ring-1 transition',
                  f.interests.includes(k) ? 'bg-rani-50 text-rani-700 ring-rani-500' : 'bg-white text-stone-600 ring-stone-200')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="text-sm">
          <span className="font-medium">Accommodation</span>
          <div className="mt-1"><Segmented value={f.hotel_tier} onChange={(v) => set('hotel_tier', v)} options={state.tiers.map((t) => ({ value: t, label: TIER_LABEL[t] }))} /></div>
        </div>
        <div className="text-sm">
          <span className="font-medium">Getting around</span>
          <div className="mt-1"><Segmented value={f.transport} onChange={(v) => set('transport', v)} options={state.transport_modes.map((m) => ({ value: m, label: MODE[m].label }))} /></div>
        </div>
        <div className="text-sm">
          <span className="font-medium">Travel style</span>
          <div className="mt-1"><Segmented value={f.pace} onChange={(v) => set('pace', v)} options={state.paces.map((p) => ({ value: p, label: PACE_LABEL[p] }))} /></div>
          <p className="mt-1 text-xs text-stone-500">{PACE_HINT[f.pace]}</p>
        </div>
        <button type="button" onClick={() => set('needs', { ...f.needs, step_free: !f.needs.step_free })}
          className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ring-1 transition',
            f.needs.step_free ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-stone-600 ring-stone-200')}>
          <Accessibility size={16} /> Step-free access needed
        </button>
        {f.children > 0 && <p className="text-xs text-stone-500">Travelling with children: we’ll only include kid-friendly experiences.</p>}
      </Card>

      <Button type="submit" className="w-full" disabled={busy || !f.interests.length}>{busy ? 'Building your optimised plan…' : 'Build my tour'}</Button>
    </form>
  )
}
