import { useEffect, useRef } from 'react'
import { ref, set } from 'firebase/database'
import { db } from '../../shared/firebase'
import * as hb from '../../shared/healthBeacon'
const MIN_MS = hb.HEALTH_BEACON_MIN_INTERVAL_MS

/** Writes the beacon to the student's own node; never recreates a missing one (resolves false). */
export async function writeHealthBeacon(sessionKey, session, anonymousId, summary) {
  if (!sessionKey || !anonymousId || !summary || !session?.students?.[anonymousId]) return false
  await set(ref(db, `sessions/${sessionKey}/students/${anonymousId}/healthBeacon`), summary)
  return true
}
/** StudentView's beacon: `live` own screen, only while the node exists, server-time stamps. */
export function useStudentBeacon({ sessionKey, session, identity, cs, connected, ...rest }) {
  const sessionRef = useRef(session)
  sessionRef.current = session
  const id = identity?.anonymousId ?? null
  useHealthBeacon({
    enabled: !!rest.live && !!session?.students?.[id],
    anonymousId: id,
    write: (anonId, summary) => writeHealthBeacon(sessionKey, sessionRef.current, anonId, summary),
    pythonStatus: cs?.pythonStuck ? 'stuck' : cs?.pyodideStatus,
    connected,
    now: () => Date.now() + (rest.serverTimeOffset ?? 0),
  })
}

// The health beacon (R1): error / unhandledrejection handlers, Python status, connection drops.
// Sends once when enabled, then on a change at most every 30 s (a trailing write carries the
// latest); a skipped (false) or failed write is sent again. Throttle resets for a new id only.
export default function useHealthBeacon(props) {
  const { enabled, anonymousId, pythonStatus = 'idle', connected = null } = props
  const p = useRef(props)
  p.current = props
  const now = () => (p.current.now ?? Date.now)()
  const beacon = useRef(null)
  if (!beacon.current) {
    const appVersion = props.appVersion ?? hb.APP_VERSION
    beacon.current = hb.createHealthBeaconState({ appVersion, now })
    beacon.current.setPythonStatus(pythonStatus) // starting values are not changes
    beacon.current.setConnected(connected)
  }
  // What was last sent and when (this device's clock), and the trailing write's timer.
  const sent = useRef({ key: null, at: null, timer: null }).current
  const flush = useRef(null)
  const later = (delay) => {
    sent.timer ??= setTimeout(() => ((sent.timer = null), flush.current()), delay)
  }
  const retryLater = (key) => sent.key === key && ((sent.key = null), later(MIN_MS))
  flush.current = () => {
    const { enabled: on, anonymousId: id, write } = p.current
    const summary = beacon.current.summary()
    const key = JSON.stringify(summary)
    if (!on || !id || !write || key === sent.key) return
    const elapsed = sent.at == null ? Infinity : Date.now() - sent.at
    if (elapsed < MIN_MS) return later(MIN_MS - elapsed)
    sent.key = key
    sent.at = Date.now()
    Promise.resolve(write(id, { ...summary, updatedAt: now() })).then(
      (wrote) => wrote === false && retryLater(key),
      () => retryLater(key)
    )
  }
  const b = beacon.current
  useEffect(() => {
    const record = (e) => beacon.current.recordError(hb.errorMessageOf(e)) && flush.current()
    const onRejection = (e) => record(e?.reason)
    window.addEventListener('error', record)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', record)
      window.removeEventListener('unhandledrejection', onRejection)
      clearTimeout(sent.timer)
      sent.timer = null
    }
  }, [sent])
  useEffect(() => void (b.setPythonStatus(pythonStatus) && flush.current()), [b, pythonStatus])
  useEffect(() => void (b.setConnected(connected) && flush.current()), [b, connected])
  useEffect(() => void ((sent.key = null), (sent.at = null)), [sent, anonymousId])
  // Enabled (joined, or the node came back after a reset): send again, still throttled.
  useEffect(() => {
    sent.key = null
    if (enabled) flush.current()
  }, [sent, enabled, anonymousId])
}
