import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BedDouble, ChevronRight, Clock, Plane, TrainFront } from 'lucide-react'
import { api, inr } from '../api'
import { Button, Card, Chip, INTEREST, IOBadge, Rating, Spinner, TIER_LABEL } from '../components/ui'

export default function DestinationDetail() {
  const { key } = useParams()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  useEffect(() => { api.destination(key).then(setD) }, [key])
  if (!d) return <Spinner />
  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-rani-600 to-rani-900 px-4 pt-4 pb-6 text-white">
        <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-rani-100"><ArrowLeft size={16} /> Back</button>
        <div className="flex flex-wrap gap-1.5">{d.tags.map((t) => <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{INTEREST[t]?.label || t}</span>)}</div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{d.name}</h1>
        <p className="mt-1 text-sm text-rani-100">{d.tagline}</p>
      </div>
      <div className="-mt-3 space-y-3 px-4">
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-stone-700">{d.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip><Clock size={12} /> {d.ideal_nights}+ nights ideal</Chip>
            <Chip>Best {d.best_months}</Chip>
            {d.airport && <Chip tone="blue"><Plane size={12} /> Airport</Chip>}
            {d.rail && <Chip tone="blue"><TrainFront size={12} /> Rail</Chip>}
          </div>
        </Card>
        <Link to={`/personalize?dest=${d.key}`}><Button className="w-full">Build a tour with {d.name}</Button></Link>

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Experiences ({d.experiences.length})</div>
        {d.experiences.map((e) => (
          <Link key={e.id} to={`/experience/${e.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{e.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span>{e.duration_min} min · {inr(e.price)}</span><Rating value={e.rating} count={e.rating_count} className="text-xs" /><IOBadge io={e.indoor_outdoor} />
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-stone-400" />
          </Link>
        ))}

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Stays</div>
        <Card className="divide-y divide-stone-100">
          {d.hotels.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <BedDouble size={16} className="shrink-0 text-stone-400" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{h.title}</div>
                  <div className="text-xs text-stone-500">{TIER_LABEL[h.tier]} · {h.amenities.slice(0, 3).join(', ')}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">{inr(h.price)}</div>
                <div className="text-[10px] text-stone-500">room / night</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
