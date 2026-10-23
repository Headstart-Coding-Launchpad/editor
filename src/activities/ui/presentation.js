import { createContext, useContext } from 'react'

// Presentation ("display") mode for an activity view: the build is put on the big screen
// (Show it), so nothing marks it. No hints, ticks, "Correct", progress ticks or tutor item picker,
// because showing a peer's "too small" hint to the whole class is public marking. ActivityView
// provides it (its `presentation` prop); the shared pieces (ActivityCorrect, SpinTick,
// RoundProgress, BonusBanner, TutorItemPicker) read it, and an activity that renders its own
// hint or verdict checks usePresentation() too. CSS under [data-presentation] is the net for the
// rest.
export const ActivityPresentationContext = createContext(false)

export function usePresentation() {
  return useContext(ActivityPresentationContext)
}
