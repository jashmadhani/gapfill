import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useLive } from './live'

const Ctx = createContext(null)
export const useTour = () => useContext(Ctx)

// Shared traveler state: demo state, the active tour, and change cards pushed live over the WebSocket.
export function TourProvider({ children }) {
  const [state, setState] = useState(null)
  const [tour, setTour] = useState(null)
  const [events, setEvents] = useState([]) // pending change cards for the active tour
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)
  const toastTimer = useRef()
  const activeRef = useRef(null)

  const notify = useCallback((msg, tone = 'info') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, tone })
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const loadPending = useCallback(async (id = activeRef.current) => {
    if (!id) return setEvents([])
    try { setEvents(await api.changes(`?tour_id=${id}&status=pending`)) } catch { /* ignore */ }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const st = await api.state()
      activeRef.current = st.active_tour_id
      const t = st.active_tour_id ? await api.tour(st.active_tour_id) : null
      setState(st)
      setTour(t)
      setError(null)
    } catch {
      setError('Can’t reach the TourCraft API. Is the backend running on :8000?')
    }
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => { refresh().then(() => loadPending()) }, [refresh, loadPending])

  const live = useLive((m) => {
    const mine = !m.tour_id || m.tour_id === activeRef.current
    switch (m.type) {
      case 'change':
        if (m.tour_id === activeRef.current) setEvents((prev) => [m.event, ...prev.filter((e) => e.id !== m.event.id)])
        refresh()
        break
      case 'change_resolved':
        setEvents((prev) => prev.filter((e) => e.id !== m.event_id))
        if (mine) refresh()
        break
      case 'demo_reset':
        setEvents([])
        refresh().then(() => loadPending())
        break
      case 'tour_updated':
      case 'bookings':
        if (mine) refresh()
        break
      case 'clock':
      case 'world':
      case 'vendor_status':
      case 'tour_created':
        refresh()
        break
      case 'poll':
        refresh()
        loadPending()
        break
      default:
    }
  })

  const activate = useCallback(async (id) => {
    await api.activate(id)
    activeRef.current = id
    await refresh()
    await loadPending(id)
  }, [refresh, loadPending])

  const value = { state, tour, events, setEvents, version, refresh, loadPending, toast, notify, live, error, activate }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
