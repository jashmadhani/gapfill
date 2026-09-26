import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bell, CalendarCheck, Check, Clock, IndianRupee, Star, Ticket, Users, X } from 'lucide-react'
import { api, fmtDate, inr } from '../api'
import { useLive } from '../live'
import { Card, Chip, IOBadge, Rating, Spinner, TIER_LABEL, cx } from '../components/ui'

const STATUS_STYLE = { open: 'bg-emerald-500', closed: 'bg-stone-500' }
const KIND_LABEL = { activity: 'Experiences', hotel: 'Hotels', transport: 'Transport' }

function BookingCard({ b, busy, onAct }) {
  return (
    <Card className={cx('p-3', b.status === 'disrupted' && 'ring-red-300')}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs text-white"><Ticket size={12} /> {b.booking_ref}</span>
        <span className="text-xs text-stone-500">{b.tour_code}</span>
      </div>
      <div className="mt-1.5 font-semibold leading-snug">{b.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {b.kind === 'hotel' ? `check-in, ${b.nights} night(s)` : `${b.start_label}–${b.end_label}`}</span>
        <span className="inline-flex items-center gap-1"><Users size={12} /> {b.customer} · {b.kind === 'hotel' ? `${b.qty} room(s)` : `${b.qty} pax`}</span>
        <span className="font-medium text-stone-700">{inr(b.price)}</span>
      </div>
      {onAct && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => onAct(b, 'decline')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 disabled:opacity-50"><X size={15} /> Decline</button>
          <button disabled={busy} onClick={() => onAct(b, 'confirm')} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} /> Confirm</button>
        </div>
      )}
    </Card>
  )
}

