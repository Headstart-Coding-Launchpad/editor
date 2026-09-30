import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  MOTION_MS,
  MOTION_STAGGER_CAP,
  firstViewKey,
  staggerStyle,
  useFirstView,
} from '../../shared/motion'

// Answer choices (quiz option cards, Match items, word chips) rise in one after another on a
// task's first view. ActivityView provides the switch for the activity it shows; a choice
// component asks for its entrance with useChoiceEntrance(). Outside ActivityView (the Builder's
// quiz editor preview) nothing animates.

const ChoiceEntranceContext = createContext(false)

// Long enough for the last capped item to finish rising, after waiting for the task slide to land
// (`--motion-entrance-delay`). After it the classes come off, so a chip that goes back to its
// answer bank later doesn't rise in again.
export const CHOICE_ENTRANCE_MS =
  MOTION_MS.slow + MOTION_MS.base + MOTION_MS.stagger * MOTION_STAGGER_CAP + MOTION_MS.fast

/**
 * `entranceKey` names the task shown (usually `firstViewKey(lessonId, taskId)`); null never
 * animates.
 */
export function ChoiceEntranceProvider({ entranceKey = null, children }) {
  const key = entranceKey == null ? null : firstViewKey('choices', entranceKey)
  const isFirstView = useFirstView(key)
  const [finishedKey, setFinishedKey] = useState(null)

  useEffect(() => {
    if (!isFirstView) return undefined
    const timer = setTimeout(() => setFinishedKey(key), CHOICE_ENTRANCE_MS)
    return () => clearTimeout(timer)
  }, [isFirstView, key])

  return (
    <ChoiceEntranceContext.Provider value={isFirstView && finishedKey !== key}>
      {children}
    </ChoiceEntranceContext.Provider>
  )
}

const NO_ENTRANCE = { className: undefined, style: undefined }

/**
 * Returns `entrance(index, className?)` → `{ className, style }` for the `index`th choice: the
 * rise-in and its stagger delay while the entrance plays, otherwise just `className`. Spread
 * `style` after the element's own style.
 */
export function useChoiceEntrance() {
  const animate = useContext(ChoiceEntranceContext)
  return function entrance(index, className) {
    if (!animate) return className ? { className, style: undefined } : NO_ENTRANCE
    return {
      className: [className, 'motion-rise-in motion-stagger'].filter(Boolean).join(' '),
      style: staggerStyle(index),
    }
  }
}
