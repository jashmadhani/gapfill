import { useEffect, useState } from 'react'
import { ArrowDownRight, BedDouble, Clock, CloudRain, IndianRupee, Store, TrainFront, TriangleAlert, X } from 'lucide-react'
import { api, inr, signedInr } from '../api'
import { useTour } from '../store'
import { Bar, Button, Chip, cx } from './ui'

export const TRIGGER_ICON = {
  weather: CloudRain, unavailable: Store, vendor_declined: Store, transport_delay: TrainFront, transport_cancel: TrainFront,
  hotel_issue: BedDouble, running_late: Clock, budget_change: IndianRupee,
}

// Side-by-side comparison of recovery plans: cost, time lost, components touched and preference fit.
export function OptionList({ options, choice, setChoice, dark = false }) {
  return (
    <div className="space-y-2">
      {options.map((o) => {
        const sel = choice === o.key
        return (
          <button key={o.key} type="button" onClick={() => setChoice(o.key)}
            className={cx('w-full rounded-xl p-3 text-left ring-1 transition',
              dark ? (sel ? 'bg-stone-800 ring-2 ring-rani-500' : 'bg-stone-900 ring-stone-700 hover:ring-stone-500')
                : (sel ? 'bg-rani-50 ring-2 ring-rani-500' : 'bg-white ring-stone-200 hover:ring-stone-300'))}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cx('grid h-5 w-5 place-items-center rounded-full text-xs font-bold', sel ? 'bg-rani-600 text-white' : dark ? 'bg-stone-700 text-stone-200' : 'bg-stone-100 text-stone-600')}>{o.key}</span>
                  <span className={cx('font-semibold leading-snug', dark ? 'text-stone-100' : 'text-stone-900')}>{o.label}</span>
                  {o.recommended && <Chip tone="green">Recommended</Chip>}
                  {o.within_budget === false && <Chip tone="amber">still over budget</Chip>}
                </div>
                <div className={cx('mt-0.5 text-xs', dark ? 'text-stone-400' : 'text-stone-500')}>{o.summary}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cx('font-bold', o.cost_delta > 0 ? 'text-red-600' : o.cost_delta < 0 ? 'text-emerald-600' : dark ? 'text-stone-200' : 'text-stone-700')}>
                  {o.cost_delta === 0 ? '₹0' : signedInr(o.cost_delta)}
                </div>
                <div className={cx('text-xs', dark ? 'text-stone-500' : 'text-stone-400')}>{o.operator_cost ? `operator pays ${inr(o.operator_cost)}` : 'change in total'}</div>
              </div>
            </div>
            <div className={cx('mt-2 grid grid-cols-3 gap-2 text-xs', dark ? 'text-stone-400' : 'text-stone-500')}>
              <div><div>Time lost</div><div className={cx('font-semibold', dark ? 'text-stone-200' : 'text-stone-800')}>{o.lost_min ? `${o.lost_min} min` : 'none'}</div></div>
              <div><div>Changes</div><div className={cx('font-semibold', dark ? 'text-stone-200' : 'text-stone-800')}>{o.items_affected} item{o.items_affected === 1 ? '' : 's'}</div></div>
              <div><div>Fit for you</div><Bar value={o.pref_score} max={100} tone={o.pref_score >= 60 ? 'green' : 'amber'} className="mt-1" /></div>
            </div>
            {sel && o.details?.length > 0 && (
              <ul className={cx('mt-2 space-y-0.5 border-t pt-2 text-xs', dark ? 'border-stone-700 text-stone-300' : 'border-stone-100 text-stone-600')}>
                {o.details.map((d, i) => <li key={i}>• {d}</li>)}
                {o.fees > 0 && <li className="text-amber-600">• Includes {inr(o.fees)} cancellation fees</li>}
              </ul>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ImpactList({ impact, dark = false }) {
  if (!impact) return null
  const row = (x, i, tone) => (
    <li key={i} className="flex items-start gap-2">
      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone)} />
      <span><b className={dark ? 'text-stone-100' : 'text-stone-800'}>{x.title}</b>{x.when && <span className={dark ? 'text-stone-500' : 'text-stone-400'}> · {x.when}</span>}<br />{x.why}</span>
    </li>
  )
  return (
    <div className={cx('rounded-xl p-3 text-xs', dark ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-500 ring-1 ring-stone-200')}>
      <div className="mb-1 font-semibold uppercase tracking-wide">Impact</div>
      <ul className="space-y-1.5">
        {impact.direct?.map((x, i) => row(x, `d${i}`, 'bg-red-500'))}
        {impact.downstream?.map((x, i) => (
          <li key={`s${i}`} className="flex items-start gap-2">
            <ArrowDownRight size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <span><b className={dark ? 'text-stone-100' : 'text-stone-800'}>{x.title}</b>{x.when && <span className={dark ? 'text-stone-500' : 'text-stone-400'}> · {x.when}</span>}<br />{x.why}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Pushed live over the WebSocket: plain-language reason, impact analysis, 2–3 recovery plans, one-tap accept.
export default function ChangeCard() {
  const { events, setEvents, notify, refresh } = useTour()
  const ev = events[0]
  const [choice, setChoice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showImpact, setShowImpact] = useState(true)
  useEffect(() => { setChoice(ev?.options.find((o) => o.recommended)?.key || ev?.options[0]?.key || null) }, [ev?.id]) // eslint-disable-line
  if (!ev) return null
  const Icon = TRIGGER_ICON[ev.trigger_type] || TriangleAlert

  const act = async (action) => {
    setBusy(true)
    try {
      const res = await api.resolve(ev.id, action, choice)
      setEvents((prev) => prev.filter((e) => e.id !== ev.id))
      const picked = ev.options.find((o) => o.key === choice)
      notify(action === 'accept'
        ? `${picked.label} applied${res.booked?.length ? ` · ${res.booked.length} new booking${res.booked.length > 1 ? 's' : ''} sent to vendors` : ''}`
        : 'Kept your original plan. Your coordinator can still help.', action === 'accept' ? 'success' : 'info')
      refresh()
    } catch (e) {
      notify(e.message, 'error')
      setEvents((prev) => prev.filter((x) => x.id !== ev.id))
      refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="animate-fade fixed inset-0 z-40 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6">
      <div role="dialog" aria-modal="true" className="animate-slide-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:max-w-lg md:rounded-[2rem]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="flex items-start gap-3">
          <div className="pulse-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rani-600 text-white"><Icon size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Chip tone="rani">{ev.label}</Chip>
              {events.length > 1 && <span className="text-xs text-stone-500">+{events.length - 1} more</span>}
            </div>
            <p className="mt-1.5 text-[15px] leading-snug text-stone-800">{ev.reason}</p>
          </div>
          <button onClick={() => act('dismiss')} disabled={busy} className="text-stone-400 hover:text-stone-600" aria-label="Dismiss"><X size={20} /></button>
        </div>

        <button onClick={() => setShowImpact((s) => !s)} className="mt-3 text-xs font-medium text-stone-500 underline-offset-2 hover:underline">
          {showImpact ? 'Hide' : 'Show'} what's affected
        </button>
        {showImpact && <div className="mt-1.5"><ImpactList impact={ev.impact} /></div>}

        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Compare recovery plans</div>
        <div className="mt-1.5"><OptionList options={ev.options} choice={choice} setChoice={setChoice} /></div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => act('dismiss')}>Keep original</Button>
          <Button disabled={busy || !choice} onClick={() => act('accept')}>Apply plan {choice}</Button>
        </div>
      </div>
    </div>
  )
}
