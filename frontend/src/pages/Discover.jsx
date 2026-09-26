import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock, Heart, MapPin, Moon, Plane, Sparkles, Star } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { destImage } from '../media'
import { useSaved } from '../lib/saved'
import { PageBody, PageHero, SearchPill, SectionHead } from '../components/page'
import CoverflowCarousel from '../components/CoverflowCarousel'
import { INTEREST, Photo, TOP_INTERESTS, cx } from '../components/ui'

const hours = (m) => (m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`)

// Tall photo card (reference: "Popular destinations")
function DestCard({ d }) {
  return (
    <Link to={`/destination/${d.key}`} className="block">
      <Photo src={destImage(d.key)} alt={d.name} className="aspect-[3/4] rounded-[1.6rem] shadow-soft">
        <div className="flex h-full flex-col justify-end p-3.5 text-white">
          <p className="font-serif-display text-[1.35rem] leading-tight">{d.name}</p>
          <p className="text-sm text-white/85">{d.region}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold"><Sparkles size={13} aria-hidden /> {d.experiences} experiences</p>
        </div>
      </Photo>
    </Link>
  )
}

// List row (reference: "Best experiences for you")
function ExpRow({ e, saved, onSave }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[1.4rem] bg-white p-2.5 pr-2 shadow-soft">
      <Link to={`/experience/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
        <Photo src={destImage(e.dest_key)} scrim={false} className="h-[5.2rem] w-[6.2rem] shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate h3-title text-ink">{e.title}</span>
          <span className="mt-0.5 block truncate text-sm text-stone-600">{hours(e.duration_min)} · {e.dest_name}</span>
          <span className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[16px] font-bold text-ink">{e.price ? inr(e.price) : 'Free'}</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700"><Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />{(e.rating ?? 0).toFixed(1)}</span>
          </span>
        </span>
      </Link>
      <button type="button" onClick={() => onSave(e.id)} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100">
        <Heart size={19} className={saved ? 'fill-rose-500 text-rose-500' : ''} />
      </button>
    </li>
  )
}

