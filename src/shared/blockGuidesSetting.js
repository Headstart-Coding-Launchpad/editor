import { useCallback, useSyncExternalStore } from 'react'

// The Blocks button in the Python editor's toolbar: whether this device shows the coloured
// block brackets (see ./blockGuides.js). Off is stored as '1'; on removes the key, so brackets
// show by default. It lives on this device across lessons, for students and teachers alike.
// A task with `showBlocks: false` hides the brackets and the button whatever this says.
// localStorage may throw (private mode, blocked storage), so every access is best-effort and
// falls back to an in-memory value for this page.

export const BLOCK_GUIDES_OFF_KEY = 'headstart_block_guides_off'

const listeners = new Set()
let memoryOff = false

export function readBlockGuidesOn() {
  try {
    return window.localStorage.getItem(BLOCK_GUIDES_OFF_KEY) !== '1'
  } catch {
    return !memoryOff
  }
}

export function setBlockGuidesOn(on) {
  memoryOff = !on
  try {
    if (on) window.localStorage.removeItem(BLOCK_GUIDES_OFF_KEY)
    else window.localStorage.setItem(BLOCK_GUIDES_OFF_KEY, '1')
  } catch {
    // Storage unavailable: memoryOff keeps the choice for this page.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  // Another tab changed the setting.
  function onStorage(event) {
    if (event.key === BLOCK_GUIDES_OFF_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** `[on, setOn]`, kept in sync across every mounted editor and other tabs. */
export function useBlockGuidesOn() {
  const on = useSyncExternalStore(subscribe, readBlockGuidesOn, () => true)
  const setOn = useCallback((next) => setBlockGuidesOn(next), [])
  return [on, setOn]
}
