import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useLive } from './live'

const Ctx = createContext(null)
export const useTraveler = () => useContext(Ctx)

// Shared traveler state: app state, active itinerary, and live disruption cards pushed over the WebSocket.
export function TravelerProvider({ children }) {
  const [state, setState] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [events, setEvents] = useState([]) // pending disruption cards
  const [version, setVersion] = useState(0) // bumps whenever recommendations may be stale
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)
  const toastTimer = useRef()

  const notify = useCallback((msg, tone = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, tone })
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const st = await api.state()
      setState(st)
      if (st.active_itinerary_id) setItinerary(await api.itinerary(st.active_itinerary_id))
      setError(null)
    } catch (e) {
      setError('Can’t reach the GapFill API. Is the backend running on :8000?')
    }
    setVersion((v) => v + 1)
  }, [])

  const loadPending = useCallback(async () => {
    try { setEvents(await api.pendingDisruptions()) } catch { /* no active itinerary yet */ }
  }, [])

  useEffect(() => { refresh(); loadPending() }, [refresh, loadPending])

  const live = useLive(async (m) => {
    switch (m.type) {
      case 'disruption': {
        // fetch fresh alternatives so the card reflects the very latest availability
        const ev = await api.alternatives(m.event.id).catch(() => m.event)
        setEvents((prev) => [ev, ...prev.filter((e) => e.id !== ev.id && e.itinerary_item_id !== ev.itinerary_item_id)])
        break
      }
      case 'disruption_resolved':
        setEvents((prev) => prev.filter((e) => e.id !== m.event_id))
        refresh()
        break
      case 'demo_reset':
        setEvents([])
        refresh()
        break
      case 'itinerary_updated':
        if (m.note) notify(m.note)
        refresh()
        break
      case 'weather':
      case 'vendor_status':
      case 'listing_published':
        refresh()
        break
      case 'poll':
        refresh()
        loadPending()
        break
      default:
    }
  })

  const value = { state, itinerary, events, setEvents, version, refresh, loadPending, toast, notify, live, error }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
