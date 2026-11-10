import { useEffect, useRef, useState } from 'react'

// A dropped connection must last this long before the child is told (Wi-Fi blips are common).
const OFFLINE_GRACE_MS = 2000
// Before the first connect, .info/connected reports false while it is still connecting.
const FIRST_CONNECT_GRACE_MS = 10000
const BACK_ONLINE_MS = 3000

/**
 * A slim strip under the student's top bar while the class connection is down (deep review
 * 2026-11-10, R7). Driven only by useSession's `connected` flag: null (no live session) never
 * shows, true is online, false is offline. Says "Back online" for 3 seconds when it returns.
 * Nothing to tap; nothing written. The tutor already sees student.online on the dashboard.
 */
export default function OfflineBanner({ connected }) {
  const [phase, setPhase] = useState('idle') // idle | offline | back
  const everConnected = useRef(connected === true)
  const shown = useRef(false)

  useEffect(() => {
    if (connected === true) {
      everConnected.current = true
      if (!shown.current) {
        setPhase('idle')
        return undefined
      }
      shown.current = false
      setPhase('back')
      const timer = setTimeout(() => setPhase('idle'), BACK_ONLINE_MS)
      return () => clearTimeout(timer)
    }
    if (connected !== false) {
      shown.current = false
      setPhase('idle')
      return undefined
    }
    const timer = setTimeout(
      () => {
        shown.current = true
        setPhase('offline')
      },
      everConnected.current ? OFFLINE_GRACE_MS : FIRST_CONNECT_GRACE_MS
    )
    return () => clearTimeout(timer)
  }, [connected])

  if (phase === 'idle') return null
  const offline = phase === 'offline'
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      style={{ ...s.bar, ...(offline ? s.offline : s.back) }}
    >
      {offline
        ? "📡 You're offline. Keep coding: your work is saved on this device and sends itself when you're back."
        : 'Back online ✅'}
    </div>
  )
}

const s = {
  bar: {
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    padding: '4px 12px',
    flexShrink: 0,
    borderBottom: '1px solid',
  },
  offline: { background: '#fff7ed', color: '#9a3412', borderColor: '#fed7aa' },
  back: { background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' },
}
