import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, CloudRain, Users } from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { VENDOR_CHIP } from '../components/DayTimeline'
import { Card, Chip, KindIcon, Spinner, cx } from '../components/ui'
import { PageHead, useOps } from './OperatorApp'

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

// Today's operations: every tour on the road, what's happening now, and which vendor is responsible.
export default function Schedule() {
  const { tick } = useOps()
  const [day, setDay] = useState('')
  const [s, setS] = useState(null)
  useEffect(() => { api.schedule(day).then(setS) }, [day, tick])
  if (!s) return <Spinner />
  const now = toMin(s.now)
  const isToday = !day
  return (
    <div>
      <PageHead title="Today’s operations" sub={`${fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ` · now ${fmtTime(s.now)}` : ''} · ${s.tours.length} tour(s) on the road`}>
        <input type="date" value={day || s.date} onChange={(e) => setDay(e.target.value)} className="rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-stone-200" />
      </PageHead>
      {s.tours.length === 0 && <Card className="p-6 text-center text-sm text-stone-500">No tours running on this date.</Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {s.tours.map((t) => (
          <Card key={t.tour_id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/operator/tours/${t.tour_id}`} className="font-semibold hover:underline">{t.code} · {t.title}</Link>
                <div className="text-xs text-stone-500"><Users size={11} className="inline" /> {t.customer} · {t.travelers} pax · coordinator {t.coordinator || '-'}</div>
                <div className="text-xs text-stone-500"><BedDouble size={11} className="inline" /> {t.stay || 'Departure day'}</div>
              </div>
              <div className="text-right">
                <Chip tone="green">Day {t.day}/{t.days} · {t.dest}</Chip>
                {t.rain && <div className="mt-1"><Chip tone="blue"><CloudRain size={12} /> Rain</Chip></div>}
              </div>
            </div>
            <ol className="mt-3 space-y-1.5">
              {t.items.map((i) => {
                const nowItem = isToday && i.kind !== 'hotel' && i.start_min <= now && now < i.end_min
                const past = isToday && i.end_min <= now && i.kind !== 'hotel'
                return (
                  <li key={i.id} className={cx('flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ring-1', nowItem ? 'bg-emerald-50 ring-emerald-300' : i.status === 'disrupted' ? 'bg-red-50 ring-red-200' : 'bg-stone-50 ring-stone-200', past && 'opacity-50')}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-28 shrink-0 text-xs text-stone-500">{i.kind === 'hotel' ? `check-in ${i.start_label}` : `${i.start_label}–${i.end_label}`}</span>
                      <KindIcon item={i} size={14} className="shrink-0 text-stone-400" />
                      <span className="truncate">{i.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-stone-500">
                      {nowItem && <Chip tone="green">now</Chip>}
                      <span className="hidden sm:inline">{i.vendor_name}</span>
                      {i.status === 'disrupted' ? <Chip tone="red">disrupted</Chip> : VENDOR_CHIP[i.vendor_status]}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="mt-2 text-right text-xs text-stone-500">Day value {inr(t.items.reduce((a, i) => a + i.price, 0))}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
