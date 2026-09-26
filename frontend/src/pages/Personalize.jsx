import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Accessibility, Coffee, Minus, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Button, INTEREST, InterestPicker, MODE, PACE_LABEL, Segmented, TIER_LABEL, cx } from '../components/ui'
import { PageBody, PageHero } from '../components/page'
import { destImage } from '../media'
import { Avatar, MOOD } from '../components/group'

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
const PRESETS = {
  generations: [{ name: 'Aarav', age: 5 }, { name: 'Ishaan', age: 20 }, { name: 'Rohan', age: 45 }, { name: 'Paati', age: 68, step_free: true, rest: true }],
  family: [{ name: 'Rohan', age: 41 }, { name: 'Meera', age: 38 }, { name: 'Aarav', age: 5 }, { name: 'Ira', age: 9 }],
  couple: [{ name: 'Aanya', age: 29 }, { name: 'Kabir', age: 31 }],
  friends: [{ name: 'Arjun', age: 26 }, { name: 'Dev', age: 27 }, { name: 'Rhea', age: 25 }],
}
const bandOf = (a) => (a <= 7 ? 'Young child' : a <= 12 ? 'Child' : a <= 17 ? 'Teen' : a <= 30 ? 'Young adult' : a <= 59 ? 'Adult' : a <= 74 ? 'Senior' : 'Elder')

