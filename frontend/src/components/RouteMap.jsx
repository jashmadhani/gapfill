import { useEffect, useMemo, useRef, useState } from 'react'
import { LngLatBounds, Map as MLMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Locate, Route as RouteIcon } from 'lucide-react'
import { api } from '../api'
import { arc } from '../lib/tripMap'
import { cx } from './ui'

// Free vector tiles (OpenFreeMap, no key). Roads come from our /roads endpoint (OSRM, cached on the server).
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const COLOR = { done: '#16a34a', next: '#2f64b0', changed: '#ea580c' }

const fc = (segs) => ({ type: 'FeatureCollection', features: segs.map((s) => ({ type: 'Feature', properties: { status: s.status }, geometry: { type: 'LineString', coordinates: s.coords } })) })
const keyOf = (pts) => pts.map((p) => p.map((x) => x.toFixed(4)).join(',')).join(';')

function useRoads(points) {
  const [legs, setLegs] = useState(null)
  const k = keyOf(points)
  useEffect(() => {
    setLegs(null)
    if (points.length < 2) return
    let off = false
    api.roads(points.slice(0, 12)).then((r) => !off && setLegs(r.legs)).catch(() => !off && setLegs([]))
    return () => { off = true }
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  return legs
}

function pinEl({ label, status, kind, text, sub, selected, onClick }) {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', label)
  el.className = 'tc-pin'
  el.dataset.status = status
  el.dataset.kind = kind
  if (selected) el.dataset.selected = 'true'
  el.innerHTML = `<span class="tc-dot${kind === 'activity' || kind === 'hotel' ? ' tc-dot-md' : ''}">${text ?? ''}</span>${sub ? `<span class="tc-label">${sub}</span>` : ''}`
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick?.() })
  return el
}

/**
 * Story map of a tour.
 * route: the cities, joined by real roads, green = travelled, dashed blue = ahead, orange = changed.
 * today: the current day's stops in order (hotel → 1 → 2 → 3) on real streets.
 * Tapping a stop flies to it and tells the parent (which shows the photo card).
 */
