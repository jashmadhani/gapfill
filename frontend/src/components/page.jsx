import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Share2 } from 'lucide-react'
import { Photo, cx } from './ui'

/**
 * Photo header used on every traveler page (reference: TripGlide). A dark, moody photo with a serif title;
 * on phones the content sheet slides up over its bottom edge, on the web it becomes a wide banner.
 */
export function PageHero({ img, eyebrow, title, subtitle, children, size = 'md', back = false, save, className, bottom }) {
  const nav = useNavigate()
  const h = { lg: 'min-h-[31rem] lg:min-h-[34rem]', md: 'min-h-[17rem] lg:min-h-[20rem]', sm: 'min-h-[12.5rem] lg:min-h-[15rem]', tall: 'min-h-[27rem] lg:min-h-[30rem]' }[size]
  return (
    <Photo src={img} alt="" scrim="both" className={cx('lg:mx-6 lg:mt-5 lg:rounded-[2rem]', className)}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" aria-hidden />
      <div className={cx('pt-safe relative mx-auto flex max-w-6xl flex-col px-5 pb-12 text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.35)] lg:px-10 lg:pb-12', h)}>
        {(back || save) && (
          <div className="flex items-center justify-between pt-4">
            {back ? <button type="button" onClick={() => nav(-1)} aria-label="Back" className="glass-dark grid h-11 w-11 place-items-center rounded-full"><ArrowLeft size={20} /></button> : <span />}
            {save && (
              <span className="flex gap-2">
                <button type="button" onClick={save.onSave} aria-pressed={save.saved} aria-label={save.saved ? 'Saved' : 'Save'} className="glass-dark grid h-11 w-11 place-items-center rounded-full">
                  <Heart size={19} className={save.saved ? 'fill-rose-500 text-rose-500' : ''} />
                </button>
                <button type="button" onClick={save.onShare} aria-label="Share" className="glass-dark grid h-11 w-11 place-items-center rounded-full"><Share2 size={18} /></button>
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

// The rounded content sheet that overlaps the hero on phones; a centred page column on the web.
export function PageBody({ children, className, width = 'wide' }) {
  return (
    <div className="page-sheet relative z-10 -mt-7 overflow-hidden rounded-t-[1.9rem] lg:mt-0 lg:rounded-none">
      <div className="page-sheet-glow" aria-hidden />
      <div className={cx('relative mx-auto px-5 pt-6 pb-6 md:px-8 lg:pt-8', width === 'wide' ? 'max-w-6xl' : 'max-w-3xl', className)}>{children}</div>
    </div>
  )
}

export function SectionHead({ title, action, onAction, to }) {
  const nav = useNavigate()
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="h2-section text-ink">{title}</h2>
      {action && (
        <button type="button" onClick={onAction || (() => nav(to))} className="btn-label min-h-11 text-stone-600 hover:text-ink">{action}</button>
      )}
    </div>
  )
}

// Search pill used in heroes and on Explore (reference: "Where to next?").
export function SearchPill({ value, onChange, onSubmit, placeholder = 'Where to next?', dark = false, trailing }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.() }} role="search"
      className={cx('flex min-h-14 w-full items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 shadow-float', dark ? 'bg-white' : 'bg-white ring-1 ring-stone-200/70')}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <label className="sr-only" htmlFor="search">{placeholder}</label>
      <input id="search" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} autoComplete="off"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-stone-500 focus:outline-none" />
      {trailing}
    </form>
  )
}
