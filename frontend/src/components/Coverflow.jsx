import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from './ui'

/**
 * One card in focus, neighbours pushed back and softened (reference: "Popular" stack).
 * Native scroll-snap does the swiping; we only read the scroll position to style cards.
 */
export default function Coverflow({ items, render, onActiveChange, label = 'Highlights' }) {
  const track = useRef()
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState([])
  const raf = useRef()
  const touched = useRef(false) // only report changes the user made (not the initial layout)

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    const kids = [...el.children]
    const d = kids.map((c) => (c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth)
    setPos(d)
    const best = d.reduce((bi, v, i) => (Math.abs(v) < Math.abs(d[bi]) ? i : bi), 0)
    setActive((a) => (a === best ? a : best))
  }, [])

  useEffect(() => { measure() }, [items.length, measure])
  useEffect(() => { if (touched.current) onActiveChange?.(active) }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i) => {
    touched.current = true
    const el = track.current
    const c = el?.children[i]
    if (c) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' })
  }

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <ul ref={track} onPointerDown={() => { touched.current = true }} onWheel={() => { touched.current = true }} onScroll={() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(measure) }}
        className="no-scrollbar snap-x-mand flex gap-3 overflow-x-auto px-[calc(50%-min(38vw,160px))] py-3">
        {items.map((it, i) => {
          const d = Math.min(1.5, Math.abs(pos[i] ?? (i === 0 ? 0 : 1)))
          const on = i === active
          return (
            <li key={it.key ?? i} aria-current={on ? 'true' : undefined} onClick={() => !on && go(i)}
              className="snap-center shrink-0 transition-[transform,opacity,filter] duration-200"
              style={{ width: 'min(76vw, 320px)', transform: `scale(${1 - d * 0.12})`, opacity: 1 - d * 0.45, filter: `saturate(${1 - d * 0.5})` }}>
              {render(it, on)}
            </li>
          )
        })}
      </ul>
      {items.length > 1 && (
        <>
          <button type="button" onClick={() => go(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous"
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-float disabled:opacity-0 md:grid"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(Math.min(items.length - 1, active + 1))} disabled={active === items.length - 1} aria-label="Next"
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-float disabled:opacity-0 md:grid"><ChevronRight size={20} /></button>
          <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
            {items.map((_, i) => <span key={i} className={cx('h-1.5 rounded-full transition-all', i === active ? 'w-6 bg-ink' : 'w-1.5 bg-stone-300')} />)}
          </div>
        </>
      )}
    </div>
  )
}
