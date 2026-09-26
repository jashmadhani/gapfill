import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Clock, Plus, Replace, Star, X } from 'lucide-react'
import { api, inr } from '../api'
import { destImage } from '../media'
import { useTour } from '../store'
import { Button, Card, Chip, Photo, cx } from './ui'
import { FitBadge, FitChips, TagList } from './group'

const CODE = {
  access: ['Not for everyone', 'red'], fit: ['Lower group fit', 'stone'], full: ['Days are full', 'amber'], budget: ['Over budget', 'amber'],
  closed: ['Closed those days', 'stone'], unavailable: ['Unavailable', 'stone'], room: ['Room to add', 'green'],
}

function ReplaceSheet({ tour, cand, onClose, onDone }) {
  const { notify } = useNotify()
  const [busy, setBusy] = useState(null)
  const go = async (r) => {
    setBusy(r.item_id)
    try {
      const res = await api.swap(tour.id, r.item_id, { offering_id: cand.offering.id })
      notify(`${r.title} → ${res.result.title}${res.result.fee ? ` · fee ${inr(res.result.fee)}` : ''}`, 'success')
      onDone()
    } catch (e) { notify(e.message, 'error') } finally { setBusy(null) }
  }
  return (
    <div className="animate-fade fixed inset-0 z-40 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="animate-slide-up max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[2rem]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-rani-600">Replace with</div>
            <h2 className="font-display text-2xl leading-tight">{cand.offering.title}</h2>
            <p className="text-sm text-stone-500">Pick what it replaces. Group fit changes are predicted by the model.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><X size={20} /></button>
        </div>
        <ul className="mt-4 space-y-2">
          {cand.replace.length === 0 && <li className="text-sm text-stone-500">Nothing planned in this city can be replaced.</li>}
          {cand.replace.map((r) => (
            <li key={r.item_id}>
              <button disabled={!!busy} onClick={() => go(r)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-stone-200 transition hover:ring-rani-500 disabled:opacity-50">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.title}</div>
                  <div className="text-xs text-stone-500">Day {r.day} · currently {r.fit}% fit</div>
                </div>
                <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', r.gain >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
                  {r.gain >= 0 ? '+' : ''}{r.gain} pts
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function useNotify() { const { notify } = useTour(); return { notify } }

function Candidate({ tour, dest, c, editable, onChanged, onReplace }) {
  const [busy, setBusy] = useState(false)
  const { notify } = useNotify()
  const [label, tone] = CODE[c.reason_code] || ['', 'stone']
  const add = async () => {
    setBusy(true)
    try {
      const r = await api.addItem(tour.id, c.offering.id, c.add_day)
      notify(`${c.offering.title} added on day ${r.result.day} at ${r.result.start_label}`, 'success')
      onChanged()
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <li className="rounded-3xl bg-white p-3 shadow-soft ring-1 ring-stone-200/70">
      <div className="flex gap-3">
        <Photo src={destImage(dest)} scrim={false} className="hidden h-16 w-16 shrink-0 rounded-2xl sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/experience/${c.offering.id}`} className="inline-flex min-h-11 items-center font-semibold leading-snug hover:underline">{c.offering.title}</Link>
            <FitBadge fit={c.fit} label="fit" className="shrink-0" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden /> {c.offering.duration_min} min</span>
            <span>{c.offering.price ? `${inr(c.offering.price)} pp` : 'Free entry'}</span>
            <span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" aria-hidden /> {c.offering.rating.toFixed(1)}</span>
            {c.offering.source === 'kaggle' && <span>Kaggle-listed attraction</span>}
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-sm">
            <Chip tone={tone} className="shrink-0">{label}</Chip>
            <span className="text-stone-700">{c.reason}{c.note && <span className="block text-rani-700">{c.note}</span>}</span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 space-y-2">
        <FitChips members={c.members} />
        <TagList tags={c.tags} />
      </div>
      {editable && !['unavailable'].includes(c.reason_code) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-10 py-1.5" disabled={busy || !c.add_day || c.reason_code === 'access'} onClick={add}>
            <Plus size={15} aria-hidden /> {c.add_day ? `Add to day ${c.add_day}` : 'No free slot'}
          </Button>
          <Button variant="secondary" className="min-h-10 py-1.5" disabled={busy || !c.replace.length} onClick={() => onReplace(c)}>
            <Replace size={15} aria-hidden /> Replace…
          </Button>
        </div>
      )}
    </li>
  )
}

// "Considered but not added": every place the planner looked at in each city, and exactly why it isn't in the plan.
export default function Considered({ tour, editable, onChanged }) {
  const [open, setOpen] = useState(() => Object.fromEntries((tour.considered || []).map((c, i) => [c.dest, i === 0])))
  const [replace, setReplace] = useState(null)
  if (!tour.considered?.length) return null
  return (
    <section aria-labelledby="considered-h" className="space-y-3">
      <div>
        <h2 id="considered-h" className="font-display text-2xl">Considered, not added</h2>
        <p className="text-sm text-stone-500">Everything else we looked at for your group, and why it didn’t make the plan. Add it or swap it in.</p>
      </div>
      {tour.considered.map((city) => (
        <Card key={city.dest} className="overflow-hidden">
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [city.dest]: !o[city.dest] }))} aria-expanded={!!open[city.dest]}
            className="flex w-full items-center gap-3 p-3 text-left">
            <Photo src={destImage(city.dest)} scrim={false} className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{city.name}</div>
              <div className="text-xs text-stone-500">{city.candidates.length} more option{city.candidates.length === 1 ? '' : 's'} · day{city.days.length > 1 ? 's' : ''} {city.days.join(', ')}</div>
            </div>
            <ChevronDown size={18} className={cx('shrink-0 text-stone-400 transition', open[city.dest] && 'rotate-180')} aria-hidden />
          </button>
          {open[city.dest] && (
            <ul className="space-y-2.5 bg-sand-50/60 p-3">
              {city.candidates.length === 0 && <li className="text-sm text-stone-500">Everything here is already in your plan.</li>}
              {city.candidates.map((c) => (
                <Candidate key={c.offering.id} tour={tour} dest={city.dest} c={c} editable={editable} onChanged={onChanged} onReplace={setReplace} />
              ))}
            </ul>
          )}
        </Card>
      ))}
      {replace && <ReplaceSheet tour={tour} cand={replace} onClose={() => setReplace(null)} onDone={() => { setReplace(null); onChanged() }} />}
    </section>
  )
}
