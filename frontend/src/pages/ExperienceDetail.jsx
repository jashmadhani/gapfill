import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, ShieldCheck, Star, Users } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { ACCESS, Button, Card, Chip, GROUP_LABEL, IOBadge, Spinner, TrustBadge, cx } from '../components/ui'
import { skipExperience } from './RightNow'

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

  if (!exp) return <Spinner />
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

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-rani-600 to-rani-900 px-4 pt-4 pb-6 text-white">
        <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-rani-100"><ArrowLeft size={16} /> Back</button>
        <div className="flex flex-wrap gap-1.5">{exp.category_tags.map((t) => <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{t}</span>)}</div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{exp.title}</h1>
        <p className="mt-1 text-sm text-rani-100">by {exp.vendor?.name}</p>
      </div>

      <div className="-mt-3 space-y-3 px-4">
        {fit ? (
          <Card className="p-4 ring-2 ring-emerald-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"><ShieldCheck size={14} /> Why it fits</div>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">{fit.reasoning}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-stone-50 p-2"><div className="text-stone-500">Travel there</div><div className="font-semibold">{fit.travel_to} min</div></div>
              <div className="rounded-lg bg-stone-50 p-2"><div className="text-stone-500">Buffer kept</div><div className="font-semibold">{fit.buffer} min</div></div>
              <div className="rounded-lg bg-stone-50 p-2"><div className="text-stone-500">Back by</div><div className="font-semibold">{fit.back_by_label}</div></div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 text-sm text-stone-600">Open a free slot from your day to see how this fits.</Card>
        )}

        <Card className="p-4">
          <p className="text-sm leading-relaxed text-stone-700">{exp.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-lg font-bold">{inr(exp.price)} <span className="text-xs font-normal text-stone-500">/ person</span></span>
            <span className="inline-flex items-center gap-1 text-stone-600"><Clock size={14} /> {exp.duration_min} min</span>
            <span className="inline-flex items-center gap-1 text-stone-600"><MapPin size={14} /> {exp.location?.name}</span>
            <IOBadge io={exp.indoor_outdoor} />
          </div>
          <div className="mt-2 text-xs text-stone-500">Open {exp.opening_hours?.open}–{exp.opening_hours?.close} · {exp.capacity_left} spots left today</div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">Accessibility</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(ACCESS).map(([k, { label, Icon }]) => (
              <li key={k} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5', exp.accessibility_attributes?.[k] ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-50 text-stone-400 line-through')}>
                <Icon size={15} /> {label}{flags.includes(k) && exp.accessibility_attributes?.[k] && ' ✓'}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
            <Users size={14} /> Good for: {exp.group_suitability.map((g) => <Chip key={g}>{GROUP_LABEL[g]}</Chip>)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Trust score</h3>
            <TrustBadge exp={exp} />
          </div>
          <p className="mt-1 text-xs text-stone-500">{exp.trust_meta?.summary}. Recent reviews count more — a review’s weight halves every 90 days.</p>
          <ul className="mt-3 space-y-2">
            {exp.reviews?.slice(0, 4).map((r, idx) => (
              <li key={idx} className="rounded-lg bg-stone-50 p-2 text-sm">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="inline-flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />)}</span>
                  <span>{r.days_ago === 0 ? 'today' : `${r.days_ago} days ago`}</span>
                </div>
                <p className="mt-0.5 text-stone-700">{r.text}</p>
              </li>
            ))}
          </ul>
        </Card>

        {slotId && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { skipExperience(exp.id); nav(`/?slot=${slotId}`) }}>Not this one</Button>
            <Button onClick={add} disabled={busy || !fit}>{busy ? 'Adding…' : 'Add to my day'}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
