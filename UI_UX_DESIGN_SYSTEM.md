# TourCraft UI/UX Design System & Implementation Specification

> **Version**: 2.0  
> **Target Platforms**: Mobile Web (PWA/App feel) & Desktop Web  
> **Primary Audience**: Engineers, UI/UX Designers, Product Architects  
> **Purpose**: A complete, self-contained reference guide and component blueprint. Any developer or AI agent can use this document to replicate the exact look, feel, animations, and interaction patterns in any new feature or entirely new application.

---

## Table of Contents
1. [Design Philosophy & Aesthetic Direction](#1-design-philosophy--aesthetic-direction)
2. [Technology Stack & Core Libraries](#2-technology-stack--core-libraries)
3. [Design Tokens & Theme Variables](#3-design-tokens--theme-variables)
   - [Color Palettes](#color-palettes)
   - [Layered Background Canvas](#layered-background-canvas)
   - [Glassmorphism & Scrims](#glassmorphism--scrims)
   - [Typography System & Font Pairing](#typography-system--font-pairing)
   - [Radii, Elevation & Shadows](#radii-elevation--shadows)
   - [Animations & Motion Design](#animations--motion-design)
4. [Component Architecture & Reproducible Blueprints](#4-component-architecture--reproducible-blueprints)
   - [4.1 3D Coverflow Carousel (`CoverflowCarousel.jsx`)](#41-3d-coverflow-carousel-coverflowcarouseljsx)
   - [4.2 Dual-Mode App Shell & Navigation (`TravelerShell`)](#42-dual-mode-app-shell--navigation-travelershell)
   - [4.3 Page Containers (`PageHero`, `PageBody`, `SectionHead`)](#43-page-containers-pagehero-pagebody-sectionhead)
   - [4.4 Search Pill (`SearchPill`)](#44-search-pill-searchpill)
   - [4.5 UI Primitives (`Button`, `Card`, `Chip`, `Segmented`, `Rating`, `Bar`, `Sheet`, `Empty`)](#45-ui-primitives-button-card-chip-segmented-rating-bar-sheet-empty)
   - [4.6 Timeline & Activity Rows (`DayTimeline`, `ItemRow`, `RestRow`)](#46-timeline--activity-rows-daytimeline-itemrow-restrow)
   - [4.7 Map Engine & Custom Markers (`RouteMap`, MapLibre GL)](#47-map-engine--custom-markers-routemap-maplibre-gl)
5. [UX Principles & Ergonomic Guidelines](#5-ux-principles--ergonomic-guidelines)
6. [Step-by-Step Implementation Guide for New Features](#6-step-by-step-implementation-guide-for-new-features)
   - [Scaffolding a New Screen](#scaffolding-a-new-screen)
   - [Creating a New Card or List Row](#creating-a-new-card-or-list-row)

---

## 1. Design Philosophy & Aesthetic Direction

TourCraft blends **high-end outdoor luxury** with **modern Scandinavian minimalism** and **editorial travel magazines**.

### The Problem It Solves
Traditional travel websites present dense tabular itineraries, cramped text, and overwhelming multi-column forms that look terrible on mobile devices and feel like an enterprise portal. 

### The Aesthetic Signature
1. **Calm Misty-Mountain Atmosphere**: Instead of sterile stark-white or harsh dark mode, the UI sits on a soothing, multi-radial mist-blue canvas (`#EAF0F7` blended with subtle azure blooms).
2. **Dual Form-Factor Experience**:
   - **On Mobile**: The app feels 100% native. A floating frosted glass navigation pill floats above the bottom safe area, full-bleed photo heroes draw the user in, and content sheets slide up over the hero with rounded top corners (`rounded-t-[1.9rem]`).
   - **On Desktop / Web**: It expands gracefully into a wide-screen editorial experience (`max-w-6xl`) with a sticky frosted top navigation bar, generous padding, and responsive 2-to-4 column photo grids.
3. **Editorial Typography**: Large, warm serif headlines (`Fraunces`) for hero banners and card titles, paired with punchy display numbers (`Outfit`) and clean, legible sans-serif body copy (`Plus Jakarta Sans`).
4. **Physical Tactility**: Interactive elements feature soft 3D elevation, smooth glassmorphic blurs (`backdrop-filter: blur(20px)`), and a physical 3D Coverflow carousel rendered at 60 frames per second.

---

## 2. Technology Stack & Core Libraries

To achieve this exact UI in any project, install and configure these specific packages:

```json
{
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router-dom": "^7.18.4",
    "lucide-react": "^1.48.0",
    "maplibre-gl": "^6.11.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4.3.3",
    "vite": "^8.3.1"
  }
}
```

### Library Roles
| Package | Version | Purpose in TourCraft UI |
|---|---|---|
| `react` & `react-dom` | `^19.0.0` | UI component tree, state management, and direct DOM ref manipulation for high-fps carousels. |
| `react-router-dom` | `^7.0.0` | Client-side routing, active tab navigation, URL query parameter management (e.g. `?embed=1`). |
| `tailwindcss` | `^4.3.3` | Utility-first CSS using Tailwind v4's new `@theme` engine, OKLAB color mixing, and fluid CSS clamps. |
| `lucide-react` | `^1.48.0` | Clean, modern 2px–2.3px stroke icon system for all navigation, category badges, and interactive controls. |
| `maplibre-gl` | `^6.11.2` | High-performance WebGL vector maps with OpenFreeMap tiles, custom HTML DOM pins, and pulse rings. |

---

## 3. Design Tokens & Theme Variables

All design tokens are defined in `index.css` using Tailwind CSS v4's `@theme` directive.

### Color Palettes

#### 1. Brand Blue (`--color-rani-*`)
Used for primary action buttons, active badges, progress bars, and link accents.
- `rani-50`: `#eef4fb` (softest tint for active backgrounds)
- `rani-100`: `#dce8f7` (light borders and hover states)
- `rani-200`: `#b9d1ee` (radial canvas blooms)
- `rani-500`: `#3a6db4` (focus rings and secondary highlights)
- `rani-600`: `#1f4f8f` (the core brand blue for primary buttons and chips)
- `rani-700`: `#183f73` (button hover and dark accents)
- `rani-900`: `#0e2547` (deep ocean shadow base)

#### 2. Slate Neutrals (`--color-stone-*`)
High-contrast slate with a cool blue cast to prevent washed-out text.
- `stone-50`: `#f4f7fb`
- `stone-100`: `#e9eef5` (input backgrounds and light borders)
- `stone-200`: `#d6dee9` (subtle dividers and card borders)
- `stone-300`: `#b3bfce`
- `stone-400`: `#6c7a8d` (icon strokes and tertiary labels)
- `stone-500`: `#4d5b6e` (secondary subtitles)
- `stone-600`: `#3b4758` (body descriptions)
- `stone-700`: `#2a3544` (card body text)
- `stone-800`: `#1a2331` (strong headlines)
- `stone-900`: `#0e1522` (primary high-contrast text)
- `stone-950`: `#070b13`

#### 3. Active Ink (`--color-ink`)
- `#0c1626`: A near-black midnight navy. Used for active navigation capsules, hero chips, and high-impact text.

#### 4. Cool Mist Canvas (`--color-sand-*`)
- `sand-50`: `#eaf0f7` (canvas base)
- `sand-100`: `#dde6f1` (canvas gradient base)
- `sand-200`: `#c9d6e6` (subtle container borders)

#### 5. Semantic Status & Accents
- **Completed / Visited / Positive**: `#16a34a` (Emerald-600) / `bg-emerald-50 text-emerald-700`
- **Warning / Planning / Needs Decision**: `#ea580c` (Orange-600) / `bg-amber-50 text-amber-800`
- **Error / Declined / Danger**: `#dc2626` (Red-600) / `bg-red-50 text-red-700`
- **Sky Highlights & Rest Breaks**: `#0f6391` / `#ecf6fc`

---

### Layered Background Canvas

The app uses a seamless, fixed background canvas that eliminates seam artifacts between headers, scrolling sheets, and short pages.

```css
/* Shared canvas: Layered off-centre blue blooms in oklab color space */
.app-canvas {
  background-color: var(--color-sand-50);
  background-attachment: fixed;
  background-image:
    radial-gradient(46rem 34rem at 10% -8%, color-mix(in oklab, var(--color-rani-200) 50%, transparent) 0%, transparent 62%),
    radial-gradient(40rem 32rem at 108% 22%, color-mix(in oklab, var(--color-sky-50) 85%, transparent) 0%, transparent 65%),
    radial-gradient(52rem 40rem at 55% 115%, color-mix(in oklab, var(--color-rani-100) 60%, transparent) 0%, transparent 68%),
    linear-gradient(180deg, var(--color-sand-50) 0%, var(--color-sand-100) 100%);
}

/* Subtle top-lit glow placed inside page sheets */
.page-sheet-glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(52rem 16rem at 50% 0%, color-mix(in oklab, white 45%, transparent) 0%, transparent 70%);
}
```

---

### Glassmorphism & Scrims

```css
/* Floating bottom tab bar glass */
.tab-glass {
  background: color-mix(in oklab, white 72%, transparent);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border: 1px solid color-mix(in oklab, white 60%, var(--color-rani-100));
  box-shadow: var(--shadow-float), inset 0 1px 0 color-mix(in oklab, white 80%, transparent);
}

/* Light frosted surface */
.glass {
  background: rgb(255 255 255 / 0.72);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
}

/* Dark frosted surface for over-photo controls */
.glass-dark {
  background: rgb(14 22 36 / 0.42);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  color: #ffffff;
}

/* Photo gradient scrims for absolute text legibility */
.scrim-b {
  background: linear-gradient(180deg, rgb(11 16 25 / 0) 30%, rgb(11 16 25 / 0.72) 100%);
}
.scrim-t {
  background: linear-gradient(180deg, rgb(11 16 25 / 0.45) 0%, rgb(11 16 25 / 0) 45%);
}
```

---

### Typography System & Font Pairing

Import the fonts in HTML or CSS:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```css
@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Outfit", ui-sans-serif, system-ui, sans-serif;
}

.font-serif-display {
  font-family: "Fraunces", ui-serif, Georgia, serif;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}

/* Fluid responsive typography classes */
.h2-section {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.375rem, 1.1rem + 1vw, 1.5rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.h3-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1rem, 0.92rem + 0.3vw, 1.125rem);
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.caption {
  font-weight: 500;
  font-size: 0.8125rem;
  line-height: 1.35;
  letter-spacing: 0.01em;
}

.btn-label {
  font-weight: 700;
  font-size: clamp(0.9375rem, 0.9rem + 0.15vw, 1rem);
  line-height: 1;
}
```

---

### Radii, Elevation & Shadows

```css
@theme {
  --radius-4xl: 2rem;
  --shadow-soft: 0 1px 2px rgb(20 27 38 / 0.04), 0 8px 24px rgb(20 27 38 / 0.06);
  --shadow-float: 0 12px 40px rgb(14 37 71 / 0.18);
}
```

- **Pill Badges & Buttons**: `rounded-full`
- **Cards**: `rounded-3xl` (`1.5rem` / `24px`) or `rounded-[1.6rem]` (`26px`)
- **Large Page Overlays & Sheets**: `rounded-t-[1.9rem]` or `rounded-[2rem]`
- **Primary Button Elevation**: `shadow-[0_8px_20px_rgb(31_79_143_/_0.28)]`

---

### Animations & Motion Design

```css
@keyframes slide-up {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.animate-slide-up {
  animation: slide-up .28s cubic-bezier(.2,.8,.2,1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade {
  animation: fade-in .35s ease-out;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgb(58 109 180 / .45); }
  100% { box-shadow: 0 0 0 14px rgb(58 109 180 / 0); }
}
.pulse-ring {
  animation: pulse-ring 1.4s ease-out infinite;
}

/* Reduced motion accessibility */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

---

## 4. Component Architecture & Reproducible Blueprints

### 4.1 3D Coverflow Carousel (`CoverflowCarousel.jsx`)

The centerpiece of the Discovery experience is a true 3D perspective coverflow carousel. It tilts and recedes flanking cards in perspective, provides touch-velocity inertia, and modifies DOM styles directly via `requestAnimationFrame` for buttery 60fps performance without triggering React rerenders.

#### Implementation
```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function cx(...a) {
  return a.filter(Boolean).join(' ')
}

/**
 * 3D Tilt Coverflow Carousel
 * @param {Array} slides - [{ key, src, alt, title, subtitle, meta, onSelect }]
 * @param {number} rotate - Maximum tilt angle in degrees (default: 40)
 * @param {number} depth - Z-axis recession factor (default: 0.55)
 * @param {number} perspective - Perspective multiplier (default: 3)
 * @param {number} falloff - Curve power for distance falloff (default: 0.56)
 * @param {number} fade - Opacity fade per unit distance (default: 0.12)
 * @param {string} cardWidth - CSS card width (default: 'clamp(148px, 42vw, 210px)')
 * @param {number} gap - Spacing pitch multiplier (default: 0.14)
 * @param {boolean} loop - Whether to loop infinitely (default: true)
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
  label = 'Carousel',
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

  // Direct DOM matrix updates at 60fps
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

  useEffect(() => {
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
```

---

### 4.2 Dual-Mode App Shell & Navigation (`TravelerShell`)

Provides the sticky desktop navigation header and the floating mobile glass tab bar.

```jsx
import { NavLink, useLocation } from 'react-router-dom'
import { Compass, Map, Plane, MessageCircle, UserRound } from 'lucide-react'
import { cx } from './ui'

const TABS = [
  { to: '/', label: 'Discover', Icon: Compass, end: true },
  { to: '/plan', label: 'Plan', Icon: Map },
  { to: '/trip', label: 'Trip', Icon: Plane },
  { to: '/assist', label: 'Assist', Icon: MessageCircle },
  { to: '/profile', label: 'Profile', Icon: UserRound },
]

export function TravelerShell({ children, tour }) {
  const embed = new URLSearchParams(useLocation().search).has('embed')
  const q = embed ? '?embed=1' : ''
  const initials = (tour?.customer?.name || 'You').split(' ').map((w) => w[0]).join('').slice(0, 2)

  return (
    <div className="flex min-h-dvh w-full flex-col">
      {/* Desktop Web: Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-30 hidden border-b border-stone-200/70 bg-white/90 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-10">
          <NavLink to={'/' + q} className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-rani-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>
            TourCraft
          </NavLink>
          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            {TABS.slice(0, 4).map(({ to, label, end }) => (
              <NavLink key={to} to={to + q} end={end}
                className={({ isActive }) => cx('rounded-full px-4 py-2 text-[15px] font-semibold transition', isActive ? 'bg-rani-50 text-rani-700' : 'text-stone-600 hover:text-ink')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <NavLink to={'/personalize' + q} className="rounded-full bg-rani-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rani-700 shadow-soft">Plan a trip</NavLink>
          <NavLink to={'/profile' + q} aria-label="Profile and settings" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">{initials}</NavLink>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-32 lg:pb-16">{children}</main>

      {/* Mobile / Tablet: Floating Frosted Glass Capsule Tab Bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.9rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="tab-glass flex items-center gap-1 rounded-full px-1.5 py-1.5">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to + q} end={end}
              className={({ isActive }) => cx(
                'flex min-h-12 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-all duration-200',
                isActive ? 'bg-ink pl-3.5 pr-4 text-white shadow-float' : 'text-stone-500 hover:text-ink'
              )}>
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.3 : 2} aria-hidden />
                  <span className={isActive ? '' : 'sr-only'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
```

---

### 4.3 Page Containers (`PageHero`, `PageBody`, `SectionHead`)

Found in `src/components/page.jsx`. This trio creates the signature look: a dark, moody photo hero with serif titles, paired with an overlapping content sheet.

```jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Share2 } from 'lucide-react'
import { Photo, cx } from './ui'

/**
 * Full-bleed photo hero with dual scrims and serif titles
 */
export function PageHero({ img, eyebrow, title, subtitle, children, size = 'md', back = false, save, className, bottom }) {
  const nav = useNavigate()
  const h = {
    lg: 'min-h-[31rem] lg:min-h-[34rem]',
    md: 'min-h-[17rem] lg:min-h-[20rem]',
    sm: 'min-h-[12.5rem] lg:min-h-[15rem]',
    tall: 'min-h-[27rem] lg:min-h-[30rem]'
  }[size]

  return (
    <Photo src={img} alt="" scrim="both" className={cx('lg:mx-6 lg:mt-5 lg:rounded-[2rem]', className)}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" aria-hidden />
      <div className={cx('pt-safe relative mx-auto flex max-w-6xl flex-col px-5 pb-12 text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.35)] lg:px-10 lg:pb-12', h)}>
        {(back || save) && (
          <div className="flex items-center justify-between pt-4">
            {back ? (
              <button type="button" onClick={() => nav(-1)} aria-label="Back" className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                <ArrowLeft size={20} />
              </button>
            ) : <span />}
            {save && (
              <span className="flex gap-2">
                <button type="button" onClick={save.onSave} aria-pressed={save.saved} aria-label={save.saved ? 'Saved' : 'Save'} className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                  <Heart size={19} className={save.saved ? 'fill-rose-500 text-rose-500' : ''} />
                </button>
                <button type="button" onClick={save.onShare} aria-label="Share" className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                  <Share2 size={18} />
                </button>
              </span>
            )}
          </div>
        )}
        <div className="mt-auto pt-10">
          {eyebrow && <p className="text-[15px] font-medium text-white/85">{eyebrow}</p>}
          <h1 className={cx('font-serif-display leading-[1.02] text-white', size === 'lg' ? 'text-[2.9rem] md:text-6xl lg:text-7xl' : 'text-[2.35rem] md:text-5xl')}>{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-base text-white/85 md:text-lg">{subtitle}</p>}
          {children}
        </div>
        {bottom}
      </div>
    </Photo>
  )
}

/**
 * Rounded content sheet that overlaps hero on mobile (-mt-7)
 */
export function PageBody({ children, className, width = 'wide' }) {
  return (
    <div className="app-canvas relative z-10 -mt-7 min-h-[40dvh] overflow-hidden rounded-t-[1.9rem] lg:mt-0 lg:rounded-none">
      <div className="page-sheet-glow" aria-hidden />
      <div className={cx('relative mx-auto px-5 pt-6 pb-6 md:px-8 lg:pt-8', width === 'wide' ? 'max-w-6xl' : 'max-w-3xl', className)}>
        {children}
      </div>
    </div>
  )
}

export function SectionHead({ title, action, onAction, to }) {
  const nav = useNavigate()
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="h2-section text-ink">{title}</h2>
      {action && (
        <button type="button" onClick={onAction || (() => nav(to))} className="btn-label min-h-11 text-stone-600 hover:text-ink">
          {action}
        </button>
      )}
    </div>
  )
}
```

---

### 4.4 Search Pill (`SearchPill`)

A floating search pill designed to sit seamlessly inside hero photos or inside white sheet bodies.

```jsx
export function SearchPill({ value, onChange, onSubmit, placeholder = 'Where to next?', dark = false, trailing }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.() }}
      role="search"
      className={cx(
        'flex min-h-14 w-full items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 shadow-float',
        dark ? 'bg-white' : 'bg-white ring-1 ring-stone-200/70'
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label className="sr-only" htmlFor="search">{placeholder}</label>
      <input
        id="search"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none"
      />
      {trailing}
    </form>
  )
}
```

---

### 4.5 UI Primitives (`Button`, `Card`, `Chip`, `Segmented`, `Rating`, `Bar`, `Sheet`, `Empty`)

Found in `src/components/ui.jsx`:

#### 1. Button
```jsx
export function Button({ variant = 'primary', className, ...p }) {
  const styles = {
    primary: 'bg-rani-600 text-white hover:bg-rani-700 active:bg-rani-900 shadow-[0_8px_20px_rgb(31_79_143_/_0.28)]',
    secondary: 'bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100',
    dark: 'bg-stone-900 text-white hover:bg-stone-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      className={cx('btn-label inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none', styles[variant], className)}
      {...p}
    />
  )
}
```

#### 2. Card
```jsx
export function Card({ className, ...p }) {
  return <div className={cx('rounded-3xl bg-white ring-1 ring-stone-200/70 shadow-soft', className)} {...p} />
}
```

#### 3. Chip
```jsx
export function Chip({ className, children, tone = 'stone' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    rani: 'bg-rani-50 text-rani-700',
    glass: 'glass text-stone-900',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
    dark: 'bg-stone-800 text-stone-200',
  }
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', tones[tone], className)}>{children}</span>
}
```

#### 4. Segmented Control
```jsx
export function Segmented({ options, value, onChange }) {
  return (
    <div className="grid rounded-full bg-stone-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('min-h-10 rounded-full px-2 text-xs font-semibold transition', value === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-800')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

#### 5. Progress Bar
```jsx
export function Bar({ value, max, tone = 'rani', className }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  const tones = { rani: 'bg-rani-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', stone: 'bg-stone-400' }
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-stone-100', className)}>
      <div className={cx('h-full rounded-full transition-all duration-300', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}
```

#### 6. Modal Bottom Sheet (`Sheet`)
Becomes a bottom sheet on mobile, and a centered modal dialog on desktop:
```jsx
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 backdrop-blur-sm md:items-center md:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-slide-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-sand-50 p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[2rem]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 md:hidden" aria-hidden />
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
```

---

### 4.6 Timeline & Activity Rows (`DayTimeline`, `ItemRow`, `RestRow`)

The timeline represents a day's schedule. It uses a vertical status rail with stateful dots:
- `done` (past activity): green marker `#16a34a`, semi-muted row.
- `current` (happening now): pulsing blue marker `#1f4f8f`, highlighted card.
- `next` (upcoming): slate marker.

#### Rest Break Row Pattern
Automatically inserted rest breaks for families or relaxed pacing:
```jsx
function RestRow({ i }) {
  return (
    <li className="relative pb-3 pl-8">
      <span className="absolute left-[0.2rem] top-5 h-3.5 w-3.5 rounded-full bg-sky-300 ring-4 ring-sand-50" aria-hidden />
      <div className="rounded-[1.6rem] border-2 border-dashed border-sky-200 bg-sky-50/70 p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sky-700 shadow-soft">
            <Coffee size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-sky-800">{i.start_label} – {i.end_label}</span>
            <span className="block text-[17px] font-bold leading-snug text-ink">{i.title}</span>
            {i.meta?.why && <span className="mt-0.5 block text-sm text-sky-900">{i.meta.why}</span>}
          </div>
        </div>
      </div>
    </li>
  )
}
```

---

### 4.7 Map Engine & Custom Markers (`RouteMap`, MapLibre GL)

The map uses free vector tiles via OpenFreeMap (`https://tiles.openfreemap.org/styles/positron`) with custom MapLibre DOM markers.

#### Marker CSS Tokens
```css
.tc-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: 0;
  padding: 6px;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
}
.tc-dot {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  font: 800 14px/1 var(--font-display);
  color: #fff;
  background: #3a6db4;
  box-shadow: 0 0 0 3px #fff, 0 4px 12px rgb(14 37 71 / .3);
  transition: transform .15s;
}
.tc-dot-md { width: 26px; height: 26px; font-size: 12px; }
.tc-pin[data-kind="hotel"] .tc-dot { background: #0c1626; }
.tc-pin[data-status="done"] .tc-dot { background: #16a34a; }
.tc-pin[data-status="changed"] .tc-dot { background: #ea580c; }
.tc-pin[data-status="current"] .tc-dot {
  background: #1f4f8f;
  animation: tc-pulse 1.6s ease-out infinite;
}
.tc-pin[data-selected="true"] .tc-dot {
  transform: scale(1.25);
  box-shadow: 0 0 0 3px #fff, 0 0 0 6px #1f4f8f, 0 4px 12px rgb(14 37 71 / .3);
}
@keyframes tc-pulse {
  0% { box-shadow: 0 0 0 3px #fff, 0 0 0 3px rgb(31 79 143 / .5); }
  100% { box-shadow: 0 0 0 3px #fff, 0 0 0 16px rgb(31 79 143 / 0); }
}
```

---

## 5. UX Principles & Ergonomic Guidelines

When designing any new interaction or feature for this app, follow these strict principles:

1. **44px Minimum Touch Targets**:
   - Every clickable button, tab, search field, or avatar must meet or exceed a 44px tap target (`min-h-11` or `min-h-12`).
2. **Strict Text Contrast (>= 4.5:1)**:
   - Never use low-contrast light grey text.
   - Secondary text uses `--color-stone-600` (`#3b4758`) or `--color-stone-700` (`#2a3544`), which provides crisp legibility over the mist canvas.
   - Text over photography must always be protected with dual gradient scrims (`scrim="both"`).
3. **iOS Safari Zoom Prevention**:
   - All input elements (`input`, `select`, `textarea`) must have a minimum `font-size: 16px` (`text-[16px]`). This prevents iOS Safari from automatically zooming into the page on tap.
4. **Max 4–5 Primary Choices**:
   - Never clutter a screen with dozens of options. Use progressive disclosure (`+4 more` buttons that expand) to keep vertical height manageable.
5. **Fluid Responsive Transition**:
   - On screens `< 1024px`, show the mobile floating glass tab bar and collapse multi-column layouts into single column streams or carousels.
   - On screens `>= 1024px`, show the desktop sticky header, hide the bottom tab bar, and expand grids into `md:grid-cols-2` or `lg:grid-cols-4`.

---

## 6. Step-by-Step Implementation Guide for New Features

### Scaffolding a New Screen

To create a brand-new page (e.g. `src/pages/PackingList.jsx`), follow this exact structure:

```jsx
import { useState } from 'react'
import { PageHero, PageBody, SectionHead } from '../components/page'
import { Card, Button, Chip } from '../components/ui'
import { Check } from 'lucide-react'

export default function PackingList() {
  const [packed, setPacked] = useState({})

  const toggle = (id) => setPacked((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div>
      {/* 1. Full-bleed Hero with Serif Title */}
      <PageHero
        size="md"
        img="https://images.unsplash.com/photo-1506744038136-46273834b3fb"
        eyebrow="PRE-TRIP PREPARATION"
        title="Packing Essentials"
        subtitle="Curated gear for Rajasthan's desert climate and historic fort walks."
        back={true}
      />

      {/* 2. Overlapping Page Body */}
      <PageBody>
        <div className="space-y-6">
          <section>
            <SectionHead title="Essential Items" action="Check all" onAction={() => {}} />
            
            {/* 3. Card Container */}
            <Card className="divide-y divide-stone-100 p-4">
              {[
                { id: '1', title: 'Light linen shirts', desc: 'Breathable fabric for daytime heat', tag: 'Clothing' },
                { id: '2', title: 'Sturdy walking shoes', desc: 'Step-free support for cobblestone fort ramps', tag: 'Footwear' },
                { id: '3', title: 'Sun hat & sunglasses', desc: 'High UV protection for open courtyards', tag: 'Sun Care' },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="text-sm text-stone-600">{item.desc}</p>
                    <Chip tone="stone" className="mt-1">{item.tag}</Chip>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`grid h-11 w-11 place-items-center rounded-full transition ${
                      packed[item.id] ? 'bg-rani-600 text-white shadow-soft' : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Check size={20} />
                  </button>
                </div>
              ))}
            </Card>
          </section>

          {/* 4. Action Button Bar */}
          <div className="pt-4">
            <Button variant="primary" className="w-full">
              Save checklist
            </Button>
          </div>
        </div>
      </PageBody>
    </div>
  )
}
```

---

### Creating a New Card or List Row

To add a new clickable item row matching the "Best experiences for you" style:

```jsx
import { Link } from 'react-router-dom'
import { Star, Heart } from 'lucide-react'
import { Photo } from '../components/ui'

export function ExperienceCard({ item, isSaved, onToggleSave }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[1.4rem] bg-white p-2.5 pr-2 shadow-soft ring-1 ring-stone-200/70">
      <Link to={`/experience/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
        <Photo src={item.imageUrl} scrim={false} className="h-[5.2rem] w-[6.2rem] shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate h3-title text-ink">{item.title}</span>
          <span className="mt-0.5 block truncate text-sm text-stone-600">{item.duration} · {item.destination}</span>
          <span className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[16px] font-bold text-ink">{item.priceFormatted}</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700">
              <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
              {item.rating.toFixed(1)}
            </span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onToggleSave(item.id)}
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Remove from saved' : 'Save'}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
      >
        <Heart size={19} className={isSaved ? 'fill-rose-500 text-rose-500' : ''} />
      </button>
    </li>
  )
}
```

---

### Summary Checklist for Any New Screen
- [ ] Route wrapped in `<TravelerShell>` in `App.jsx`
- [ ] Uses `<PageHero>` with `font-serif-display` headline and dual scrims
- [ ] Uses `<PageBody>` with `.app-canvas` background and overlapping rounded sheet
- [ ] Headings use `font-display` (`Outfit`) or `font-serif-display` (`Fraunces`)
- [ ] Interactive buttons/links use minimum `min-h-11` (44px) tap targets
- [ ] Primary buttons use `bg-rani-600 text-white rounded-full shadow-[0_8px_20px_rgb(31_79_143_/_0.28)]`
- [ ] Inputs have `text-[16px]` to prevent mobile Safari viewport zooming
- [ ] All icons sourced from `lucide-react` with 2.0px–2.3px stroke width
- [ ] High-contrast colors adhere to `--color-stone-900` or `--color-ink` for headlines and `--color-stone-600` for secondary text
