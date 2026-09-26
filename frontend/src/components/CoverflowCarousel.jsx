import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from './ui'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useEffect : useEffect

/**
 * 3D tilt carousel (reference: TripGlide "Popular destinations" stack).
 * Cards rake away from the centred one in true perspective; drag or arrow keys settle
 * on the nearest whole card. Positions are painted straight to the DOM every frame,
 * not through React state, so dragging stays smooth at 60fps.
 *
 * slides: [{ key, src, alt, title, subtitle, meta, onSelect }]
 */
export default function CoverflowCarousel({
  slides,
  rotate = 40,
  depth = 0.55,
  perspective = 3,
  falloff = 0.56,
  fade = 0.12,
  cardWidth = 'clamp(148px, 42vw, 210px)',
  gap = 0.14,
  loop = true,
  showCaption = true,
  showPagination = true,
  showNavigation = false,
  label = 'Popular destinations',
  className,
  cardClassName,
}) {
  const count = slides.length
  const frameRef = useRef(null)
  const cardRefs = useRef([])
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const widthRef = useRef(0)
  const rafRef = useRef(null)
  const dragRef = useRef(null)
  const movedRef = useRef(false)

  const [selected, setSelected] = useState(0)

  const indexAt = useCallback((pos) => ((Math.round(pos) % count) + count) % count, [count])

  const paint = useCallback(() => {
    const width = widthRef.current
    if (!width) return
    const pitch = width * (1 + gap)
    const pos = posRef.current

    cardRefs.current.forEach((card, index) => {
      if (!card) return
      let offset = index - pos
      if (loop) {
        offset = ((offset % count) + count) % count
        if (offset > count / 2) offset -= count
      }
      const distance = Math.abs(offset)
      const ramp = Math.pow(distance, falloff)
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset)

      card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge)
      card.style.zIndex = String(100 - Math.round(distance))
    })
  }, [count, depth, fade, falloff, gap, loop, rotate])

  const settle = useCallback((target) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    targetRef.current = target
    setSelected(indexAt(target))
    const step = () => {
      const remaining = target - posRef.current
      if (Math.abs(remaining) < 0.0004) {
        posRef.current = target
        paint()
        rafRef.current = null
        return
      }
      posRef.current += remaining * 0.16
      paint()
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [indexAt, paint])

  const clamp = useCallback((pos) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))), [count, loop])

  const goTo = useCallback((index) => {
    const target = loop ? index + Math.round((targetRef.current - index) / count) * count : index
    settle(clamp(target))
  }, [clamp, count, loop, settle])

  const nudge = useCallback((by) => settle(clamp(Math.round(targetRef.current) + by)), [clamp, settle])

  const onPointerDown = (e) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    e.currentTarget.setPointerCapture(e.pointerId)
    movedRef.current = false
    targetRef.current = posRef.current
    dragRef.current = { id: e.pointerId, x: e.clientX, pos: posRef.current, v: 0, t: performance.now() }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const pitch = widthRef.current * (1 + gap)
    if (!pitch) return
    if (Math.abs(e.clientX - drag.x) > 4) movedRef.current = true
    const now = performance.now()
    const previous = posRef.current
    posRef.current = clamp(drag.pos - (e.clientX - drag.x) / pitch)
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000
    drag.t = now
    const index = indexAt(posRef.current)
    if (index !== selected) setSelected(index)
    paint()
  }

  const endDrag = (e) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18))
    settle(clamp(Math.round(posRef.current + carried)))
  }

  useIsoLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      const card = cardRefs.current[0]
      if (!card) return
      widthRef.current = card.offsetWidth
      paint()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

  const active = slides[selected]

  return (
    <div className={cx('w-full', className)} style={{ '--cf-card': cardWidth }} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1) }
            else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1) }
          }}
          className="cursor-grab overflow-hidden py-6 outline-none focus-visible:ring-2 focus-visible:ring-rani-500 active:cursor-grabbing"
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            touchAction: 'pan-y',
            // Fade neighbours into the page instead of clipping them at a hard rectangle.
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
          }}
        >
          <div className="relative select-none" style={{ height: 'var(--cf-card)', transformStyle: 'preserve-3d' }}>
            {slides.map((slide, index) => (
              <div
                key={slide.key ?? index}
                ref={(node) => { cardRefs.current[index] = node }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                onClick={() => {
                  if (movedRef.current) return
                  if (index === selected) slide.onSelect?.()
                  else goTo(index)
                }}
                className={cx('absolute left-1/2 top-0 aspect-square overflow-hidden rounded-[1.6rem] bg-stone-200 shadow-xl will-change-transform', cardClassName)}
                style={{ width: 'var(--cf-card)' }}
              >
                <img src={slide.src} alt={slide.alt} draggable={false} className="h-full w-full select-none object-cover" />
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <>
            <button type="button" aria-label="Previous" onClick={() => nudge(-1)}
              className="absolute left-2 top-1/2 z-[200] hidden -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2.5 text-ink shadow-float backdrop-blur md:grid"><ChevronLeft size={20} /></button>
            <button type="button" aria-label="Next" onClick={() => nudge(1)}
              className="absolute right-2 top-1/2 z-[200] hidden -translate-y-1/2 place-items-center rounded-full bg-white/85 p-2.5 text-ink shadow-float backdrop-blur md:grid"><ChevronRight size={20} /></button>
          </>
        )}
      </div>

      {showCaption && active?.title && (
        <div key={selected} className="mt-1 flex flex-col items-center px-6 text-center duration-300 animate-in fade-in">
          <p className="font-serif-display text-xl leading-tight text-ink">{active.title}</p>
          {active.subtitle && <p className="mt-0.5 text-[15px] text-stone-600">{active.subtitle}</p>}
        </div>
      )}

      {showPagination && (
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {slides.map((_, index) => (
            <span key={index} className={cx('h-1.5 rounded-full bg-ink transition-all', index === selected ? 'w-6 opacity-100' : 'w-1.5 opacity-30')} />
          ))}
        </div>
      )}
    </div>
  )
}
