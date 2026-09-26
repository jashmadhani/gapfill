import { useCallback, useEffect, useState } from 'react'

// Hearted places and experiences, kept on this device.
const KEY = 'tc-saved'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }

export function useSaved() {
  const [ids, setIds] = useState(read)
  useEffect(() => {
    const on = () => setIds(read())
    window.addEventListener('tc-saved', on)
    return () => window.removeEventListener('tc-saved', on)
  }, [])
  const toggle = useCallback((id) => {
    const next = read().includes(id) ? read().filter((x) => x !== id) : [...read(), id]
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
    window.dispatchEvent(new Event('tc-saved'))
  }, [])
  return { ids, isSaved: (id) => ids.includes(id), toggle }
}
