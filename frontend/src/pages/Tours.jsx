import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MonitorPlay, Store } from 'lucide-react'
import { api, fmtDate } from '../api'
import { useTour } from '../store'
import { Card, Chip, STAGE_CHIP, Spinner, cx } from '../components/ui'

// Demo switcher: view the traveler app as any customer, or jump to the operator / vendor surfaces.
export default function Tours() {
  const { tour, activate } = useTour()
  const nav = useNavigate()
  const [tours, setTours] = useState(null)
  useEffect(() => { api.tours().then(setTours) }, [])
  const open = async (t) => { await activate(t.id); nav(t.stage === 'plan' ? '/plan' : t.stage === 'complete' ? '/review' : '/trip') }
  return (
    <div className="px-4 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">Tours</h1>
      <p className="text-sm text-stone-500">Open the traveler app as any customer — each tour is at a different lifecycle stage.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Link to="/operator" className="flex items-center justify-center gap-1 rounded-lg bg-white p-2 ring-1 ring-stone-200"><LayoutDashboard size={14} /> Operator</Link>
        <Link to="/vendor/1" className="flex items-center justify-center gap-1 rounded-lg bg-white p-2 ring-1 ring-stone-200"><Store size={14} /> Vendor</Link>
        <Link to="/ops" className="flex items-center justify-center gap-1 rounded-lg bg-white p-2 ring-1 ring-stone-200"><MonitorPlay size={14} /> Live Ops</Link>
      </div>
      {!tours ? <Spinner /> : (
        <div className="mt-4 space-y-2">
          {tours.map((t) => {
            const [label, tone] = STAGE_CHIP[t.stage] || []
            return (
              <button key={t.id} onClick={() => open(t)} className="w-full text-left">
                <Card className={cx('p-3', tour?.id === t.id && 'ring-2 ring-rani-500')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-stone-500">{t.code} · {t.customer.name}</div>
                    <Chip tone={tone}>{label}</Chip>
                  </div>
                  <div className="mt-0.5 font-semibold">{t.title}</div>
                  <div className="text-xs text-stone-500">{fmtDate(t.start_date)} – {fmtDate(t.end_date)} · {t.route.map((r) => r.name).join(' → ')} · {t.travelers} pax</div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
