import { useCallback, useSyncExternalStore } from 'react'

// "Show extra class tools (quick polls, Coding Paused, Edit Lesson)": whether this device's
// tutor session controls show the ad hoc quick poll button, the Pause Coding button and the
// mid-class Edit Lesson button. Off by default; on is stored as '1' and off removes the key.
// Set in Account Settings. Poll quiz tasks inside lessons are not affected.
// localStorage may throw, so every access is best-effort with an in-memory fallback.

export const EXTRA_CLASS_TOOLS_KEY = 'headstart_extra_class_tools'

const listeners = new Set()
let memoryOn = false

export function readExtraClassToolsOn() {
  try {
    return window.localStorage.getItem(EXTRA_CLASS_TOOLS_KEY) === '1'
  } catch {
    return memoryOn
  }
}

export function setExtraClassToolsOn(on) {
  memoryOn = !!on
  try {
    if (on) window.localStorage.setItem(EXTRA_CLASS_TOOLS_KEY, '1')
    else window.localStorage.removeItem(EXTRA_CLASS_TOOLS_KEY)
  } catch {
    // Storage unavailable: memoryOn keeps the choice for this page.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  function onStorage(event) {
    if (event.key === EXTRA_CLASS_TOOLS_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** `[on, setOn]`, kept in sync across mounted components and other tabs. */
export function useExtraClassToolsOn() {
  const on = useSyncExternalStore(subscribe, readExtraClassToolsOn, () => false)
  const setOn = useCallback((next) => setExtraClassToolsOn(next), [])
  return [on, setOn]
}
