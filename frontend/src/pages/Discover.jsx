import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, CloudRain, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { destImage } from '../media'
import { buildTripMap } from '../lib/tripMap'
import { Chip, InterestPicker, JourneyStrip, Photo, Sheet, cx } from '../components/ui'

// The map engine is large (~1 MB); load it separately so the rest of the app opens fast on phones.
const RouteMap = lazy(() => import('../components/RouteMap'))
const MAX_PICKS = 4
const LEGEND = [['bg-green-600', 'Visited'], ['bg-rani-600', 'Now'], ['bg-rani-500', 'Ahead'], ['bg-orange-600', 'Changed']]

function PickRow({ to, img, title, meta, right, highlight }) {
  return (
    <Link to={to} className={cx('flex items-center gap-3 rounded-3xl bg-white p-2.5 pr-3 shadow-soft ring-1 transition hover:ring-stone-300', highlight ? 'ring-2 ring-rani-500' : 'ring-stone-200/70')}>
      <Photo src={img} scrim={false} className="h-14 w-14 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-stone-900">{title}</div>
        <div className="truncate text-sm text-stone-500">{meta}</div>
      </div>
      {right}
      <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden />
    </Link>
  )
}

export default function Discover() {
  const { tour, state, events } = useTour()
  const [interests, setInterests] = useState(null)
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [tuning, setTuning] = useState(false)
  const [local, setLocal] = useState([]) // experiences in today's city, so "Right now" stays near the traveler

  useEffect(() => { if (interests === null && state) setInterests(tour?.prefs?.interests || ['heritage', 'food']) }, [state, tour?.id]) // eslint-disable-line
  useEffect(() => { if (interests) api.discover(interests).then(setData) }, [interests])
  const toggle = (k) => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const onSelect = useCallback((s) => setSelected((cur) => (cur && cur.type === s.type && (cur.key ?? cur.id) === (s.key ?? s.id) ? null : s)), [])

  const cities = useMemo(() => Object.fromEntries((state?.destinations || []).map((d) => [d.key, d])), [state])
  const model = useMemo(() => buildTripMap({ tour, state, cities, events }), [tour, state, cities, events])
  const suggestions = useMemo(() => (tour ? [] : (data?.destinations || []).slice(0, MAX_PICKS).map((d) => ({ ...d, ...cities[d.key] }))), [tour, data, cities])

  const onTour = tour?.stage === 'operate'
  const nowItem = onTour ? model.today.find((a) => a.status === 'current') || model.today.find((a) => a.status === 'next') : null
  const routeKeys = new Set((tour?.route || []).map((r) => r.dest))
  const curDest = onTour ? tour.days_detail[tour.current_day - 1]?.dest : null
  useEffect(() => { if (curDest) api.destination(curDest).then((d) => setLocal(d.experiences)).catch(() => setLocal([])); else setLocal([]) }, [curDest])
  const planned = new Set((tour?.days_detail || []).flatMap((d) => d.items.map((i) => i.offering_id)))
  const expPool = [...local, ...(data?.experiences || []).filter((e) => !local.some((l) => l.id === e.id))].filter((e) => !planned.has(e.id))
  // Closest first: today's city, then the rest of the route, then anywhere.
  const rank = (e) => (e.dest_key === curDest ? 0 : routeKeys.has(e.dest_key) ? 1 : 2)
  const exps = [...expPool].sort((a, b) => rank(a) - rank(b)).slice(0, nowItem ? MAX_PICKS - 1 : MAX_PICKS)

  // What the selected pin refers to
  const selCity = selected?.type === 'city' ? model.stops.find((s) => s.key === selected.key) : null
  const selAct = selected?.type === 'activity' ? model.today.find((a) => a.id === selected.id) : null
  const selSug = selected?.type === 'suggestion' ? suggestions.find((d) => d.key === selected.key) : null
  const rainy = state?.rain?.length > 0

  return (
    <div>
      {/* Map-first: the plan is the page. */}
      <div className="relative md:px-4 md:pt-4">
        <Suspense fallback={<div className="h-[56dvh] min-h-[340px] max-h-[620px] animate-pulse bg-stone-200 md:rounded-[2rem]" aria-label="Loading map" />}>
          <RouteMap model={model} suggestions={suggestions} selected={selected} onSelect={onSelect}
            className="h-[56dvh] min-h-[340px] max-h-[620px] md:rounded-[2rem] md:shadow-soft" />
        </Suspense>
        <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-3 md:px-8 md:pt-7">
          <Link to="/personalize" className="glass pointer-events-auto flex min-h-13 items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-stone-500 shadow-float ring-1 ring-white/70">
            <Search size={18} className="text-stone-400" aria-hidden />
            <span className="flex-1 truncate text-[15px]">{tour ? 'Plan another trip' : 'Where to next?'}</span>
            {rainy && <Chip tone="blue"><CloudRain size={13} aria-hidden /> Rain</Chip>}
            <span className="grid h-10 w-10 place-items-center rounded-full bg-rani-600 text-white"><ArrowRight size={17} aria-hidden /></span>
          </Link>
        </div>
      </div>

      <div className="relative z-10 -mt-6 space-y-4 rounded-t-[2rem] bg-sand-50 pt-3 md:mt-0 md:rounded-none md:pt-5">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />

        {tour && (
          <>
            <JourneyStrip stage={tour.stage} day={onTour ? tour.current_day : null} days={tour.days} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 text-xs text-stone-500 md:px-6" aria-label="Map legend">
              {LEGEND.map(([c, l]) => <li key={l} className="inline-flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-full', c)} aria-hidden />{l}</li>)}
            </ul>
          </>
        )}

        <section className="space-y-2.5 px-4 md:px-6" aria-live="polite">
          {(selCity || selAct || selSug) ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">On the map</h2>
                <button type="button" onClick={() => setSelected(null)} aria-label="Clear selection" className="grid h-11 w-11 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><X size={18} /></button>
              </div>
              {selCity && <PickRow to={`/destination/${selCity.key}`} img={destImage(selCity.key)} title={selCity.name} highlight
                meta={`Stop ${selCity.order} · ${selCity.nights} night${selCity.nights === 1 ? '' : 's'} · ${selCity.status === 'done' ? 'visited' : selCity.status === 'current' ? 'you’re here' : 'coming up'}${selCity.changed ? ' · plan changed' : ''}`} />}
              {selAct && <PickRow to={selAct.item.offering_id ? `/experience/${selAct.item.offering_id}` : '/trip'} img={destImage(selAct.item.dest_key)} title={selAct.title} highlight
                meta={`${selAct.start} – ${selAct.end} · ${{ done: 'done', current: 'happening now', next: 'up next', changed: 'needs a decision' }[selAct.status]}`} />}
              {selSug && <PickRow to={`/destination/${selSug.key}`} img={destImage(selSug.key)} title={selSug.name} highlight meta={`${selSug.region} · ${selSug.ideal_nights}+ nights · ${selSug.tagline}`} />}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{onTour ? 'Right now' : tour ? 'Picks for your route' : 'Top picks for you'}</h2>
                <button type="button" onClick={() => setTuning(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rani-600 hover:bg-rani-50">
                  <SlidersHorizontal size={15} aria-hidden /> Tune
                </button>
              </div>
              {!data && [0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-3xl bg-stone-200" aria-hidden />)}
              {nowItem && <PickRow to="/trip" img={destImage(nowItem.item.dest_key)} title={nowItem.title} highlight
                meta={`${nowItem.status === 'current' ? 'Happening now' : 'Up next'} · ${nowItem.start} – ${nowItem.end}`} />}
              {data && !tour && suggestions.map((d) => (
                <PickRow key={d.key} to={`/destination/${d.key}`} img={destImage(d.key)} title={d.name} meta={`${d.region} · ${d.ideal_nights}+ nights · ${d.tagline}`} />
              ))}
              {data && tour && exps.map((e) => (
                <PickRow key={e.id} to={`/experience/${e.id}`} img={destImage(e.dest_key)} title={e.title}
                  meta={`${e.dest_name} · ${inr(e.price)}`}
                  right={<span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-stone-700"><Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />{(e.rating ?? 0).toFixed(1)}</span>} />
              ))}
            </>
          )}
        </section>

        <p className="pb-2 text-center text-sm text-stone-500"><Link to="/tours" className="inline-flex min-h-11 items-center underline">Switch traveler / tour</Link></p>
      </div>

      <Sheet open={tuning} onClose={() => setTuning(false)} title="What are you into?">
        {interests && <InterestPicker value={interests} onToggle={toggle} />}
        <button type="button" onClick={() => setTuning(false)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rani-600 font-semibold text-white">Show my picks</button>
      </Sheet>
    </div>
  )
}
