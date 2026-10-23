import { useCallback, useEffect, useRef, useState } from 'react'

// How long an item shows its "done" tick before the round moves to the next one.
export const DONE_MOMENT_MS = 700

// Drives an activity round: the student works the first item that is not done; when it becomes
// done it stays on screen for a short moment (the tick), then the round moves on by itself.
// There is no way to pick an item. The moment is the same length with reduced motion: the tick's
// spin is switched off by CSS, but the pause still lets the student see it land.
//
//   items: the round's items in order;  isDone(item): live, from the item's current state.
//   readOnly: tutor views never linger or advance (callers show every item instead).
// Returns { current, lingering, finished, doneCount, skip }. `skip` ends the done moment early
// (an activity with something to read can pass momentMs: Infinity and offer a Next tap). `current`
// is the item to show (the one
// that just finished while lingering), null when finished.
export function useRoundFlow(items, isDone, { readOnly = false, momentMs = DONE_MOMENT_MS } = {}) {
  const firstOpen = items.find((item) => !isDone(item)) ?? null
  const firstId = firstOpen?.id ?? null
  const firstIdRef = useRef(firstId)
  firstIdRef.current = firstId
  // The item the student is on, and the one showing its done moment.
  const [track, setTrack] = useState(firstId)
  const [lingerId, setLingerId] = useState(null)

  // Derived during render so the next item never flashes up before the done moment.
  if (!readOnly && lingerId == null && track !== firstId) {
    const tracked = items.find((item) => item.id === track)
    if (tracked && isDone(tracked)) setLingerId(track)
    else setTrack(firstId)
  }

  useEffect(() => {
    // An infinite moment never times out: the student moves on with `skip` (a Next tap).
    if (lingerId == null || !Number.isFinite(momentMs)) return undefined
    const timer = setTimeout(() => {
      setLingerId(null)
      setTrack(firstIdRef.current)
    }, momentMs)
    return () => clearTimeout(timer)
  }, [lingerId, momentMs])

  const skip = useCallback(() => {
    setLingerId(null)
    setTrack(firstIdRef.current)
  }, [])

  const lingerItem = lingerId != null ? items.find((item) => item.id === lingerId) : null
  const lingering = !!lingerItem
  return {
    current: lingerItem ?? firstOpen,
    lingering,
    finished: !lingering && firstOpen == null && items.length > 0,
    doneCount: items.filter(isDone).length,
    skip,
  }
}
