import { useEffect, useState } from 'react'
import { Bot, Lock, ShieldCheck } from 'lucide-react'
import { api, inr } from '../api'
import { Card, Chip, Segmented, Spinner } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

const STATUS_TONE = { proposed: 'amber', awaiting_payment: 'blue', executed: 'green', declined: 'stone', cancelled: 'stone', expired: 'stone', stale: 'amber', failed: 'red' }
const OUTCOME_TONE = { ok: 'green', blocked: 'red', error: 'amber' }
const KIND_TONE = { read: 'stone', action: 'blue', propose: 'amber' }

function detailText(d) {
  if (!d) return ''
  if (d.text) return `“${d.text}”${d.redacted?.length ? ` · removed: ${d.redacted.join(', ')}` : ''}`
  if (d.title) return `${d.title}${d.amount != null ? ` · ${inr(d.amount)}` : ''}${d.refund ? ` · refund ${inr(d.refund)}` : ''}`
  if (d.reason) return d.reason
  if (d.args) return `${JSON.stringify(d.args)} → ${d.result || ''}`.slice(0, 180)
  return JSON.stringify(d).slice(0, 180)
}

// Oversight for the booking agent: every payment request and every tool call, including blocked attempts.
export default function AgentAudit() {
  const { tick } = useOps()
  const [d, setD] = useState(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { api.agentAudit().then(setD) }, [tick])
  if (!d) return <Spinner />
  const log = d.log.filter((l) => filter === 'all' || (filter === 'blocked' ? l.outcome !== 'ok' : l.actor === filter))
  const paid = d.intents.filter((i) => i.status === 'executed').reduce((a, i) => a + i.amount, 0)
  return (
    <div>
      <PageHead title="Booking agent & payments" sub={`Model: ${d.agent.model} · every payment needs the traveler’s own approval`} />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 font-bold"><Lock size={16} className="text-rani-600" /> Guardrails</div>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            <li>• Agent can only <b>propose</b> payments — no tool approves, pays or refunds</li>
            <li>• Traveler approves the exact amount; plan + price locked by hash, 15-minute expiry</li>
            <li>• Card / UPI / OTP entered only on the provider’s page; secrets stripped from chat</li>
            <li>• {d.agent.limits.tool_calls_per_message} tool calls and {d.agent.limits.proposals_per_message} proposals per message, hard spend ceiling</li>
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 font-bold"><Bot size={16} className="text-rani-600" /> Agent tools ({d.agent.tools.length})</div>
          <div className="mt-2 flex flex-wrap gap-1">{d.agent.tools.map((t) => <Chip key={t.name} tone={KIND_TONE[t.kind]}>{t.name}</Chip>)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 font-bold"><ShieldCheck size={16} className="text-emerald-600" /> Activity</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold">{d.intents.length}</div><div className="text-xs text-stone-500">requests</div></div>
            <div><div className="text-2xl font-bold">{inr(paid)}</div><div className="text-xs text-stone-500">approved & paid</div></div>
            <div><div className="text-2xl font-bold text-red-600">{d.log.filter((l) => l.outcome === 'blocked').length}</div><div className="text-xs text-stone-500">blocked</div></div>
          </div>
        </Card>
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Payment requests</div>
      <Card className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>When</Th><Th>Tour</Th><Th>Request</Th><Th>Prepared by</Th><Th className="text-right">Pay</Th><Th className="text-right">Refund</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {d.intents.length === 0 && <tr><Td colSpan={7} className="py-6 text-center text-stone-500">No payment requests yet.</Td></tr>}
            {d.intents.map((i) => (
              <tr key={i.id}>
                <Td className="whitespace-nowrap text-xs">{new Date(i.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Td>
                <Td className="font-semibold">{i.tour_code}</Td>
                <Td>{i.summary.title}<div className="font-mono text-xs text-stone-400">{i.id}</div></Td>
                <Td className="text-xs capitalize">{i.created_by}</Td>
                <Td className="text-right">{i.amount ? inr(i.amount) : '-'}</Td>
                <Td className="text-right">{i.refund ? inr(i.refund) : '-'}</Td>
                <Td><Chip tone={STATUS_TONE[i.status]}>{i.status.replace('_', ' ')}</Chip>{i.error && <div className="mt-0.5 max-w-xs text-xs text-stone-500">{i.error}</div>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Audit log</div>
        <div className="w-96 max-w-full"><Segmented value={filter} onChange={setFilter} options={[['all', 'All'], ['agent', 'Agent'], ['traveler', 'Traveler'], ['blocked', 'Blocked / errors']].map(([value, label]) => ({ value, label }))} /></div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>When</Th><Th>Tour</Th><Th>Actor</Th><Th>Action</Th><Th>Detail</Th><Th>Outcome</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {log.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-xs">{new Date(l.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</Td>
                <Td className="text-xs">{l.tour_code}</Td>
                <Td className="text-xs capitalize">{l.actor}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="max-w-md text-xs text-stone-600">{detailText(l.detail)}</Td>
                <Td><Chip tone={OUTCOME_TONE[l.outcome]}>{l.outcome}</Chip></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
