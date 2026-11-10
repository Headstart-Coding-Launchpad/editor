import { useEffect, useState } from 'react'

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
 *
 * One `phase` state (idle | offline | back); each effect owns and clears its own timer.
 */
export default function OfflineBanner({ connected }) {
  const [phase, setPhase] = useState('idle')
  const [everConnected, setEverConnected] = useState(connected === true)

  useEffect(() => {
    if (connected === true) {
      setEverConnected(true)
      // Back online only if the child was told they were offline (or is already being told).
      setPhase((prev) => (prev === 'idle' ? 'idle' : 'back'))
      return undefined
    }
    // Down again (or no live session): never keep saying Back online.
    setPhase((prev) => (prev === 'back' ? 'idle' : prev))
    if (connected !== false) {
      setPhase('idle')
      return undefined
    }
    const timer = setTimeout(
      () => setPhase('offline'),
      everConnected ? OFFLINE_GRACE_MS : FIRST_CONNECT_GRACE_MS
    )
    return () => clearTimeout(timer)
  }, [connected, everConnected])

  useEffect(() => {
    if (phase !== 'back') return undefined
    const timer = setTimeout(() => setPhase('idle'), BACK_ONLINE_MS)
    return () => clearTimeout(timer)
  }, [phase])

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
        ? "📡 You're offline. Keep coding: your work is saved on this device."
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
