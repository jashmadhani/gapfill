import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Clock, CloudRain, Hourglass, Layers, MapPin, Sparkles, Sun, Wifi, WifiOff } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { AccessIcons, Button, Card, Chip, IOBadge, Spinner, TrustBadge, cx } from '../components/ui'

const SKIP_KEY = 'gapfill.skipped'
export const getSkipped = () => { try { return JSON.parse(sessionStorage.getItem(SKIP_KEY) || '[]') } catch { return [] } }
export const skipExperience = (id) => { try { sessionStorage.setItem(SKIP_KEY, JSON.stringify([...new Set([...getSkipped(), id])])) } catch { /* ignore */ } }
export const clearSkipped = () => { try { sessionStorage.removeItem(SKIP_KEY) } catch { /* ignore */ } }

export function ItineraryStrip({ items, activeSlot }) {
  const activeRef = useRef()
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [activeSlot, items])
  const visible = items.filter((i) => i.status !== 'replaced' && !(i.type === 'booked' && i.minutes === 0))
  return (
    <Link to="/timeline" className="block">
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {visible.map((i) => (
          <div key={i.id} ref={i.id === activeSlot ? activeRef : undefined}
            className={cx('shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] leading-tight',
              i.type === 'gap' ? 'border border-dashed border-rani-500/60 bg-rani-50 text-rani-700' :
                i.status === 'disrupted' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                  i.type === 'suggested' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-stone-700 ring-1 ring-stone-200',
              i.id === activeSlot && 'ring-2 ring-rani-500', i.is_past && 'opacity-45')}>
            <div className="font-semibold">{i.start_label}</div>
            <div className="max-w-[7.5rem] truncate">{i.type === 'gap' ? `${i.minutes} min free` : i.title}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}

function Backup({ c, slotId }) {
  const e = c.experience
  return (
    <Link to={`/experience/${e.id}?slot=${slotId}`} state={{ fit: c.fit }}
      className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5 ring-1 ring-stone-200 hover:ring-stone-300">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{e.title}</div>
        <div className="text-xs text-stone-500">{c.fit.start_label} · {e.duration_min} min · {inr(e.price)}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-stone-400" />
    </Link>
  )
}

const EXCLUDE_LABEL = {
  time: 'too long for the window', budget: 'over budget', unavailable: 'closed or full', group: 'not suited to your group',
  accessibility: 'missing an accessibility need', weather: 'outdoors in bad weather', intent: 'didn’t match your ask', in_plan: 'already planned',
}

export default function RightNow() {
  const { itinerary, state, version, live, notify, refresh } = useTraveler()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [rec, setRec] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [skipTick, setSkipTick] = useState(0)

  const slotId = Number(params.get('slot')) || itinerary?.next_gap_id
  const slot = itinerary?.items.find((i) => i.id === slotId)

  useEffect(() => {
    if (!slotId) { setRec(null); return }
    let cancel = false
    setLoading(true)
    api.recommendations(slotId).then((r) => !cancel && setRec(r)).catch(() => !cancel && setRec(null)).finally(() => !cancel && setLoading(false))
    return () => { cancel = true }
  }, [slotId, version])

  // One card at a time: the top pick minus anything the traveler said "not this one" to; the rest are quiet backups.
  const ranked = useMemo(() => {
    if (!rec?.primary) return []
    const skipped = getSkipped()
    return [rec.primary, ...rec.backups].filter((c) => !skipped.includes(c.experience.id))
  }, [rec, skipTick])
  const top = ranked[0]
  const backups = ranked.slice(1, 3)

  const add = async () => {
    setBusy(true)
    try {
      const r = await api.addToSlot(itinerary.id, slotId, [top.experience.id])
      const booking = await api.book(r.created_item_ids)
      await refresh()
      nav('/booking', { state: { booking } })
    } catch (e) {
      notify(e.message, 'error')
      refresh()
    } finally { setBusy(false) }
  }

  const runningLate = async () => {
    try {
      const r = await api.trigger({ trigger_type: 'time_shrink', minutes: 45 })
      if (r.note) notify(r.note)
      else if (!r.events.length) notify('Nothing upcoming needed to change.')
    } catch (e) { notify(e.message, 'error') }
  }

  if (!itinerary) return <Spinner />
  const now = state?.demo_now

  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-500">Right now · {fmtNow(now)}</div>
            <h1 className="text-2xl font-bold tracking-tight">Hi {itinerary.user.display_name.split(' ')[0]} 👋</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            {itinerary.weather_bad ? <Chip tone="blue"><CloudRain size={12} /> Rain</Chip> : <Chip tone="amber"><Sun size={12} /> Clear</Chip>}
            <span className={cx('inline-flex items-center gap-1 text-[10px]', live === 'live' ? 'text-emerald-600' : 'text-amber-600')}>
              {live === 'live' ? <Wifi size={11} /> : <WifiOff size={11} />} {live === 'live' ? 'live' : live}
            </span>
          </div>
        </div>
      </header>

      <ItineraryStrip items={itinerary.items} activeSlot={slotId} />

      <section className="px-4 pt-4">
        {!slotId ? (
          <Card className="p-5 text-center">
            <Sparkles className="mx-auto text-rani-500" />
            <h2 className="mt-2 font-semibold">Your day is nicely full</h2>
            <p className="mt-1 text-sm text-stone-500">No idle gaps of 45+ minutes left. We’ll ping you if anything changes.</p>
          </Card>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                <Hourglass size={15} className="text-rani-600" />
                {slot ? `${slot.minutes} min free · ${slot.start_label} – ${slot.end_label}` : 'Free time'}
              </div>
              {rec?.slot && <span className="text-xs text-stone-500">{inr(rec.slot.budget_left)} left</span>}
            </div>

            {loading && !rec ? <Spinner label="Finding the best fit…" /> : top ? (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-rani-600 to-rani-700 px-4 pt-4 pb-3 text-white">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rani-100">
                    <Sparkles size={13} /> Best fit for this gap
                  </div>
                  <h2 className="mt-1 text-xl font-bold leading-tight">{top.experience.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-rani-50">
                    <span className="inline-flex items-center gap-1"><Clock size={14} /> {top.fit.start_label} · {top.experience.duration_min} min</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={14} /> {top.experience.location?.name}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm leading-relaxed text-stone-700">{top.fit.reasoning}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold">{inr(top.experience.price)}</span>
                    <span className="text-xs text-stone-500">/ person</span>
                    <span className="mx-1 h-4 w-px bg-stone-200" />
                    <TrustBadge exp={top.experience} />
                    <IOBadge io={top.experience.indoor_outdoor} />
                    <AccessIcons attrs={top.experience.accessibility_attributes} highlight={itinerary.user.accessibility_flags} />
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add to my day'}</Button>
                    <Link to={`/experience/${top.experience.id}?slot=${slotId}`} state={{ fit: top.fit }}>
                      <Button variant="secondary" className="w-full">Details</Button>
                    </Link>
                  </div>
                  <button className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
                    onClick={() => { skipExperience(top.experience.id); setSkipTick((t) => t + 1) }}>
                    Not this one
                  </button>
                </div>

                {(backups.length > 0 || rec.bundle) && (
                  <div className="border-t border-stone-100 px-4 py-3">
                    {backups.length > 0 && (
                      <button onClick={() => setShowAlts((s) => !s)} className="flex w-full items-center justify-between text-sm font-medium text-stone-600">
                        See {backups.length} alternative{backups.length > 1 ? 's' : ''}
                        <ChevronDown size={16} className={cx('transition', showAlts && 'rotate-180')} />
                      </button>
                    )}
                    {showAlts && <div className="mt-2 space-y-2">{backups.map((c) => <Backup key={c.experience.id} c={c} slotId={slotId} />)}</div>}
                    {rec.bundle && (
                      <Link to={`/bundle?slot=${slotId}`} className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
                        <span className="inline-flex items-center gap-1.5"><Layers size={15} /> Make it a combo: {rec.bundle.experiences.length} stops for {inr(rec.bundle.total_price)}</span>
                        <ChevronRight size={16} />
                      </Link>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-5">
                <h2 className="font-semibold">Nothing fits this window well</h2>
                <p className="mt-1 text-sm text-stone-500">Enjoy the breather. Here’s why we held back:</p>
                <ul className="mt-2 space-y-1 text-sm text-stone-600">
                  {rec && Object.entries(rec.excluded).filter(([, n]) => n).map(([k, n]) => <li key={k}>• {n} {EXCLUDE_LABEL[k]}</li>)}
                </ul>
                {getSkipped().length > 0 && (
                  <Button variant="secondary" className="mt-3" onClick={() => { clearSkipped(); setSkipTick((t) => t + 1) }}>Show skipped ideas again</Button>
                )}
              </Card>
            )}
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={runningLate}><Clock size={16} /> I’m running late</Button>
          <Link to="/ask"><Button variant="secondary" className="w-full"><Sparkles size={16} /> Set a mood</Button></Link>
        </div>
        {itinerary.session?.intent_parsed_json && (
          <p className="mt-3 text-center text-xs text-stone-500">Tuned for “{itinerary.session.intent_raw_text}” · <Link to="/ask" className="underline">change</Link></p>
        )}
      </section>
    </div>
  )
}

export function fmtNow(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
