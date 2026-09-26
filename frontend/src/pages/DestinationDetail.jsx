import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BedDouble, CalendarDays, ChevronRight, MapPin, Moon, Plane, Sparkles, Star, TrainFront } from 'lucide-react'
import { api, inr } from '../api'
import { destImage } from '../media'
import { useSaved } from '../lib/saved'
import { PageBody, PageHero } from '../components/page'
import { INTEREST, IOBadge, Spinner, TIER_LABEL, cx } from '../components/ui'

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={cx('-mb-px min-h-12 shrink-0 border-b-2 px-4 text-[15px] font-semibold transition', value === k ? 'border-rani-600 text-ink' : 'border-transparent text-stone-500 hover:text-ink')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Feature({ Icon, label, sub }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[1.2rem] bg-white px-2 py-3.5 text-center shadow-soft">
      <Icon size={22} className="text-rani-600" aria-hidden />
      <span className="text-sm font-bold text-ink">{label}</span>
      {sub && <span className="text-xs text-stone-500">{sub}</span>}
    </div>
  )
}

// Price + primary action: a sticky bottom bar on phones, a floating card on the web.
export function BookBar({ price, unit, action }) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-stone-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p><span className="text-2xl font-bold text-ink">{price}</span> <span className="text-[15px] text-stone-600">{unit}</span></p>
          {action}
        </div>
      </div>
      <div className="hidden rounded-[1.8rem] bg-white p-6 shadow-float lg:block">
        <p><span className="text-3xl font-bold text-ink">{price}</span> <span className="text-stone-600">{unit}</span></p>
        <div className="mt-4 [&>*]:w-full">{action}</div>
      </div>
    </>
  )
}

export default function DestinationDetail() {
  const { key } = useParams()
  const [d, setD] = useState(null)
  const [tab, setTab] = useState('overview')
  const { isSaved, toggle } = useSaved()
  useEffect(() => { api.destination(key).then(setD) }, [key])
  if (!d) return <Spinner />

  const from = Math.min(...d.hotels.map((h) => h.price))
  const avg = d.experiences.length ? d.experiences.reduce((s, e) => s + e.rating, 0) / d.experiences.length : 0
  const share = () => navigator.share?.({ title: d.name, url: location.href }).catch(() => {})
  const cta = <Link to={`/personalize?dest=${d.key}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rani-600 px-6 text-[16px] font-bold text-white hover:bg-rani-700">Build my trip <ArrowRight size={18} aria-hidden /></Link>

  return (
    <div className="pb-24 lg:pb-0">
      <PageHero size="tall" back save={{ saved: isSaved(`d:${d.key}`), onSave: () => toggle(`d:${d.key}`), onShare: share }} img={destImage(d.key)} title={d.name}>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/90">
          <span className="inline-flex items-center gap-1"><MapPin size={15} aria-hidden /> {d.region}</span>
          <span className="inline-flex items-center gap-1"><Moon size={15} aria-hidden /> {d.ideal_nights}+ nights</span>
          <span className="inline-flex items-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden /> {avg.toFixed(1)} ({d.experiences.length} experiences)</span>
        </p>
      </PageHero>

      <PageBody>
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10 [&>*]:min-w-0">
          <div className="space-y-6">
            <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['experiences', 'Experiences'], ['stays', 'Stays']]} />

            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-4 gap-2.5">
                  <Feature Icon={Moon} label={`${d.ideal_nights}+ nights`} sub="ideal stay" />
                  <Feature Icon={CalendarDays} label={d.best_months} sub="best time" />
                  <Feature Icon={Plane} label={d.airport ? 'Airport' : 'No airport'} sub="fly in" />
                  <Feature Icon={TrainFront} label={d.rail ? 'Railway' : 'No rail'} sub="by train" />
                </div>
                <section>
                  <h2 className="text-xl font-bold text-ink">About {d.name}</h2>
                  <p className="mt-2 text-[16px] leading-relaxed text-stone-700">{d.tagline}. {d.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{d.tags.map((t) => <span key={t} className="rounded-full bg-rani-50 px-3 py-1.5 text-sm font-semibold text-rani-700">{INTEREST[t]?.label || t}</span>)}</div>
                </section>
                <section>
                  <div className="flex items-end justify-between"><h2 className="text-xl font-bold text-ink">Top experiences</h2>
                    <button type="button" onClick={() => setTab('experiences')} className="min-h-11 text-[15px] font-semibold text-stone-600">View all</button></div>
                  <ul className="mt-2 space-y-3">{d.experiences.slice(0, 3).map((e) => <ExpItem key={e.id} e={e} />)}</ul>
                </section>
              </>
            )}
            {tab === 'experiences' && <ul className="space-y-3">{d.experiences.map((e) => <ExpItem key={e.id} e={e} />)}</ul>}
            {tab === 'stays' && (
              <ul className="space-y-3">
                {d.hotels.map((h) => (
                  <li key={h.id} className="flex items-center gap-3.5 rounded-[1.4rem] bg-white p-4 shadow-soft">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white"><BedDouble size={20} aria-hidden /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-bold text-ink">{h.title}</span>
                      <span className="block truncate text-sm text-stone-600">{TIER_LABEL[h.tier]} · {h.amenities.slice(0, 3).join(', ')}</span></span>
                    <span className="shrink-0 text-right"><span className="block font-bold text-ink">{inr(h.price)}</span><span className="text-xs text-stone-500">per night</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookBar price={inr(from)} unit="/ night stays from" action={cta} />
          </aside>
        </div>
      </PageBody>
    </div>
  )
}

function ExpItem({ e }) {
  return (
    <li>
      <Link to={`/experience/${e.id}`} className="flex items-center gap-3.5 rounded-[1.4rem] bg-white p-2.5 pr-3 shadow-soft">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-rani-50 text-rani-600"><Sparkles size={22} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold text-ink">{e.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-stone-600">{e.duration_min} min · {e.price ? inr(e.price) : 'Free'} <IOBadge io={e.indoor_outdoor} /></span>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700"><Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />{e.rating.toFixed(1)}</span>
        <ChevronRight size={18} className="text-stone-400" aria-hidden />
      </Link>
    </li>
  )
}
