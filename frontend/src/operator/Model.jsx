import { useEffect, useState } from 'react'
import { BrainCircuit, Check, Database, FlaskConical, RefreshCw, X } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { Bar, Button, Card, Chip, Segmented, Spinner, cx } from '../components/ui'
import { CrowdChart, FitChips, MOOD } from '../components/group'
import { PageHead, Td, Th, useOps } from './OperatorApp'

const CAT_LABEL = { heritage: 'Heritage', museum: 'Museum', religious: 'Religious', nature: 'Nature', wildlife: 'Wildlife', adventure: 'Adventure',
  food: 'Food', shopping: 'Shopping', performance: 'Shows', workshop: 'Workshops', relaxation: 'Relaxation', viewpoint: 'Viewpoints' }

function Stat({ label, value, sub, tone }) {
  return (
    <Card className="p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-bold', tone)}>{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </Card>
  )
}

function heat(v) {
  // brand-blue sequential scale; text flips to white on dark cells
  const t = Math.max(0, Math.min(1, (v - 20) / 70))
  const l = 96 - t * 58
  return { background: `hsl(213 58% ${l}%)`, color: l < 62 ? 'white' : 'var(--color-stone-800)' }
}

function Playground({ state }) {
  const [city, setCity] = useState('jaipur')
  const [exps, setExps] = useState([])
  const [f, setF] = useState({ offering_id: null, age: 68, step_free: false, moods: [], start: '13:00', month: 5, rain: false, weekday: 5, interests: [] })
  const [out, setOut] = useState(null)
  useEffect(() => { api.destination(city).then((d) => { setExps(d.experiences); setF((x) => ({ ...x, offering_id: d.experiences[0]?.id })) }) }, [city])
  useEffect(() => { if (f.offering_id) api.mlPredict(f).then(setOut).catch(() => setOut(null)) }, [f])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2"><FlaskConical size={16} className="text-rani-600" /><h2 className="font-bold">Playground, ask the model</h2></div>
      <p className="text-xs text-stone-500">One person, one experience, one situation. Change anything and watch the prediction and its reasons move.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="min-h-10 rounded-full bg-stone-50 px-3 ring-1 ring-stone-200">
              {state?.destinations.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
            <select value={f.offering_id || ''} onChange={(e) => set('offering_id', Number(e.target.value))} className="min-h-10 rounded-full bg-stone-50 px-3 ring-1 ring-stone-200">
              {exps.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <label className="block">Age <b>{f.age}</b>
            <input type="range" min="2" max="90" value={f.age} onChange={(e) => set('age', Number(e.target.value))} className="w-full accent-rani-600" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Start time
              <select value={f.start} onChange={(e) => set('start', e.target.value)} className="mt-1 min-h-10 w-full rounded-full bg-stone-50 px-3 ring-1 ring-stone-200">
                {['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">Month
              <select value={f.month} onChange={(e) => set('month', Number(e.target.value))} className="mt-1 min-h-10 w-full rounded-full bg-stone-50 px-3 ring-1 ring-stone-200">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set('step_free', !f.step_free)} className={cx('min-h-8 rounded-full px-3 text-xs font-semibold ring-1', f.step_free ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : 'bg-white ring-stone-200')}>Needs step-free</button>
            <button type="button" onClick={() => set('rain', !f.rain)} className={cx('min-h-8 rounded-full px-3 text-xs font-semibold ring-1', f.rain ? 'bg-sky-50 text-sky-800 ring-sky-300' : 'bg-white ring-stone-200')}>Raining</button>
            {Object.entries(MOOD).map(([k, { label }]) => (
              <button type="button" key={k} onClick={() => set('moods', f.moods.includes(k) ? f.moods.filter((x) => x !== k) : [...f.moods, k])}
                className={cx('min-h-8 rounded-full px-3 text-xs font-semibold ring-1', f.moods.includes(k) ? 'bg-rani-600 text-white ring-rani-600' : 'bg-white ring-stone-200')}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          {!out ? <Spinner /> : (
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="text-5xl font-bold">{out.veto ? '-' : `${out.fit}%`}</div>
                <div className="pb-1 text-sm text-stone-500">{out.veto ? <span className="text-red-700">Vetoed: {out.veto}</span> : <>predicted enjoyment · {out.score.toFixed(2)} / 5</>}</div>
              </div>
              <FitChips members={[{ ...out, name: 'Traveler', age: f.age }]} />
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Crowd model · {out.crowd}% busy at {f.start}</div>
              <CrowdChart curve={out.crowd_curve} mark={Number(f.start.slice(0, 2))} />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function Model() {
  const { tick, refresh } = useOps()
  const { state } = useTour()
  const [m, setM] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('satisfaction')
  useEffect(() => { api.mlMetrics().then(setM) }, [tick])
  if (!m) return <Spinner />
  const s = m.satisfaction
  const imp = s.importance.slice(0, 10)
  const maxImp = Math.max(...imp.map((x) => x.value), 0.0001)
  const retrain = async () => {
    setBusy(true)
    try { await api.mlRetrain(); refresh() } finally { setBusy(false) }
  }
  const passed = s.tests.filter((t) => t.passed).length

  return (
    <div>
      <PageHead title="Planning model" sub={`v${m.version} · trained ${new Date(m.trained_at).toLocaleString('en-IN')} in ${m.seconds}s · scikit-learn`}>
        <Button onClick={retrain} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Retraining… (~1 min)' : `Retrain with ${m.feedback_available} feedback signals`}</Button>
      </PageHead>

      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2"><BrainCircuit size={16} className="text-rani-600" /><h2 className="font-bold">How TourCraft understands a group</h2></div>
        <ol className="mt-2 grid gap-2 text-sm text-stone-600 md:grid-cols-4">
          <li className="rounded-2xl bg-stone-50 p-3"><b className="text-stone-900">1 · Satisfaction model</b><br />Predicts how much <i>one</i> person (age, interests, needs, mood) will enjoy <i>one</i> place at a given time, crowd, heat and weather.</li>
          <li className="rounded-2xl bg-stone-50 p-3"><b className="text-stone-900">2 · Crowd model</b><br />Forecasts how busy a place is by hour, weekday, month and weather. Drives “Overcrowded, go here instead”.</li>
          <li className="rounded-2xl bg-stone-50 p-3"><b className="text-stone-900">3 · Mood model</b><br />Reads free text (“the kids are cranky and it’s boiling”) into moods that re-weight the plan.</li>
          <li className="rounded-2xl bg-stone-50 p-3"><b className="text-stone-900">4 · Fair planner</b><br />Combines per-person predictions (60% average + 40% least-happy), applies hard safety rules, rest blocks and split tracks.</li>
        </ol>
      </Card>

      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><Database size={14} /> Training data</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Real places (Kaggle)" value={m.data.kaggle_places} sub="ratings, reviews, fees, best time" />
        <Stat label="Curated experiences" value={m.data.catalogue_places} sub="expert-assessed profiles" />
        <Stat label="Synthetic visits" value={m.data.synthetic_satisfaction_rows.toLocaleString('en-IN')} sub="from documented expert priors" />
        <Stat label="Crowd samples" value={m.data.synthetic_crowd_rows.toLocaleString('en-IN')} sub="hour × day × season" />
        <Stat label="Mood sentences" value={m.data.mood_sentences.toLocaleString('en-IN')} sub="+16 hand-written test" />
        <Stat label="Real feedback" value={m.data.feedback_rows} tone="text-rani-600" sub={`in this version · ${m.feedback_available} collected (${Object.entries(m.feedback_by_signal || {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'none yet'})`} />
      </div>

      <div className="my-4 w-full max-w-md"><Segmented value={tab} onChange={setTab} options={[{ value: 'satisfaction', label: 'Satisfaction' }, { value: 'crowd', label: 'Crowd' }, { value: 'mood', label: 'Mood' }, { value: 'try', label: 'Playground' }]} /></div>

      {tab === 'satisfaction' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="p-4">
            <h2 className="font-bold">Accuracy on places it has never seen</h2>
            <p className="text-xs text-stone-500">{s.test_places} places held out entirely · mean absolute error on a 1–5 enjoyment scale (lower is better)</p>
            <div className="mt-3 space-y-2 text-sm">
              {[['TourCraft model', s.mae, 'green'], ['Baseline: predict the average', s.baseline_mean_mae, 'stone'], ['Baseline: Google rating only', s.baseline_rating_only_mae, 'stone']].map(([l, v, t]) => (
                <div key={l} className="grid grid-cols-[11rem_1fr_3rem] items-center gap-2">
                  <span className="text-stone-600">{l}</span><Bar value={v} max={s.baseline_mean_mae} tone={t} /><b className="text-right">{v}</b>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2"><Chip tone="green">R² {s.r2}</Chip><Chip tone="blue">{Math.round((1 - s.mae / s.baseline_rating_only_mae) * 100)}% less error than ratings alone</Chip></div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between"><h2 className="font-bold">Behaviour tests</h2><Chip tone={passed === s.tests.length ? 'green' : 'amber'}>{passed}/{s.tests.length} pass</Chip></div>
            <p className="text-xs text-stone-500">Hand-written expectations the model must satisfy after every retrain.</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {s.tests.map((t) => (
                <li key={t.test} className="flex items-start gap-2">
                  {t.passed ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <X size={16} className="mt-0.5 shrink-0 text-red-600" />}{t.test}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="font-bold">What drives a prediction</h2>
            <p className="text-xs text-stone-500">Permutation importance on held-out data (how much error grows when a factor is scrambled)</p>
            <div className="mt-3 space-y-1.5">
              {imp.map((x) => (
                <div key={x.feature} className="grid grid-cols-[9rem_1fr] items-center gap-2 text-sm"><span className="truncate text-stone-600">{x.feature}</span><Bar value={x.value} max={maxImp} /></div>
              ))}
            </div>
          </Card>
          <Card className="overflow-x-auto p-4">
            <h2 className="font-bold">What it learned: enjoyment by life stage</h2>
            <p className="text-xs text-stone-500">Predicted fit for a typical place of each kind, 10 AM in November, no special interests</p>
            <table className="mt-3 w-full min-w-[640px] border-separate border-spacing-0.5 text-center text-xs">
              <thead><tr><th />{s.learned.categories.map((c) => <th key={c} className="px-1 pb-1 font-semibold text-stone-500">{CAT_LABEL[c]}</th>)}</tr></thead>
              <tbody>
                {s.learned.bands.map((b, i) => (
                  <tr key={b.key}>
                    <th className="whitespace-nowrap pr-2 text-left font-semibold text-stone-600">{b.label} <span className="font-normal text-stone-400">{b.age}</span></th>
                    {s.learned.fit[i].map((v, j) => <td key={j} className="rounded-md py-1.5 font-semibold" style={heat(v)}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'crowd' && (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Mean absolute error" value={`${m.crowd.mae} pts`} sub={`vs ${m.crowd.baseline_mean_mae} predicting the average`} tone="text-emerald-700" />
          <Stat label="R²" value={m.crowd.r2} sub="on places held out" />
          <Stat label="Training rows" value={m.crowd.rows.toLocaleString('en-IN')} sub="Kaggle popularity × hourly patterns × season" />
        </div>
      )}

      {tab === 'mood' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="F1 · held-out generated" value={m.mood.f1_heldout} />
            <Stat label="F1 · hand-written sentences" value={m.mood.f1_natural} tone="text-emerald-700" sub="never seen in training" />
            <Stat label="Training sentences" value={m.mood.rows.toLocaleString('en-IN')} />
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-stone-100"><tr><Th>Sentence</Th><Th>Expected</Th><Th>Model read</Th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {m.mood.natural_examples.map((e) => {
                  const ok = [...e.expected].sort().join() === [...e.predicted].sort().join()
                  return (
                    <tr key={e.text}>
                      <Td>“{e.text}”</Td>
                      <Td className="text-xs">{e.expected.map((x) => MOOD[x]?.label || x).join(', ') || '-'}</Td>
                      <Td className="text-xs"><span className={ok ? 'text-emerald-700' : 'text-amber-700'}>{e.predicted.map((x) => MOOD[x]?.label || x).join(', ') || '-'}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'try' && <Playground state={state} />}

      {m.history?.length > 1 && (
        <Card className="mt-4 p-4">
          <h2 className="font-bold">Versions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...m.history].reverse().map((h) => <li key={h.version} className="flex justify-between"><span>v{h.version} · {new Date(h.at).toLocaleString('en-IN')}</span><span>MAE {h.mae} · {h.feedback_rows} real signals</span></li>)}
          </ul>
        </Card>
      )}
    </div>
  )
}
