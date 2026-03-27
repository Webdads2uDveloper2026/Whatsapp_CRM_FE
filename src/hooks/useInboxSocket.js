import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export function useInboxSocket(onMessage, enabled = true) {
  const ws      = useRef(null)
  const retry   = useRef(0)
  const timer   = useRef(null)
  const mounted = useRef(true)

  const connect = useCallback(() => {
    if (!mounted.current || !enabled) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    ws.current = new WebSocket(`${WS_BASE}/ws/inbox?token=${token}`)

    ws.current.onopen  = () => { retry.current = 0 }
    ws.current.onmessage = e => {
      try {
        const d = JSON.parse(e.data)
        if (d.type !== 'ping' && d.type !== 'connected') onMessage(d)
      } catch {}
    }
    ws.current.onclose = ev => {
      if (!mounted.current) return
      if (ev.code === 4001) {
        window.dispatchEvent(new CustomEvent('ws:auth_failed'))
        return
      }
      const delay = Math.min(1000 * 2 ** retry.current, 30000)
      retry.current++
      timer.current = setTimeout(connect, delay)
    }
    ws.current.onerror = () => ws.current?.close()
  }, [enabled, onMessage])

  useEffect(() => {
    mounted.current = true
    connect()
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
      ws.current?.close()
    }
  }, [connect])

  return { disconnect: () => { mounted.current = false; ws.current?.close() } }
}
