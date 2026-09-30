import { useEffect, useRef, useState } from 'react'

/**
 * Shared motion helpers. The CSS half (tokens, `motion-*` classes, the reduced-motion block)
 * lives in `src/index.css`; docs/architecture/motion-system.md explains when to use each.
 */

/** Motion durations in ms, mirroring the `--motion-*` tokens, for JS timers that must match CSS. */
export const MOTION_MS = Object.freeze({
  fast: 180,
  base: 280,
  slow: 460,
  stagger: 70,
})

/** A stagger never waits for more than this many items, so a long list doesn't drag. */
export const MOTION_STAGGER_CAP = 8

export function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch {
    return false
  }
}

/**
 * Inline style for the `index`th item of a `motion-stagger` list. The CSS caps the delay at
 * MOTION_STAGGER_CAP items.
 */
export function staggerStyle(index) {
  return { '--motion-i': Math.max(0, Number(index) || 0) }
}

// Keys seen on this screen. In-memory only, so a page reload shows every entrance again; each
// window (the presentation window, the Builder preview) has its own module instance.
const seenKeys = new Set()

/** Build a first-view key from its parts, skipping empty ones (`null` when nothing is left). */
export function firstViewKey(...parts) {
  const clean = parts.filter((part) => part !== undefined && part !== null && part !== '')
  return clean.length > 0 ? clean.map(String).join(':') : null
}

/**
 * True while this component shows `key` for the first time on this screen, and for the rest of
 * that mount, so an entrance animation plays once per task and never replays on a revisit, a
 * remount (the task slide's leaving panel) or a Builder edit. A null key never animates.
 *
 * Callers namespace their key (`firstViewKey('explainer', lessonId, taskId)`), because every
 * component that mounts in the same commit sees the key as unseen, but a later one doesn't.
 */
export function useFirstView(key) {
  const ref = useRef(null)
  if (ref.current === null || ref.current.key !== key) {
    ref.current = { key, first: key != null && !seenKeys.has(key) }
  }
  useEffect(() => {
    if (key != null) seenKeys.add(key)
  }, [key])
  return ref.current.first
}

/** Forget every first view (tests, and anything that deliberately restarts a screen). */
export function resetFirstViews() {
  seenKeys.clear()
}

/**
 * Counts the pass moments the student watched: each time `passed` goes from false to true while
 * `resetKey` (usually the task id) stays the same. Arriving on an already-passed task, or a reload
 * that restores a pass, is 0. Use the count as a React `key` to restart a one-shot animation.
 */
export function usePassMoment(passed, resetKey) {
  const [moment, setMoment] = useState({ key: resetKey, count: 0 })
  const previous = useRef({ key: resetKey, passed: !!passed })

  useEffect(() => {
    const prev = previous.current
    previous.current = { key: resetKey, passed: !!passed }
    if (prev.key !== resetKey) {
      setMoment({ key: resetKey, count: 0 })
      return
    }
    if (!prev.passed && passed) {
      setMoment((current) => ({
        key: resetKey,
        count: current.key === resetKey ? current.count + 1 : 1,
      }))
    }
  }, [passed, resetKey])

  return moment.key === resetKey ? moment.count : 0
}
