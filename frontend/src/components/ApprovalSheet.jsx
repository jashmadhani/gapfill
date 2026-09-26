import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Clock, Lock, ShieldCheck, X } from 'lucide-react'
import { api, inr, signedInr } from '../api'
import { useTour } from '../store'
import { Button, cx } from './ui'

const OPEN = ['proposed', 'awaiting_payment']
const STATUS = {
  proposed: ['Waiting for you', 'bg-amber-50 text-amber-800'],
  awaiting_payment: ['Payment page open', 'bg-sky-50 text-sky-800'],
  executed: ['Done', 'bg-emerald-50 text-emerald-800'],
  declined: ['Declined', 'bg-stone-100 text-stone-600'],
  cancelled: ['Cancelled', 'bg-stone-100 text-stone-600'],
  expired: ['Expired · nothing charged', 'bg-stone-100 text-stone-600'],
  stale: ['Price changed · nothing charged', 'bg-orange-50 text-orange-800'],
  failed: ['Not completed', 'bg-red-50 text-red-700'],
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = ok
    s.onerror = () => fail(new Error('Couldn’t load the payment page. Nothing was charged.'))
    document.body.appendChild(s)
  })
}

// After approval: open the provider's own page. Our app never sees card numbers, UPI PINs or OTPs.
export function usePayFlow() {
  const nav = useNavigate()
  const { notify, refresh, upsertApproval } = useTour()
  const [busy, setBusy] = useState(false)

  const finished = (i) => {
    upsertApproval(i)
    refresh()
    if (i.status === 'executed') {
      if (i.kind === 'booking') return nav('/booking', { state: { booking: i.result } })
      notify(`✓ ${i.summary.title}${i.refund ? ` · ${inr(i.refund)} refund on its way` : ''}`, 'success')
    } else if (i.error) notify(i.error, 'error')
  }

  const approve = async (i) => {
    setBusy(true)
    try {
      const r = await api.approveIntent(i.id, i.amount)
      upsertApproval(r.intent)
      if (r.status === 'executed') return finished(r.intent)
      if (r.checkout?.type === 'simulated') return nav(r.checkout.url)
      if (r.checkout?.type === 'razorpay') {
        await loadRazorpay()
        new window.Razorpay({
          key: r.checkout.key_id, order_id: r.checkout.order_id, amount: r.checkout.amount, currency: r.checkout.currency,
          name: r.checkout.name, description: r.checkout.description,
          handler: async (resp) => { try { finished(await api.razorpayVerify(i.id, resp)) } catch (e) { notify(e.message, 'error') } },
          modal: { ondismiss: () => api.declineIntent(i.id).then(upsertApproval).catch(() => {}) },
        }).open()
      }
    } catch (e) {
      notify(e.message, 'error')
      api.intent(i.id).then(upsertApproval).catch(() => {})
    } finally { setBusy(false) }
  }

  const decline = async (i) => {
    setBusy(true)
    try { upsertApproval(await api.declineIntent(i.id)); notify('Declined — nothing was charged or changed.') } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  return { approve, decline, busy }
}

function Countdown({ seconds }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => { setLeft(seconds); const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t) }, [seconds])
  return <span className="tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
}

// The approval card: what changes, exact amount, policy. Used in the sheet and inline in the assistant chat.
export function ApprovalCard({ intent: i, compact = false }) {
  const { approve, decline, busy } = usePayFlow()
  const [armed, setArmed] = useState(false)
  useEffect(() => { const t = setTimeout(() => setArmed(true), 700); return () => clearTimeout(t) }, [i.id]) // no approving by a stray tap as the card appears
  const [label, tone] = STATUS[i.status] || [i.status, 'bg-stone-100']
  const open = i.status === 'proposed'
  const money = i.amount > 0 ? `Approve & pay ${inr(i.amount)}` : i.refund > 0 ? `Approve · get ${inr(i.refund)} back` : 'Approve change'
  return (
    <div className="rounded-[1.6rem] bg-white p-4 shadow-soft ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-stone-500">
            {i.created_by === 'agent' && <span className="inline-flex items-center gap-1 rounded-full bg-rani-50 px-2 py-0.5 text-rani-700"><Bot size={12} aria-hidden /> Prepared by your assistant</span>}
            {i.created_by === 'operator' && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Suggested by your tour team</span>}
            <span className={cx('rounded-full px-2 py-0.5', tone)}>{label}</span>
          </div>
          <h3 className="mt-1.5 text-lg font-bold leading-snug text-ink">{i.summary.title}</h3>
          {i.summary.subtitle && <p className="text-sm text-stone-500">{i.summary.subtitle}</p>}
        </div>
        {open && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600"><Clock size={12} aria-hidden /><Countdown seconds={i.expires_in} /></span>}
      </div>
      {!compact || open ? (
        <ul className="mt-3 space-y-1.5 text-[15px]">
          {i.summary.lines.map((l, k) => (
            <li key={k} className={cx('flex items-start justify-between gap-3', l.strong ? 'border-t border-stone-100 pt-2 font-bold text-ink' : 'text-stone-600')}>
              <span>{l.label}</span>
              {l.amount != null && <span className="shrink-0 tabular-nums">{/change/i.test(l.label) ? signedInr(l.amount) : inr(l.amount)}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {open && i.summary.policy && <p className="mt-3 rounded-2xl bg-stone-50 p-3 text-sm text-stone-600">{i.summary.policy}</p>}
      {i.error && <p className="mt-3 text-sm font-medium text-red-700">{i.error}</p>}
      {open && (
        <>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => decline(i)}>Decline</Button>
            <Button disabled={busy || !armed} onClick={() => approve(i)}><Lock size={16} aria-hidden /> {busy ? 'Opening…' : money}</Button>
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-xs text-stone-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            {i.amount > 0 ? 'You’ll pay on the payment provider’s secure page. TourCraft and the assistant never see your card, UPI PIN or OTP.' : 'Nothing is charged. Refunds always go back to your original payment method.'}
          </p>
        </>
      )}
      {i.status === 'awaiting_payment' && <p className="mt-3 text-sm text-stone-600">Payment page is open. Close it to cancel — nothing is charged until you pay there.</p>}
    </div>
  )
}

// Global sheet: whichever screen (or the assistant) prepared a payment, the traveler decides here.
export default function ApprovalSheet() {
  const { approvals } = useTour()
  const [hidden, setHidden] = useState([])
  const pending = approvals.filter((a) => a.status === 'proposed' && !hidden.includes(a.id))
  const i = pending[0]
  if (!i || location.pathname.startsWith('/assist') || location.pathname.startsWith('/checkout')) return null
  return (
    <div className="animate-fade fixed inset-0 z-40 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Approve payment">
      <div className="animate-slide-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[2rem]">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-rani-600">Needs your approval{pending.length > 1 ? ` · ${pending.length}` : ''}</span>
          <button type="button" onClick={() => setHidden((h) => [...h, i.id])} aria-label="Decide later" className="grid h-10 w-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><X size={20} /></button>
        </div>
        <ApprovalCard intent={i} />
      </div>
    </div>
  )
}

export { OPEN as OPEN_APPROVAL }
