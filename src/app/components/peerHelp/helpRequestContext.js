import { createContext, createElement, useContext, useMemo, useRef } from 'react'

// The student's ✋ Help, for controls away from the top bar (the hint beside the task, the check
// result popup): `{ onAsk, requested }`, with `onAsk` calling the very handler the top-bar
// HelpRequestButton calls (StudentView's handleHelpTap). StudentView provides it only when the
// top-bar button shows (canRequestHelp: a live lesson or the tutor's sandbox, not solo or the
// presentation window); with no provider there is no tutor to ask, so nothing offers help.
// The wording lives in helpLabel.js.
export const HelpRequestContext = createContext(null)

export function useHelpRequest() {
  return useContext(HelpRequestContext)
}

/**
 * Provides HelpRequestContext with a value that changes only when `enabled` or `requested` does:
 * `onAsk` may be a new function every render (StudentView's handler is), so the value calls the
 * newest one through a ref instead of holding it.
 */
export function HelpRequestProvider({ enabled, onAsk, requested, children }) {
  const onAskRef = useRef(onAsk)
  onAskRef.current = onAsk
  const value = useMemo(
    () => (enabled ? { onAsk: () => onAskRef.current?.(), requested: !!requested } : null),
    [enabled, requested]
  )
  return createElement(HelpRequestContext.Provider, { value }, children)
}
