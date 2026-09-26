import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight, Globe, Heart, IndianRupee, LayoutDashboard, Mail, MapPin, MonitorPlay, Phone, RotateCcw, Ruler, Shuffle, Store, Users } from 'lucide-react'
import { api } from '../api'
import { useTour } from '../store'
import { destImage } from '../media'
import { useSaved } from '../lib/saved'
import { PageBody, PageHero } from '../components/page'
import { INTEREST, PACE_LABEL, TIER_LABEL, cx } from '../components/ui'

const KEY = 'tc-settings'
const load = () => { try { return { alerts: true, email: false, lang: 'English', units: 'km', ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { alerts: true, email: false, lang: 'English', units: 'km' } } }

function Group({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-[0.12em] text-stone-500">{title}</h2>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-[1.6rem] bg-white shadow-soft">{children}</div>
    </section>
  )
}

function Row({ Icon, label, value, to, onClick, children, danger }) {
  const body = (
    <>
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', danger ? 'bg-red-50 text-red-600' : 'bg-rani-50 text-rani-600')}><Icon size={19} aria-hidden /></span>
      <span className={cx('flex-1 text-[16px] font-semibold', danger ? 'text-red-600' : 'text-ink')}>{label}</span>
      {value && <span className="max-w-[45%] truncate text-[15px] text-stone-600">{value}</span>}
      {children}
      {(to || onClick) && !children && <ChevronRight size={18} className="text-stone-400" aria-hidden />}
    </>
  )
  const cls = 'flex min-h-16 w-full items-center gap-3.5 px-4 text-left'
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative grid h-11 w-16 shrink-0 place-items-center">
      <span className={cx('relative block h-8 w-14 rounded-full transition', on ? 'bg-rani-600' : 'bg-stone-300')}>
        <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
      </span>
    </button>
  )
}

// Profile + settings on one page.
export default function Profile() {
  const { tour, notify, refresh } = useTour()
  const { ids } = useSaved()
  const [s, setS] = useState(load)
  const set = (k, v) => { const n = { ...s, [k]: v }; setS(n); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* ignore */ } }
  const c = tour?.customer
  const prefs = tour?.prefs || {}
  const members = tour?.group?.members || []

  const reset = async () => {
    if (!confirm('Reset all demo data? Tours you created will be removed.')) return
    await api.reset()
    await refresh()
    notify('Demo data reset', 'success')
  }

  return (
    <div>
      <PageHero size="sm" img={destImage(tour?.route?.[0]?.dest || 'udaipur')} eyebrow="Profile & settings" title={c?.name || 'Traveler'}>
        {c?.city && <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-white/85"><MapPin size={15} aria-hidden /> {c.city}</p>}
      </PageHero>
      <PageBody width="narrow">
        <div className="space-y-7">
          <div className="grid grid-cols-3 gap-3">
            {[['Trips', tour ? 1 : 0, '/tours'], ['Saved', ids.length, '/'], ['Travelers', members.length || 1, '/plan']].map(([l, n, to]) => (
              <Link key={l} to={to} className="rounded-[1.4rem] bg-white p-4 text-center shadow-soft">
                <span className="block font-display text-2xl font-bold text-ink">{n}</span>
                <span className="text-sm font-semibold text-stone-600">{l}</span>
              </Link>
            ))}
          </div>

          <Group title="Your details">
            <Row Icon={Mail} label="Email" value={c?.email || 'Not set'} />
            <Row Icon={Phone} label="Phone" value={c?.phone || 'Not set'} />
            <Row Icon={Users} label="Travel group" value={members.length ? members.map((m) => (typeof m === 'string' ? m : m.name)).slice(0, 3).join(', ') : 'Just me'} to="/personalize" />
          </Group>

          <Group title="Travel preferences">
            <Row Icon={Heart} label="Interests" value={(prefs.interests || []).map((k) => INTEREST[k]?.label || k).join(', ') || 'Not set'} to="/personalize" />
            <Row Icon={LayoutDashboard} label="Stays and pace" value={prefs.hotel_tier ? `${TIER_LABEL[prefs.hotel_tier]} · ${PACE_LABEL[prefs.pace] || ''}` : 'Not set'} to="/personalize" />
          </Group>

          <Group title="Settings">
            <Row Icon={Bell} label="Trip alerts"><Toggle label="Trip alerts" on={s.alerts} onChange={(v) => set('alerts', v)} /></Row>
            <Row Icon={Mail} label="Email summaries"><Toggle label="Email summaries" on={s.email} onChange={(v) => set('email', v)} /></Row>
            <Row Icon={Globe} label="Language">
              <select value={s.lang} onChange={(e) => set('lang', e.target.value)} aria-label="Language" className="min-h-10 rounded-full bg-stone-100 px-3 text-[15px] font-semibold text-ink">
                {['English', 'हिन्दी', 'Français', 'Deutsch'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </Row>
            <Row Icon={Ruler} label="Distance">
              <select value={s.units} onChange={(e) => set('units', e.target.value)} aria-label="Distance units" className="min-h-10 rounded-full bg-stone-100 px-3 text-[15px] font-semibold text-ink">
                <option value="km">Kilometres</option><option value="mi">Miles</option>
              </select>
            </Row>
            <Row Icon={IndianRupee} label="Currency" value="Indian rupee (₹)" />
          </Group>

          <Group title="More">
            <Row Icon={Shuffle} label="Switch traveler or trip" to="/tours" />
            <Row Icon={LayoutDashboard} label="Operator console" to="/operator" />
            <Row Icon={Store} label="Vendor portal" to="/vendor/1" />
            <Row Icon={MonitorPlay} label="Live Ops demo" to="/ops" />
            <Row Icon={RotateCcw} label="Reset demo data" onClick={reset} danger />
          </Group>
          <p className="text-center text-sm text-stone-500">TourCraft · Rajasthan & the Golden Triangle</p>
        </div>
      </PageBody>
    </div>
  )
}
