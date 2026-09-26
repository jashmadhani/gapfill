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
  setClock: (body) => req('POST', '/demo/clock', body),
  discover: (interests = []) => req('GET', `/discover?interests=${interests.join(',')}`),
  destination: (key) => req('GET', `/destinations/${key}`),
  roads: (pts) => req('GET', `/roads?pts=${pts.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(';')}`),
  offering: (id) => req('GET', `/offerings/${id}`),
  plan: (body) => req('POST', '/tours/plan', body),
  tours: () => req('GET', '/tours'),
  tour: (id) => req('GET', `/tours/${id}`),
  activate: (id) => req('POST', `/tours/${id}/activate`),
  patchTour: (id, body) => req('PATCH', `/tours/${id}`, body),
  alternatives: (id, itemId) => req('GET', `/tours/${id}/items/${itemId}/alternatives`),
  swap: (id, itemId, body) => req('POST', `/tours/${id}/items/${itemId}/swap`, body),
  removeItem: (id, itemId) => req('DELETE', `/tours/${id}/items/${itemId}`),
  addItem: (id, offering_id, day) => req('POST', `/tours/${id}/items`, { offering_id, day }),
  optimise: (id) => req('POST', `/tours/${id}/optimise`),
  book: (id, pay, method) => req('POST', `/tours/${id}/book`, { pay, method }),
  pay: (id, body) => req('POST', `/tours/${id}/payments`, body),
  checklist: (id, key, done) => req('POST', `/tours/${id}/checklist`, { key, done }),
  review: (id, body) => req('POST', `/tours/${id}/review`, body),
  chat: (id) => req('GET', `/tours/${id}/chat`),
  say: (id, text) => req('POST', `/tours/${id}/chat`, { text }),
  trigger: (body) => req('POST', '/changes/trigger', body),
  changes: (q = '') => req('GET', `/changes${q}`),
  change: (id) => req('GET', `/changes/${id}`),
  resolve: (id, action, option, by = 'traveler') => req('POST', `/changes/${id}/resolve`, { action, option, by }),
  vendors: () => req('GET', '/vendors'),
  vendor: (id) => req('GET', `/vendors/${id}`),
  vendorStatus: (id, body) => req('PATCH', `/vendors/${id}/status`, body),
  vendorBooking: (id, itemId, action) => req('POST', `/vendors/${id}/bookings/${itemId}`, { action }),
  dashboard: () => req('GET', '/operator/dashboard'),
  schedule: (day) => req('GET', `/operator/schedule${day ? `?day=${day}` : ''}`),
  people: () => req('GET', '/operator/people'),
  payments: () => req('GET', '/operator/payments'),
  tasks: (status = 'open') => req('GET', `/operator/tasks?status=${status}`),
  taskDone: (id) => req('POST', `/operator/tasks/${id}/done`),
  coordinators: () => req('GET', '/coordinators'),
}

export function wsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

export const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.round(Math.abs(n ?? 0)).toLocaleString('en-IN')
export const signedInr = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + '₹' + Math.round(Math.abs(n ?? 0)).toLocaleString('en-IN')
export const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', opts)
export function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

Object.assign(api, {
  retime: (id, itemId, start_min) => req('POST', `/tours/${id}/items/${itemId}/retime`, { start_min }),
  moodCheckin: (id, body) => req('POST', `/tours/${id}/mood`, body),
  parseMood: (text) => req('POST', '/ml/mood', { text }),
  offeringInsights: (id, tourId) => req('GET', `/offerings/${id}/insights${tourId ? `?tour_id=${tourId}` : ''}`),
  mlMetrics: () => req('GET', '/ml/metrics'),
  mlRetrain: () => req('POST', '/ml/retrain'),
  mlPredict: (body) => req('POST', '/ml/predict', body),
  // Digital Twin  (BASE already prefixes /api, so paths here start after that)
  dtLiveWeather: (city) => req('GET', `/digital-twin/live-weather?city=${encodeURIComponent(city)}`),
  dtSimulate: (body) => req('POST', '/digital-twin/simulate', body),
  dtSocialSignals: (city, rain_mm, temp, condition) =>
    req('GET', `/digital-twin/social-signals?city=${encodeURIComponent(city)}&rain_mm=${rain_mm}&temp=${temp}&condition=${encodeURIComponent(condition)}`),
  dtApplyMitigation: (tourId) => req('POST', `/digital-twin/apply-mitigation?tour_id=${tourId}`),
})
