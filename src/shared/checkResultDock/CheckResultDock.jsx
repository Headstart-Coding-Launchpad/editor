import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckResultDockContext, useCheckResultDock } from './context'

/** Wraps a task's content: tracks the registered output-panel slots and whether a result waits. */
export function CheckResultDockProvider({ children }) {
  const [slots, setSlots] = useState([])
  const [waiting, setWaiting] = useState(false)
  const register = useCallback((el) => {
    setSlots((prev) => (prev.includes(el) ? prev : [...prev, el]))
    return () => setSlots((prev) => prev.filter((x) => x !== el))
  }, [])
  const value = useMemo(
    () => ({ slot: slots[slots.length - 1] ?? null, register, waiting, setWaiting }),
    [slots, register, waiting]
  )
  return <CheckResultDockContext.Provider value={value}>{children}</CheckResultDockContext.Provider>
}

/**
 * Put inside an output panel's box (the panel must be `position: relative`). Renders a strip
 * pinned to the panel's bottom edge, absolutely positioned so it can only cover output and never
 * shifts the layout. Empty (and invisible) until a check result is portalled into it.
 */
export function CheckResultSlot() {
  const dock = useCheckResultDock()
  const register = dock?.register
  const [el, setEl] = useState(null)
  useEffect(() => (el && register ? register(el) : undefined), [el, register])
  if (!dock) return null
  return <div ref={setEl} className="check-result-slot" data-testid="check-result-slot" />
}

/** True while a check result is docked in an output panel the student may not be looking at. */
export function useCheckResultWaiting() {
  return useCheckResultDock()?.waiting ?? false
}
