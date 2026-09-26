import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Accessibility, ArrowLeft, Check, CheckCheck, Clock, MapPin, PartyPopper, Send, Tag, Users, Zap } from 'lucide-react'
import { api, inr } from '../api'
import { ACCESS, GROUP_LABEL, cx } from '../components/ui'

const SAMPLE_ANSWERS = [
  "We're Kesar Blue Pottery and we run a blue pottery painting class for beginners.",
  'Near Hawa Mahal, in our family studio on the first lane.',
  'About 1.5 hours, ₹650 per person, up to 8 guests per batch.',
  '10am to 6pm every day, indoors.',
  'Great for families, couples and solo travelers. Ground floor with seating and a washroom, and it’s quiet.',
]

const time = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

function Bubble({ from, children }) {
  const me = from === 'me'
  return (
    <div className={cx('flex', me ? 'justify-end' : 'justify-start')}>
      <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-card md:max-w-[70%]',
        me ? 'rounded-tr-md bg-success-soft text-ink' : 'rounded-tl-md bg-surface text-ink')}>
        {children}
        <div className="mt-1 flex items-center justify-end gap-1 text-xs text-ink-3">{time()} {me && <CheckCheck size={14} className="text-accent" aria-label="read" />}</div>
      </div>
    </div>
  )
}

function DraftCard({ draft, setDraft, onPublish, busy, source }) {
  const a = draft.accessibility_attributes || {}
  const field = (k, label, type = 'text') => (
    <label className="block">
      <span className="text-xs font-medium text-ink-3">{label}</span>
      <input type={type} inputMode={type === 'number' ? 'numeric' : undefined} value={draft[k]}
        onChange={(e) => setDraft({ ...draft, [k]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="mt-0.5 min-h-11 w-full rounded-lg bg-surface px-2.5 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent" />
    </label>
  )
  const Row = ({ Icon, children }) => <p className="flex items-start gap-2 text-sm text-ink-2"><Icon size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden /> <span>{children}</span></p>
  return (
    <div className="space-y-3">
      <p className="font-semibold">Here’s your listing draft{source === 'llm' ? ' (AI-extracted)' : ''}. Tweak anything, then publish.</p>
      <div className="space-y-2.5 rounded-xl bg-surface-2 p-3">
        {field('title', 'Title')}
        <div className="grid grid-cols-3 gap-2">
          {field('price', 'Price ₹', 'number')}
          {field('duration_min', 'Minutes', 'number')}
          {field('capacity_left', 'Spots', 'number')}
        </div>
        <Row Icon={MapPin}>{draft.location?.name}</Row>
        <Row Icon={Clock}>{draft.opening_hours?.open}–{draft.opening_hours?.close} · {draft.indoor_outdoor}</Row>
        <Row Icon={Tag}>{draft.category_tags.join(', ')}</Row>
        <Row Icon={Users}>{draft.group_suitability.map((g) => GROUP_LABEL[g]).join(', ')}</Row>
        <Row Icon={Accessibility}>{Object.entries(ACCESS).filter(([k]) => a[k]).map(([, v]) => v.label).join(', ') || 'None listed'}</Row>
        {draft.needs_review?.length > 0 && <p className="text-sm font-medium text-warn">Please double-check: {draft.needs_review.join(', ')} (guessed)</p>}
      </div>
      <button type="button" onClick={onPublish} disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-success px-4 font-semibold text-on-brand disabled:opacity-50">
        <Check size={18} aria-hidden /> {busy ? 'Publishing…' : `Looks good, publish at ${inr(draft.price)}`}
      </button>
    </div>
  )
}

// Guided chat-style onboarding: 5 questions, extracted draft, one-tap confirm.
export default function VendorChat() {
  const [params] = useSearchParams()
  const vendorId = Number(params.get('vendor')) || null
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [input, setInput] = useState('')
  const [draft, setDraft] = useState(null)
  const [source, setSource] = useState(null)
  const [published, setPublished] = useState(null)
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const end = useRef()
  const answersRef = useRef([])

  useEffect(() => { api.onboardQuestions().then((r) => setQuestions(r.questions)) }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [answers, draft, published, typing])

  const step = answers.length
  const done = questions.length > 0 && step >= questions.length

  const send = async (text) => {
    const t = (text ?? input).trim()
    if (!t || answersRef.current.length >= questions.length) return
    const next = [...answersRef.current, t]
    answersRef.current = next
    setAnswers(next)
    setInput('')
    setTyping(true)
    await new Promise((r) => setTimeout(r, 450))
    if (next.length >= questions.length) {
      const r = await api.onboard(next, questions)
      setDraft(r.draft); setSource(r.source)
    }
    setTyping(false)
  }

  const fillSample = async () => {
    for (const a of SAMPLE_ANSWERS.slice(answersRef.current.length)) {
      await send(a) // eslint-disable-line no-await-in-loop
    }
  }

  const publish = async () => {
    setBusy(true)
    try { setPublished(await api.publish(draft, vendorId)) } finally { setBusy(false) }
  }

  return (
    <div className="flex h-dvh flex-col bg-surface-2">
      <header className="bg-accent text-on-brand">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-2 py-2">
          <Link to={vendorId ? `/vendor/${vendorId}` : '/vendor'} aria-label="Back to vendor console" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/15"><ArrowLeft size={20} aria-hidden /></Link>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 font-display text-sm font-bold" aria-hidden>GF</div>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold leading-tight">GapFill for Hosts</h1>
            <p className="text-sm opacity-85" aria-live="polite">{typing ? 'typing…' : 'online'}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2.5 px-3 py-4 md:px-6" role="log" aria-label="Onboarding chat">
          <p className="mx-auto w-fit rounded-lg bg-warn-soft px-3 py-1.5 text-center text-sm text-warn">List your experience in 5 quick questions. No app, no dashboard.</p>
          {questions.slice(0, Math.min(step + 1, questions.length)).map((q, i) => (
            <div key={i} className="space-y-2.5">
              <Bubble from="bot">{q}</Bubble>
              {answers[i] && <Bubble from="me">{answers[i]}</Bubble>}
            </div>
          ))}
          {typing && <Bubble from="bot"><span className="tracking-widest text-ink-3" aria-label="typing">•••</span></Bubble>}
          {draft && !published && <Bubble from="bot"><DraftCard draft={draft} setDraft={setDraft} onPublish={publish} busy={busy} source={source} /></Bubble>}
          {published && (
            <Bubble from="bot">
              <p className="flex items-start gap-2"><PartyPopper size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <span><b>{published.experience.title}</b> is live. Travelers with a free window near {published.experience.location.name} can now get it as their top pick.</span></p>
              <p className="mt-2">Update Open / Closed / Full / spots left any time with one tap from your <Link className="font-medium text-accent-ink underline" to={`/vendor/${published.vendor_id}`}>status console</Link>.</p>
            </Bubble>
          )}
          <div ref={end} />
        </div>
      </div>

      {!done && (
        <div className="pb-safe border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl p-2 md:px-6">
            {step === 0 && (
              <button type="button" onClick={fillSample} className="mb-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent-soft text-sm font-medium text-accent-ink">
                <Zap size={15} aria-hidden /> Demo: fill sample answers
              </button>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
              <label htmlFor="msg" className="sr-only">Your answer</label>
              <input id="msg" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your answer" autoComplete="off"
                className="min-h-12 flex-1 rounded-full bg-surface-2 px-4 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent" />
              <button type="submit" aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-on-brand"><Send size={18} aria-hidden /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
