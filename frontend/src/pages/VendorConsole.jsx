import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, CircleSlash, Clock, Eye, Lightbulb, MapPin, MessageCircle, Minus, Plus, Ticket, TrendingUp, Users } from 'lucide-react'
import { api, inr } from '../api'
import { useLive } from '../live'
import { AccessIcons, Card, Chip, IOBadge, Skeleton, ThemeToggle, TrustBadge, cx } from '../components/ui'

const STATUS = {
  open: { label: 'Open', dot: 'bg-success', btn: 'bg-success', Icon: CircleCheck },
  closed: { label: 'Closed', dot: 'bg-ink-3', btn: 'bg-ink-2', Icon: CircleSlash },
  full: { label: 'Fully booked', dot: 'bg-danger', btn: 'bg-danger', Icon: Users },
}

// One-tap status console + read-only listings + today's nearby-demand strip.
export default function VendorConsole() {
  const { id } = useParams()
  const { search } = useLocation()
  const embed = new URLSearchParams(search).has('embed')
  const nav = useNavigate()
  const vendorId = Number(id) || 1
  const [vendors, setVendors] = useState([])
  const [vendor, setVendor] = useState(null)
  const [demand, setDemand] = useState(null)
  const [slots, setSlots] = useState(3)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = useCallback(async () => {
    const [vs, v, d] = await Promise.all([api.vendors(), api.vendor(vendorId), api.demand(vendorId)])
    setVendors(vs); setVendor(v); setDemand(d)
  }, [vendorId])
  useEffect(() => { load() }, [load])
  useLive((m) => { if (['vendor_status', 'demo_reset', 'listing_published', 'itinerary_updated', 'poll', 'disruption_resolved'].includes(m.type)) load() })

  const setStatus = async (body, label) => {
    setBusy(true)
    try {
      const r = await api.vendorStatus(vendorId, body)
      setFlash(`${label}${r.disruptions_created.length ? ` · ${r.disruptions_created.length} traveler plan(s) auto-replanned` : ''}`)
      setTimeout(() => setFlash(null), 3500)
      await load()
    } finally { setBusy(false) }
  }

  if (!vendor) return <div className="mx-auto max-w-5xl space-y-3 p-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  const allSoldOut = vendor.listings.length > 0 && vendor.listings.every((l) => l.capacity_left === 0)
  const current = vendor.status !== 'open' ? vendor.status : allSoldOut ? 'full' : 'open'

  return (
    <div className="min-h-dvh bg-canvas pb-10">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 pt-3 pb-5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {!embed && <Link to="/" aria-label="Back to traveler app" className="grid h-11 w-11 place-items-center rounded-xl text-ink-2 hover:bg-surface-2"><ArrowLeft size={20} aria-hidden /></Link>}
              <label htmlFor="vendor-pick" className="sr-only">Vendor</label>
              <select id="vendor-pick" value={vendorId} onChange={(e) => nav(`/vendor/${e.target.value}${search}`)}
                className="min-h-11 max-w-[60vw] rounded-xl bg-surface-2 px-3 text-sm font-medium text-ink ring-1 ring-line">
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              {!embed && <ThemeToggle />}
              <Link to={`/vendor/chat?vendor=${vendorId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-on-brand hover:opacity-90"><MessageCircle size={16} aria-hidden /> New listing</Link>
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold md:text-3xl">{vendor.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-ink-2">
            <span className={cx('h-2.5 w-2.5 rounded-full', STATUS[current].dot)} aria-hidden /> Currently <b className="text-ink">{STATUS[current].label}</b>
          </p>
        </div>
      </header>

      <div className="mx-auto mt-5 grid max-w-5xl gap-4 px-4 md:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Today’s status, one tap</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Object.entries(STATUS).map(([s, { label, btn, Icon }]) => (
                <button type="button" key={s} disabled={busy} aria-pressed={current === s} onClick={() => setStatus({ status: s }, label)}
                  className={cx('flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-sm font-semibold text-on-brand transition-opacity disabled:opacity-50', btn,
                    current === s ? 'ring-4 ring-accent/40' : 'opacity-75 hover:opacity-100')}>
                  <Icon size={18} aria-hidden /> {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-warn-soft p-2">
              <button type="button" onClick={() => setSlots((s) => Math.max(1, s - 1))} aria-label="Fewer slots" className="grid h-11 w-11 place-items-center rounded-lg bg-surface text-ink ring-1 ring-line"><Minus size={16} aria-hidden /></button>
              <output className="w-8 text-center font-display text-xl font-bold" aria-live="polite">{slots}</output>
              <button type="button" onClick={() => setSlots((s) => s + 1)} aria-label="More slots" className="grid h-11 w-11 place-items-center rounded-lg bg-surface text-ink ring-1 ring-line"><Plus size={16} aria-hidden /></button>
              <button type="button" disabled={busy} onClick={() => setStatus({ status: 'slots', slots_left: slots }, `${slots} slots left`)}
                className="min-h-11 flex-1 rounded-lg bg-warn px-2 text-sm font-semibold text-on-brand disabled:opacity-50">Set {slots} slots left</button>
            </div>
            <div aria-live="polite">{flash && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">{flash}</p>}</div>
          </Card>

          {demand && (
            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-3"><TrendingUp size={16} aria-hidden /> Demand near you today</h2>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[[Eye, demand.own.shown, 'suggested'], [Plus, demand.own.added, 'added'], [Ticket, demand.own.booked, 'booked']].map(([Icon, n, l]) => (
                  <div key={l} className="rounded-xl bg-surface-2 p-2.5">
                    <Icon size={16} className="mx-auto text-ink-3" aria-hidden />
                    <dd className="font-display text-xl font-bold">{n}</dd><dt className="text-xs text-ink-3">times {l}</dt>
                  </div>
                ))}
              </dl>
              <ul className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-wrap" aria-label="Nearby searches">
                {demand.nearby.map((n) => (
                  <li key={n.area_key + n.tag} className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', n.matches_you ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-ink-2')}>
                    {n.tag} × {n.count} · {n.area}
                  </li>
                ))}
              </ul>
              {demand.insights[0] && <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-2"><Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden /> {demand.insights[0]}</p>}
            </Card>
          )}
        </div>

        <section aria-labelledby="listings-h">
          <h2 id="listings-h" className="mb-3 text-lg font-semibold">Your listings</h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {vendor.listings.map((l) => {
              const off = vendor.status !== 'open' || l.capacity_left === 0
              return (
                <Card as="li" key={l.id} className={cx('flex flex-col p-4', off && 'opacity-70')}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[17px] font-semibold leading-snug">{l.title}</h3>
                    <span className="shrink-0 font-semibold">{inr(l.price)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                    <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {l.duration_min} min · {l.opening_hours?.open}–{l.opening_hours?.close}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {l.location?.name}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Chip tone={l.capacity_left === 0 ? 'danger' : l.capacity_left <= 3 ? 'warn' : 'success'}>{l.capacity_left} spots left</Chip>
                    <IOBadge io={l.indoor_outdoor} />
                    <TrustBadge exp={l} />
                  </div>
                  <div className="mt-2"><AccessIcons attrs={l.accessibility_attributes} /></div>
                  <div className="mt-auto flex gap-2 pt-3">
                    <button type="button" disabled={busy} onClick={() => setStatus({ status: 'full', experience_id: l.id }, `${l.title} marked full`)} className="min-h-11 flex-1 rounded-lg bg-danger-soft px-3 text-sm font-medium text-danger disabled:opacity-50">Mark full</button>
                    <button type="button" disabled={busy} onClick={() => setStatus({ status: 'slots', slots_left: 10, experience_id: l.id }, `${l.title} reopened`)} className="min-h-11 flex-1 rounded-lg bg-success-soft px-3 text-sm font-medium text-success disabled:opacity-50">Reopen</button>
                  </div>
                </Card>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
