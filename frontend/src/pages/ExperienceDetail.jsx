import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, MapPin, ShieldCheck, Star, Timer, Users, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { ACCESS, Button, Card, Chip, GROUP_LABEL, IOBadge, Skeleton, TrustBadge, cx } from '../components/ui'
import { skipExperience } from './RightNow'

function FitCard({ fit }) {
  if (!fit) return <Card className="p-5 text-ink-2">Open a free slot from your day to see how this fits.</Card>
  return (
    <Card className="p-5 ring-2 ring-success/40">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-success"><ShieldCheck size={16} aria-hidden /> Why it fits</h2>
      <p className="mt-2 leading-relaxed text-ink-2">{fit.reasoning}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[['Travel there', `${fit.travel_to} min`], ['Buffer kept', `${fit.buffer} min`], ['Back by', fit.back_by_label]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 p-2.5"><dt className="text-xs text-ink-3">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>
        ))}
      </dl>
    </Card>
  )
}

export default function ExperienceDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const loc = useLocation()
  const nav = useNavigate()
  const { itinerary, notify, refresh } = useTraveler()
  const slotId = Number(params.get('slot')) || null
  const [exp, setExp] = useState(null)
  const [fit, setFit] = useState(loc.state?.fit || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.experience(id).then(setExp) }, [id])
  useEffect(() => {
    if (fit || !slotId) return
    api.recommendations(slotId).then((r) => {
      const c = [r.primary, ...r.backups].find((x) => x && x.experience.id === Number(id))
      if (c) setFit(c.fit)
    }).catch(() => {})
  }, [slotId, id, fit])

  if (!exp) return <div className="space-y-3 p-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
  const flags = itinerary?.user.accessibility_flags || []

  const add = async () => {
    setBusy(true)
    try {
      const r = await api.addToSlot(itinerary.id, slotId, [exp.id])
      const booking = await api.book(r.created_item_ids)
      await refresh()
      nav('/booking', { state: { booking } })
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  const actions = slotId && (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={() => { skipExperience(exp.id); nav(`/?slot=${slotId}`) }}>Not this one</Button>
      <Button onClick={add} disabled={busy || !fit}>{busy ? 'Adding…' : 'Add to my day'}</Button>
    </div>
  )

  return (
    <div className="pb-4 lg:pt-8">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#c2410c] to-[#0e7490] px-4 pt-4 pb-8 text-white md:px-6 lg:rounded-3xl lg:px-8 lg:pb-10">
        <div className="absolute -right-12 -bottom-16 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <button type="button" onClick={() => nav(-1)} className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] text-white/90 hover:bg-white/10"><ArrowLeft size={18} aria-hidden /> Back</button>
        <ul className="flex flex-wrap gap-1.5" aria-label="Categories">{exp.category_tags.map((t) => <li key={t} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{t}</li>)}</ul>
        <h1 className="mt-2 text-3xl font-bold leading-tight lg:text-4xl">{exp.title}</h1>
        <p className="mt-1 text-white/85">by {exp.vendor?.name}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-white/90">
          <span className="inline-flex items-center gap-1.5"><Timer size={16} aria-hidden /> {exp.duration_min} min</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {exp.location?.name}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden /> {exp.opening_hours?.open}–{exp.opening_hours?.close}</span>
        </div>
      </div>

      <div className="-mt-4 px-4 md:px-6 lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8 lg:px-0">
        <div className="space-y-3">
          <div className="lg:hidden"><FitCard fit={fit} /></div>

          <Card className="p-5">
            <p className="leading-relaxed text-ink-2">{exp.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-display text-2xl font-bold">{inr(exp.price)}</span><span className="text-sm text-ink-3">per person</span>
              <IOBadge io={exp.indoor_outdoor} />
              <Chip tone={exp.capacity_left <= 3 ? 'warn' : 'success'}>{exp.capacity_left} spots left today</Chip>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Accessibility</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(ACCESS).map(([k, { label, Icon }]) => {
                const has = exp.accessibility_attributes?.[k]
                return (
                  <li key={k} className={cx('flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px]', has ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-3')}>
                    <Icon size={18} aria-hidden /> <span className="flex-1">{label}</span>
                    {has ? <Check size={16} aria-label="available" /> : <X size={16} aria-label="not available" />}
                    {has && flags.includes(k) && <span className="sr-only">matches your needs</span>}
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
              <Users size={16} aria-hidden /> Good for: {exp.group_suitability.map((g) => <Chip key={g}>{GROUP_LABEL[g]}</Chip>)}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Trust score</h2>
              <TrustBadge exp={exp} />
            </div>
            <p className="mt-1 text-sm text-ink-3">{exp.trust_meta?.summary}. Recent reviews count more: a review’s weight halves every 90 days.</p>
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {exp.reviews?.slice(0, 4).map((r, idx) => (
                <li key={idx} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-xs text-ink-3">
                    <span className="inline-flex" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} aria-hidden className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-line'} />)}</span>
                    <span>{r.days_ago === 0 ? 'today' : `${r.days_ago} days ago`}</span>
                  </div>
                  <p className="mt-1 text-[15px] text-ink">{r.text}</p>
                </li>
              ))}
            </ul>
          </Card>

          {actions && <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:hidden">{actions}</div>}
        </div>

        <aside className="hidden space-y-3 lg:sticky lg:top-8 lg:block">
          <FitCard fit={fit} />
          {actions}
        </aside>
      </div>
    </div>
  )
}
