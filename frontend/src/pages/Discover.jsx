import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CloudRain, MapPin, Sparkles, Wand2, Wifi, WifiOff } from 'lucide-react'
import { api, fmtDate, fmtTime, inr } from '../api'
import { useTour } from '../store'
import { Card, Chip, INTEREST, IOBadge, JourneyStrip, Rating, STAGE_CHIP, Spinner, cx } from '../components/ui'

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

  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-500">
              {state ? `${fmtDate(state.demo_date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(state.demo_time)}` : 'Discover'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Hi {first} 👋</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            {rainy && <Chip tone="blue"><CloudRain size={12} /> Rain alert</Chip>}
            <span className={cx('inline-flex items-center gap-1 text-[10px]', live === 'live' ? 'text-emerald-600' : 'text-amber-600')}>
              {live === 'live' ? <Wifi size={11} /> : <WifiOff size={11} />} {live}
            </span>
          </div>
        </div>
      </header>

      <JourneyStrip stage={tour?.stage || 'discover'} />

      <section className="space-y-4 px-4 pt-4">
        {tour && (
          <Link to={tour.stage === 'plan' ? '/plan' : tour.stage === 'complete' ? '/review' : '/trip'}>
            <Card className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  Your tour {label && <Chip tone={tone}>{label}</Chip>}
                </div>
                <div className="truncate font-semibold">{tour.title}</div>
                <div className="text-xs text-stone-500">
                  {fmtDate(tour.start_date)} – {fmtDate(tour.end_date)} · {tour.route.map((r) => r.name).join(' → ')}
                  {tour.current_day && ` · day ${tour.current_day} of ${tour.days}`}
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-stone-400" />
            </Card>
          </Link>
        )}

        <Link to="/personalize" className="block">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-rani-600 to-rani-700 px-4 py-4 text-white">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rani-100"><Wand2 size={13} /> No fixed packages</div>
              <h2 className="mt-1 text-xl font-bold leading-tight">Design your own tour</h2>
              <p className="mt-1 text-sm text-rani-50">Pick dates, budget, stays, transport and interests — get an optimised day-by-day plan you can change anytime.</p>
            </div>
          </Card>
        </Link>

        <div>
          <div className="mb-2 text-sm font-semibold text-stone-700">What are you into?</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(INTEREST).map(([k, { label: l, Icon }]) => (
              <button key={k} onClick={() => toggle(k)}
                className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition',
                  interests?.includes(k) ? 'bg-rani-50 text-rani-700 ring-rani-500' : 'bg-white text-stone-600 ring-stone-200')}>
                <Icon size={13} /> {l}
              </button>
            ))}
          </div>
        </div>

        {!data ? <Spinner label="Finding places for you…" /> : (
          <>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Sparkles size={15} className="text-rani-600" /> Destinations for you</div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {data.destinations.map((d, i) => (
                  <Link key={d.key} to={`/destination/${d.key}`} className="w-60 shrink-0">
                    <Card className="h-full p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold">{d.name}</div>
                          <div className="text-[11px] text-stone-500">{d.region} · {d.ideal_nights}+ nights · {d.best_months}</div>
                        </div>
                        {i === 0 && <Chip tone="rani">Top match</Chip>}
                      </div>
                      <p className="mt-1.5 text-xs leading-snug text-stone-600">{d.tagline}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{d.match.map((m) => <Chip key={m} tone="green">{INTEREST[m]?.label || m}</Chip>)}</div>
                      <div className="mt-2 text-[11px] text-stone-500">{d.reasons.join(' · ')}</div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-stone-700">Experiences you’ll love</div>
              <div className="space-y-2">
                {data.experiences.map((e) => (
                  <Link key={e.id} to={`/experience/${e.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200 hover:ring-stone-300">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{e.title}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {e.dest_name}</span>
                        <span>{Math.round(e.duration_min / 6) / 10}h</span><span>{inr(e.price)}</span>
                        <Rating value={e.rating} className="text-xs" />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1"><IOBadge io={e.indoor_outdoor} /><ChevronRight size={16} className="text-stone-400" /></div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
        <p className="pb-2 text-center text-xs text-stone-400"><Link to="/tours" className="underline">Switch traveler / tour</Link></p>
      </section>
    </div>
  )
}
