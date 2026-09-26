import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, inr } from '../api'
import { Card, Chip, STAGE_CHIP, Spinner } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

export default function Payments() {
  const { tick } = useOps()
  const [d, setD] = useState(null)
  useEffect(() => { api.payments().then(setD) }, [tick])
  if (!d) return <Spinner />
  const due = d.tours.reduce((a, t) => a + Math.max(0, t.balance), 0)
  const credit = d.tours.reduce((a, t) => a + Math.max(0, -t.balance), 0)
  return (
    <div>
      <PageHead title="Payments" sub={`${inr(due)} outstanding · ${inr(credit)} owed back to travelers after changes`} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Tour</Th><Th>Customer</Th><Th>Stage</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th className="text-right">Balance</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {d.tours.map((t) => (
              <tr key={t.tour_id}>
                <Td><Link to={`/operator/tours/${t.tour_id}`} className="font-semibold hover:underline">{t.code}</Link><div className="text-xs text-stone-500">{t.title}</div></Td>
                <Td>{t.customer}</Td>
                <Td><Chip tone={STAGE_CHIP[t.stage]?.[1]}>{STAGE_CHIP[t.stage]?.[0]}</Chip></Td>
                <Td className="text-right">{inr(t.total)}</Td>
                <Td className="text-right">{inr(t.net_paid)}</Td>
                <Td className={t.balance > 0 ? 'text-right font-semibold text-amber-700' : t.balance < 0 ? 'text-right font-semibold text-emerald-700' : 'text-right'}>{t.balance < 0 ? `${inr(-t.balance)} credit` : inr(t.balance)}</Td>
                <Td><Chip tone={t.status === 'paid' ? 'green' : 'amber'}>{t.status}</Chip></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Ledger</div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Date</Th><Th>Tour</Th><Th>Note</Th><Th>Method</Th><Th className="text-right">Amount</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {d.ledger.map((l) => (
              <tr key={l.id}>
                <Td className="text-xs">{new Date(l.at).toLocaleDateString('en-IN')}</Td>
                <Td><Link to={`/operator/tours/${l.tour_id}`} className="hover:underline">{l.code}</Link></Td>
                <Td>{l.note}</Td>
                <Td className="text-xs uppercase">{l.method}</Td>
                <Td className={l.kind === 'refund' ? 'text-right text-emerald-700' : 'text-right'}>{l.kind === 'refund' ? '−' : ''}{inr(l.amount)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
