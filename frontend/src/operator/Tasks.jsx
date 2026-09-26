import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '../api'
import { Button, Card, Chip, Segmented, Spinner } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

const KIND = { cancel: ['Cancel', 'red'], confirm: ['Confirm', 'amber'], notify: ['Notify', 'blue'], callback: ['Call back', 'rani'], payment: ['Payment', 'green'] }

// Coordination queue: every vendor confirmation, cancellation, reschedule and traveler callback the system generated.
export default function Tasks() {
  const { tick, refresh } = useOps()
  const [status, setStatus] = useState('open')
  const [kind, setKind] = useState('all')
  const [tasks, setTasks] = useState(null)
  useEffect(() => { api.tasks(status).then(setTasks) }, [status, tick])
  if (!tasks) return <Spinner />
  const shown = tasks.filter((t) => kind === 'all' || t.kind === kind)
  return (
    <div>
      <PageHead title="Coordination" sub="Generated automatically from bookings and changes, so nothing falls between WhatsApp groups and phone calls.">
        <div className="flex flex-wrap gap-2">
          <div className="w-44"><Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }]} /></div>
          <div className="w-[26rem] max-w-full"><Segmented value={kind} onChange={setKind} options={[['all', 'All'], ...Object.entries(KIND).map(([k, [l]]) => [k, l])].map(([value, label]) => ({ value, label }))} /></div>
        </div>
      </PageHead>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Type</Th><Th>Task</Th><Th>Tour</Th><Th>Vendor</Th><Th>Created</Th><Th /></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {shown.length === 0 && <tr><Td colSpan={6} className="py-6 text-center text-stone-500">Nothing here.</Td></tr>}
            {shown.map((t) => (
              <tr key={t.id}>
                <Td><Chip tone={KIND[t.kind]?.[1]}>{KIND[t.kind]?.[0] || t.kind}</Chip></Td>
                <Td className="max-w-lg">{t.text}</Td>
                <Td>{t.tour_id && <Link to={`/operator/tours/${t.tour_id}`} className="font-semibold hover:underline">{t.tour_code}</Link>}</Td>
                <Td className="text-xs">{t.vendor_id ? <Link to={`/vendor/${t.vendor_id}`} className="hover:underline">{t.vendor_name}</Link> : '—'}</Td>
                <Td className="whitespace-nowrap text-xs">{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Td>
                <Td>{t.status === 'open' ? <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={async () => { await api.taskDone(t.id); refresh() }}><Check size={13} /> Done</Button> : <Check size={15} className="text-emerald-600" />}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
