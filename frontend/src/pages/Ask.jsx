import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Send, Sparkles, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Chip, inputCls } from '../components/ui'

const EXAMPLES = ['Something foodie under ₹500', 'Indoors, it’s too hot', 'Quick adventure, under 1 hour', 'Chill and cultural']

export default function Ask() {
  const { itinerary, refresh, notify } = useTraveler()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [rec, setRec] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (itinerary?.session?.intent_raw_text && !parsed) { setText(itinerary.session.intent_raw_text); setParsed({ parsed: itinerary.session.intent_parsed_json }) } }, [itinerary]) // eslint-disable-line

  const ask = async (q) => {
    const query = (q ?? text).trim()
    if (!query) return
    setText(query)
    setBusy(true)
    try {
      const p = await api.intent(query)
      setParsed(p)
      await refresh()
      const it = await api.itinerary(itinerary.id)
      setRec(it.next_gap_id ? await api.recommendations(it.next_gap_id) : null)
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  const clear = async () => {
    await api.intent('')
    setText(''); setParsed(null); setRec(null)
    refresh()
  }

  const f = parsed?.parsed
  return (
    <div className="px-4 pt-6 md:px-6 lg:max-w-2xl lg:px-0 lg:pt-10">
      <h1 className="text-3xl font-bold lg:text-4xl">What are you in the mood for?</h1>
      <p className="mt-1 text-ink-2">Say it the way you’d tell a friend. We’ll turn it into one pick.</p>
      <form onSubmit={(e) => { e.preventDefault(); ask() }} className="mt-5 flex gap-2" role="search">
        <label htmlFor="mood" className="sr-only">Describe your mood</label>
        <input id="mood" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. something cheap and indoors" autoComplete="off" className={inputCls} />
        <Button type="submit" disabled={busy} aria-label="Find my pick" className="w-12 shrink-0 px-0"><Send size={18} aria-hidden /></Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
        {EXAMPLES.map((q) => (
          <button type="button" key={q} onClick={() => ask(q)} className="min-h-11 rounded-full bg-surface px-3.5 text-sm text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink">{q}</button>
        ))}
      </div>

      <div aria-live="polite">
        {f && (
          <Card className="mt-6 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Understood as {parsed.source === 'llm' ? '(AI)' : parsed.source === 'rules' ? '(keywords)' : ''}</h2>
              <Button variant="ghost" size="sm" onClick={clear}><X size={15} aria-hidden /> Clear</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.tags?.map((t) => <Chip key={t} tone="brand">{t}</Chip>)}
              {f.max_price && <Chip tone="success">up to {inr(f.max_price)}</Chip>}
              {f.max_duration && <Chip tone="accent">up to {f.max_duration} min</Chip>}
              {f.indoor_only && <Chip tone="accent">indoors</Chip>}
              {!f.tags?.length && !f.max_price && !f.max_duration && !f.indoor_only && <span className="text-sm text-ink-3">No filters recognised, so you’ll see the overall best fit.</span>}
            </div>
          </Card>
        )}

        {rec && (rec.primary ? (
          <Card className="mt-3 p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-ink"><Sparkles size={14} aria-hidden /> Your pick for {rec.slot.start} – {rec.slot.end}</p>
            <h2 className="mt-1 text-xl font-bold">{rec.primary.experience.title}</h2>
            <p className="mt-1 text-ink-2">{rec.primary.fit.reasoning}</p>
            <Link to={`/?slot=${rec.slot_id}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover">Open it on Right Now <ArrowRight size={18} aria-hidden /></Link>
          </Card>
        ) : (
          <Card className="mt-3 p-5 text-ink-2">Nothing matches that in your next free window. Try loosening it, or <button type="button" className="font-medium text-accent-ink underline" onClick={clear}>clear the filter</button>.</Card>
        ))}
      </div>
    </div>
  )
}