// Vendor portal: confirm/decline booking requests, one-tap availability, and change notifications from the operator.
export default function VendorPortal() {
  const { id } = useParams()
  const nav = useNavigate()
  const [vendors, setVendors] = useState([])
  const [vendorId, setVendorId] = useState(Number(id) || null)
  const [v, setV] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = useCallback(async () => {
    const vs = await api.vendors()
    setVendors(vs)
    const vid = vendorId || vs[0]?.id
    if (vid) { setVendorId(vid); setV(await api.vendor(vid)) }
  }, [vendorId])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (Number(id) && Number(id) !== vendorId) setVendorId(Number(id)) }, [id]) // eslint-disable-line
  useLive((m) => { if (!['hello', 'pong'].includes(m.type)) load() })

  const say = (t) => { setFlash(t); setTimeout(() => setFlash(null), 3500) }
  const setStatus = async (body, label) => {
    setBusy(true)
    try {
      const r = await api.vendorStatus(vendorId, body)
      say(`${label} ✓${r.events ? ` · ${r.events} traveler plan(s) got replanning options` : ''}`)
      await load()
    } finally { setBusy(false) }
  }
  const act = async (b, action) => {
    setBusy(true)
    try {
      const r = await api.vendorBooking(vendorId, b.id, action)
      say(action === 'confirm' ? `${b.booking_ref} confirmed ✓` : `${b.booking_ref} declined · the traveler got ${r.events ? 'replacement options' : 'notified'}`)
      await load()
    } finally { setBusy(false) }
  }

  if (!v) return <Spinner />
  const embed = location.search
  return (
    <div className="mx-auto min-h-full max-w-md bg-stone-50 pb-8">
      <header className="bg-stone-900 px-4 pt-4 pb-5 text-white">
        <div className="flex items-center justify-between gap-2">
          <select value={vendorId} onChange={(e) => { setVendorId(Number(e.target.value)); nav(`/vendor/${e.target.value}${embed}`) }}
            className="min-w-0 max-w-[70%] rounded-lg bg-white/10 px-2 py-1 text-sm text-white">
            {['activity', 'hotel', 'transport'].map((k) => (
              <optgroup key={k} label={KIND_LABEL[k]} className="text-stone-900">
                {vendors.filter((x) => x.kind === k).map((x) => <option key={x.id} value={x.id} className="text-stone-900">{x.name}{x.pending ? ` (${x.pending})` : ''}</option>)}
              </optgroup>
            ))}
          </select>
          <Link to="/operator" className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Operator ↗</Link>
        </div>
        <h1 className="mt-3 text-xl font-bold">{v.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-stone-300">
          <span className={cx('h-2.5 w-2.5 rounded-full', STATUS_STYLE[v.status])} /> Currently <b className="capitalize text-white">{v.status}</b> · {KIND_LABEL[v.kind]} · {v.dest_name}
        </div>
      </header>

      <div className="-mt-3 space-y-3 px-4">
        <Card className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Availability — one tap</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[['open', 'Open', 'bg-emerald-600'], ['closed', 'Closed / can’t operate', 'bg-stone-700']].map(([s, label, bg]) => (
              <button key={s} disabled={busy} onClick={() => setStatus({ status: s }, label)}
                className={cx('rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50', bg, v.status === s ? 'ring-4 ring-stone-300 ring-offset-1' : 'opacity-80 hover:opacity-100')}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-500">Closing instantly alerts every affected traveler with recovery options, and the operator’s coordinator.</p>
          {flash && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{flash}</div>}
        </Card>

        <Card className="grid grid-cols-3 gap-2 p-3 text-center">
          <div className="rounded-lg bg-stone-50 p-2"><CalendarCheck size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{v.stats.bookings}</div><div className="text-[11px] text-stone-500">active bookings</div></div>
          <div className="rounded-lg bg-stone-50 p-2"><IndianRupee size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{inr(v.stats.revenue)}</div><div className="text-[11px] text-stone-500">booked value</div></div>
          <div className="rounded-lg bg-stone-50 p-2"><Star size={14} className="mx-auto text-stone-400" /><div className="text-lg font-bold">{v.stats.rating?.toFixed(1)}</div><div className="text-[11px] text-stone-500">avg rating</div></div>
        </Card>

        <div className="flex items-center justify-between pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <span>Booking requests</span>{v.requests.length > 0 && <Chip tone="amber">{v.requests.length} to confirm</Chip>}
        </div>
        {v.requests.length === 0 && <p className="text-sm text-stone-500">No pending requests.</p>}
        {v.requests.map((b) => <BookingCard key={b.id} b={b} busy={busy} onAct={act} />)}

        {v.notifications.filter((n) => n.kind !== 'confirm').length > 0 && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><Bell size={14} /> From the operator</div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {v.notifications.filter((n) => n.kind !== 'confirm').slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-start gap-2">
                  <Chip tone={n.kind === 'cancel' ? 'red' : 'blue'}>{n.kind === 'cancel' ? 'Cancelled' : 'Update'}</Chip>
                  <span className="text-stone-700">{n.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Confirmed upcoming ({v.upcoming.length})</div>
        {v.upcoming.slice(0, 6).map((b) => <BookingCard key={b.id} b={b} />)}

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Your listings</div>
        {v.offerings.map((l) => (
          <Card key={l.id} className={cx('p-3', (!l.available) && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold leading-snug">{l.title}</div>
              <span className="shrink-0 font-semibold">{inr(l.price)}{l.kind === 'hotel' ? '/night' : l.kind === 'transport' ? (l.mode === 'car' ? '/km' : '') : ''}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip tone={l.status === 'open' ? 'green' : 'red'}>{l.status}</Chip>
              {l.kind === 'activity' && <><IOBadge io={l.indoor_outdoor} /><span className="text-xs text-stone-500">{l.duration_min} min · {l.open}–{l.close}</span></>}
              {l.kind === 'hotel' && <Chip>{TIER_LABEL[l.tier]}</Chip>}
              <Rating value={l.rating} count={l.rating_count} className="text-xs" />
            </div>
            {l.kind === 'activity' && (
              <div className="mt-2 flex gap-3">
                <button disabled={busy} onClick={() => setStatus({ status: 'full', offering_id: l.id }, `${l.title} marked full`)} className="text-xs font-medium text-red-600 hover:underline">Mark full / cancel</button>
                <button disabled={busy} onClick={() => setStatus({ status: 'open', offering_id: l.id }, `${l.title} reopened`)} className="text-xs font-medium text-emerald-700 hover:underline">Reopen</button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
