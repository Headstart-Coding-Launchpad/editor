import { useEffect, useRef } from 'react'

// Sprites, backdrop and variables for one round trip away from the student's own Scratch work (a
// classmate's shared work, or tutor Go Live) and back. Pen trails are not restored.
let slot = null

const fingerprint = (sprites) => JSON.stringify(sprites ?? [])

export function rememberRuntime(key, task, data) {
  slot = data ? { key, fp: fingerprint(task?.sprites), data } : null
}

// The next own workspace to mount takes the slot, used or not: nothing old is ever replayed.
export function recallRuntime(key, task) {
  const entry = slot
  slot = null
  return entry?.key === key && entry.fp === fingerprint(task?.sprites) ? entry.data : null
}

// StudentView sets .current while the student is away on such a round trip: only then does a
// workspace save. `where` is their own place; moving (or rejoining) drops what was saved.
export function useRuntimeAway(where) {
  const away = useRef(false)
  useEffect(() => {
    slot = null
  }, [where])
  return away
}
