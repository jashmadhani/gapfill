import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { BedDouble, Car, Sparkles, Ticket as TicketIcon } from 'lucide-react'
import { api, fmtDate } from '../api'
import { useTour } from '../store'
import { Button, Empty, Spinner, cx } from '../components/ui'
import { PageBody, PageHero } from '../components/page'
import { destImage } from '../media'

const KIND_ICON = { hotel: BedDouble, transport: Car, activity: Sparkles }

function QR({ value }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { QRCode.toDataURL(value, { margin: 1, width: 240, color: { dark: '#141b26', light: '#ffffff' } }).then(setSrc) }, [value])
  return src ? <img src={src} alt="Ticket QR code" className="h-28 w-28 shrink-0 rounded-xl ring-1 ring-stone-200" /> : <div className="h-28 w-28 shrink-0 animate-pulse rounded-xl bg-stone-100" />
}

// Trip pass: one signed QR ticket per booking. Changed bookings keep their old ticket, clearly marked void.
export default function Tickets() {
  const { tour, version } = useTour()
  const [data, setData] = useState(null)
  const [showVoid, setShowVoid] = useState(false)
  useEffect(() => { if (tour?.id) api.tickets(tour.id).then(setData) }, [tour?.id, version])
  if (!tour) return <div className="px-4 pt-5"><Empty title="No trip yet">Tickets appear once a trip is booked and paid.</Empty></div>
  if (!data) return <Spinner />
  const valid = data.tickets.filter((t) => t.status === 'valid')
  const voided = data.tickets.filter((t) => t.status !== 'valid')
  const days = [...new Set(valid.map((t) => t.day))].sort((a, b) => a - b)

  return (
    <div>
      <PageHero size="sm" img={destImage(tour.route[0]?.dest)} eyebrow={`${tour.code} · ${data.tour.travelers.join(', ')}`} title="Trip pass"
        subtitle={`${valid.length} valid ticket${valid.length === 1 ? '' : 's'} — show the QR at each stop`} />
      <PageBody width="narrow">
        {valid.length === 0 && <Empty title="No tickets yet" action={<Link to="/price"><Button>Review & pay</Button></Link>}>Tickets are issued as soon as a booking is paid.</Empty>}
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d}>
              <h2 className="mb-2 text-xl font-bold text-ink">Day {d}</h2>
              <ul className="space-y-3">
                {valid.filter((t) => t.day === d).map((t) => {
                  const I = KIND_ICON[t.kind] || TicketIcon
                  return (
                    <li key={t.code} className="flex gap-4 rounded-[1.6rem] bg-white p-3.5 shadow-soft ring-1 ring-stone-200/70">
                      <QR value={t.qr} />
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rani-600"><I size={13} aria-hidden /> {t.kind === 'transport' ? 'Transfer' : t.kind === 'hotel' ? 'Stay' : 'Experience'}</span>
                        <p className="mt-0.5 text-[17px] font-bold leading-snug text-ink">{t.title}</p>
                        <p className="text-sm text-stone-600">{fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' })}{t.kind === 'hotel' ? ` · ${t.nights} night${t.nights > 1 ? 's' : ''}` : ` · ${t.time}`}</p>
                        <p className="text-sm text-stone-500">{t.vendor} · {t.kind === 'hotel' ? `${t.qty} room${t.qty > 1 ? 's' : ''}` : `${t.qty} guest${t.qty > 1 ? 's' : ''}`}</p>
                        <p className="mt-1 font-mono text-xs text-stone-500">{t.code} · ref {t.booking_ref}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        {voided.length > 0 && (
          <div className="mt-6">
            <button type="button" onClick={() => setShowVoid((v) => !v)} className="min-h-11 text-sm font-semibold text-stone-600 underline">
              {showVoid ? 'Hide' : 'Show'} {voided.length} voided ticket{voided.length > 1 ? 's' : ''}
            </button>
            {showVoid && (
              <ul className="mt-2 space-y-2">
                {voided.map((t) => (
                  <li key={t.code} className={cx('rounded-2xl bg-stone-100 p-3 text-sm text-stone-500')}>
                    <span className="font-semibold line-through">{t.title}</span> · <span className="font-mono">{t.code}</span> · {t.void_reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PageBody>
    </div>
  )
}
