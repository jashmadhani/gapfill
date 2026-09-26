import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { Button, Empty, Spinner, cx } from '../components/ui'

const SUGGEST = {
  plan: ['Show day 2', 'Add a cooking class', 'Cheaper hotel', 'How much is it?'],
  prepare: ['How much have I paid?', 'Show day 1', 'Upgrade my hotel', 'Call my coordinator'],
  operate: ["What's next today?", 'Add something foodie tomorrow', "I'm running 30 min late", "It's raining", 'Make tomorrow lighter', 'Call my coordinator'],
  complete: ['How much did I spend?'],
  review: ['How much did I spend?'],
}

// Assist: a conversational layer over the same planning engine — it can read, change and replan the tour.
export default function Assist() {
  const { tour, state, refresh, notify } = useTour()
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef()

  useEffect(() => { if (tour?.id) api.chat(tour.id).then(setMsgs) }, [tour?.id])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  if (!state) return <Spinner />
  if (!tour) return <div className="px-4 pt-5"><Empty title="No tour yet" action={<Link to="/personalize"><Button>Design a tour</Button></Link>}>The assistant works on your tour once you have one.</Empty></div>

  const send = async (q) => {
    const t = (q ?? text).trim()
    if (!t || busy) return
    setText('')
    setMsgs((m) => [...(m || []), { id: `u${Date.now()}`, role: 'user', text: t }])
    setBusy(true)
    try {
      const r = await api.say(tour.id, t)
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: 'assistant', text: r.reply }])
      refresh()
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-rani-600 text-white"><Bot size={20} /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Trip assistant</h1>
          <p className="text-xs text-stone-500">{busy ? 'thinking…' : `Knows your whole plan · ${state.assistant === 'anthropic' ? 'AI' : 'smart rules'} mode`}</p>
        </div>
      </header>
      <div className="flex-1 space-y-2 px-4">
        {msgs === null && <Spinner />}
        {msgs?.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">Hi! Ask me about your schedule, costs, or tell me what to change — I’ll update the plan and the bookings.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[14px] leading-snug shadow-sm',
              m.role === 'user' ? 'rounded-br-md bg-rani-600 text-white' : 'rounded-bl-md bg-white text-stone-800 ring-1 ring-stone-200')}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="flex"><div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 text-stone-400 ring-1 ring-stone-200">•••</div></div>}
        <div ref={end} />
      </div>
      <div className="sticky bottom-16 bg-sand-50/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {(SUGGEST[tour.stage] || SUGGEST.plan).map((q) => (
            <button key={q} onClick={() => send(q)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs text-stone-700 ring-1 ring-stone-200 hover:ring-rani-500">{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or tell me what to change…"
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
          <Button type="submit" disabled={busy} aria-label="Send"><Send size={16} /></Button>
        </form>
      </div>
    </div>
  )
}
