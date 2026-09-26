// Turns a tour + demo clock into map geometry: city stops, Strava-style route segments,
// and today's activity pins, each tagged done / current / next / changed.

const toMin = (hhmm) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + m }
const PROBLEM = new Set(['weather', 'unavailable', 'declined'])

// Smooth arc between two [lng, lat] points (quadratic bezier bowed to one side).
export function arc(a, b, bend = 0.18, steps = 40) {
  const [x1, y1] = a, [x2, y2] = b
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dx = x2 - x1, dy = y2 - y1
  const cx = mx - dy * bend, cy = my + dx * bend
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2])
  }
  return pts
}

// Activities have no coordinates of their own: fan them out around their city so each gets a tappable pin.
function around([lng, lat], i, n) {
  const r = 0.028, a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
  return [lng + Math.cos(a) * r * 1.15, lat + Math.sin(a) * r]
}

export function buildTripMap({ tour, state, cities, events = [] }) {
  const empty = { stops: [], segments: [], today: [], todayPath: [], focus: null }
  if (!tour || !cities) return empty
  const pos = (key) => (cities[key] ? [cities[key].lng, cities[key].lat] : null)
  const riskIds = new Set((tour.risks || []).filter((r) => PROBLEM.has(r.kind)).map((r) => r.item_id))
  // pending change cards (pushed live) mark their items as changed until resolved
  const arr = (x) => (Array.isArray(x) ? x : [])
  const pendingIds = new Set(events.flatMap((e) => [
    e.item_id, ...arr(e.item_ids),
    ...arr(e.options).flatMap((o) => arr(o.changes).map((c) => (['replace', 'remove', 'retime'].includes(c.op) ? c.item_id : null))),
  ]).filter(Boolean))
  const changedItem = (i) => riskIds.has(i.id) || pendingIds.has(i.id)

  const finished = ['complete', 'review'].includes(tour.stage)
  const onTour = tour.stage === 'operate'
  const curDest = onTour ? tour.days_detail?.[tour.current_day - 1]?.dest : null
  const curIdx = curDest ? tour.route.findIndex((r) => r.dest === curDest) : -1

  const stops = tour.route.map((r, idx) => {
    const days = (tour.days_detail || []).filter((d) => d.dest === r.dest)
    const changed = days.some((d) => d.items.some(changedItem))
    const status = finished ? 'done' : !onTour ? 'next' : idx < curIdx ? 'done' : idx === curIdx ? 'current' : 'next'
    return { key: r.dest, name: r.name, nights: r.nights, first_day: r.first_day, lngLat: pos(r.dest), status, changed, order: idx + 1 }
  }).filter((s) => s.lngLat)

  const segments = []
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1]
    const done = b.status === 'done' || b.status === 'current'
    segments.push({ coords: arc(a.lngLat, b.lngLat, i % 2 ? -0.16 : 0.16), status: done ? 'done' : b.changed ? 'changed' : 'next' })
  }

  // Today's activities around the current city (on tour) or day 1's city (before the trip).
  const day = onTour ? tour.days_detail[tour.current_day - 1] : tour.days_detail?.[0]
  const now = onTour ? toMin(state?.demo_time) : -1
  const acts = (day?.items || []).filter((i) => i.kind === 'activity' && !['replaced', 'cancelled'].includes(i.status))
  const center = day ? pos(day.dest) : null
  const today = center ? acts.map((i, n) => ({
    id: i.id, title: i.title, start: i.start_label, end: i.end_label, lngLat: around(center, n, acts.length), item: i,
    status: changedItem(i) ? 'changed' : i.end_min <= now ? 'done' : i.start_min <= now ? 'current' : 'next',
  })) : []
  const todayPath = today.length > 1 ? today.slice(1).map((p, k) => ({
    coords: arc(today[k].lngLat, p.lngLat, 0.25, 16), status: p.status === 'done' || p.status === 'current' ? 'done' : 'next',
  })) : []

  return { stops, segments, today, todayPath, focus: center, dayLabel: day ? `Day ${day.day} · ${day.dest_name}` : null }
}
