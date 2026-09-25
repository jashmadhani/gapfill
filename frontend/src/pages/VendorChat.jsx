import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCheck, Send } from 'lucide-react'
import { api, inr } from '../api'
import { ACCESS, GROUP_LABEL } from '../components/ui'

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
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[14px] leading-snug shadow-sm ${me ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'}`}>
        {children}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-stone-400">{time()} {me && <CheckCheck size={12} className="text-sky-500" />}</div>
      </div>
    </div>
  )
}

function DraftCard({ draft, setDraft, onPublish, busy, source }) {
  const a = draft.accessibility_attributes || {}
  const field = (k, label, type = 'text') => (
    <label className="block">
      <span className="text-[11px] text-stone-500">{label}</span>
      <input type={type} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="w-full rounded border border-stone-200 px-2 py-1 text-sm" />
    </label>
  )
  return (
    <div className="space-y-2">
      <div className="font-semibold">Here’s your listing draft {source === 'llm' ? '(AI-extracted)' : ''} 👇</div>
      <div className="space-y-2 rounded-md bg-stone-50 p-2">
        {field('title', 'Title')}
        <div className="grid grid-cols-3 gap-2">
          {field('price', 'Price ₹', 'number')}
          {field('duration_min', 'Minutes', 'number')}
          {field('capacity_left', 'Spots', 'number')}
        </div>
        <div className="text-xs text-stone-600">
          📍 {draft.location?.name} · 🕘 {draft.opening_hours?.open}–{draft.opening_hours?.close} · {draft.indoor_outdoor}
        </div>
        <div className="text-xs text-stone-600">🏷 {draft.category_tags.join(', ')} · 👥 {draft.group_suitability.map((g) => GROUP_LABEL[g]).join(', ')}</div>
        <div className="text-xs text-stone-600">♿ {Object.entries(ACCESS).filter(([k]) => a[k]).map(([, v]) => v.label).join(', ') || 'none listed'}</div>
        {draft.needs_review?.length > 0 && <div className="text-xs text-amber-700">Please double-check: {draft.needs_review.join(', ')} (I guessed)</div>}
      </div>
      <button onClick={onPublish} disabled={busy} className="w-full rounded-md bg-[#00a884] py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Publishing…' : `✅ Looks good — publish at ${inr(draft.price)}`}
      </button>
    </div>
  )
}

// Guided WhatsApp-style onboarding: 5 questions, extracted draft, one-tap confirm.
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
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [answers, draft, published, typing])

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
    <div className="mx-auto flex h-full max-w-md flex-col bg-[#efeae2]">
      <header className="flex items-center gap-3 bg-[#008069] px-3 py-3 text-white">
        <Link to={vendorId ? `/vendor/${vendorId}` : '/vendor'}><ArrowLeft size={20} /></Link>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-bold">GF</div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">GapFill for Hosts</div>
          <div className="text-xs text-emerald-100">{typing ? 'typing…' : 'online'}</div>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <div className="mx-auto w-fit rounded-md bg-[#fdf4c5] px-3 py-1 text-center text-[11px] text-stone-600">List your experience in 5 quick questions. No app, no dashboard.</div>
        {questions.slice(0, Math.min(step + 1, questions.length)).map((q, i) => (
          <div key={i} className="space-y-2">
            <Bubble from="bot">{q}</Bubble>
            {answers[i] && <Bubble from="me">{answers[i]}</Bubble>}
          </div>
        ))}
        {typing && <Bubble from="bot"><span className="tracking-widest text-stone-400">•••</span></Bubble>}
        {draft && !published && <Bubble from="bot"><DraftCard draft={draft} setDraft={setDraft} onPublish={publish} busy={busy} source={source} /></Bubble>}
        {published && (
          <Bubble from="bot">
            🎉 <b>{published.experience.title}</b> is live! Travelers with a free window near {published.experience.location.name} can now get it as their top pick.
            <div className="mt-2">
              Update Open / Closed / Full / spots left any time with one tap from your <Link className="text-[#008069] underline" to={`/vendor/${published.vendor_id}`}>status console</Link>.
            </div>
          </Bubble>
        )}
        <div ref={end} />
      </div>

      {!done && (
        <div className="bg-[#f0f2f5] p-2">
          {step === 0 && <button onClick={fillSample} className="mb-2 w-full rounded-full bg-white py-1.5 text-xs text-[#008069] shadow-sm">⚡ Demo: fill sample answers</button>}
          <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message"
              className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm focus:outline-none" />
            <button className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884] text-white" aria-label="Send"><Send size={18} /></button>
          </form>
        </div>
      )}
    </div>
  )
}
