import { useSyncExternalStore } from 'react'

// Whether to show on-screen typing keys (the Python key row): a finger is the main pointer, or
// the screen has really been touched in this page (a touchscreen laptop, after its first touch).
// Stricter than useIsTouchDevice, which is also true on a mouse PC that only reports touch support.
let touched = false
const listeners = new Set()

// Noted once the gesture has ended, and a moment later: a row appearing under a finger still on
// the screen would move the code before the tap lands.
const REVEAL_DELAY_MS = 100

function onPointerEnd(event) {
  if (touched || event.pointerType !== 'touch') return
  setTimeout(() => {
    touched = true
    listeners.forEach((notify) => notify())
  }, REVEAL_DELAY_MS)
}

// Listening from the first import, so a touch before any editor is on screen still counts.
// A scroll ends in pointercancel rather than pointerup.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', onPointerEnd, true)
  window.addEventListener('pointercancel', onPointerEnd, true)
}

function subscribe(notify) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

function showTouchKeys() {
  return (
    touched ||
    (typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches)
  )
}

export function useShowTouchKeys() {
  return useSyncExternalStore(subscribe, showTouchKeys, () => false)
}