export default function RouteMap({ model, suggestions = [], selected, onSelect, className, initialMode = 'route' }) {
  const box = useRef()
  const map = useRef()
  const markers = useRef([])
  const anim = useRef()
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState(initialMode)

  const routeLegs = useRoads(model.routePoints)
  const todayRoad = useRoads(mode === 'today' ? model.todayPoints : [])

  const routeSegs = useMemo(() => model.legs.map((l, i) => ({
    status: l.status,
    coords: routeLegs?.[i]?.coords?.length > 1 ? routeLegs[i].coords : arc(model.routePoints[i], model.routePoints[i + 1], i % 2 ? -0.14 : 0.14),
  })), [model, routeLegs])
  const todaySegs = useMemo(() => model.todayLegs.map((l, i) => ({
    status: l.status,
    coords: todayRoad?.[i]?.coords?.length > 1 ? todayRoad[i].coords : arc(model.todayPoints[i], model.todayPoints[i + 1], 0.2, 16),
  })), [model, todayRoad])

  useEffect(() => {
    const m = new MLMap({ container: box.current, style: STYLE, center: [75.8, 26.9], zoom: 5, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false })
    m.touchZoomRotate.disableRotation()
    m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    m.on('load', () => {
      m.addSource('path', { type: 'geojson', data: fc([]) })
      m.addLayer({ id: 'path-casing', type: 'line', source: 'path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } })
      for (const st of ['next', 'changed', 'done']) {
        m.addLayer({
          id: `path-${st}`, type: 'line', source: 'path', filter: ['==', ['get', 'status'], st], layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLOR[st], 'line-width': st === 'done' ? 5.5 : 4.5, ...(st === 'next' ? { 'line-dasharray': [0.8, 1.6] } : {}) },
        })
      }
      setReady(true)
    })
    map.current = m
    return () => { cancelAnimationFrame(anim.current); markers.current.forEach((mk) => mk.remove()); m.remove() }
  }, [])

  // Lines: travelled parts draw themselves in (Strava-style), the rest appear at once.
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    const segs = mode === 'today' ? todaySegs : routeSegs
    cancelAnimationFrame(anim.current)
    const t0 = performance.now(), dur = 1100
    const frame = (t) => {
      const f = Math.min(1, (t - t0) / dur)
      const ease = 1 - (1 - f) ** 3
      m.getSource('path')?.setData(fc(segs.map((s) => (s.status === 'done' ? { ...s, coords: s.coords.slice(0, Math.max(2, Math.ceil(s.coords.length * ease))) } : s))))
      if (f < 1) anim.current = requestAnimationFrame(frame)
    }
    anim.current = requestAnimationFrame(frame)
  }, [ready, mode, routeSegs, todaySegs])

  // Pins
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    markers.current.forEach((mk) => mk.remove())
    markers.current = []
    const add = (lngLat, opts) => markers.current.push(new Marker({ element: pinEl(opts), anchor: 'center' }).setLngLat(lngLat).addTo(m))
    if (!model.stops.length) {
      suggestions.forEach((d, i) => add([d.lng, d.lat], { label: d.name, kind: 'city', text: i + 1, sub: d.name, status: 'next', selected: selected?.key === d.key, onClick: () => onSelect?.({ type: 'suggestion', key: d.key }) }))
      return
    }
    if (mode === 'route') {
      model.stops.forEach((s) => add(s.lngLat, {
        label: `${s.name}, ${s.nights} nights`, kind: 'city', text: s.status === 'done' ? '✓' : s.order, sub: s.name,
        status: s.changed && s.status !== 'done' ? 'changed' : s.status, selected: selected?.type === 'city' && selected.key === s.key,
        onClick: () => onSelect?.({ type: 'city', key: s.key }),
      }))
    } else {
      if (model.hotel) add(model.hotel.lngLat, { label: `Hotel: ${model.hotel.title}`, kind: 'hotel', text: 'H', status: 'done' })
      model.today.forEach((a, i) => add(a.lngLat, {
        label: `${a.title}, ${a.start}`, kind: 'activity', text: a.status === 'done' ? '✓' : i + 1, sub: a.status === 'current' || (selected?.type === 'activity' && selected.id === a.id) ? a.start : null,
        status: a.status, selected: selected?.type === 'activity' && selected.id === a.id, onClick: () => onSelect?.({ type: 'activity', id: a.id }),
      }))
    }
  }, [ready, model, suggestions, selected, mode, onSelect])

  // Camera: fit everything, or fly to the selected stop.
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    const sel = selected?.type === 'city' ? model.stops.find((s) => s.key === selected.key)?.lngLat
      : selected?.type === 'activity' ? model.today.find((a) => a.id === selected.id)?.lngLat
        : selected?.type === 'suggestion' ? (() => { const d = suggestions.find((x) => x.key === selected.key); return d && [d.lng, d.lat] })() : null
    if (sel) { m.flyTo({ center: sel, zoom: selected.type === 'activity' ? 14 : mode === 'route' && model.stops.length > 1 ? 7 : 8.5, duration: 900 }); return }
    const pts = mode === 'today' ? model.todayPoints : model.stops.length ? model.routePoints : suggestions.map((d) => [d.lng, d.lat])
    if (!pts.length) return
    if (pts.length === 1) { m.flyTo({ center: pts[0], zoom: mode === 'today' ? 13 : 8, duration: 900 }); return }
    const b = pts.reduce((acc, p) => acc.extend(p), new LngLatBounds(pts[0], pts[0]))
    m.fitBounds(b, { padding: { top: 90, bottom: 70, left: 50, right: 60 }, maxZoom: mode === 'today' ? 14 : 8, duration: 900 })
  }, [ready, mode, selected, model.stops.length, model.todayPoints.length, suggestions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const canToday = model.today.length > 0
  const road = mode === 'today' ? todayRoad : routeLegs
  const km = road?.reduce((s, l) => s + (l.km || 0), 0)
  return (
    <div className={cx('relative overflow-hidden', className)}>
      <div className="absolute inset-0"><div ref={box} className="h-full w-full" role="region" aria-label="Trip map" /></div>
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        {canToday && (
          <div className="flex rounded-full bg-ink p-1 shadow-float" role="radiogroup" aria-label="Map view">
            {[['route', 'Route', RouteIcon], ['today', 'Today', Locate]].map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { setMode(v); onSelect?.(null) }}
                className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition', mode === v ? 'bg-white text-ink' : 'text-white/75')}>
                <Icon size={16} aria-hidden /> {l}
              </button>
            ))}
          </div>
        )}
        {km > 0 && <span className="whitespace-nowrap rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-ink shadow-soft">{Math.round(km)} km{road?.some((l) => l.source === 'line') ? ' approx.' : ' by road'}</span>}
      </div>
    </div>
  )
}
