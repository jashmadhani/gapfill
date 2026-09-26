import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { api, inr } from '../api'
import { Card, Chip, INTEREST, STAGE_CHIP, Spinner } from '../components/ui'
import { PageHead, Td, Th, useOps } from './OperatorApp'

const TourChips = ({ tours }) => (
  <div className="flex flex-wrap gap-1">{tours.map((t) => <Link key={t.id} to={`/operator/tours/${t.id}`}><Chip tone={STAGE_CHIP[t.stage]?.[1]}>{t.code}</Chip></Link>)}</div>
)

export default function People() {
  const { tick } = useOps()
  const [d, setD] = useState(null)
  useEffect(() => { api.people().then(setD) }, [tick])
  if (!d) return <Spinner />
  return (
    <div>
      <PageHead title="Customers & team" sub="Customers, tour groups and the coordinators who run them on the ground." />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Tour coordinators</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {d.coordinators.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between">
              <div><div className="font-semibold">{c.name}</div><div className="text-xs text-stone-500">Based in {c.base} · {c.languages.join(', ')}</div></div>
              <a href={`tel:${c.phone}`} className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white" aria-label="Call"><Phone size={14} /></a>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-stone-600"><span><b>{c.tours.length}</b> active tours</span><span><b>{c.on_tour_now}</b> on the road</span><span><b>{c.open_tasks}</b> open tasks</span></div>
            <div className="mt-2"><TourChips tours={c.tours} /></div>
          </Card>
        ))}
      </div>

      <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Customers</div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Customer</Th><Th>Segment</Th><Th>Interests</Th><Th>Tours</Th><Th className="text-right">Lifetime value</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {d.customers.map((c) => (
              <tr key={c.id}>
                <Td><div className="font-semibold">{c.name}</div><div className="text-xs text-stone-500">{c.email} · {c.phone} · {c.city}</div></Td>
                <Td className="text-xs capitalize">{c.segment}</Td>
                <Td><div className="flex flex-wrap gap-1">{c.interests.map((i) => <Chip key={i}>{INTEREST[i]?.label || i}</Chip>)}</div></Td>
                <Td><TourChips tours={c.tours} /></Td>
                <Td className="text-right font-semibold">{inr(c.lifetime_value)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Tour groups</div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-stone-100"><tr><Th>Tour</Th><Th>Group</Th><Th>Size</Th><Th>Members</Th><Th>Stage</Th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {d.groups.map((g) => (
              <tr key={g.tour_id}>
                <Td><Link to={`/operator/tours/${g.tour_id}`} className="font-semibold hover:underline">{g.code}</Link><div className="text-xs text-stone-500">{g.title}</div></Td>
                <Td>{g.name}</Td>
                <Td className="text-xs">{g.adults} adults{g.children ? ` · ${g.children} children` : ''}</Td>
                <Td className="text-xs text-stone-600">{g.members?.join(', ')}</Td>
                <Td><Chip tone={STAGE_CHIP[g.stage]?.[1]}>{STAGE_CHIP[g.stage]?.[0]}</Chip></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
