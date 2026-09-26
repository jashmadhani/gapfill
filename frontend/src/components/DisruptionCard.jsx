import { useEffect, useRef, useState } from 'react'
import { Clock, CloudRain, IndianRupee, MapPin, Store, TriangleAlert, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Chip, IOBadge, cx } from './ui'

const TRIGGER_ICON = { unavailable: Store, weather: CloudRain, time_shrink: Clock, budget_shrink: IndianRupee }

function Option({ alt, label, selected, onSelect }) {
  const e = alt.experience
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cx('w-full rounded-2xl p-4 text-left transition-colors ring-1',
        selected ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface ring-line hover:bg-surface-2')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</div>
          <div className="font-display text-[17px] font-semibold leading-snug text-ink">{e.title}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-ink">{inr(e.price)}</div>
          <div className="text-xs text-ink-3">{e.duration_min} min</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {alt.fit.start_label} – {alt.fit.end_label}</span>
        <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {e.location?.name}</span>
        <IOBadge io={e.indoor_outdoor} />
      </div>
      {selected && <p className="mt-2 text-sm leading-relaxed text-ink-2">{alt.fit.reasoning}</p>}
    </button>
  )
}

// Pushed live over the WebSocket: plain-language reason, 1 primary + 1 backup, one-tap accept / dismiss.
// Bottom sheet on phones, centered dialog on larger screens. Escape = "decide later" (never destructive).
export default function DisruptionCard() {
  const { events, setEvents, snoozed, snooze, notify, refresh } = useTraveler()
  const [choice, setChoice] = useState('primary')
  const [busy, setBusy] = useState(false)
  const dialog = useRef()
  const ev = events.find((e) => !snoozed.includes(e.id))

  useEffect(() => {
    if (!ev) return
    const prev = document.activeElement
    const root = dialog.current
    root?.querySelector('[data-autofocus]')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); snooze(ev.id) }
      if (e.key !== 'Tab' || !root) return
      const f = [...root.querySelectorAll('button:not([disabled]), [href], input, select')]
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.() }
  }, [ev?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ev) return null
  const Icon = TRIGGER_ICON[ev.trigger_type] || TriangleAlert
  const waiting = events.length - 1

  const act = async (action) => {
    setBusy(true)
    try {
      const res = await api.resolve(ev.id, action, choice)
      const picked = choice === 'backup' ? ev.backup : ev.primary
      setEvents((prev) => prev.filter((e) => e.id !== ev.id))
      notify(action === 'accept'
        ? `Swapped in ${picked?.experience.title} · booking ${res.booking_ref}`
        : ev.trigger_type === 'unavailable' ? 'Removed. We’ll suggest something else for that window.' : 'Kept your original plan.',
      action === 'accept' ? 'success' : 'info')
      setChoice('primary')
      refresh()
    } catch (e) {
      notify(e.message, 'error')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-center md:p-6"
      onClick={(e) => e.target === e.currentTarget && snooze(ev.id)}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="replan-title" aria-describedby="replan-reason"
        className="animate-sheet pb-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-canvas shadow-2xl md:max-w-lg md:rounded-3xl">
        <div className="p-5 md:p-6">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="pulse-ring grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand" aria-hidden><Icon size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="brand">{ev.trigger_label}</Chip>
                {waiting > 0 && <span className="text-xs text-ink-3">+{waiting} more waiting</span>}
              </div>
              <h2 id="replan-title" className="mt-1.5 text-xl font-semibold text-ink">Your plan changed — here’s a swap</h2>
            </div>
            <button type="button" onClick={() => snooze(ev.id)} disabled={busy} aria-label="Decide later"
              className="-mr-2 -mt-1 grid h-11 w-11 place-items-center rounded-xl text-ink-3 hover:bg-surface-2 hover:text-ink"><X size={20} /></button>
          </div>
          <p id="replan-reason" className="mt-3 text-[15px] leading-relaxed text-ink-2">{ev.reason}</p>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-3">
            <span className="text-xs font-semibold uppercase tracking-wide">Was</span>
            <span className="truncate line-through">{ev.original.title}</span>
            <span className="shrink-0">· {ev.original.start_label}</span>
          </div>

          {ev.primary ? (
            <div role="radiogroup" aria-label="Replacement options" className="mt-3 space-y-2">
              <Option alt={ev.primary} label="Best replacement" selected={choice === 'primary'} onSelect={() => setChoice('primary')} />
              {ev.backup && <Option alt={ev.backup} label="Backup" selected={choice === 'backup'} onSelect={() => setChoice('backup')} />}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-surface p-4 text-sm text-ink-2 ring-1 ring-line">
              Nothing else fits that window right now. You can keep the time free.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => act('dismiss')}>
              {ev.trigger_type === 'unavailable' ? 'Leave it free' : 'Keep original'}
            </Button>
            <Button data-autofocus disabled={busy || !ev.primary} onClick={() => act('accept')}>{busy ? 'Saving…' : 'Accept swap'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
