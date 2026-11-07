import { createContext, useContext } from 'react'

// The student's ✋ Help, for controls away from the top bar (the hint beside the task, the check
// result popup): `{ onAsk, requested }`, with `onAsk` the very handler the top-bar
// HelpRequestButton calls (StudentView's handleHelpTap). StudentView provides it only when the
// top-bar button shows (canRequestHelp: a live lesson or the tutor's sandbox, not solo or the
// presentation window); with no provider there is no tutor to ask, so nothing offers help.
export const HelpRequestContext = createContext(null)

export function useHelpRequest() {
  return useContext(HelpRequestContext)
}

export const ASK_FOR_HELP_LABEL = '✋ Ask for help'
export const HELP_REQUESTED_LABEL = '✋ Help requested'
