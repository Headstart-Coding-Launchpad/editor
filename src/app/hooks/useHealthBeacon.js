import { useEffect, useRef } from 'react'
import {
  createHealthBeaconState,
  errorMessageOf,
  HEALTH_BEACON_MIN_INTERVAL_MS,
  summaryKey,
} from '../../shared/healthBeacon'
import { formatVersionNumber, getAppBuildInfo } from '../../shared/appVersion'

/**
 * The student's health beacon (R1, src/shared/healthBeacon.js): global `error` and
 * `unhandledrejection` handlers count what breaks on this screen, with Python's status and load
 * time and connection drops, and `write(anonymousId, summary)` sends the summary to the
 * student's own node. One write when enabled, then only when the summary changes, at most once
 * every HEALTH_BEACON_MIN_INTERVAL_MS (a trailing write carries the latest). Never per keystroke.
 *
 * The handlers listen from mount, so an error before joining still counts; nothing is written
 * while `enabled` is false (preview, presentation window, solo, or no student node yet).
 */
export default function useHealthBeacon({
  enabled,
  anonymousId,
  write,
  pythonStatus = 'idle',
  connected = null,
  appVersion = formatVersionNumber(getAppBuildInfo()),
  now = Date.now,
}) {
  const nowRef = useRef(now)
  nowRef.current = now
  const beaconRef = useRef(null)
  if (!beaconRef.current) {
    beaconRef.current = createHealthBeaconState({ appVersion, now: () => nowRef.current() })
    // The starting values are not changes: the join write carries them.
    beaconRef.current.setPythonStatus(pythonStatus)
    beaconRef.current.setConnected(connected)
  }
  const live = useRef({ enabled, anonymousId, write })
  live.current = { enabled, anonymousId, write }
  // Throttle bookkeeping: what was last sent and when (this device's clock), and the trailing
  // write's timer.
  const sentRef = useRef({ key: null, at: null, timer: null })

  const flushRef = useRef(null)
  flushRef.current = function flush() {
    const { enabled: on, anonymousId: id, write: send } = live.current
    if (!on || !id || !send) return
    const sent = sentRef.current
    const summary = beaconRef.current.summary()
    const key = summaryKey(summary)
    if (key === sent.key) return
    const elapsed = sent.at == null ? Infinity : Date.now() - sent.at
    if (elapsed < HEALTH_BEACON_MIN_INTERVAL_MS) {
      if (!sent.timer) {
        sent.timer = setTimeout(() => {
          sent.timer = null
          flushRef.current?.()
        }, HEALTH_BEACON_MIN_INTERVAL_MS - elapsed)
      }
      return
    }
    sent.key = key
    sent.at = Date.now()
    Promise.resolve(send(id, { ...summary, updatedAt: nowRef.current() })).catch(() => {
      // Try again with the next change or after the throttle window.
      if (sentRef.current.key === key) sentRef.current.key = null
    })
  }

  // Global handlers: one pair for the screen's life.
  useEffect(() => {
    function onError(event) {
      if (beaconRef.current.recordError(errorMessageOf(event))) flushRef.current?.()
    }
    function onRejection(event) {
      if (beaconRef.current.recordError(errorMessageOf(event?.reason))) flushRef.current?.()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const sent = sentRef.current
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      clearTimeout(sent.timer)
      sent.timer = null
    }
  }, [])

  useEffect(() => {
    if (beaconRef.current.setPythonStatus(pythonStatus)) flushRef.current?.()
  }, [pythonStatus])

  useEffect(() => {
    if (beaconRef.current.setConnected(connected)) flushRef.current?.()
  }, [connected])

  // A new student id (or a fresh enable) starts the throttle afresh and sends once.
  useEffect(() => {
    sentRef.current.key = null
    sentRef.current.at = null
    if (enabled) flushRef.current?.()
  }, [enabled, anonymousId])
}