// One traveler: age drives what the model predicts they'll enjoy; needs are hard rules.
function MemberCard({ m, onChange, onRemove, canRemove }) {
  const [open, setOpen] = useState(false)
  const set = (k, v) => onChange({ ...m, [k]: v })
  const toggleInt = (k) => set('interests', (m.interests || []).includes(k) ? m.interests.filter((x) => x !== k) : [...(m.interests || []), k])
  return (
    <li className="rounded-3xl bg-white p-3 shadow-soft ring-1 ring-stone-200/70">
      <div className="flex items-center gap-2">
        <Avatar name={m.name} age={m.age} />
        <input value={m.name} onChange={(e) => set('name', e.target.value)} aria-label="Name"
          className="min-h-11 min-w-0 flex-1 rounded-2xl bg-stone-50 px-3 font-semibold ring-1 ring-stone-200" />
        <button type="button" aria-label="Younger" onClick={() => set('age', Math.max(1, m.age - 1))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Minus size={14} /></button>
        <input type="number" min="1" max="99" value={m.age} aria-label="Age"
          onChange={(e) => set('age', Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          className="h-11 w-12 shrink-0 rounded-2xl bg-stone-50 text-center font-bold ring-1 ring-stone-200" />
        <button type="button" aria-label="Older" onClick={() => set('age', Math.min(99, m.age + 1))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Plus size={14} /></button>
        {canRemove && <button type="button" aria-label={`Remove ${m.name}`} onClick={onRemove} className="grid h-11 w-9 shrink-0 place-items-center text-stone-400 hover:text-red-600"><Trash2 size={17} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
        <span className="text-sm font-medium text-stone-500">{bandOf(m.age)}</span>
        <button type="button" onClick={() => set('step_free', !m.step_free)} aria-pressed={!!m.step_free}
          className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1', m.step_free ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : 'bg-white text-stone-500 ring-stone-200')}>
          <Accessibility size={13} aria-hidden /> Step-free
        </button>
        <button type="button" onClick={() => set('rest', !m.rest)} aria-pressed={!!m.rest}
          className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1', m.rest ? 'bg-sky-50 text-sky-800 ring-sky-300' : 'bg-white text-stone-500 ring-stone-200')}>
          <Coffee size={13} aria-hidden /> Afternoon rest
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-h-9 px-1 text-xs font-semibold text-rani-600">
          {m.interests?.length ? `${m.interests.length} own interest${m.interests.length > 1 ? 's' : ''}` : '+ own interests'}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(INTEREST).map(([k, { label, Icon }]) => (
            <button type="button" key={k} onClick={() => toggleInt(k)} aria-pressed={(m.interests || []).includes(k)}
              className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs ring-1', (m.interests || []).includes(k) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
              <Icon size={12} aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

// Personalize: every preference the planner uses. The group is people with ages and needs; the model plans fairly for all of them.
export default function Personalize() {
  const { state, tour, notify, activate } = useTour()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const inThreeWeeks = state ? new Date(new Date(state.demo_date).getTime() + 21 * 864e5).toISOString().slice(0, 10) : ''
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [moodText, setMoodText] = useState('')
  const [detected, setDetected] = useState([])
  const timer = useRef()

  useEffect(() => {
    if (!state || f) return
    const dest = params.get('dest')
    setF({
      name: tour?.customer?.name || 'Aanya Sharma', start_date: inThreeWeeks, days: 7, start_city: 'delhi',
      destinations: dest ? [dest] : [], members: PRESETS.generations.map((m) => ({ interests: [], ...m })), budget: 180000,
      hotel_tier: 'standard', transport: 'best', interests: tour?.prefs?.interests || ['heritage', 'food', 'wildlife'], pace: 'balanced', mood: [],
    })
  }, [state]) // eslint-disable-line
  // the mood model reads free text as you type
  useEffect(() => {
    clearTimeout(timer.current)
    if (!moodText.trim()) { setDetected([]); return }
    timer.current = setTimeout(() => api.parseMood(moodText).then((r) => setDetected(r.moods.map((m) => m.mood))).catch(() => {}), 350)
  }, [moodText])
  if (!f) return null
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v])
  const travelers = f.members.length
  const moods = [...new Set([...f.mood, ...detected])]

  // Build only from an explicit tap: the form's own submit (Enter key, or a button that just changed type
  // under the finger) must never skip the remaining steps.
  const build = async () => {
    if (busy) return
    setBusy(true)
    try {
      const t = await api.plan({ ...f, budget: Number(f.budget), mood: moods, mood_text: moodText })
      await activate(t.id)
      nav('/plan')
    } catch (err) { notify(err.message, 'error') } finally { setBusy(false) }
  }

  const STEPS = ['Trip basics', 'Who’s coming', 'What you love', 'Your style']
  const last = step === STEPS.length - 1
  const inputCls = 'mt-1 min-h-11 w-full rounded-2xl bg-white px-3 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500'

  return (
    <div>
    <PageHero size="sm" img={destImage(f.destinations[0] || 'jaipur')} eyebrow="Plan a trip" title="Your trip, your way" />
    <PageBody width="narrow">
    <form onSubmit={(e) => e.preventDefault()} className="flex min-h-[60dvh] flex-col">
      <div>
        <p className="text-sm font-semibold text-rani-600">Step {step + 1} of {STEPS.length}</p>
        <h1 className="font-display text-3xl">{STEPS[step]}</h1>
        <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden>{STEPS.map((_, i) => <span key={i} className={cx('h-1.5 rounded-full', i <= step ? 'bg-rani-600' : 'bg-stone-200')} />)}</div>
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
            <div className="text-sm font-semibold">Days<Stepper value={f.days} onChange={(v) => set('days', v)} min={2} max={16} /></div>
            <div className="text-sm font-semibold">
              Total budget
              <div className="font-display mt-1 text-3xl font-semibold">{inr(Number(f.budget))}</div>
              <input type="range" style={{ height: 44 }} min={20000} max={600000} step={5000} value={f.budget} onChange={(e) => set('budget', Number(e.target.value))} aria-label="Total budget" className="mt-2 w-full accent-rani-600" />
              <span className="block text-sm font-normal text-stone-500">≈ {inr(f.budget / Math.max(1, travelers) / Math.max(1, f.days))} per person per day for {travelers} {travelers === 1 ? 'person' : 'people'}</span>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-[15px] text-stone-600">Ages matter: a 5-year-old and a 68-year-old need very different days. Our model predicts what each person will enjoy and plans fairly for everyone.</p>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {[['generations', '3 generations'], ['family', 'Family with kids'], ['couple', 'Couple'], ['friends', 'Friends']].map(([k, l]) => (
                <button type="button" key={k} onClick={() => set('members', PRESETS[k].map((m) => ({ interests: [], ...m })))}
                  className="min-h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 hover:ring-rani-500">{l}</button>
              ))}
            </div>
            <ul className="space-y-2">
              {f.members.map((m, i) => (
                <MemberCard key={i} m={m} canRemove={travelers > 1}
                  onChange={(nm) => set('members', f.members.map((x, j) => (j === i ? nm : x)))}
                  onRemove={() => set('members', f.members.filter((_, j) => j !== i))} />
              ))}
            </ul>
            <Button type="button" variant="secondary" className="w-full" onClick={() => set('members', [...f.members, { name: `Traveler ${travelers + 1}`, age: 30, interests: [] }])}>
              <UserPlus size={16} aria-hidden /> Add a traveler
            </Button>
            <div className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-stone-200/70">
              <div className="font-semibold">How’s everyone feeling?</div>
              <p className="text-sm text-stone-500">Type it like you’d text a friend, our mood model reads it.</p>
              <input value={moodText} onChange={(e) => setMoodText(e.target.value)} placeholder="e.g. the kids are restless and we’re a bit tired" className={inputCls} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(MOOD).map(([k, { label, Icon }]) => (
                  <button type="button" key={k} aria-pressed={moods.includes(k)}
                    onClick={() => (detected.includes(k) ? setDetected(detected.filter((x) => x !== k)) : toggle('mood', k))}
                    className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 transition', moods.includes(k) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
                    <Icon size={13} aria-hidden /> {label}{detected.includes(k) && <Sparkles size={11} aria-label="detected" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
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

        {step === 3 && (
          <>
            <div className="text-sm font-semibold">Stays<div className="mt-1.5"><Segmented value={f.hotel_tier} onChange={(v) => set('hotel_tier', v)} options={state.tiers.map((t) => ({ value: t, label: TIER_LABEL[t] }))} /></div></div>
            <div className="text-sm font-semibold">Getting around<div className="mt-1.5"><Segmented value={f.transport} onChange={(v) => set('transport', v)} options={state.transport_modes.map((m) => ({ value: m, label: MODE[m].label }))} /></div></div>
            <div className="text-sm font-semibold">Pace<div className="mt-1.5"><Segmented value={f.pace} onChange={(v) => set('pace', v)} options={state.paces.map((p) => ({ value: p, label: PACE_LABEL[p] }))} /></div>
              <p className="mt-1 font-normal text-stone-500">{PACE_HINT[f.pace]}, the youngest and oldest in the group can shorten it.</p></div>
            <label className="block text-sm font-semibold">Lead traveler
              <input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" className={inputCls} />
            </label>
          </>
        )}
      </div>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-5 lg:bottom-0 mt-6 grid grid-cols-[auto_1fr] gap-2 bg-gradient-to-t from-sand-50 from-70% to-sand-50/0 px-4 pb-2 pt-6 md:-mx-6 md:px-6">
        {step > 0 ? <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
        {last
          ? <Button key="build" type="button" onClick={build} disabled={busy || !f.interests.length || !travelers}>{busy ? 'Predicting what everyone will enjoy…' : 'Build our tour'}</Button>
          : <Button key="next" type="button" onClick={() => setStep(step + 1)}>Next</Button>}
        {!last && (
          <button type="button" onClick={build} disabled={busy || !f.interests.length || !travelers} className="col-span-2 min-h-11 text-sm font-semibold text-rani-600 hover:underline disabled:opacity-50">
            {busy ? 'Building your plan…' : 'Skip, build with smart defaults'}
          </button>
        )}
      </div>
    </form>
    </PageBody>
    </div>
  )
}
