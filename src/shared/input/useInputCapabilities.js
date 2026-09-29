import { useEffect, useState } from 'react'
import { detectInputCapabilities, normalizeKeyEvent, withKeyEvidence } from './index.js'

function detectNow() {
  if (typeof window === 'undefined') return detectInputCapabilities()
  return detectInputCapabilities({
    matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null,
    maxTouchPoints: window.navigator?.maxTouchPoints ?? 0,
    userAgent: window.navigator?.userAgent ?? '',
    userAgentData: window.navigator?.userAgentData ?? null,
  })
}

/**
 * React binding for detectInputCapabilities: what the device offers, updated when a hardware
 * keydown proves a physical keyboard is present. Kept out of index.js so the input library
 * stays Node-safe (the CLI imports it).
 */
export function useInputCapabilities() {
  const [capabilities, setCapabilities] = useState(detectNow)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function onKeyDown(event) {
      setCapabilities((current) => withKeyEvidence(current, normalizeKeyEvent(event)))
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
  return capabilities
}
