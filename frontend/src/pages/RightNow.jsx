import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Clock, Hourglass, Layers, MapPin, Sparkles, Timer, Wallet } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { LiveStatus, Logo } from '../components/brand'
import { AccessIcons, Button, Card, IOBadge, Skeleton, ThemeToggle, TrustBadge, cx } from '../components/ui'

const SKIP_KEY = 'gapfill.skipped'
export const getSkipped = () => { try { return JSON.parse(sessionStorage.getItem(SKIP_KEY) || '[]') } catch { return [] } }
export const skipExperience = (id) => { try { sessionStorage.setItem(SKIP_KEY, JSON.stringify([...new Set([...getSkipped(), id])])) } catch { /* ignore */ } }
export const clearSkipped = () => { try { sessionStorage.removeItem(SKIP_KEY) } catch { /* ignore */ } }

const itemTone = (i) => i.type === 'gap' ? 'gap' : i.status === 'disrupted' ? 'disrupted' : i.type === 'suggested' ? 'pick' : 'booked'
const visibleItems = (items) => items.filter((i) => i.status !== 'replaced' && !(i.type === 'booked' && i.minutes === 0))

// Phones/tablets: compact horizontal strip of the day.
function DayStrip({ items, activeSlot }) {
  const activeRef = useRef()
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [activeSlot, items])
  return (
    <nav aria-label="Today at a glance" className="lg:hidden">
      <ol className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 md:px-6">
        {visibleItems(items).map((i) => {
          const tone = itemTone(i)
          return (
            <li key={i.id} ref={i.id === activeSlot ? activeRef : undefined} className="shrink-0">
              <Link to={tone === 'gap' ? `/?slot=${i.id}` : '/timeline'} aria-current={i.id === activeSlot ? 'true' : undefined}
                className={cx('flex min-h-12 flex-col justify-center rounded-xl px-3 py-1.5 text-xs leading-tight',
                  tone === 'gap' ? 'border border-dashed border-brand bg-brand-soft text-brand-ink'
                    : tone === 'disrupted' ? 'bg-danger-soft text-danger ring-1 ring-danger/40'
                      : tone === 'pick' ? 'bg-success-soft text-success' : 'bg-surface text-ink-2 ring-1 ring-line',
                  i.id === activeSlot && 'ring-2 ring-brand', i.is_past && 'opacity-60')}>
                <span className="font-semibold">{i.start_label}</span>
                <span className="max-w-32 truncate">{tone === 'gap' ? `${i.minutes} min free` : i.title}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// Desktop: a vertical mini-timeline beside the suggestion.
function DayRail({ items, activeSlot }) {
  return (
    <Card as="nav" aria-label="Today at a glance" className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Today</h2>
        <Link to="/timeline" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">Full day</Link>
      </div>
      <ol className="space-y-1">
        {visibleItems(items).map((i) => {
          const tone = itemTone(i)
          return (
            <li key={i.id}>
              <Link to={tone === 'gap' ? `/?slot=${i.id}` : '/timeline'} aria-current={i.id === activeSlot ? 'true' : undefined}
                className={cx('flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-surface-2',
                  i.id === activeSlot && 'bg-brand-soft hover:bg-brand-soft', i.is_past && 'opacity-60')}>
                <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full',
                  tone === 'gap' ? 'border-2 border-dashed border-brand' : tone === 'disrupted' ? 'bg-danger' : tone === 'pick' ? 'bg-success' : 'bg-ink-3')} aria-hidden />
                <span className="w-16 shrink-0 text-xs font-semibold text-ink-3">{i.start_label}</span>
                <span className={cx('truncate', tone === 'gap' ? 'font-medium text-brand-ink' : 'text-ink')}>{tone === 'gap' ? `${i.minutes} min free` : i.title}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function Backup({ c, slotId }) {
  const e = c.experience
  return (
    <Link to={`/experience/${e.id}?slot=${slotId}`} state={{ fit: c.fit }}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 transition-colors hover:bg-line/60">
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{e.title}</div>
        <div className="text-sm text-ink-3">{c.fit.start_label} · {e.duration_min} min · {inr(e.price)}</div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
    </Link>
  )
}

const EXCLUDE_LABEL = {
  time: 'too long for the window', budget: 'over budget', unavailable: 'closed or full', group: 'not suited to your group',
  accessibility: 'missing an accessibility need', weather: 'outdoors in bad weather', intent: 'didn’t match your ask', in_plan: 'already planned',
}

export function fmtNow(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function RightNow() {
  const { itinerary, state, version, notify, refresh } = useTraveler()
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

  if (!itinerary) return <div className="space-y-4 p-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>

  return (
    <div>
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-4 md:px-6 lg:px-0 lg:pt-10">
        <div>
          <Logo className="mb-3 text-lg lg:hidden" />
          <p className="text-sm font-medium text-ink-3">Right now · {fmtNow(state?.demo_now)}</p>
          <h1 className="text-3xl font-bold text-ink lg:text-4xl">Hi {itinerary.user.display_name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-col items-end gap-1 lg:hidden">
          <ThemeToggle />
          <LiveStatus />
        </div>
      </header>

      <DayStrip items={itinerary.items} activeSlot={slotId} />

      <div className="px-4 pt-5 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:px-0">
        <section aria-labelledby="gap-heading">
          {!slotId ? (
            <Card className="p-8 text-center">
              <Sparkles className="mx-auto text-brand" aria-hidden />
              <h2 id="gap-heading" className="mt-2 text-xl font-semibold">Your day is nicely full</h2>
              <p className="mt-1 text-ink-2">No idle gaps of 45+ minutes left. We’ll let you know if anything changes.</p>
            </Card>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="gap-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Hourglass size={18} className="text-brand" aria-hidden />
                  {slot ? `${slot.minutes} min free · ${slot.start_label} – ${slot.end_label}` : 'Free time'}
                </h2>
                {rec?.slot && <span className="inline-flex items-center gap-1 text-sm text-ink-3"><Wallet size={15} aria-hidden /> {inr(rec.slot.budget_left)} left</span>}
              </div>

              {loading && !rec ? <Skeleton className="h-[420px]" /> : top ? (
                <Card as="article" aria-labelledby="top-pick" className="overflow-hidden">
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#c2410c] via-[#b8420f] to-[#0e7490] px-5 pt-5 pb-5 text-white md:px-6">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/85"><Sparkles size={14} aria-hidden /> Best fit for this gap</p>
                    <h3 id="top-pick" className="mt-1.5 text-2xl font-bold leading-tight md:text-3xl">{top.experience.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/90">
                      <span className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden /> {top.fit.start_label}</span>
                      <span className="inline-flex items-center gap-1.5"><Timer size={16} aria-hidden /> {top.experience.duration_min} min</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {top.experience.location?.name}</span>
                    </div>
                  </div>
                  <div className="space-y-4 p-5 md:p-6">
                    <p className="text-[16px] leading-relaxed text-ink-2">{top.fit.reasoning}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-display text-2xl font-bold text-ink">{inr(top.experience.price)}</span>
                      <span className="text-sm text-ink-3">per person</span>
                      <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
                      <TrustBadge exp={top.experience} />
                      <IOBadge io={top.experience.indoor_outdoor} />
                    </div>
                    <AccessIcons attrs={top.experience.accessibility_attributes} highlight={itinerary.user.accessibility_flags} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                      <Button onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add to my day'}</Button>
                      <Link to={`/experience/${top.experience.id}?slot=${slotId}`} state={{ fit: top.fit }}
                        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-surface px-5 font-semibold text-ink ring-1 ring-line hover:bg-surface-2">Details</Link>
                    </div>
                    <button type="button" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-3 hover:text-ink hover:underline"
                      onClick={() => { skipExperience(top.experience.id); setSkipTick((t) => t + 1) }}>
                      Not this one
                    </button>
                  </div>

                  {(backups.length > 0 || rec.bundle) && (
                    <div className="space-y-2 border-t border-line px-5 py-4 md:px-6">
                      {backups.length > 0 && (
                        <button type="button" onClick={() => setShowAlts((s) => !s)} aria-expanded={showAlts} aria-controls="alts"
                          className="flex min-h-11 w-full items-center justify-between text-[15px] font-medium text-ink-2 hover:text-ink">
                          See {backups.length} alternative{backups.length > 1 ? 's' : ''}
                          <ChevronDown size={18} className={cx('transition-transform', showAlts && 'rotate-180')} aria-hidden />
                        </button>
                      )}
                      {showAlts && <div id="alts" className="space-y-2">{backups.map((c) => <Backup key={c.experience.id} c={c} slotId={slotId} />)}</div>}
                      {rec.bundle && (
                        <Link to={`/bundle?slot=${slotId}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-warn-soft px-3.5 text-[15px] font-medium text-warn hover:opacity-90">
                          <span className="inline-flex items-center gap-2"><Layers size={18} aria-hidden /> Make it a combo: {rec.bundle.experiences.length} stops for {inr(rec.bundle.total_price)}</span>
                          <ChevronRight size={18} aria-hidden />
                        </Link>
                      )}
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold">Nothing fits this window well</h3>
                  <p className="mt-1 text-ink-2">Enjoy the breather. Here’s why we held back:</p>
                  <ul className="mt-3 space-y-1 text-ink-2">
                    {rec && Object.entries(rec.excluded).filter(([, n]) => n).map(([k, n]) => <li key={k}>{n} {EXCLUDE_LABEL[k]}</li>)}
                  </ul>
                  {getSkipped().length > 0 && (
                    <Button variant="secondary" className="mt-4" onClick={() => { clearSkipped(); setSkipTick((t) => t + 1) }}>Show skipped ideas again</Button>
                  )}
                </Card>
              )}
            </>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={runningLate}><Clock size={18} aria-hidden /> Running late</Button>
            <Link to="/ask" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface px-4 font-semibold text-ink ring-1 ring-line hover:bg-surface-2"><Sparkles size={18} aria-hidden /> Set a mood</Link>
          </div>
          {itinerary.session?.intent_parsed_json && (
            <p className="mt-3 text-center text-sm text-ink-3">Tuned for “{itinerary.session.intent_raw_text}” · <Link to="/ask" className="font-medium text-accent-ink underline">change</Link></p>
          )}
        </section>

        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <DayRail items={itinerary.items} activeSlot={slotId} />
        </aside>
      </div>
    </div>
  )
}
