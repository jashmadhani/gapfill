// All calls go through the Vite proxy (/api -> FastAPI on :8000), so no CORS setup is needed in dev.
const BASE = import.meta.env.VITE_API_URL || '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

export const api = {
  state: () => req('GET', '/state'),
  reset: () => req('POST', '/demo/reset'),
  setClock: (demo_now) => req('POST', '/demo/clock', { demo_now }),
  startSession: (body) => req('POST', '/session/start', body),
  intent: (text) => req('POST', '/session/intent', { text }),
  createItinerary: (body) => req('POST', '/itinerary', body),
  itinerary: (id) => req('GET', `/itinerary/${id}`),
  recomputeGaps: (id) => req('POST', `/itinerary/${id}/gaps`),
  addToSlot: (id, slot_id, experience_ids) => req('POST', `/itinerary/${id}/items`, { slot_id, experience_ids }),
  recommendations: (slotId) => req('GET', `/recommendations?slot_id=${slotId}`),
  experience: (id) => req('GET', `/experiences/${id}`),
  experiences: () => req('GET', '/experiences'),
  trigger: (body) => req('POST', '/disruption/trigger', body),
  pendingDisruptions: () => req('GET', '/disruption/pending'),
  alternatives: (id) => req('GET', `/disruption/${id}/alternatives`),
  resolve: (id, action, choice = 'primary') => req('POST', `/disruption/${id}/resolve`, { action, choice }),
  vendors: () => req('GET', '/vendors'),
  vendor: (id) => req('GET', `/vendor/${id}`),
  onboardQuestions: () => req('GET', '/vendor/onboard/questions'),
  onboard: (answers, questions) => req('POST', '/vendor/onboard', { answers, questions }),
  publish: (draft, vendor_id) => req('POST', '/vendor/listings', { draft, vendor_id }),
  vendorStatus: (id, body) => req('PATCH', `/vendor/${id}/status`, body),
  demand: (id) => req('GET', `/vendor/${id}/demand-signals`),
  book: (itinerary_item_ids) => req('POST', '/booking/confirm', { itinerary_item_ids }),
}

export function wsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

export const inr = (n) => '₹' + Math.round(n ?? 0).toLocaleString('en-IN')
