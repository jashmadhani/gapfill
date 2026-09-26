import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, signedInr } from '../api'
import { Card, Chip, Spinner } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'
import { PendingChange } from './TourDetail'

// Change management: every disruption / request with its impact analysis and recovery options, plus the audit trail.
export default function Changes() {
  const { tick, refresh } = useOps()
  const [all, setAll] = useState(null)
  useEffect(() => { api.changes().then(setAll) }, [tick])
  if (!all) return <Spinner />
  const pending = all.filter((e) => e.status === 'pending')
  const done = all.filter((e) => e.status !== 'pending')
  return (
    <div>
      <PageHead title="Changes" sub={`${pending.length} waiting · ${done.length} resolved. Travelers get the same options live, approve on their behalf if they call in.`} />
      {pending.length === 0 && <Card className="mb-4 p-6 text-center text-sm text-stone-500">No pending changes. Use <Link to="/ops" className="underline">Live Ops</Link> to trigger weather, delays, cancellations or overbookings.</Card>}
      <div className="space-y-4">{pending.map((ev) => <PendingChange key={ev.id} ev={ev} onDone={refresh} />)}</div>
      <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">History</div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>When</Th><Th>Tour</Th><Th>Change</Th><Th>Outcome</Th><Th>Decided by</Th><Th className="text-right">Cost impact</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {done.length === 0 && <tr><Td colSpan={6} className="py-6 text-center text-stone-500">No history yet.</Td></tr>}
            {done.map((e) => {
              const opt = e.options.find((o) => o.key === e.chosen)
              return (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs">{new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Td>
                  <Td><Link to={`/operator/tours/${e.tour_id}`} className="font-semibold hover:underline">{e.tour_code}</Link></Td>
                  <Td><Chip tone="rani">{e.label}</Chip><div className="mt-0.5 max-w-md text-xs text-stone-500">{e.reason}</div></Td>
                  <Td>{e.status === 'accepted' ? <Chip tone="green">{opt?.label}</Chip> : <Chip>{e.resolved_by === 'superseded' ? 'superseded' : 'kept original'}</Chip>}</Td>
                  <Td className="text-xs capitalize">{e.resolved_by}</Td>
                  <Td className="text-right text-xs">{opt ? signedInr(opt.cost_delta) : '-'}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
