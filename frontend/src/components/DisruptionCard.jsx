import { useState } from 'react'
import { Clock, CloudRain, IndianRupee, Store, TriangleAlert, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Chip, IOBadge, cx } from './ui'

const TRIGGER_ICON = { unavailable: Store, weather: CloudRain, time_shrink: Clock, budget_shrink: IndianRupee }

function Option({ alt, label, selected, onSelect }) {
  const e = alt.experience
  return (
    <button type="button" onClick={onSelect}
      className={cx('w-full rounded-xl p-3 text-left transition ring-1',
        selected ? 'bg-rani-50 ring-2 ring-rani-500' : 'bg-white ring-stone-200 hover:ring-stone-300')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
          <div className="font-semibold text-stone-900 leading-snug">{e.title}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{inr(e.price)}</div>
          <div className="text-xs text-stone-500">{e.duration_min} min</div>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
        <span>{alt.fit.start_label} – {alt.fit.end_label}</span>
        <span>·</span>
        <span>{e.location?.name}</span>
        <IOBadge io={e.indoor_outdoor} />
      </div>
      {selected && <p className="mt-2 text-xs text-stone-600">{alt.fit.reasoning}</p>}
    </button>
  )
}

// Pushed live over the WebSocket: plain-language reason, 1 primary + 1 backup, one-tap accept / dismiss.
export default function DisruptionCard() {
  const { events, setEvents, notify, refresh } = useTraveler()
  const [choice, setChoice] = useState('primary')
  const [busy, setBusy] = useState(false)
  const ev = events[0]
  if (!ev) return null
  const Icon = TRIGGER_ICON[ev.trigger_type] || TriangleAlert

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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/40 backdrop-blur-[2px]">
      <div className="animate-slide-up w-full max-w-md rounded-t-3xl bg-sand-50 p-4 pb-6 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="flex items-start gap-3">
          <div className="pulse-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rani-600 text-white"><Icon size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Chip tone="rani">{ev.trigger_label}</Chip>
              {events.length > 1 && <span className="text-xs text-stone-500">+{events.length - 1} more</span>}
            </div>
            <p className="mt-1.5 text-[15px] leading-snug text-stone-800">{ev.reason}</p>
          </div>
          <button onClick={() => act('dismiss')} disabled={busy} className="text-stone-400 hover:text-stone-600" aria-label="Dismiss"><X size={20} /></button>
        </div>

        <div className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-500">
          <span className="line-through">{ev.original.title}</span> · {ev.original.start_label}
        </div>

        {ev.primary ? (
          <div className="mt-3 space-y-2">
            <Option alt={ev.primary} label="Best replacement" selected={choice === 'primary'} onSelect={() => setChoice('primary')} />
            {ev.backup && <Option alt={ev.backup} label="Backup" selected={choice === 'backup'} onSelect={() => setChoice('backup')} />}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">
            Nothing else fits that window right now. You can keep the time free.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => act('dismiss')}>
            {ev.trigger_type === 'unavailable' ? 'Leave it free' : 'Keep original'}
          </Button>
          <Button disabled={busy || !ev.primary} onClick={() => act('accept')}>Accept swap</Button>
        </div>
      </div>
    </div>
  )
}
