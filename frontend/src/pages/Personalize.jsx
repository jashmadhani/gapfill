import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Accessibility, Minus, Plus } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Button, InterestPicker, MODE, PACE_LABEL, Segmented, TIER_LABEL, cx } from '../components/ui'

function Stepper({ value, onChange, min = 0, max = 30 }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Minus size={14} /></button>
      <span className="w-8 text-center text-lg font-bold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Plus size={14} /></button>
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
  const [step, setStep] = useState(0)

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

  const STEPS = ['Trip basics', 'What you love', 'Your style']
  const last = step === STEPS.length - 1
  const inputCls = 'mt-1 min-h-11 w-full rounded-2xl bg-white px-3 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500'

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-8rem)] flex-col px-4 pt-5 md:px-6">
      <div>
        <p className="text-sm font-semibold text-rani-600">Step {step + 1} of {STEPS.length}</p>
        <h1 className="font-display text-3xl">{STEPS[step]}</h1>
        <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>{STEPS.map((_, i) => <span key={i} className={cx('h-1.5 rounded-full', i <= step ? 'bg-rani-600' : 'bg-stone-200')} />)}</div>
      </div>

      <div className="mt-5 flex-1 space-y-5">
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">Start date
                <input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm font-semibold">Starting from
                <select value={f.start_city} onChange={(e) => set('start_city', e.target.value)} className={inputCls}>
                  {state.destinations.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm font-semibold">
              <div>Days<Stepper value={f.days} onChange={(v) => set('days', v)} min={2} max={16} /></div>
              <div>Adults<Stepper value={f.adults} onChange={(v) => set('adults', v)} min={1} max={20} /></div>
              <div>Children<Stepper value={f.children} onChange={(v) => set('children', v)} max={8} /></div>
            </div>
            <div className="text-sm font-semibold">
              Total budget
              <div className="font-display mt-1 text-3xl font-semibold">{inr(Number(f.budget))}</div>
              <input type="range" min={20000} max={600000} step={5000} value={f.budget} onChange={(e) => set('budget', Number(e.target.value))} aria-label="Total budget" className="mt-2 w-full accent-rani-600" />
              <span className="block text-sm font-normal text-stone-500">≈ {inr(f.budget / Math.max(1, travelers) / Math.max(1, f.days))} per person per day</span>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <InterestPicker value={f.interests} onToggle={(k) => toggle('interests', k)} />
            <details className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-stone-200/70" open={f.destinations.length > 0}>
              <summary className="min-h-11 content-center font-semibold">Choose cities myself <span className="font-normal text-stone-500">(optional)</span></summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.destinations.map((d) => (
                  <button type="button" key={d.key} onClick={() => toggle('destinations', d.key)} aria-pressed={f.destinations.includes(d.key)}
                    className={cx('min-h-10 rounded-full px-3.5 text-sm font-medium ring-1', f.destinations.includes(d.key) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
                    {f.destinations.includes(d.key) && `${f.destinations.indexOf(d.key) + 1}. `}{d.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-stone-500">Leave empty and we’ll pick the best route for your interests.</p>
            </details>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-sm font-semibold">Stays<div className="mt-1.5"><Segmented value={f.hotel_tier} onChange={(v) => set('hotel_tier', v)} options={state.tiers.map((t) => ({ value: t, label: TIER_LABEL[t] }))} /></div></div>
            <div className="text-sm font-semibold">Getting around<div className="mt-1.5"><Segmented value={f.transport} onChange={(v) => set('transport', v)} options={state.transport_modes.map((m) => ({ value: m, label: MODE[m].label }))} /></div></div>
            <div className="text-sm font-semibold">Pace<div className="mt-1.5"><Segmented value={f.pace} onChange={(v) => set('pace', v)} options={state.paces.map((p) => ({ value: p, label: PACE_LABEL[p] }))} /></div>
              <p className="mt-1 font-normal text-stone-500">{PACE_HINT[f.pace]}</p></div>
            <button type="button" onClick={() => set('needs', { ...f.needs, step_free: !f.needs.step_free })} aria-pressed={f.needs.step_free}
              className={cx('flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left text-sm font-medium ring-1 transition',
                f.needs.step_free ? 'bg-emerald-50 text-emerald-800 ring-emerald-400' : 'bg-white text-stone-600 ring-stone-200')}>
              <Accessibility size={18} aria-hidden /> Step-free access needed
            </button>
            <label className="block text-sm font-semibold">Lead traveler
              <input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" className={inputCls} />
            </label>
            {f.children > 0 && <p className="text-sm text-stone-500">Travelling with children: we’ll only include kid-friendly experiences.</p>}
          </>
        )}
      </div>

      <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] mt-6 grid grid-cols-[auto_1fr] gap-2">
        {step > 0 ? <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
        {last
          ? <Button type="submit" disabled={busy || !f.interests.length}>{busy ? 'Building your plan…' : 'Build my tour'}</Button>
          : <Button type="button" onClick={() => setStep(step + 1)}>Next</Button>}
        {!last && (
          <button type="submit" disabled={busy || !f.interests.length} className="col-span-2 min-h-11 text-sm font-semibold text-rani-600 hover:underline disabled:opacity-50">
            {busy ? 'Building your plan…' : 'Skip — build with smart defaults'}
          </button>
        )}
      </div>
    </form>
  )
}
