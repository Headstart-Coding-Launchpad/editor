import { useRef } from 'react'

// A ref that always holds the latest render's value, for stale-closure-safe reads inside
// async handlers, timers and event listeners. Assigning during render (rather than in an
// effect) is deliberate: the callbacks that read these refs can fire before effects flush.
export function useLatestRef(value) {
  const ref = useRef(value)
  ref.current = value
  return ref
}
