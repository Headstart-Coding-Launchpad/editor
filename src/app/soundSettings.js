import { useCallback, useSyncExternalStore } from 'react'

// The student's one Sounds setting (the 🔊/🔇 button in the top bar and the Coding moments
// popover). Muted is stored as '1'; sounds on removes the key. It lives on this device across
// lessons and sessions. The tutor's class-wide Sounds off still silences everything in a live
// session regardless of this setting. localStorage may throw (private mode, blocked storage),
// so every access is best-effort and falls back to "sounds on" in memory.

export const SOUNDS_MUTED_KEY = 'headstart_sounds_muted'

const listeners = new Set()
// Only used when localStorage throws, so the toggle still works for this page.
let memoryMuted = false

export function readSoundsMuted() {
  try {
    return window.localStorage.getItem(SOUNDS_MUTED_KEY) === '1'
  } catch {
    return memoryMuted
  }
}

export function setSoundsMuted(muted) {
  const next = !!muted
  memoryMuted = next
  try {
    if (next) window.localStorage.setItem(SOUNDS_MUTED_KEY, '1')
    else window.localStorage.removeItem(SOUNDS_MUTED_KEY)
  } catch {
    // Storage unavailable: memoryMuted keeps the choice for this page.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  // Another tab changed the setting.
  function onStorage(event) {
    if (event.key === SOUNDS_MUTED_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** `[muted, setMuted]`, kept in sync across every mounted consumer and other tabs. */
export function useSoundsMuted() {
  const muted = useSyncExternalStore(subscribe, readSoundsMuted, () => false)
  const setMuted = useCallback((next) => setSoundsMuted(next), [])
  return [muted, setMuted]
}