export default function Discover() {
  const { tour, state } = useTour()
  const nav = useNavigate()
  const [interests, setInterests] = useState(null)
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [allDest, setAllDest] = useState(false)
  const { isSaved, toggle: toggleSave } = useSaved()

  useEffect(() => { if (interests === null && state) setInterests(tour?.prefs?.interests || ['heritage', 'food']) }, [state, tour?.id]) // eslint-disable-line
  useEffect(() => { if (interests) api.discover(interests).then(setData) }, [interests])

  const first = tour?.customer?.name?.split(' ')[0]
  const heroKey = tour?.days_detail?.[(tour.current_day || 1) - 1]?.dest || tour?.route?.[0]?.dest || 'udaipur'

  const exps = useMemo(() => {
    const list = data?.experiences || []
    const t = q.trim().toLowerCase()
    return list.filter((e) => (cat === 'all' || e.tags?.includes(cat)) && (!t || `${e.title} ${e.dest_name}`.toLowerCase().includes(t)))
  }, [data, q, cat])
  const hero = exps[0]
  const rest = exps.slice(1, showAll ? 12 : 5)
  const onTour = tour?.stage === 'operate'

  return (
    <div>
      <PageHero size="lg" img={destImage(heroKey)} eyebrow={first ? `Hi ${first}` : 'TourCraft'} title={<>Go beyond<br />the itinerary.</>}
        subtitle="Tours built around your group, that keep themselves on track while you travel.">
        <div className="mt-6 max-w-xl">
          <SearchPill dark value={q} onChange={setQ} onSubmit={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })}
            trailing={<button type="button" onClick={() => nav('/personalize')} aria-label="Plan a trip" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rani-600 text-white"><ArrowRight size={19} /></button>} />
        </div>
      </PageHero>

      <PageBody>
        <div className="space-y-9">
          {tour && (
            <Link to={tour.stage === 'plan' ? '/plan' : tour.stage === 'complete' ? '/review' : '/trip'}
              className="flex items-center gap-4 rounded-[1.6rem] bg-ink p-3 pr-5 text-white shadow-float">
              <Photo src={destImage(heroKey)} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-rani-200">{onTour ? `On tour · day ${tour.current_day} of ${tour.days}` : tour.stage === 'plan' ? 'Draft trip' : 'Your next trip'}</span>
                <span className="block truncate text-lg font-bold">{tour.title}</span>
              </span>
              <ArrowRight size={20} aria-hidden />
            </Link>
          )}

          <section aria-label="Popular destinations">
            <SectionHead title="Popular destinations" action={allDest ? 'Show less' : 'View all'} onAction={() => setAllDest((v) => !v)} />
            {!data ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-[1.6rem] bg-stone-200" />)}</div> : (
              <>
                <div className="md:hidden">
                  <CoverflowCarousel
                    slides={data.destinations.slice(0, allDest ? 12 : 8).map((d) => ({
                      key: d.key,
                      src: destImage(d.key),
                      alt: d.name,
                      title: d.name,
                      subtitle: `${d.region} · ${d.experiences} experiences`,
                      onSelect: () => nav(`/destination/${d.key}`),
                    }))}
                  />
                </div>
                <ul className="hidden gap-3 md:grid md:grid-cols-4">
                  {data.destinations.slice(0, allDest ? 12 : 8).map((d) => <li key={d.key}><DestCard d={d} /></li>)}
                </ul>
              </>
            )}
          </section>

          <section id="explore" aria-labelledby="exp-h" className="scroll-mt-20">
            <h2 id="exp-h" className="sr-only">Explore</h2>
            <div className="lg:flex lg:items-center lg:gap-4">
              <div className="lg:w-[26rem]"><SearchPill value={q} onChange={setQ} placeholder="Search destinations, tours…" /></div>
              <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-0 lg:px-0" role="group" aria-label="Categories">
                {['all', ...TOP_INTERESTS].map((k) => (
                  <button key={k} type="button" onClick={() => setCat(k)} aria-pressed={cat === k}
                    className={cx('min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition', cat === k ? 'bg-rani-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:text-ink')}>
                    {k === 'all' ? 'All' : INTEREST[k].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start [&>*]:min-w-0">
              {hero ? (
                <Link to={`/experience/${hero.id}`} className="block">
                  <Photo src={destImage(hero.dest_key)} alt={hero.title} className="aspect-[4/3.3] rounded-[1.9rem] shadow-float lg:aspect-[4/3.6]">
                    <div className="flex h-full flex-col justify-between p-5 text-white">
                      <div className="flex justify-end">
                        <button type="button" onClick={(e) => { e.preventDefault(); toggleSave(hero.id) }} aria-label="Save" className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                          <Heart size={19} className={isSaved(hero.id) ? 'fill-rose-500 text-rose-500' : ''} />
                        </button>
                      </div>
                      <div>
                        <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"><Sparkles size={14} aria-hidden /> Recommended</span>
                        <p className="font-serif-display mt-2 text-[2rem] leading-[1.05] md:text-4xl">{hero.title}</p>
                        <p className="mt-1 text-[15px] text-white/85">{hero.dest_name}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-semibold">
                          <span className="inline-flex items-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden />{hero.rating.toFixed(1)} ({hero.rating_count})</span>
                          <span className="inline-flex items-center gap-1"><Clock size={15} aria-hidden />{hours(hero.duration_min)}</span>
                          <span>From {hero.price ? inr(hero.price) : 'free'}</span>
                        </p>
                      </div>
                    </div>
                  </Photo>
                </Link>
              ) : <div className="rounded-[1.9rem] bg-white p-8 text-center text-stone-600 shadow-soft">{data ? 'Nothing matches that search yet.' : 'Loading…'}</div>}

              <div>
                <SectionHead title="Best experiences for you" action={exps.length > 5 ? (showAll ? 'Show less' : 'View all') : null} onAction={() => setShowAll((s) => !s)} />
                <ul className="space-y-3">{rest.map((e) => <ExpRow key={e.id} e={e} saved={isSaved(e.id)} onSave={toggleSave} />)}</ul>
              </div>
            </div>
          </section>

          {!tour && (
            <Link to="/personalize" className="flex items-center gap-4 rounded-[1.6rem] bg-white p-5 shadow-soft">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-rani-50 text-rani-600"><Plane size={22} aria-hidden /></span>
              <span className="flex-1"><span className="block text-lg font-bold text-ink">Plan your trip in 4 taps</span><span className="text-[15px] text-stone-600">Dates, who’s coming, what you love. We do the rest.</span></span>
              <ArrowRight size={20} aria-hidden />
            </Link>
          )}
          <p className="flex flex-wrap justify-center gap-x-4 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> Rajasthan & the Golden Triangle</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden /> Best Oct to Mar</span>
            <span className="inline-flex items-center gap-1"><Moon size={14} aria-hidden /> 12 cities</span>
          </p>
        </div>
      </PageBody>
    </div>
  )
}
