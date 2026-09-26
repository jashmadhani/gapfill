import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, ChevronRight, Moon, Plane, Star, TrainFront } from 'lucide-react'
import { api, inr } from '../api'
import { destImage } from '../media'
import { Card, GlassIconButton, INTEREST, IOBadge, Photo, Spinner, TIER_LABEL } from '../components/ui'

export default function DestinationDetail() {
  const { key } = useParams()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  useEffect(() => { api.destination(key).then(setD) }, [key])
  if (!d) return <Spinner />

  const facts = [
    [Moon, `${d.ideal_nights}+ nights`],
    [CalendarDays, d.best_months],
    ...(d.airport ? [[Plane, 'Airport']] : []),
    ...(d.rail ? [[TrainFront, 'Rail']] : []),
  ]

  return (
    <div className="pb-4">
      <Photo src={destImage(d.key)} alt={d.name} scrim="both" className="md:mx-4 md:mt-4 md:rounded-[2rem]">
        <div className="pt-safe flex min-h-[26rem] flex-col px-4 pb-8 text-white md:min-h-[30rem] md:px-8">
          <div className="pt-3"><GlassIconButton label="Back" onClick={() => nav(-1)}><ArrowLeft size={20} /></GlassIconButton></div>
          <div className="mt-auto">
            <h1 className="font-display text-5xl leading-none md:text-6xl">{d.name}</h1>
            <p className="mt-2 max-w-md text-[15px] text-white/85">{d.tagline}</p>
          </div>
        </div>
      </Photo>

      <div className="relative -mt-5 space-y-5 rounded-t-[2rem] bg-sand-50 px-4 pt-5 md:mt-5 md:rounded-none md:px-6 md:pt-0">
        <ul className="flex flex-wrap gap-2" aria-label="Quick facts">
          {facts.map(([Icon, text]) => (
            <li key={text} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-stone-700 shadow-soft ring-1 ring-stone-200/70">
              <Icon size={15} className="text-rani-600" aria-hidden /> {text}
            </li>
          ))}
        </ul>

        <section>
          <h2 className="text-lg font-bold">About {d.name}</h2>
          <p className="mt-1.5 leading-relaxed text-stone-600">{d.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{d.tags.map((t) => <span key={t} className="rounded-full bg-rani-50 px-3 py-1 text-xs font-semibold text-rani-700">{INTEREST[t]?.label || t}</span>)}</div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Experiences <span className="font-medium text-stone-400">{d.experiences.length}</span></h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {d.experiences.map((e) => (
              <li key={e.id}>
                <Link to={`/experience/${e.id}`} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-stone-200/70 transition hover:ring-stone-300">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{e.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                      <span>{e.duration_min} min</span>
                      <span className="font-semibold text-stone-800">{inr(e.price)}</span>
                      <span className="inline-flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />{(e.rating ?? 0).toFixed(1)}</span>
                      <IOBadge io={e.indoor_outdoor} />
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Where you could stay</h2>
          <Card className="divide-y divide-stone-100">
            {d.hotels.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rani-50 text-rani-600"><BedDouble size={18} aria-hidden /></span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{h.title}</div>
                    <div className="truncate text-sm text-stone-500">{TIER_LABEL[h.tier]} · {h.amenities.slice(0, 3).join(', ')}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">{inr(h.price)}</div>
                  <div className="text-xs text-stone-500">per night</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>

      {/* Sticky primary action (reference: "Book now" bar) */}
      <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-20 mt-4 px-4 md:px-6">
        <Link to={`/personalize?dest=${d.key}`}
          className="glass flex min-h-14 items-center justify-between rounded-full py-1.5 pl-5 pr-1.5 shadow-float ring-1 ring-white/70">
          <span className="text-sm text-stone-600">Start with <b className="text-stone-900">{d.name}</b></span>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rani-600 px-5 text-sm font-semibold text-white">Build my tour <ArrowRight size={16} aria-hidden /></span>
        </Link>
      </div>
    </div>
  )
}
