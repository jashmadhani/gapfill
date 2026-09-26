import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Accessibility, ArrowLeft, Coffee, Minus, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { Button, Card, GlassIconButton, INTEREST, MODE, PACE_LABEL, Segmented, TIER_LABEL, cx } from '../components/ui'
import { Avatar, MOOD } from '../components/group'

function Stepper({ value, onChange, min = 0, max = 30, label }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-sand-50 ring-1 ring-stone-200"><Minus size={15} /></button>
      <span className="w-8 text-center text-lg font-bold">{value}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-sand-50 ring-1 ring-stone-200"><Plus size={15} /></button>
    </div>
  )
}

const PACE_HINT = { relaxed: 'Late starts, 2 things a day', balanced: '3 things a day, evenings free-ish', packed: 'Early starts, up to 4 a day' }
const PRESETS = {
  couple: [{ name: 'Aanya', age: 29 }, { name: 'Kabir', age: 31 }],
  family: [{ name: 'Rohan', age: 41 }, { name: 'Meera', age: 38 }, { name: 'Aarav', age: 5 }, { name: 'Ira', age: 9 }],
  generations: [{ name: 'Aarav', age: 5 }, { name: 'Ishaan', age: 20 }, { name: 'Rohan', age: 45 }, { name: 'Paati', age: 68, step_free: true, rest: true }],
  friends: [{ name: 'Arjun', age: 26 }, { name: 'Dev', age: 27 }, { name: 'Rhea', age: 25 }],
}
const bandOf = (a) => (a <= 7 ? 'Young child' : a <= 12 ? 'Child' : a <= 17 ? 'Teen' : a <= 30 ? 'Young adult' : a <= 59 ? 'Adult' : a <= 74 ? 'Senior' : 'Elder')

