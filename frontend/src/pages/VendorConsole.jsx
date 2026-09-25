import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Clock, Eye, MapPin, MessageCircle, Minus, Plus, Ticket, TrendingUp } from 'lucide-react'
import { api, inr } from '../api'
import { useLive } from '../live'
import { AccessIcons, Card, Chip, IOBadge, Spinner, TrustBadge, cx } from '../components/ui'

const STATUS_STYLE = { open: 'bg-emerald-500', closed: 'bg-stone-500', full: 'bg-red-500' }

// One-tap status console + read-only listings + today's nearby-demand strip.
export default function VendorConsole() {
  const { id } = useParams()
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
      setFlash(`${label} ✓${r.disruptions_created.length ? ` · ${r.disruptions_created.length} traveler plan(s) auto-replanned` : ''}`)
      setTimeout(() => setFlash(null), 3500)
      await load()
    } finally { setBusy(false) }
  }

  if (!vendor) return <Spinner />
  const allSoldOut = vendor.listings.length > 0 && vendor.listings.every((l) => l.capacity_left === 0)
  const current = vendor.status !== 'open' ? vendor.status : allSoldOut ? 'full' : 'open'

  return (
    <div className="mx-auto min-h-full max-w-md bg-stone-50 pb-8">
      <header className="bg-stone-900 px-4 pt-4 pb-5 text-white">
        <div className="flex items-center justify-between">
          <select value={vendorId} onChange={(e) => nav(`/vendor/${e.target.value}${location.search}`)}
            className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white">
            {vendors.map((v) => <option key={v.id} value={v.id} className="text-stone-900">{v.name}</option>)}
          </select>
          <Link to={`/vendor/chat?vendor=${vendorId}`} className="inline-flex items-center gap-1 rounded-full bg-[#00a884] px-3 py-1 text-xs font-semibold"><MessageCircle size={13} /> New listing</Link>
        </div>
        <h1 className="mt-3 text-xl font-bold">{vendor.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-stone-300">
          <span className={cx('h-2.5 w-2.5 rounded-full', STATUS_STYLE[current])} /> Currently <b className="text-white capitalize">{current}</b>
        </div>
      </header>

      <div className="-mt-3 space-y-3 px-4">
        <Card className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Today’s status — one tap</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[['open', 'Open', 'bg-emerald-600'], ['closed', 'Closed', 'bg-stone-700'], ['full', 'Fully booked', 'bg-red-600']].map(([s, label, bg]) => (
              <button key={s} disabled={busy} onClick={() => setStatus({ status: s }, label)}
                className={cx('rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50', bg, current === s ? 'ring-4 ring-offset-1 ring-stone-300' : 'opacity-80 hover:opacity-100')}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 p-2">
            <button onClick={() => setSlots((s) => Math.max(1, s - 1))} className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-amber-200"><Minus size={14} /></button>
            <span className="w-8 text-center text-lg font-bold">{slots}</span>
            <button onClick={() => setSlots((s) => s + 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-amber-200"><Plus size={14} /></button>
            <button disabled={busy} onClick={() => setStatus({ status: 'slots', slots_left: slots }, `${slots} slots left`)}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-white disabled:opacity-50">Set “{slots} slots left”</button>
          </div>
          {flash && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{flash}</div>}
        </Card>

        {demand && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><TrendingUp size={14} /> Demand near you today</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-stone-50 p-2"><Eye size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{demand.own.shown}</div><div className="text-[11px] text-stone-500">times suggested</div></div>
              <div className="rounded-lg bg-stone-50 p-2"><Plus size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{demand.own.added}</div><div className="text-[11px] text-stone-500">added to days</div></div>
              <div className="rounded-lg bg-stone-50 p-2"><Ticket size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{demand.own.booked}</div><div className="text-[11px] text-stone-500">booked</div></div>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {demand.nearby.map((n) => (
                <span key={n.area_key + n.tag} className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs', n.matches_you ? 'bg-rani-50 text-rani-700' : 'bg-stone-100 text-stone-600')}>
                  {n.tag} ×{n.count} · {n.area}
                </span>
              ))}
            </div>
            {demand.insights[0] && <p className="mt-1 text-xs text-stone-500">💡 {demand.insights[0]}</p>}
          </Card>
        )}

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Your listings</div>
        {vendor.listings.map((l) => (
          <Card key={l.id} className={cx('p-3', (vendor.status !== 'open' || l.capacity_left === 0) && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold leading-snug">{l.title}</div>
              <span className="shrink-0 font-semibold">{inr(l.price)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {l.duration_min} min · {l.opening_hours?.open}–{l.opening_hours?.close}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {l.location?.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone={l.capacity_left === 0 ? 'red' : l.capacity_left <= 3 ? 'amber' : 'green'}>{l.capacity_left} spots left</Chip>
              <IOBadge io={l.indoor_outdoor} />
              <TrustBadge exp={l} />
              <AccessIcons attrs={l.accessibility_attributes} />
            </div>
            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={() => setStatus({ status: 'full', experience_id: l.id }, `${l.title} marked full`)} className="text-xs font-medium text-red-600 hover:underline">Mark this one full</button>
              <button disabled={busy} onClick={() => setStatus({ status: 'slots', slots_left: 10, experience_id: l.id }, `${l.title} reopened`)} className="text-xs font-medium text-emerald-700 hover:underline">Reopen</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
