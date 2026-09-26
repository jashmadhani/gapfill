import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, Clock, CloudRain, MapPin, Moon, Search, SlidersHorizontal, Sparkles, Star, Sun } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { destImage } from '../media'
import { buildTripMap } from '../lib/tripMap'
import Coverflow from '../components/Coverflow'
import { INTEREST, InterestPicker, Photo, Sheet, TOP_INTERESTS, cx } from '../components/ui'

// The map engine is large (~1 MB); load it separately so the rest of the app opens fast on phones.
const RouteMap = lazy(() => import('../components/RouteMap'))

const STATUS = { done: ['Visited', 'bg-green-600 text-white'], current: ['You’re here', 'bg-white text-ink'], next: ['Coming up', 'glass text-ink'], changed: ['Plan changed', 'bg-orange-600 text-white'] }
const LEGEND = [['bg-green-600', 'Visited'], ['bg-rani-600', 'Now'], ['border-2 border-dashed border-rani-500', 'Ahead'], ['bg-orange-600', 'Changed']]

function StatChip({ Icon, children }) {
  return <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white"><Icon size={15} aria-hidden /> {children}</span>
}

// Big story card used in the carousel.
function StoryCard({ to, img, eyebrow, title, chips, badge, active }) {
  return (
    <Link to={to} tabIndex={active ? 0 : -1} className="block">
      <Photo src={img} alt={title} scrim="both" className="h-[25rem] rounded-[2.25rem] shadow-float">
        <div className="flex h-full flex-col justify-between p-5 text-white">
          <div className="flex items-start justify-between gap-2">
            {badge ? <span className={cx('rounded-full px-3 py-1.5 text-sm font-bold', badge[1])}>{badge[0]}</span> : <span />}
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink"><ArrowUpRight size={20} aria-hidden /></span>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/80">{eyebrow}</p>
            <h3 className="mt-1 text-[2rem] font-bold leading-[1.05]">{title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{chips}</div>
          </div>
        </div>
      </Photo>
    </Link>
  )
}

export default function Discover() {
  const { tour, state, events } = useTour()
  const [interests, setInterests] = useState(null)
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [tuning, setTuning] = useState(false)

  useEffect(() => { if (interests === null && state) setInterests(tour?.prefs?.interests || ['heritage', 'food']) }, [state, tour?.id]) // eslint-disable-line
  useEffect(() => { if (interests) api.discover(interests).then(setData) }, [interests])
  const toggle = (k) => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const onSelect = useCallback((s) => setSelected(s), [])

  const cities = useMemo(() => Object.fromEntries((state?.destinations || []).map((d) => [d.key, d])), [state])
  const model = useMemo(() => buildTripMap({ tour, state, cities, events }), [tour, state, cities, events])
  const suggestions = useMemo(() => (tour ? [] : (data?.destinations || []).slice(0, 6).map((d) => ({ ...d, ...cities[d.key] }))), [tour, data, cities])

  const onTour = tour?.stage === 'operate'
  const first = tour?.customer?.name?.split(' ')[0] || 'traveler'
  const curDest = onTour ? tour.days_detail[tour.current_day - 1]?.dest : null
  const rainy = (state?.rain || []).some((r) => !curDest || r.dest === curDest)
  const next = onTour ? model.today.find((a) => a.status === 'current') || model.today.find((a) => a.status === 'next') : null

  // Carousel: the tour's stops as a story, or the best destinations when there's no tour yet.
  const slides = tour
    ? model.stops.map((s) => ({ key: s.key, to: `/destination/${s.key}`, img: destImage(s.key), eyebrow: `Stop ${s.order} · day ${s.first_day}`, title: s.name,
      badge: STATUS[s.changed && s.status !== 'done' ? 'changed' : s.status], select: { type: 'city', key: s.key },
      chips: [<StatChip key="n" Icon={Moon}>{s.nights} night{s.nights === 1 ? '' : 's'}</StatChip>, <StatChip key="a" Icon={Sparkles}>{s.activities} plans</StatChip>] }))
    : suggestions.map((d, i) => ({ key: d.key, to: `/destination/${d.key}`, img: destImage(d.key), eyebrow: d.region, title: d.name,
      badge: i === 0 ? ['Top match', 'bg-white text-ink'] : null, select: { type: 'suggestion', key: d.key },
      chips: [<StatChip key="n" Icon={Moon}>{d.ideal_nights}+ nights</StatChip>, <StatChip key="m" Icon={CalendarDays}>{d.best_months}</StatChip>] }))

  const selStop = selected?.type === 'city' ? model.stops.find((s) => s.key === selected.key) : null
  const selAct = selected?.type === 'activity' ? model.today.find((a) => a.id === selected.id) : null
  const selSug = selected?.type === 'suggestion' ? suggestions.find((d) => d.key === selected.key) : null
  const chipKeys = interests ? [...new Set([...TOP_INTERESTS, ...interests])].slice(0, 7) : TOP_INTERESTS

  return (
    <div className="pt-safe space-y-7 pb-4">
      {/* Greeting + weather (reference: "Hi, Morgan") */}
      <header className="flex items-center justify-between px-5 pt-5 md:px-6">
        <p className="text-xl font-semibold text-stone-800">Hi, {first}</p>
        <span className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-soft">
          <span className={cx('grid h-9 w-9 place-items-center rounded-full', rainy ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-500')}>
            {rainy ? <CloudRain size={19} aria-hidden /> : <Sun size={19} aria-hidden />}
          </span>
          <span className="text-sm font-bold text-ink">{rainy ? 'Rain today' : 'Clear skies'}</span>
        </span>
      </header>

      <section className="flex items-end justify-between gap-4 px-5 md:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-rani-600">
            <MapPin size={15} aria-hidden /> {onTour ? `Day ${tour.current_day} of ${tour.days} · ${tour.days_detail[tour.current_day - 1].dest_name}` : tour ? tour.route.map((r) => r.name).join(' · ') : 'Rajasthan & the Golden Triangle'}
          </p>
          <h1 className="mt-1.5 text-[2.25rem] font-extrabold leading-[1.04] text-ink md:text-5xl">{tour ? tour.title : 'Where to next?'}</h1>
        </div>
        <Link to="/personalize" aria-label="Plan a new trip" className="grid h-20 w-14 shrink-0 place-items-center rounded-full bg-white text-ink shadow-soft transition hover:bg-stone-50">
          <Search size={22} aria-hidden />
        </Link>
      </section>

      {/* Interests: dark = selected (reference chips) */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 md:px-6" role="group" aria-label="Your interests">
        {chipKeys.map((k) => {
          const { label, Icon } = INTEREST[k]
          const on = interests?.includes(k)
          return (
            <button type="button" key={k} onClick={() => toggle(k)} aria-pressed={!!on}
              className={cx('inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition',
                on ? 'bg-ink text-white' : 'bg-white text-stone-700 shadow-soft hover:text-ink')}>
              <Icon size={18} aria-hidden /> {label}
            </button>
          )
        })}
        <button type="button" onClick={() => setTuning(true)} aria-label="More interests" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-ink shadow-soft">
          <SlidersHorizontal size={18} aria-hidden />
        </button>
      </div>

      {/* Story carousel */}
      <section aria-labelledby="stops-h">
        <div className="mb-1 flex items-end justify-between px-5 md:px-6">
          <h2 id="stops-h" className="text-2xl font-bold text-ink">{tour ? 'Your story so far' : 'Popular for you'}</h2>
          {tour && <Link to="/plan" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-rani-600">Full plan <ArrowRight size={16} aria-hidden /></Link>}
        </div>
        {!slides.length ? <div className="mx-auto h-[25rem] w-[min(76vw,320px)] animate-pulse rounded-[2.25rem] bg-stone-200" aria-hidden />
          : <Coverflow items={slides} label={tour ? 'Tour stops' : 'Destinations'} onActiveChange={(i) => slides[i] && setSelected(slides[i].select)}
            render={(s, on) => <StoryCard {...s} active={on} />} />}
      </section>

      {/* Up next: one clear action while travelling */}
      {next && (
        <Link to="/trip" className="mx-5 flex items-center gap-4 rounded-[2rem] bg-ink p-4 pr-5 text-white shadow-float md:mx-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white/10 text-center">
            <span><Clock size={18} className="mx-auto mb-0.5" aria-hidden /><span className="text-sm font-bold">{next.start.replace(/ (AM|PM)/, '')}</span></span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold uppercase tracking-wider text-rani-200">{next.status === 'current' ? 'Happening now' : 'Up next'}</span>
            <span className="block truncate text-xl font-bold">{next.title}</span>
          </span>
          <ArrowRight size={22} aria-hidden />
        </Link>
      )}

      {/* Story map */}
      <section aria-labelledby="map-h" className="px-5 md:px-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="map-h" className="text-2xl font-bold text-ink">{tour ? 'Your route' : 'On the map'}</h2>
          {tour && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-stone-600" aria-label="Map legend">
              {LEGEND.map(([c, l]) => <li key={l} className="inline-flex items-center gap-1.5"><span className={cx('h-3 w-3 rounded-full', c)} aria-hidden />{l}</li>)}
            </ul>
          )}
        </div>
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-soft">
          <Suspense fallback={<div className="h-[22rem] animate-pulse bg-stone-200" aria-label="Loading map" />}>
            <RouteMap model={model} suggestions={suggestions} selected={selected} onSelect={onSelect} className="h-[22rem] md:h-[26rem]" />
          </Suspense>
          {(selStop || selAct || selSug) && (
            <Link to={selAct ? (selAct.item.offering_id ? `/experience/${selAct.item.offering_id}` : '/trip') : `/destination/${(selStop || selSug).key}`}
              className="animate-fade flex items-center gap-4 p-3 pr-5">
              <Photo src={destImage(selAct ? selAct.item.dest_key : (selStop || selSug).key)} scrim={false} className="h-20 w-20 shrink-0 rounded-3xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold text-ink">{selAct ? selAct.title : (selStop || selSug).name}</span>
                <span className="block truncate text-[15px] text-stone-600">
                  {selAct ? `${selAct.start} – ${selAct.end}` : selStop ? `${selStop.nights} night${selStop.nights === 1 ? '' : 's'} · ${STATUS[selStop.status][0]}` : selSug.tagline}
                </span>
                {selSug && <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-stone-700"><Star size={14} className="fill-amber-400 text-amber-400" aria-hidden /> Top pick for your interests</span>}
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white"><ArrowUpRight size={20} aria-hidden /></span>
            </Link>
          )}
        </div>
      </section>

      <p className="text-center text-[15px] text-stone-600"><Link to="/tours" className="inline-flex min-h-11 items-center font-semibold underline">Switch traveler / tour</Link></p>

      <Sheet open={tuning} onClose={() => setTuning(false)} title="What are you into?">
        {interests && <InterestPicker value={interests} onToggle={toggle} />}
        <button type="button" onClick={() => setTuning(false)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink font-semibold text-white">Show my picks</button>
      </Sheet>
    </div>
  )
}
