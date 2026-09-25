import { useEffect, useRef, useState } from 'react'
import { api, wsUrl } from './api'

// Live channel: WebSocket with auto-reconnect. While the socket is down, poll every 4s as a fallback.
export function useLive(onMessage) {
  const handler = useRef(onMessage)
  handler.current = onMessage
  const [mode, setMode] = useState('connecting')

  useEffect(() => {
    let ws, retry, poll, ping, closed = false
    const startPolling = () => {
      if (poll) return
      setMode('polling')
      poll = setInterval(() => handler.current?.({ type: 'poll' }), 4000)
    }
    const stopPolling = () => { clearInterval(poll); poll = null }
    const connect = () => {
      try { ws = new WebSocket(wsUrl()) } catch { startPolling(); retry = setTimeout(connect, 3000); return }
      ws.onopen = () => {
        stopPolling(); setMode('live')
        ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000)
      }
      ws.onmessage = (e) => { try { handler.current?.(JSON.parse(e.data)) } catch { /* ignore */ } }
      ws.onclose = () => {
        clearInterval(ping)
        if (closed) return
        startPolling()
        retry = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { closed = true; clearTimeout(retry); clearInterval(ping); stopPolling(); ws?.close() }
  }, [])
  return mode
}

export { api }
