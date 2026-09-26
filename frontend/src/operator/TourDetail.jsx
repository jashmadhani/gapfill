import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BedDouble, Check, CloudRain, Smartphone, TrainFront } from 'lucide-react'
import { api, fmtDate, inr } from '../api'
import { useTour } from '../store'
import { VENDOR_CHIP } from '../components/DayTimeline'
import { ImpactList, OptionList } from '../components/ChangeCard'
import { Bar, Button, Card, Chip, INTEREST, KindIcon, MODE, PACE_LABEL, STAGE_CHIP, Spinner, TIER_LABEL, cx } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

export function PendingChange({ ev, onDone }) {
  const [choice, setChoice] = useState(ev.options.find((o) => o.recommended)?.key || ev.options[0]?.key)
  const [busy, setBusy] = useState(false)
  const act = async (action) => {
    setBusy(true)
    try { await api.resolve(ev.id, action, choice, 'operator'); onDone?.() } catch (e) { alert(e.message); onDone?.() } finally { setBusy(false) }
  }
  return (
    <Card className="p-4 ring-2 ring-rani-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Chip tone="rani">{ev.label}</Chip><Link to={`/operator/tours/${ev.tour_id}`} className="text-sm font-semibold">{ev.tour_code} · {ev.tour_title}</Link></div>
        <span className="text-xs text-stone-500">raised by {ev.source} · {new Date(ev.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <p className="mt-2 text-sm text-stone-700">{ev.reason}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <ImpactList impact={ev.impact} />
        <div>
          <OptionList options={ev.options} choice={choice} setChoice={setChoice} />
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => act('accept')}>Apply plan {choice} for traveler</Button>
            <Button variant="secondary" disabled={busy} onClick={() => act('dismiss')}>Keep original</Button>
          </div>
          <p className="mt-1 text-xs text-stone-500">The traveler sees the same options on their phone — whoever decides first wins; vendors are re-booked and notified automatically.</p>
        </div>
      </div>
    </Card>
  )
}

export default function TourDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { tick, refresh } = useOps()
  const { activate } = useTour()
  const [t, setT] = useState(null)
  const [pending, setPending] = useState([])
  const [coords, setCoords] = useState([])
  const [amount, setAmount] = useState('')
  const [history, setHistory] = useState(false)
  const load = () => Promise.all([api.tour(id), api.changes(`?tour_id=${id}&status=pending`)]).then(([a, b]) => { setT(a); setPending(b) })
  useEffect(() => { load() }, [id, tick]) // eslint-disable-line
  useEffect(() => { api.coordinators().then(setCoords) }, [])
  if (!t) return <Spinner />
  const [label, tone] = STAGE_CHIP[t.stage] || []
  const p = t.pricing

  const confirmItem = async (i) => { await api.vendorBooking(i.vendor_id, i.id, 'confirm'); refresh() }
  const record = async (kind) => {
    const n = Number(amount || t.payments.balance)
    if (!n) return
    await api.pay(t.id, { amount: Math.abs(n), kind, method: 'bank', note: kind === 'refund' ? 'Refund' : 'Recorded by operator' })
    setAmount(''); refresh()
  }
  const opsTrigger = async (body) => { const r = await api.trigger({ tour_id: t.id, source: 'operator', ...body }); if (r.note) alert(r.note); refresh() }

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-2 inline-flex items-center gap-1 text-sm text-stone-500"><ArrowLeft size={16} /> Back</button>
      <PageHead title={t.title} sub={`${t.code} · ${t.customer.name} · ${fmtDate(t.start_date)} – ${fmtDate(t.end_date)} · ${t.days} days · ${t.group.adults} adults${t.group.children ? ` + ${t.group.children} children` : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={tone}>{label}{t.current_day ? ` · day ${t.current_day}` : ''}</Chip>
          <select value={t.coordinator?.id || ''} onChange={async (e) => { await api.patchTour(t.id, { coordinator_id: Number(e.target.value) }); refresh() }} className="rounded-lg bg-white px-2 py-1.5 text-sm ring-1 ring-stone-200">
            <option value="" disabled>Assign coordinator</option>
            {coords.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.base})</option>)}
          </select>
          <Button variant="secondary" onClick={async () => { await activate(t.id); window.open('/trip', '_blank') }}><Smartphone size={15} /> Open as traveler</Button>
        </div>
      </PageHead>

      {pending.map((ev) => <div key={ev.id} className="mb-4"><PendingChange ev={ev} onDone={refresh} /></div>)}

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div><div className="text-xs uppercase tracking-wide text-stone-500">Route</div><div className="font-medium">{t.route.map((r) => `${r.name} (${r.nights}N)`).join(' → ')}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-stone-500">Preferences</div><div className="font-medium">{TIER_LABEL[t.prefs.hotel_tier]} · {MODE[t.prefs.transport]?.label} · {PACE_LABEL[t.prefs.pace]}{t.prefs.needs?.step_free ? ' · step-free' : ''}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-stone-500">Interests</div><div className="flex flex-wrap gap-1">{t.prefs.interests.map((i) => <Chip key={i}>{INTEREST[i]?.label}</Chip>)}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-stone-500">Group</div>
                <div className="flex flex-wrap gap-1">{(t.members || []).map((m) => <Chip key={m.name}>{m.name} {m.age} · {m.band}{m.step_free ? ' · step-free' : ''}</Chip>)}</div></div>
              {t.group_fit && <div><div className="text-xs uppercase tracking-wide text-stone-500">Predicted fit</div>
                <div className="flex flex-wrap gap-1">{t.group_fit.members.map((m) => <Chip key={m.name} tone={m.avg >= 75 ? 'green' : m.avg >= 55 ? 'amber' : 'red'}>{m.name} {m.avg}%</Chip>)}<Chip tone="blue">fairness {t.group_fit.fairness}%</Chip></div></div>}
            </div>
          </Card>

          {t.risks.length > 0 && (
            <Card className="space-y-1.5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Risks</div>
              {t.risks.map((r, i) => <div key={i} className={cx('rounded-lg px-2.5 py-1.5 text-xs ring-1', r.level === 'high' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200')}>{r.text}</div>)}
            </Card>
          )}

          <Card className="overflow-x-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Itinerary & bookings</div>
              <button onClick={() => setHistory((h) => !h)} className="text-xs text-stone-500 underline">{history ? 'Hide' : 'Show'} replaced items</button>
            </div>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-stone-100"><tr><Th>Day</Th><Th>Time</Th><Th>Component</Th><Th>Vendor</Th><Th>Ref</Th><Th className="text-right">Price</Th><Th>Status</Th><Th /></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {t.days_detail.map((d) => d.items.filter((i) => history || !['replaced', 'cancelled'].includes(i.status)).map((i, idx) => (
                  <tr key={i.id} className={cx(d.day === t.current_day && 'bg-emerald-50/40', ['replaced', 'cancelled'].includes(i.status) && 'text-stone-400 line-through', i.is_past && 'opacity-60')}>
                    <Td className="whitespace-nowrap text-xs">{idx === 0 && <><b>D{d.day}</b> {d.dest_name}{d.rain && <CloudRain size={12} className="ml-1 inline text-sky-600" />}<div className="text-stone-400">{fmtDate(d.date)}</div></>}</Td>
                    <Td className="whitespace-nowrap text-xs">{i.kind === 'hotel' ? `in ${i.start_label}` : i.kind === 'fee' ? '' : `${i.start_label}–${i.end_label}`}</Td>
                    <Td><span className="inline-flex items-start gap-1.5">{i.kind !== 'fee' && <KindIcon item={i} size={14} className="mt-0.5 shrink-0 text-stone-400" />}<span>{i.title}{i.kind === 'hotel' && <span className="text-xs text-stone-500"> · {i.nights}N × {i.qty} rm</span>}</span></span></Td>
                    <Td className="text-xs">{i.vendor_name}</Td>
                    <Td className="font-mono text-xs">{i.booking_ref}</Td>
                    <Td className="text-right">{inr(i.price)}</Td>
                    <Td>{i.status === 'disrupted' ? <Chip tone="red">disrupted</Chip> : ['replaced', 'cancelled'].includes(i.status) ? <Chip>{i.status}</Chip> : VENDOR_CHIP[i.vendor_status]}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {i.vendor_status === 'pending' && i.status === 'booked' && <button onClick={() => confirmItem(i)} className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check size={13} /> Confirmed by phone</button>}
                      {i.kind === 'hotel' && i.status === 'booked' && !i.is_past && <button onClick={() => opsTrigger({ trigger_type: 'hotel_issue', item_id: i.id })} className="ml-2 inline-flex items-center gap-1 text-stone-500 hover:text-rani-600"><BedDouble size={13} /> Issue</button>}
                      {i.kind === 'transport' && i.status === 'booked' && !i.is_past && <button onClick={() => opsTrigger({ trigger_type: 'transport_delay', item_id: i.id, minutes: 120 })} className="ml-2 inline-flex items-center gap-1 text-stone-500 hover:text-rani-600"><TrainFront size={13} /> Delay</button>}
                    </Td>
                  </tr>
                )))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Financials</div>
            <div className="mt-2 flex items-end justify-between"><span className="text-2xl font-bold">{inr(p.total)}</span><span className="text-xs text-stone-500">budget {inr(p.budget)}</span></div>
            {p.budget > 0 && <Bar value={p.total} max={p.budget} tone={p.within_budget ? 'green' : 'red'} className="mt-1" />}
            <ul className="mt-3 space-y-1 text-xs text-stone-600">
              <li className="flex justify-between"><span>Stays</span><span>{inr(p.categories.stays)}</span></li>
              <li className="flex justify-between"><span>Transport</span><span>{inr(p.categories.transport)}</span></li>
              <li className="flex justify-between"><span>Experiences</span><span>{inr(p.categories.experiences)}</span></li>
              {p.categories.fees > 0 && <li className="flex justify-between"><span>Change fees</span><span>{inr(p.categories.fees)}</span></li>}
              <li className="flex justify-between font-semibold text-emerald-700"><span>Operator margin</span><span>{inr(p.service_fee)}</span></li>
              <li className="flex justify-between"><span>GST</span><span>{inr(p.gst)}</span></li>
            </ul>
            <div className="mt-3 border-t border-stone-100 pt-3">
              <div className="flex justify-between text-sm"><span>Paid</span><b>{inr(t.payments.net_paid)}</b></div>
              <div className={cx('flex justify-between text-sm', t.payments.balance > 0 ? 'text-amber-700' : 'text-emerald-700')}><span>{t.payments.balance >= 0 ? 'Balance due' : 'Credit to refund'}</span><b>{inr(Math.abs(t.payments.balance))}</b></div>
              <ul className="mt-2 space-y-0.5 text-xs text-stone-500">
                {t.payments.ledger.map((l) => <li key={l.id} className="flex justify-between"><span>{new Date(l.at).toLocaleDateString('en-IN')} · {l.note}</span><span>{l.kind === 'refund' ? '−' : ''}{inr(l.amount)}</span></li>)}
              </ul>
              {t.status !== 'draft' && (
                <div className="mt-2 flex gap-1.5">
                  <input type="number" placeholder={String(Math.abs(t.payments.balance))} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 min-w-0 flex-1 rounded-lg bg-stone-50 px-2 py-1.5 text-sm ring-1 ring-stone-200" />
                  <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => record('payment')}>+ Payment</Button>
                  <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => record('refund')}>Refund</Button>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Change log</div>
            {t.changes.length === 0 && <p className="mt-1 text-xs text-stone-500">No changes yet.</p>}
            <ul className="mt-2 space-y-1.5 text-xs">
              {t.changes.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <span><b>{c.label}</b> · {c.status === 'accepted' ? `“${c.chosen_label}”` : c.status}{c.resolved_by ? ` by ${c.resolved_by}` : ''}</span>
                  <Chip tone={c.status === 'accepted' ? 'green' : c.status === 'pending' ? 'rani' : 'stone'}>{c.status}</Chip>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Coordination tasks</div>
            <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto text-xs">
              {t.tasks.slice(0, 30).map((k) => (
                <li key={k.id} className={cx('flex items-start justify-between gap-2', k.status === 'done' && 'text-stone-400')}>
                  <span><Chip tone={{ cancel: 'red', confirm: 'amber', notify: 'blue', callback: 'rani', payment: 'green' }[k.kind]}>{k.kind}</Chip> {k.text}</span>
                  {k.status === 'open' ? <button onClick={async () => { await api.taskDone(k.id); refresh() }} className="shrink-0 font-semibold text-emerald-700">Done</button> : <Check size={13} className="shrink-0" />}
                </li>
              ))}
            </ul>
          </Card>

          {t.review && (
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Customer review</div>
              <div className="mt-1 text-lg font-bold">{'★'.repeat(t.review.overall)}<span className="text-stone-300">{'★'.repeat(5 - t.review.overall)}</span></div>
              <p className="text-sm text-stone-600">“{t.review.text}”</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
