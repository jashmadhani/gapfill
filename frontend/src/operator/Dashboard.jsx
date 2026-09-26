import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing, ChevronRight, Shuffle } from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { Bar, Card, Chip, INTEREST, STAGE_CHIP, Spinner, cx } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

function Kpi({ label, value, sub, tone }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-bold', tone)}>{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </Card>
  )
}

export function ToursTable({ tours }) {
  const nav = useNavigate()
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b border-stone-100"><tr><Th>Tour</Th><Th>Customer</Th><Th>Dates</Th><Th>Route</Th><Th>Stage</Th><Th className="text-right">Total</Th><Th>Payment</Th><Th>Vendors</Th><Th>Coordinator</Th></tr></thead>
        <tbody className="divide-y divide-stone-100">
          {tours.map((t) => {
            const [label, tone] = STAGE_CHIP[t.stage] || []
            return (
              <tr key={t.id} onClick={() => nav(`/operator/tours/${t.id}`)} className="cursor-pointer hover:bg-stone-50">
                <Td><div className="font-semibold">{t.title}</div><div className="text-xs text-stone-500">{t.code} · {t.travelers} pax</div></Td>
                <Td>{t.customer.name}<div className="text-xs capitalize text-stone-500">{t.customer.segment}</div></Td>
                <Td className="whitespace-nowrap">{fmtDate(t.start_date)} – {fmtDate(t.end_date)}{t.current_day && <div className="text-xs text-emerald-700">day {t.current_day}/{t.days}</div>}</Td>
                <Td className="text-xs">{t.route.map((r) => `${r.name} ${r.nights}N`).join(' → ')}</Td>
                <Td><Chip tone={tone}>{label}</Chip>{t.pending_changes > 0 && <Chip tone="rani" className="ml-1">{t.pending_changes} change</Chip>}</Td>
                <Td className="text-right font-semibold">{inr(t.pricing.total)}</Td>
                <Td><Chip tone={t.payments.status === 'paid' ? 'green' : t.payments.status === 'deposit' ? 'amber' : 'stone'}>{t.status === 'draft' ? 'quote' : t.payments.status}</Chip></Td>
                <Td className="text-xs">{t.status === 'draft' ? '—' : <>{t.confirmations.confirmed} ✓{t.confirmations.pending > 0 && <span className="text-amber-700"> · {t.confirmations.pending} pending</span>}{t.confirmations.declined > 0 && <span className="text-red-600"> · {t.confirmations.declined} declined</span>}</>}</Td>
                <Td className="text-xs">{t.coordinator?.name || <span className="text-stone-400">unassigned</span>}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function Bars({ rows, max }) {
  return (
    <div className="space-y-1.5">
      {rows.map(([label, value, disp]) => (
        <div key={label} className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-stone-600">{label}</span><Bar value={value} max={max} /><span className="text-right font-medium">{disp ?? value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { tick } = useOps()
  const [d, setD] = useState(null)
  useEffect(() => { api.dashboard().then(setD) }, [tick])
  if (!d) return <Spinner />
  const k = d.kpis
  const a = d.analytics
  const stages = [['plan', 'Planning'], ['prepare', 'Preparing'], ['operate', 'On tour'], ['complete', 'Completed'], ['review', 'Reviewed']]
  const mix = Object.entries(a.revenue_mix)
  return (
    <div>
      <PageHead title="Operations dashboard" sub={`${fmtDate(d.demo_date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtTime(d.demo_time)}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="On tour now" value={k.active_tours} sub={`${k.travelers_on_tour} travelers`} tone="text-emerald-700" />
        <Kpi label="Upcoming" value={k.upcoming} sub={`${k.drafts} quote(s) in planning`} />
        <Kpi label="Open changes" value={k.open_changes} sub={`${k.changes_resolved} resolved`} tone={k.open_changes ? 'text-rani-600' : ''} />
        <Kpi label="Vendor confirmations" value={k.pending_confirmations} sub="awaiting vendors" tone={k.pending_confirmations ? 'text-amber-700' : ''} />
        <Kpi label="Booked revenue" value={inr(k.revenue)} />
        <Kpi label="Collected" value={inr(k.collected)} sub={`${inr(k.outstanding)} outstanding`} />
        <Kpi label="Operator margin" value={inr(k.margin)} sub="coordination fees" />
        <Kpi label="Avg rating" value={k.avg_rating ? `${k.avg_rating}★` : '—'} sub={`${k.open_tasks} open tasks`} />
      </div>

      <Card className="mt-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tour lifecycle</div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {stages.map(([key, label], i) => (
            <Link key={key} to={`/operator/tours?stage=${key}`} className="relative rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200 hover:ring-stone-300">
              <div className="text-2xl font-bold">{d.pipeline[key]}</div>
              <div className="text-xs text-stone-500">{label}</div>
              {i < stages.length - 1 && <ChevronRight size={16} className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 text-stone-300" />}
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><BellRing size={14} /> Proactive alerts across tours</div>
          {d.alerts.length === 0 && <p className="mt-2 text-sm text-stone-500">All clear.</p>}
          <ul className="mt-2 space-y-1.5">
            {d.alerts.map((r, i) => (
              <li key={i}>
                <Link to={`/operator/tours/${r.tour_id}`} className={cx('flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ring-1',
                  r.level === 'high' ? 'bg-red-50 text-red-800 ring-red-200' : r.level === 'medium' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-sky-50 text-sky-900 ring-sky-200')}>
                  <b className="shrink-0">{r.tour_code}</b> {r.text}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500"><Shuffle size={14} /> Changes waiting on a decision</div>
            <Link to="/operator/changes" className="text-xs font-semibold text-rani-600">Open queue →</Link>
          </div>
          {d.pending_changes.length === 0 && <p className="mt-2 text-sm text-stone-500">No pending changes. Trigger one from Live Ops.</p>}
          <ul className="mt-2 space-y-2">
            {d.pending_changes.map((e) => (
              <li key={e.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm ring-1 ring-stone-200">
                <div className="flex items-center justify-between gap-2"><span><Chip tone="rani">{e.label}</Chip> <b>{e.tour_code}</b></span><span className="text-xs text-stone-500">{e.options.length} options</span></div>
                <p className="mt-1 text-xs text-stone-600">{e.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Revenue mix</div>
          <Bars rows={mix.map(([k2, v]) => [{ hotel: 'Stays', transport: 'Transport', activity: 'Experiences' }[k2], v, inr(v)])} max={Math.max(...mix.map(([, v]) => v), 1)} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Destinations (nights sold)</div>
          <Bars rows={a.destinations.map((x) => [x.name, x.nights])} max={Math.max(...a.destinations.map((x) => x.nights), 1)} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Traveler interests</div>
          <Bars rows={a.interests.slice(0, 7).map((x) => [INTEREST[x.tag]?.label || x.tag, x.count])} max={Math.max(...a.interests.map((x) => x.count), 1)} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Busiest vendors</div>
          <Bars rows={a.top_vendors.map((x) => [x.name, x.bookings])} max={Math.max(...a.top_vendors.map((x) => x.bookings), 1)} />
        </Card>
      </div>

      <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">All tours</div>
      <ToursTable tours={d.tours} />
    </div>
  )
}
