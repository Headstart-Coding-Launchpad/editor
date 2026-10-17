import { createContext, useContext } from 'react'

// The check-result dock: the Correct! / Not quite strip is shown INSIDE the module's output panel
// (Python/Turtle console + result pane, HTML/Arcade preview, Scratch stage), never over the
// editor, Run/Reset or file tabs. A `<CheckResultSlot />` in an output panel registers its element
// here; `CheckFeedbackBanner` portals into the latest registered slot. With no slot (a quiz, a
// module with no output panel, the Builder) the banner keeps its old floating corner position.
// `null` outside a provider, so a slot rendered elsewhere (Builder previews) renders nothing.
export const CheckResultDockContext = createContext(null)

export function useCheckResultDock() {
  return useContext(CheckResultDockContext)
}
