import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, CloudRain, MapPin, Search, Star, Wifi, WifiOff } from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { useTour } from '../store'
import { destImage } from '../media'
import { Chip, INTEREST, JourneyStrip, Photo, STAGE_CHIP, cx } from '../components/ui'

function SectionHead({ title, to, action = 'View all' }) {
  return (
    <div className="mb-3 flex items-end justify-between px-4 md:px-6">
      <h2 className="text-lg font-bold text-stone-900">{title}</h2>
      {to && <Link to={to} className="inline-flex min-h-11 items-center text-sm font-semibold text-rani-600 hover:underline">{action}</Link>}
    </div>
  )
}

export default function Discover() {
  const { tour, state, live } = useTour()
  const [interests, setInterests] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => { if (interests === null && state) setInterests(tour?.prefs?.interests || ['heritage', 'food']) }, [state, tour?.id]) // eslint-disable-line
  useEffect(() => { if (interests) api.discover(interests).then(setData) }, [interests])
  const toggle = (k) => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const first = tour?.customer?.name?.split(' ')[0] || 'traveler'
  const [label, tone] = STAGE_CHIP[tour?.stage] || []
  const rainy = state?.rain?.length > 0
  const tourDest = tour?.days_detail?.[(tour.current_day || 1) - 1]?.dest || tour?.route?.[0]?.dest
  const heroKey = tourDest || data?.destinations?.[0]?.key || 'udaipur'

  return (
    <div>
      {/* Hero: full-bleed photo, big serif line, pill search (reference: TripGlide) */}
      <Photo src={destImage(heroKey)} scrim="both" className="rounded-b-[2rem] md:mx-4 md:mt-4 md:rounded-[2rem]">
        <div className="pt-safe flex min-h-[23rem] flex-col px-5 pb-6 text-white md:min-h-[26rem] md:px-8">
          <div className="flex items-center justify-between pt-4">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20" aria-hidden>
                <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M5 24l7-11 5 6 3-4 7 9z" fill="white" /><circle cx="22" cy="9" r="2.6" fill="#b9d1ee" /></svg>
              </span>
              TourCraft
            </span>
            <div className="flex items-center gap-1.5">
              {rainy && <Chip tone="glass"><CloudRain size={13} aria-hidden /> Rain alert</Chip>}
              <span className={cx('glass-dark inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', live === 'live' ? 'text-emerald-200' : 'text-amber-200')}>
                {live === 'live' ? <Wifi size={12} aria-hidden /> : <WifiOff size={12} aria-hidden />} {live}
              </span>
            </div>
          </div>

          <div className="mt-auto">
            <p className="text-sm font-medium text-white/80">
              {state ? `${fmtDate(state.demo_date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(state.demo_time)} · Hi ${first}` : `Hi ${first}`}
            </p>
            <h1 className="font-display mt-1 text-[2.6rem] leading-[1.02] md:text-6xl">Your India,<br />your way.</h1>
            <Link to="/personalize"
              className="mt-5 flex min-h-14 items-center gap-3 rounded-full bg-white py-1.5 pl-5 pr-1.5 text-stone-500 shadow-float transition hover:bg-stone-50">
              <Search size={18} aria-hidden className="text-stone-400" />
              <span className="flex-1 truncate text-[15px]">Where to next?</span>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-rani-600 text-white"><ArrowRight size={18} aria-hidden /></span>
            </Link>
          </div>
        </div>
      </Photo>

      <div className="space-y-7 pt-5">
        {tour && (
          <div className="px-4 md:px-6">
            <Link to={tour.stage === 'plan' ? '/plan' : tour.stage === 'complete' ? '/review' : '/trip'}
              className="flex items-center gap-3 rounded-3xl bg-white p-2.5 pr-4 shadow-soft ring-1 ring-stone-200/70 transition hover:ring-stone-300">
              <Photo src={destImage(tourDest)} scrim={false} className="h-16 w-16 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">Your tour {label && <Chip tone={tone}>{label}</Chip>}</div>
                <div className="truncate font-bold text-stone-900">{tour.title}</div>
                <div className="truncate text-sm text-stone-500">
                  {fmtDate(tour.start_date)} – {fmtDate(tour.end_date)}{tour.current_day ? ` · day ${tour.current_day} of ${tour.days}` : ''}
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden />
            </Link>
          </div>
        )}

        {tour && <JourneyStrip stage={tour.stage || 'discover'} />}

        <section aria-labelledby="interests-h">
          <h2 id="interests-h" className="mb-3 px-4 text-lg font-bold md:px-6">What are you into?</h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:px-6">
            {Object.entries(INTEREST).map(([k, { label: l, Icon }]) => {
              const on = interests?.includes(k)
              return (
                <button type="button" key={k} onClick={() => toggle(k)} aria-pressed={!!on}
                  className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition',
                    on ? 'bg-rani-600 text-white shadow-[0_6px_16px_rgb(31_79_143_/_0.25)]' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900')}>
                  <Icon size={15} aria-hidden /> {l}
                </button>
              )
            })}
          </div>
        </section>

        {!data ? (
          <div className="flex gap-3 overflow-hidden px-4 md:px-6" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-72 w-52 shrink-0 animate-pulse rounded-[1.75rem] bg-stone-200" />)}
          </div>
        ) : (
          <>
            <section aria-label="Destinations for you">
              <SectionHead title="Destinations for you" />
              <ul className="no-scrollbar snap-x-mand flex gap-3 overflow-x-auto px-4 pb-2 md:px-6">
                {data.destinations.map((d, i) => (
                  <li key={d.key} className="snap-start shrink-0">
                    <Link to={`/destination/${d.key}`} className="block w-52 md:w-60">
                      <Photo src={destImage(d.key)} alt={d.name} className="h-72 rounded-[1.75rem] shadow-soft md:h-80">
                        <div className="flex h-full flex-col justify-between p-3.5 text-white">
                          <div className="flex justify-between">
                            {i === 0 ? <Chip tone="glass">Top match</Chip> : <span />}
                          </div>
                          <div>
                            <div className="font-display text-2xl leading-tight">{d.name}</div>
                            <div className="mt-0.5 flex items-center gap-1 text-sm text-white/85"><MapPin size={13} aria-hidden /> {d.region} · {d.ideal_nights}+ nights</div>
                            <div className="mt-2 flex flex-wrap gap-1">{d.match.slice(0, 2).map((m) => <span key={m} className="glass-dark rounded-full px-2 py-0.5 text-xs">{INTEREST[m]?.label || m}</span>)}</div>
                          </div>
                        </div>
                      </Photo>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Experiences you'll love" className="px-4 md:px-6">
              <h2 className="mb-3 text-lg font-bold">Best experiences for you</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {data.experiences.map((e) => (
                  <li key={e.id}>
                    <Link to={`/experience/${e.id}`} className="flex items-center gap-3 rounded-3xl bg-white p-2.5 pr-3 shadow-soft ring-1 ring-stone-200/70 transition hover:ring-stone-300">
                      <Photo src={destImage(e.dest_key || e.dest_name)} scrim={false} className="h-20 w-20 shrink-0 rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 font-semibold leading-snug text-stone-900">{e.title}</div>
                        <div className="mt-0.5 text-sm text-stone-500">{e.dest_name} · {Math.round(e.duration_min / 6) / 10} h</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-bold text-stone-900">{inr(e.price)}</span>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700"><Star size={14} className="fill-amber-400 text-amber-400" aria-hidden /> {(e.rating ?? 0).toFixed(1)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        <p className="pb-2 text-center text-sm text-stone-500"><Link to="/tours" className="inline-flex min-h-11 items-center underline">Switch traveler / tour</Link></p>
      </div>
    </div>
  )
}
