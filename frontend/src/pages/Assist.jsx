import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, GraduationCap, Mail, Map, Mic, Plus, Send, Settings, Smile, Sparkles } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { Button, Empty, Spinner, cx } from '../components/ui'

// Icons cycle so the suggestion row reads like the reference board (mail, mood, plan, etc.)
// rather than every chip carrying the same glyph.
const CHIP_ICONS = [Mail, Smile, Map, GraduationCap, Compass, Sparkles]

const SUGGEST = {
  plan: ['Show day 2', 'Add a cooking class', 'Cheaper hotel', 'How much is it?'],
  prepare: ['How much have I paid?', 'Show day 1', 'Upgrade my hotel', 'Call my coordinator'],
  operate: ["What's next today?", 'Add something foodie tomorrow', "I'm running 30 min late", "It's raining", 'Make tomorrow lighter', 'Call my coordinator'],
  complete: ['How much did I spend?'],
  review: ['How much did I spend?'],
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
      <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
    </svg>
  )
}

// Assist: a conversational layer over the same planning engine, it can read, change and replan the tour.
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

  const first = tour?.customer?.name?.split(' ')[0] || 'there'
  const suggestions = SUGGEST[tour.stage] || SUGGEST.plan
  const empty = msgs !== null && msgs.length === 0

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Flat header, not a photo hero: logo + name, settings on the right (reference board). */}
      <header className="pt-safe flex items-center justify-between px-5 pb-2 pt-4 lg:px-8">
        <span className="inline-flex items-center gap-2 text-[17px] font-bold text-ink"><span className="text-rani-600"><Logo /></span>TourCraft Assist</span>
        <Link to="/profile" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-600 hover:text-ink"><Settings size={19} /></Link>
      </header>

      {empty ? (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="px-5 pt-6 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-1.5 text-sm font-semibold text-stone-600"><Sparkles size={14} className="text-violet-500" aria-hidden /> AI assistant</span>
            <h1 className="mt-5 text-[2rem] font-bold leading-[1.15] text-ink md:text-4xl">Hi {first},<br />how can I help today?</h1>
          </div>

          {/* Soft violet smudge behind the suggestions and input — the one deliberately-warm accent
              against an otherwise all-blue app, same trick as the reference board. */}
          <div className="assist-glow pointer-events-none absolute inset-x-0 bottom-0 h-[60%]" aria-hidden />

          <div className="relative mt-auto px-5 pb-3 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q, i) => {
                const Icon = CHIP_ICONS[i % CHIP_ICONS.length]
                return (
                  <button key={q} onClick={() => send(q)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-semibold text-stone-700 shadow-soft ring-1 ring-white/70 backdrop-blur hover:ring-rani-300">
                    <Icon size={15} className="text-stone-500" aria-hidden />{q}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-0">
          <div className="space-y-2.5">
            {msgs === null && <Spinner />}
            {msgs?.map((m) => (
              <div key={m.id} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[85%] whitespace-pre-line rounded-[1.3rem] px-4 py-2.5 text-[16px] leading-snug shadow-soft',
                  m.role === 'user' ? 'rounded-br-md bg-rani-600 text-white' : 'rounded-bl-md bg-stone-100 text-stone-800')}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div className="flex"><div className="rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-stone-400">•••</div></div>}
            <div ref={end} />
          </div>
        </div>
      )}

      {/* Pill input: a leading "+" placeholder for attachments, a trailing mic that swaps to send
          once there is text to send. The mic itself does nothing yet — voice capture is a later,
          backend-dependent piece; this just reserves its place in the UI. */}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 bg-white px-5 pb-3 pt-2 lg:bottom-0">
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-stone-100 py-1.5 pl-1.5 pr-2">
          <button type="button" aria-label="Attach" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-200"><Plus size={20} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Got questions…"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none" />
          {text.trim() ? (
            <Button type="submit" disabled={busy} aria-label="Send" className="!min-h-11 !w-11 !p-0"><Send size={16} /></Button>
          ) : (
            <button type="button" aria-label="Voice input (coming soon)" title="Voice input — coming soon"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-rani-600 text-white shadow-soft">
              <Mic size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
