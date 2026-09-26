import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, inr } from '../api'
import { Card, Chip, Segmented, Spinner, cx } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

// Supplier network: hotels, transport and activity partners with live status, load and pending confirmations.
export default function Vendors() {
  const { tick, refresh } = useOps()
  const [kind, setKind] = useState('all')
  const [vs, setVs] = useState(null)
  const [busy, setBusy] = useState(null)
  useEffect(() => { api.vendors().then(setVs) }, [tick])
  if (!vs) return <Spinner />
  const shown = vs.filter((v) => kind === 'all' || v.kind === kind)
  const toggle = async (v) => {
    setBusy(v.id)
    const r = await api.vendorStatus(v.id, { status: v.status === 'open' ? 'closed' : 'open' })
    if (r.events) alert(`${r.events} tour(s) affected, replanning options sent to travelers and the Changes queue.`)
    setBusy(null); refresh()
  }
  return (
    <div>
      <PageHead title="Vendors" sub={`${vs.length} partners · ${vs.reduce((a, v) => a + v.pending, 0)} bookings awaiting confirmation`}>
        <div className="w-96 max-w-full"><Segmented value={kind} onChange={setKind} options={[['all', 'All'], ['hotel', 'Hotels'], ['transport', 'Transport'], ['activity', 'Experiences']].map(([value, label]) => ({ value, label }))} /></div>
      </PageHead>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Vendor</Th><Th>Type</Th><Th>Base</Th><Th>Rating</Th><Th className="text-right">Active bookings</Th><Th className="text-right">Booked value</Th><Th>Confirmations</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {shown.map((v) => (
              <tr key={v.id} className="hover:bg-stone-50">
                <Td><Link to={`/vendor/${v.id}`} className="font-semibold hover:underline">{v.name}</Link><div className="text-xs text-stone-500">{v.phone} · {v.offerings} listing(s)</div></Td>
                <Td className="text-xs capitalize">{v.kind}</Td>
                <Td className="text-xs">{v.dest_name}</Td>
                <Td>{v.rating ? `${v.rating.toFixed(1)}★` : '-'}</Td>
                <Td className="text-right">{v.bookings}</Td>
                <Td className="text-right">{inr(v.revenue)}</Td>
                <Td>{v.pending ? <Chip tone="amber">{v.pending} pending</Chip> : v.bookings ? <Chip tone="green">all confirmed</Chip> : <span className="text-xs text-stone-400">-</span>}</Td>
                <Td>
                  <button disabled={busy === v.id} onClick={() => toggle(v)} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold text-white', v.status === 'open' ? 'bg-emerald-600' : 'bg-stone-500')}>
                    {v.status === 'open' ? 'Open' : 'Closed'}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
