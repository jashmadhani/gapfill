// Turns a tour + demo clock into a story map: city stops, the route between them, and today's stops,
// each tagged done / current / next / changed. Road geometry is fetched separately (see RouteMap).

const toMin = (hhmm) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + m }
const PROBLEM = new Set(['weather', 'unavailable', 'declined'])
const arr = (x) => (Array.isArray(x) ? x : [])

// Smooth arc between two [lng, lat] points; only used until real roads arrive (or if routing is down).
export function arc(a, b, bend = 0.18, steps = 32) {
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

function around([lng, lat], i, n) {
  const r = 0.02, a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
  return [lng + Math.cos(a) * r * 1.15, lat + Math.sin(a) * r]
}

export function buildTripMap({ tour, state, cities, events = [] }) {
  const empty = { stops: [], legs: [], today: [], todayLegs: [], focus: null, routePoints: [], todayPoints: [] }
  if (!tour || !cities) return empty
  const pos = (key) => (cities[key] ? [cities[key].lng, cities[key].lat] : null)
  const riskIds = new Set(arr(tour.risks).filter((r) => PROBLEM.has(r.kind)).map((r) => r.item_id))
  const pendingIds = new Set(events.flatMap((e) => [
    e.item_id, ...arr(e.item_ids),
    ...arr(e.options).flatMap((o) => arr(o.changes).map((c) => (['replace', 'remove', 'retime'].includes(c.op) ? c.item_id : null))),
  ]).filter(Boolean))
  const changedItem = (i) => riskIds.has(i.id) || pendingIds.has(i.id)
  const live = (i) => !['replaced', 'cancelled'].includes(i.status)

  const finished = ['complete', 'review'].includes(tour.stage)
  const onTour = tour.stage === 'operate'
  const curDest = onTour ? tour.days_detail?.[tour.current_day - 1]?.dest : null
  const curIdx = curDest ? tour.route.findIndex((r) => r.dest === curDest) : -1

  const stops = tour.route.map((r, idx) => {
    const days = arr(tour.days_detail).filter((d) => d.dest === r.dest)
    const acts = days.flatMap((d) => d.items).filter((i) => i.kind === 'activity' && live(i))
    const changed = days.some((d) => d.items.some(changedItem))
    const status = finished ? 'done' : !onTour ? 'next' : idx < curIdx ? 'done' : idx === curIdx ? 'current' : 'next'
    return { key: r.dest, name: r.name, nights: r.nights, first_day: r.first_day, from_date: r.from_date, lngLat: pos(r.dest), status, changed,
      order: idx + 1, activities: acts.length, days: days.map((d) => d.day) }
  }).filter((s) => s.lngLat)

  const legs = stops.slice(1).map((b, i) => ({
    from: stops[i].key, to: b.key,
    status: b.status === 'done' || b.status === 'current' ? 'done' : b.changed ? 'changed' : 'next',
  }))

  // Today's story: start at the hotel, then each activity in time order (real coordinates when known).
  const day = onTour ? tour.days_detail[tour.current_day - 1] : tour.days_detail?.[0]
  const now = onTour ? toMin(state?.demo_time) : -1
  const center = day ? pos(day.dest) : null
  const acts = arr(day?.items).filter((i) => i.kind === 'activity' && live(i)).sort((a, b) => a.start_min - b.start_min)
  const hotel = arr(day?.items).find((i) => i.kind === 'hotel' && live(i))
  const at = (i, n) => (i.offering?.lat ? [i.offering.lng, i.offering.lat] : around(center, n, acts.length))
  const today = center ? acts.map((i, n) => ({
    id: i.id, title: i.title, start: i.start_label, end: i.end_label, lngLat: at(i, n), item: i,
    status: changedItem(i) ? 'changed' : i.end_min <= now ? 'done' : i.start_min <= now ? 'current' : 'next',
  })) : []
  const hotelAt = hotel?.offering?.lat ? [hotel.offering.lng, hotel.offering.lat] : null
  const todayPoints = [...(hotelAt ? [hotelAt] : []), ...today.map((t) => t.lngLat)]
  const todayLegs = today.map((t, k) => (k === 0 && !hotelAt ? null : { status: t.status === 'done' || t.status === 'current' ? 'done' : t.status === 'changed' ? 'changed' : 'next' })).filter(Boolean)

  return {
    stops, legs, today, todayLegs, focus: center, hotel: hotelAt ? { title: hotel.title, lngLat: hotelAt } : null,
    routePoints: stops.map((s) => s.lngLat), todayPoints,
    dayLabel: day ? `Day ${day.day} · ${day.dest_name}` : null,
  }
}