function MemberCard({ m, onChange, onRemove, canRemove }) {
  const [open, setOpen] = useState(false)
  const set = (k, v) => onChange({ ...m, [k]: v })
  const toggleInt = (k) => set('interests', (m.interests || []).includes(k) ? m.interests.filter((x) => x !== k) : [...(m.interests || []), k])
  return (
    <li className="rounded-3xl bg-sand-50 p-3 ring-1 ring-stone-200">
      <div className="flex items-center gap-2.5">
        <Avatar name={m.name} age={m.age} />
        <input value={m.name} onChange={(e) => set('name', e.target.value)} aria-label="Name"
          className="min-h-10 min-w-0 flex-1 rounded-full bg-white px-3 font-semibold ring-1 ring-stone-200" />
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Younger" onClick={() => set('age', Math.max(1, m.age - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Minus size={14} /></button>
          <input type="number" min="1" max="99" value={m.age} onChange={(e) => set('age', Math.max(1, Math.min(99, Number(e.target.value) || 1)))} aria-label="Age"
            className="h-9 w-12 rounded-full bg-white text-center font-bold ring-1 ring-stone-200" />
          <button type="button" aria-label="Older" onClick={() => set('age', Math.min(99, m.age + 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-stone-200"><Plus size={14} /></button>
        </div>
        {canRemove && <button type="button" aria-label={`Remove ${m.name}`} onClick={onRemove} className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
        <span className="text-xs font-medium text-stone-500">{bandOf(m.age)}</span>
        <button type="button" onClick={() => set('step_free', !m.step_free)} aria-pressed={!!m.step_free}
          className={cx('inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1', m.step_free ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : 'bg-white text-stone-500 ring-stone-200')}>
          <Accessibility size={13} /> Step-free
        </button>
        <button type="button" onClick={() => set('rest', !m.rest)} aria-pressed={!!m.rest}
          className={cx('inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1', m.rest ? 'bg-sky-50 text-sky-800 ring-sky-300' : 'bg-white text-stone-500 ring-stone-200')}>
          <Coffee size={13} /> Afternoon rest
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-h-8 px-1 text-xs font-semibold text-rani-600">
          {m.interests?.length ? `${m.interests.length} own interest${m.interests.length > 1 ? 's' : ''}` : '+ own interests'}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(INTEREST).map(([k, { label, Icon }]) => (
            <button type="button" key={k} onClick={() => toggleInt(k)} aria-pressed={(m.interests || []).includes(k)}
              className={cx('inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs ring-1', (m.interests || []).includes(k) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

// Personalize: who is travelling (as people, with ages and needs), how they feel, and every preference the planner uses.
export default function Personalize() {
  const { state, tour, notify, activate } = useTour()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [moodText, setMoodText] = useState('')
  const [detected, setDetected] = useState([])
  const timer = useRef()

  useEffect(() => {
    if (!state || f) return
    const dest = params.get('dest')
    const inThreeWeeks = new Date(new Date(state.demo_date).getTime() + 21 * 864e5).toISOString().slice(0, 10)
    setF({
      name: tour?.customer?.name || 'Aanya Sharma', start_date: inThreeWeeks, days: 7, start_city: 'delhi',
      destinations: dest ? [dest] : [], members: PRESETS.generations.map((m) => ({ interests: [], ...m })), budget: 180000,
      hotel_tier: 'standard', transport: 'best', interests: tour?.prefs?.interests || ['heritage', 'food', 'wildlife'], pace: 'balanced', mood: [],
    })
  }, [state]) // eslint-disable-line
  // read free-text mood with the mood model as the user types
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

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const t = await api.plan({ ...f, budget: Number(f.budget), mood: moods, mood_text: moodText })
      await activate(t.id)
      nav('/plan')
    } catch (err) { notify(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 pt-5 md:px-6">
      <div className="flex items-start gap-3">
        <GlassIconButton label="Back" onClick={() => nav(-1)} className="shrink-0"><ArrowLeft size={20} /></GlassIconButton>
        <div>
          <h1 className="font-display text-3xl leading-tight">Personalize your tour</h1>
          <p className="text-sm text-stone-500">Tell us who’s coming and how you like to travel. Our model predicts what each person will enjoy and plans fairly for everyone.</p>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Who’s travelling?</h2>
            <p className="text-xs text-stone-500">Ages matter: a 5-year-old and a 68-year-old need very different days.</p>
          </div>
          <span className="text-sm font-semibold text-stone-500">{travelers} {travelers === 1 ? 'person' : 'people'}</span>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {[['generations', '3 generations'], ['family', 'Family with kids'], ['couple', 'Couple'], ['friends', 'Friends']].map(([k, l]) => (
            <button type="button" key={k} onClick={() => set('members', PRESETS[k].map((m) => ({ interests: [], ...m })))}
              className="min-h-9 shrink-0 rounded-full bg-sand-50 px-3 text-xs font-semibold text-stone-700 ring-1 ring-stone-200 hover:ring-rani-500">{l}</button>
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
          <UserPlus size={16} /> Add a traveler
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-base font-bold">How’s everyone feeling?</h2>
          <p className="text-xs text-stone-500">Type it like you’d text a friend — our mood model reads it. You can check in again every day of the trip.</p>
        </div>
        <input value={moodText} onChange={(e) => setMoodText(e.target.value)} placeholder="e.g. the kids are restless and we're a bit tired"
          className="min-h-12 w-full rounded-full bg-sand-50 px-4 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MOOD).map(([k, { label, Icon }]) => {
            const on = moods.includes(k)
            return (
              <button type="button" key={k} onClick={() => detected.includes(k) ? setDetected(detected.filter((x) => x !== k)) : toggle('mood', k)} aria-pressed={on}
                className={cx('inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 transition', on ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
                <Icon size={13} /> {label}{detected.includes(k) && <Sparkles size={11} aria-label="detected" />}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <label className="block text-sm">
          <span className="font-semibold">Lead traveler / booking name</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className="mt-1 min-h-11 w-full rounded-full bg-sand-50 px-4 ring-1 ring-stone-200" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold">Start date</span>
            <input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} className="mt-1 min-h-11 w-full rounded-full bg-sand-50 px-3 ring-1 ring-stone-200" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Starting from</span>
            <select value={f.start_city} onChange={(e) => set('start_city', e.target.value)} className="mt-1 min-h-11 w-full rounded-full bg-sand-50 px-3 ring-1 ring-stone-200">
              {state.destinations.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <div className="text-sm"><span className="font-semibold">Days</span><Stepper value={f.days} onChange={(v) => set('days', v)} min={2} max={16} label="days" /></div>
        <label className="block text-sm">
          <span className="font-semibold">Total budget (₹, whole group)</span>
          <input type="number" min="0" step="5000" value={f.budget} onChange={(e) => set('budget', e.target.value)} className="mt-1 min-h-11 w-full rounded-full bg-sand-50 px-4 ring-1 ring-stone-200" />
          <span className="mt-1 block text-xs text-stone-500">≈ {inr(f.budget / Math.max(1, travelers))} per person · {inr(f.budget / Math.max(1, travelers) / Math.max(1, f.days))} per person per day</span>
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="text-sm">
          <span className="font-semibold">Where to?</span> <span className="text-stone-500">(optional — leave empty and we’ll choose)</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.destinations.map((d) => (
              <button type="button" key={d.key} onClick={() => toggle('destinations', d.key)}
                className={cx('min-h-9 rounded-full px-3 text-xs font-semibold ring-1', f.destinations.includes(d.key) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white text-stone-600 ring-stone-200')}>
                {f.destinations.includes(d.key) && `${f.destinations.indexOf(d.key) + 1}. `}{d.name}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm">
          <span className="font-semibold">Group interests</span>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Object.entries(INTEREST).map(([k, { label, Icon }]) => (
              <button type="button" key={k} onClick={() => toggle('interests', k)}
                className={cx('flex min-h-10 items-center gap-1.5 rounded-full px-3 text-left text-xs font-medium ring-1 transition',
                  f.interests.includes(k) ? 'bg-rani-50 text-rani-700 ring-rani-500' : 'bg-white text-stone-600 ring-stone-200')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="text-sm">
          <span className="font-semibold">Accommodation</span>
          <div className="mt-1"><Segmented value={f.hotel_tier} onChange={(v) => set('hotel_tier', v)} options={state.tiers.map((t) => ({ value: t, label: TIER_LABEL[t] }))} /></div>
        </div>
        <div className="text-sm">
          <span className="font-semibold">Getting around</span>
          <div className="mt-1"><Segmented value={f.transport} onChange={(v) => set('transport', v)} options={state.transport_modes.map((m) => ({ value: m, label: MODE[m].label }))} /></div>
        </div>
        <div className="text-sm">
          <span className="font-semibold">Travel style</span>
          <div className="mt-1"><Segmented value={f.pace} onChange={(v) => set('pace', v)} options={state.paces.map((p) => ({ value: p, label: PACE_LABEL[p] }))} /></div>
          <p className="mt-1 text-xs text-stone-500">{PACE_HINT[f.pace]} — the youngest and oldest in the group can shorten it.</p>
        </div>
      </Card>

      <Button type="submit" className="w-full" disabled={busy || !f.interests.length || !travelers}>{busy ? 'Predicting what everyone will enjoy…' : 'Build our tour'}</Button>
    </form>
  )
}
