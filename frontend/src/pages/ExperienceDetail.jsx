import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Accessibility, Baby, Clock, MapPin, Star, Sun, Umbrella } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'
import { INTEREST, Spinner, cx } from '../components/ui'
import { PageBody, PageHero } from '../components/page'
import { BookBar, Feature, Tabs } from './DestinationDetail'
import { useSaved } from '../lib/saved'
import { destImage } from '../media'
import { CrowdChart, FitBadge, FitChips, TagList } from '../components/group'

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ExperienceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { tour, notify, refresh } = useTour()
  const [exp, setExp] = useState(null)
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [fit, setFit] = useState(null)
  const { isSaved, toggle: toggleSave } = useSaved()
  const [tab, setTab] = useState('overview')

  useEffect(() => { api.offering(id).then(setExp) }, [id])
  useEffect(() => { setFit(null); api.offeringInsights(id, tour?.id).then(setFit).catch(() => {}) }, [id, tour?.id])
  if (!exp) return <Spinner />

  const editable = tour && ['plan', 'prepare', 'operate'].includes(tour.stage)
  const days = (tour?.days_detail || []).filter((d) => d.dest === exp.dest_key && (!tour.current_day || d.day >= tour.current_day))
  const inPlan = tour?.days_detail?.some((d) => d.items.some((i) => i.offering_id === exp.id && !['replaced', 'cancelled'].includes(i.status)))
  const interests = tour?.prefs?.interests || []

  const add = async () => {
    setBusy(true)
    try {
      const r = await api.addItem(tour.id, exp.id, day ? Number(day) : null)
      notify(`Added to day ${r.result.day} at ${r.result.start_label}${r.result.booking_ref ? ` · ${r.result.booking_ref}` : ''}`, 'success')
      await refresh()
      nav('/plan')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  const share = () => navigator.share?.({ title: exp.title, url: location.href }).catch(() => {})
  const action = !editable
    ? <Link to={`/personalize?dest=${exp.dest_key}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-rani-600 px-6 font-bold text-white">Plan a trip here</Link>
    : inPlan ? <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-green-600 px-6 font-bold text-white">In your trip</span>
      : days.length === 0 ? <Link to={`/personalize?dest=${exp.dest_key}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-rani-600 px-6 font-bold text-white">New trip here</Link>
        : <button type="button" onClick={add} disabled={busy} className="inline-flex min-h-12 items-center justify-center rounded-full bg-rani-600 px-6 font-bold text-white disabled:opacity-60">{busy ? 'Adding…' : 'Add to my trip'}</button>

  return (
    <div className="pb-24 lg:pb-0">
      <PageHero size="tall" back save={{ saved: isSaved(exp.id), onSave: () => toggleSave(exp.id), onShare: share }} img={destImage(exp.dest_key || exp.dest_name)} title={exp.title}>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/90">
          <span className="inline-flex items-center gap-1"><MapPin size={15} aria-hidden /> {exp.dest_name}</span>
          <span className="inline-flex items-center gap-1"><Clock size={15} aria-hidden /> {exp.duration_min} min</span>
          <span className="inline-flex items-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden /> {exp.rating.toFixed(1)} ({exp.rating_count} reviews)</span>
        </p>
      </PageHero>

      <PageBody>
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10 [&>*]:min-w-0">
          <div className="space-y-6">
            <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ...(fit ? [['fit', 'Group fit']] : []), ['reviews', 'Reviews']]} />

            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-4 gap-2.5">
                  <Feature Icon={Clock} label={`${exp.duration_min} min`} sub="duration" />
                  <Feature Icon={exp.indoor_outdoor === 'outdoor' ? Sun : Umbrella} label={exp.indoor_outdoor === 'mixed' ? 'Mixed' : exp.indoor_outdoor === 'outdoor' ? 'Outdoor' : 'Indoor'} sub="setting" />
                  <Feature Icon={Accessibility} label={exp.step_free ? 'Step-free' : 'Stairs'} sub="access" />
                  <Feature Icon={Baby} label={exp.kid_friendly ? 'Kids OK' : '12+'} sub="age" />
                </div>
                <section>
                  <h2 className="text-xl font-bold text-ink">About this experience</h2>
                  <p className="mt-2 text-[16px] leading-relaxed text-stone-700">{exp.description}</p>
                  <p className="mt-2 text-[15px] text-stone-600">Open {exp.open} to {exp.close}{exp.closed_weekdays?.length ? `, closed ${exp.closed_weekdays.map((d) => WEEKDAY[d]).join(', ')}` : ''} · up to {exp.capacity} guests · by {exp.vendor_name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{exp.tags.map((t) => <span key={t} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', interests.includes(t) ? 'bg-rani-600 text-white' : 'bg-rani-50 text-rani-700')}>{INTEREST[t]?.label || t}</span>)}</div>
                </section>
                {editable && !inPlan && days.length > 1 && (
                  <label className="block">
                    <span className="text-[15px] font-bold text-ink">Which day?</span>
                    <select value={day} onChange={(e) => setDay(e.target.value)} className="mt-1.5 min-h-12 w-full rounded-full bg-white px-4 text-[15px] shadow-soft">
                      <option value="">Best day for me</option>
                      {days.map((d) => <option key={d.day} value={d.day}>Day {d.day} · {d.dest_name}{d.rain && exp.indoor_outdoor === 'outdoor' ? ' (rain)' : ''}</option>)}
                    </select>
                  </label>
                )}
                {editable && !inPlan && days.length === 0 && <p className="rounded-2xl bg-white p-4 text-[15px] text-stone-600 shadow-soft">{exp.dest_name} isn’t on your route yet. Start a new trip with this stop.</p>}
                {tour && tour.stage !== 'plan' && !inPlan && days.length > 0 && <p className="text-sm text-stone-500">Your trip is booked: adding sends a request to {exp.vendor_name} to confirm.</p>}
              </>
            )}

            {tab === 'fit' && fit && (
              <section className="space-y-4 rounded-[1.6rem] bg-white p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-ink">How it suits {tour ? 'your group' : 'you'}</h2>
                    <p className="text-sm text-stone-600">Predicted per person by our model{fit.day ? ` for day ${fit.day}` : ''} · best around {fit.best_start}</p>
                  </div>
                  <FitBadge fit={fit.fit} />
                </div>
                <FitChips members={fit.members} />
                {fit.tags.length > 0 && <TagList tags={fit.tags} />}
                <div className="text-sm font-bold uppercase tracking-wide text-stone-500">Crowd forecast · {new Date(fit.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                <CrowdChart curve={fit.crowd_curve} mark={fit.best_hour} />
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-2xl bg-sand-50 p-2.5"><div className="text-stone-500">Effort</div><div className="font-bold">{fit.profile.intensity}/5</div></div>
                  <div className="rounded-2xl bg-sand-50 p-2.5"><div className="text-stone-500">Stairs</div><div className="font-bold">{fit.profile.stairs >= 0.6 ? 'Many' : fit.profile.stairs >= 0.3 ? 'Some' : 'Few'}</div></div>
                  <div className="rounded-2xl bg-sand-50 p-2.5"><div className="text-stone-500">Walking</div><div className="font-bold">{fit.profile.walk_km} km</div></div>
                </div>
              </section>
            )}

            {tab === 'reviews' && (
              <ul className="space-y-3">
                {exp.reviews?.map((r, idx) => (
                  <li key={idx} className="rounded-[1.4rem] bg-white p-4 shadow-soft">
                    <div className="flex items-center justify-between text-sm text-stone-600">
                      <span className="inline-flex items-center gap-2 font-semibold text-ink">
                        <span className="inline-flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />)}</span>
                        {r.author}
                      </span>
                      <span>{r.days_ago === 0 ? 'today' : `${r.days_ago} days ago`}</span>
                    </div>
                    {r.text && <p className="mt-1.5 text-[15px] text-stone-700">{r.text}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookBar price={exp.price ? inr(exp.price) : 'Free'} unit="/ person" action={action} />
          </aside>
        </div>
      </PageBody>
    </div>
  )
}
