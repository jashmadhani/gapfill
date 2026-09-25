import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Sparkles, X } from 'lucide-react'
import { api, inr } from '../api'
import { useTraveler } from '../store'
import { Button, Card, Chip } from '../components/ui'

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
    <div className="px-4 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">What are you in the mood for?</h1>
      <p className="text-sm text-stone-500">Say it how you’d say it to a friend. We’ll turn it into one pick.</p>
      <form onSubmit={(e) => { e.preventDefault(); ask() }} className="mt-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. something cheap and indoors"
          className="flex-1 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
        <Button type="submit" disabled={busy} aria-label="Ask"><Send size={16} /></Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full bg-white px-3 py-1.5 text-xs text-stone-700 ring-1 ring-stone-200 hover:ring-rani-500">{q}</button>)}
      </div>

      {f && (
        <Card className="mt-5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Understood as {parsed.source === 'llm' ? '(AI)' : parsed.source === 'rules' ? '(rules)' : ''}</div>
            <button onClick={clear} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"><X size={13} /> Clear</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.tags?.map((t) => <Chip key={t} tone="rani">{t}</Chip>)}
            {f.max_price && <Chip tone="green">≤ {inr(f.max_price)}</Chip>}
            {f.max_duration && <Chip tone="blue">≤ {f.max_duration} min</Chip>}
            {f.indoor_only && <Chip tone="blue">indoors</Chip>}
            {!f.tags?.length && !f.max_price && !f.max_duration && !f.indoor_only && <span className="text-sm text-stone-500">No filters recognised — showing the overall best fit.</span>}
          </div>
        </Card>
      )}

      {rec && (rec.primary ? (
        <Card className="mt-3 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rani-600"><Sparkles size={13} /> Your pick for {rec.slot.start} – {rec.slot.end}</div>
          <h2 className="mt-1 text-lg font-bold">{rec.primary.experience.title}</h2>
          <p className="mt-1 text-sm text-stone-600">{rec.primary.fit.reasoning}</p>
          <Link to={`/?slot=${rec.slot_id}`}><Button className="mt-3 w-full">See it on my Right Now card</Button></Link>
        </Card>
      ) : (
        <Card className="mt-3 p-4 text-sm text-stone-600">Nothing matches that in your next free window. Try loosening it, or <button className="underline" onClick={clear}>clear the filter</button>.</Card>
      ))}
    </div>
  )
}
