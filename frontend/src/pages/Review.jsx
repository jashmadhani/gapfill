import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { Button, Card, Empty, JourneyStrip, Spinner, cx } from '../components/ui'

function Stars({ value, onChange, size = 22 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
        </button>
      ))}
    </span>
  )
}

// Complete → Review: rate the tour and each experience; ratings flow back into vendor scores and future recommendations.
export default function Review() {
  const { tour, state, refresh, notify } = useTour()
  const nav = useNavigate()
  const [overall, setOverall] = useState(5)
  const [text, setText] = useState('')
  const [ratings, setRatings] = useState({})
  const [busy, setBusy] = useState(false)
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="No tour to review">Reviews open after a tour ends.</Empty></div>
  if (tour.stage !== 'complete') {
    return (
      <div className="px-4 pt-5">
        <Empty title={tour.stage === 'review' ? 'Already reviewed — thank you!' : 'Reviews open after your tour'} action={<Link to="/trip"><Button variant="secondary">Back to trip</Button></Link>}>
          {tour.stage === 'review' ? `You rated it ${tour.review?.overall}/5.` : 'We’ll ask for your feedback on the last day.'}
        </Empty>
      </div>
    )
  }
  const acts = tour.days_detail.flatMap((d) => d.items).filter((i) => i.kind === 'activity' && i.status === 'booked')
  const submit = async () => {
    setBusy(true)
    try {
      await api.review(tour.id, { overall, text, items: acts.map((a) => ({ item_id: a.id, rating: ratings[a.id] ?? 5 })) })
      await refresh()
      notify('Thanks for your review!', 'success')
      nav('/trip')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">How was {tour.title}?</h1>
        <p className="text-sm text-stone-500">Your ratings go straight to our local partners.</p>
      </header>
      <JourneyStrip stage="complete" />
      <section className="space-y-3 px-4 pt-4">
        <Card className="p-4 text-center">
          <Stars value={overall} onChange={setOverall} size={32} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What stood out? What could be better?" rows={3}
            className="mt-3 w-full rounded-xl bg-sand-50 px-3 py-2 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
        </Card>
        <Card className="divide-y divide-stone-100">
          {acts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-stone-500">Day {a.day} · {a.vendor_name}</div>
              </div>
              <Stars value={ratings[a.id] ?? 5} onChange={(n) => setRatings((r) => ({ ...r, [a.id]: n }))} size={18} />
            </div>
          ))}
        </Card>
        <Button className={cx('w-full')} disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Submit review'}</Button>
      </section>
    </div>
  )
}
