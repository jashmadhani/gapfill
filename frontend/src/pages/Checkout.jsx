import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, CircleX, FlaskConical, Lock } from 'lucide-react'
import { api, inr } from '../api'
import { useTour } from '../store'

// Stand-in for a payment provider's hosted page (used when no Razorpay test keys are configured).
// On purpose it has NO card, UPI PIN or OTP fields: a fake page that asks for those would teach a bad habit.
export default function Checkout() {
  const { pid } = useParams()
  const nav = useNavigate()
  const { refresh, upsertApproval, notify } = useTour()
  const [i, setI] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [armed, setArmed] = useState(false)
  useEffect(() => { api.intent(pid).then(setI).catch((e) => setErr(e.message)) }, [pid])
  // Tap-jacking guard: the Pay button only arms a moment after it appears, so a double-tap on "Approve"
  // (which brought you here) can never land on "Pay".
  useEffect(() => { if (i?.status === 'awaiting_payment') { const t = setTimeout(() => setArmed(true), 1000); return () => clearTimeout(t) } }, [i?.status])

  const go = async (outcome) => {
    setBusy(true)
    try {
      const r = await api.simulatePay(pid, outcome)
      setI(r)
      upsertApproval(r)
      refresh()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const done = () => {
    if (i?.status === 'executed' && i.kind === 'booking') return nav('/booking', { state: { booking: i.result } })
    if (i?.status === 'executed') notify(`✓ ${i.summary.title}`, 'success')
    nav('/trip')
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4f5f7] px-4 py-8 font-sans text-[#1b1f24]">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-bold"><Lock size={15} aria-hidden /> TestPay</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900"><FlaskConical size={12} aria-hidden /> Test mode</span>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_10px_40px_rgb(0_0_0/0.08)] ring-1 ring-black/5">
          {!i && !err && <p className="text-sm text-[#5b6470]">Loading…</p>}
          {err && !i && <p className="text-sm text-red-700">{err}</p>}
          {i && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5b6470]">Paying</p>
              <p className="text-lg font-bold">TourCraft Tours</p>
              <p className="text-sm text-[#5b6470]">{i.summary.title}</p>
              <p className="mt-5 text-4xl font-bold tabular-nums">{inr(i.amount)}</p>

              {i.status === 'awaiting_payment' && (
                <>
                  <div className="mt-5 rounded-xl bg-[#f4f5f7] p-3 text-sm text-[#3d444d]">
                    This is a simulated payment page for the demo. No real money moves, and it never asks for card numbers,
                    UPI PINs or OTPs. With Razorpay test keys configured, the real provider page opens instead.
                  </div>
                  {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
                  <button type="button" disabled={busy || !armed} onClick={() => go('success')}
                    className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1a56db] font-bold text-white hover:bg-[#1648b8] disabled:opacity-50">
                    {busy ? 'Processing…' : armed ? `Pay ${inr(i.amount)} (test)` : 'Getting ready…'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => go('cancel')} className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-[#5b6470] hover:bg-[#f4f5f7]">
                    Cancel payment
                  </button>
                </>
              )}
              {i.status === 'executed' && (
                <div className="mt-5 text-center">
                  <CheckCircle2 size={44} className="mx-auto text-emerald-600" aria-hidden />
                  <p className="mt-2 font-bold">Payment successful</p>
                  <p className="text-sm text-[#5b6470]">{i.result?.tickets_issued ? `${i.result.tickets_issued} ticket${i.result.tickets_issued > 1 ? 's' : ''} issued` : 'Your trip is updated'}</p>
                </div>
              )}
              {!['awaiting_payment', 'executed'].includes(i.status) && (
                <div className="mt-5 text-center">
                  <CircleX size={44} className="mx-auto text-[#8a93a0]" aria-hidden />
                  <p className="mt-2 font-bold">{i.status === 'failed' ? 'Payment not completed' : i.status === 'expired' ? 'This payment expired' : 'Payment cancelled'}</p>
                  <p className="text-sm text-[#5b6470]">{i.error || 'Nothing was charged.'}</p>
                </div>
              )}
              {i.status !== 'awaiting_payment' && (
                <button type="button" onClick={done} className="mt-5 min-h-12 w-full rounded-xl bg-[#1b1f24] font-bold text-white">Back to TourCraft</button>
              )}
            </>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-[#8a93a0]">Secured by the payment provider · TourCraft never sees your payment details</p>
      </div>
    </div>
  )
}
