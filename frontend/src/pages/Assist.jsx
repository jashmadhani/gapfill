import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Bot, FileCheck2, Search, Send, ShieldCheck, Zap } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { Button, Empty, Spinner, cx } from '../components/ui'
import { PageBody, PageHero } from '../components/page'
import { destImage } from '../media'
import { ApprovalCard } from '../components/ApprovalSheet'

const SUGGEST = {
  plan: ['Book it with the 30% deposit', 'Add a cooking class', 'Cheaper hotel', 'How much is it?'],
  prepare: ['Pay the balance', 'Show my tickets', 'Upgrade my hotel', 'What’s the cancellation policy for the food trail?'],
  operate: ["What's next today?", 'Add something foodie tomorrow', 'Go with the recommended option', "I'm running 30 min late", 'Show my tickets', 'Skip the zipline'],
  complete: ['How much did I spend?'],
  review: ['How much did I spend?'],
}

const STEP = { read: Search, action: Zap, propose: FileCheck2 }

// What the agent actually did for this reply, including anything the gateway blocked.
function Trace({ steps, mode }) {
  return (
    <details className="mt-2 text-xs text-stone-500">
      <summary className="cursor-pointer select-none font-semibold">{steps.length} step{steps.length > 1 ? 's' : ''} · {mode}</summary>
      <ul className="mt-1 space-y-0.5">
        {steps.map((t, k) => {
          const I = t.ok ? STEP[t.kind] || Search : Ban
          return <li key={k} className={cx('flex items-center gap-1.5', !t.ok && 'text-red-600')}><I size={12} aria-hidden /> <span className="font-mono">{t.tool}</span>{!t.ok && ' — blocked'}</li>
        })}
      </ul>
    </details>
  )
}

// Assist: the booking & ticketing agent. It reads, searches and prepares; the traveler approves every payment.
export default function Assist() {
  const { tour, state, refresh, notify, approvals, upsertApproval } = useTour()
  const live = (a) => approvals.find((x) => x.id === a.id) || a
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
    const uid = `u${Date.now()}`
    setMsgs((m) => [...(m || []), { id: uid, role: 'user', text: t }])
    setBusy(true)
    try {
      const r = await api.say(tour.id, t)
      // Show what the server kept: card numbers / PINs are masked on screen too, not just in storage.
      setMsgs((m) => [...m.map((x) => (x.id === uid && r.safe_text ? { ...x, text: r.safe_text } : x)), { id: `a${Date.now()}`, role: 'assistant', text: r.reply, data: r.data }])
      r.data?.approvals?.forEach(upsertApproval)
      refresh()
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <PageHero size="sm" img={destImage(tour.route[0]?.dest)} eyebrow={busy ? 'Thinking…' : 'Knows your whole plan'} title="Trip assistant" />
      <PageBody width="narrow" className="flex-1">
      <div className="flex-1 space-y-2.5">
        {msgs === null && <Spinner />}
        <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>I can book, pay balances and make paid changes — but I only <b>prepare</b> them. You approve every payment yourself and pay on the provider’s page. Never share card numbers, PINs or OTPs here.</span>
        </p>
        {msgs?.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">Hi! Ask me about your schedule, costs, tickets, or tell me what to change.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={cx('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cx('max-w-[85%] whitespace-pre-line rounded-[1.3rem] px-4 py-2.5 text-[16px] leading-snug shadow-soft',
              m.role === 'user' ? 'rounded-br-md bg-rani-600 text-white' : 'rounded-bl-md bg-white text-stone-800 ring-1 ring-stone-200')}>
              {m.text}
              {m.data?.trace?.length > 0 && <Trace steps={m.data.trace} mode={m.data.mode} />}
            </div>
            {m.data?.approvals?.map((a) => <div key={a.id} className="mt-2 w-full max-w-md"><ApprovalCard intent={live(a)} compact /></div>)}
          </div>
        ))}
        {busy && <div className="flex"><div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 text-stone-400 ring-1 ring-stone-200">•••</div></div>}
        <div ref={end} />
      </div>
      </PageBody>
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 bg-sand-50/95 px-5 pb-3 pt-2 backdrop-blur lg:bottom-0"><div className="mx-auto max-w-3xl">
        <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {(SUGGEST[tour.stage] || SUGGEST.plan).map((q) => (
            <button key={q} onClick={() => send(q)} className="min-h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 hover:ring-rani-500">{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or tell me what to change…"
            className="min-h-12 flex-1 rounded-full bg-white px-5 text-[16px] ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-rani-500" />
          <Button type="submit" disabled={busy} aria-label="Send"><Send size={16} /></Button>
        </form>
      </div></div>
    </div>
  )
}
