import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map as MLMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Locate, Route as RouteIcon } from 'lucide-react'
import { cx } from './ui'

// Free vector tiles, no API key (OpenFreeMap). Positron = calm, minimal basemap.
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const COLOR = { done: '#16a34a', current: '#1f4f8f', next: '#3a6db4', changed: '#ea580c' }
const LAYERS = ['done', 'next', 'changed']

const fc = (segs) => ({ type: 'FeatureCollection', features: segs.map((s) => ({ type: 'Feature', properties: { status: s.status }, geometry: { type: 'LineString', coordinates: s.coords } })) })

function pinEl({ label, status, kind, order, selected, onClick }) {
  const el = document.createElement('button')
  el.type = 'button'
  el.setAttribute('aria-label', label)
  el.className = 'tc-pin'
  el.dataset.status = status
  el.dataset.kind = kind
  if (selected) el.dataset.selected = 'true'
  el.innerHTML = kind === 'city'
    ? `<span class="tc-dot">${status === 'done' ? '✓' : order ?? ''}</span><span class="tc-label">${label.split(' · ')[0]}</span>`
    : '<span class="tc-dot tc-dot-sm"></span>'
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick?.() })
  return el
}

/**
 * Interactive trip map.
 * - route mode: every city on the tour, joined by a Strava-style line (green = travelled, dashed blue = ahead, orange = changed)
 * - today mode: zooms into today's city with a pin per activity
 * Redraws whenever `model` changes, so plan changes show up live.
 */
export default function RouteMap({ model, suggestions = [], selected, onSelect, className }) {
  const box = useRef()
  const map = useRef()
  const markers = useRef([])
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('route')

  useEffect(() => {
    const m = new MLMap({
      container: box.current, style: STYLE, center: [75.8, 26.9], zoom: 5, attributionControl: { compact: true },
      dragRotate: false, pitchWithRotate: false, cooperativeGestures: false,
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    m.on('load', () => {
      m.addSource('trip', { type: 'geojson', data: fc([]) })
      m.addSource('today', { type: 'geojson', data: fc([]) })
      for (const src of ['trip', 'today']) {
        const w = src === 'trip' ? 5 : 3.5
        m.addLayer({ id: `${src}-casing`, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': w + 4, 'line-opacity': 0.9 } })
        for (const st of LAYERS) {
          m.addLayer({
            id: `${src}-${st}`, type: 'line', source: src, filter: ['==', ['get', 'status'], st],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': COLOR[st], 'line-width': w, ...(st === 'next' ? { 'line-dasharray': [1.2, 1.6] } : {}) },
          })
        }
      }
      setReady(true)
    })
    map.current = m
    return () => { markers.current.forEach((mk) => mk.remove()); m.remove() }
  }, [])

  // Redraw lines + pins whenever the plan (or the selection / mode) changes.
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    m.getSource('trip').setData(fc(mode === 'today' ? [] : model.segments))
    m.getSource('today').setData(fc(mode === 'today' ? model.todayPath : []))
    markers.current.forEach((mk) => mk.remove())
    markers.current = []
    const add = (lngLat, opts) => markers.current.push(new Marker({ element: pinEl(opts), anchor: 'center' }).setLngLat(lngLat).addTo(m))

    if (model.stops.length) {
      model.stops.filter((s) => mode !== 'today' || s.status === 'current').forEach((s) => add(s.lngLat, {
        label: `${s.name} · ${s.nights} night${s.nights === 1 ? '' : 's'}`, kind: 'city', order: s.order,
        status: s.changed && s.status !== 'done' ? 'changed' : s.status, selected: selected?.type === 'city' && selected.key === s.key,
        onClick: () => onSelect?.({ type: 'city', key: s.key }),
      }))
      if (mode === 'today') model.today.forEach((a) => add(a.lngLat, {
        label: `${a.title}, ${a.start}`, kind: 'activity', status: a.status, selected: selected?.type === 'activity' && selected.id === a.id,
        onClick: () => onSelect?.({ type: 'activity', id: a.id }),
      }))
    } else {
      suggestions.forEach((d, i) => add([d.lng, d.lat], {
        label: d.name, kind: 'city', order: i + 1, status: 'next', selected: selected?.key === d.key,
        onClick: () => onSelect?.({ type: 'suggestion', key: d.key }),
      }))
    }
  }, [ready, model, suggestions, selected, mode, onSelect])

  // Camera: fit the whole route, or fly into today's city.
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    const pad = { top: 110, bottom: 70, left: 60, right: 60 }
    if (mode === 'today' && model.focus) { m.flyTo({ center: model.focus, zoom: 11.3, duration: 900 }); return }
    const pts = model.stops.length ? model.stops.map((s) => s.lngLat) : suggestions.map((d) => [d.lng, d.lat])
    if (!pts.length) return
    const b = pts.reduce((acc, p) => acc.extend(p), new LngLatBounds(pts[0], pts[0]))
    m.fitBounds(b, { padding: pad, maxZoom: 7.5, duration: 900 })
  }, [ready, mode, model.stops.length, model.focus?.[0], suggestions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasToday = model.today.length > 0
  return (
    <div className={cx('relative overflow-hidden', className)}>
      <div className="absolute inset-0"><div ref={box} className="h-full w-full" role="region" aria-label="Trip map" /></div>
      {hasToday && (
        <div className="glass absolute bottom-3 left-3 z-10 flex rounded-full p-1 shadow-soft ring-1 ring-white/70" role="radiogroup" aria-label="Map view">
          {[['route', 'Route', RouteIcon], ['today', 'Today', Locate]].map(([v, l, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
              className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition', mode === v ? 'bg-rani-600 text-white' : 'text-stone-600')}>
              <Icon size={15} aria-hidden /> {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
