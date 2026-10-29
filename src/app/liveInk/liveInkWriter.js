// The presenting teacher's writes to `liveInk/{lessonId}` (see liveInkData.js for the shape).
// Only the Presentation window creates one of these; students only read.

import { onDisconnect, push, ref, remove, set } from 'firebase/database'
import { db } from '../../shared/firebase'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import {
  INK_COLOUR,
  POINTER_INTERVAL_MS,
  SCROLL_INTERVAL_MS,
  STROKE_REMOVE_AFTER_MS,
  liveInkPath,
} from './liveInkData'

function quietly(promise, what) {
  return Promise.resolve(promise).catch((err) => {
    console.warn(`[liveInk] could not ${what}`, err)
  })
}

export function createLiveInkWriter(
  lessonId,
  {
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  } = {}
) {
  const rootRef = ref(db, liveInkPath(lessonId))
  const pointerRef = ref(db, liveInkPath(lessonId, 'pointer'))
  const strokeTimers = new Set()

  // ~12Hz with a trailing edge, so the dot always ends where the mouse stopped.
  const pointerWriter = createThrottledMirrorWriter({
    write: (value) => quietly(set(pointerRef, value), 'move the pointer'),
    intervalMs: POINTER_INTERVAL_MS,
    now,
    setTimer,
    clearTimer,
  })

  // Tutor pointer layer: same cadence as the annotation pointer, its own node.
  const tutorPointerRef = ref(db, liveInkPath(lessonId, 'tutorPointer'))
  const tutorClickRef = ref(db, liveInkPath(lessonId, 'tutorClick'))
  let clickCount = 0
  // One throttled writer per scrolling pane, so two panes scrolling at once don't drop each other.
  const scrollWriters = new Map()
  function scrollWriterFor(pane) {
    if (!scrollWriters.has(pane)) {
      const scrollRef = ref(db, liveInkPath(lessonId, 'tutorScroll', pane))
      scrollWriters.set(
        pane,
        createThrottledMirrorWriter({
          write: (value) => quietly(set(scrollRef, value), 'scroll a pane'),
          intervalMs: SCROLL_INTERVAL_MS,
          now,
          setTimer,
          clearTimer,
        })
      )
    }
    return scrollWriters.get(pane)
  }
  const tutorPointerWriter = createThrottledMirrorWriter({
    write: (value) => quietly(set(tutorPointerRef, value), 'move the tutor pointer'),
    intervalMs: POINTER_INTERVAL_MS,
    now,
    setTimer,
    clearTimer,
  })

  return {
    // `pane` is a data-tp-pane id; rx/ry are fractions of that pane's box (tutorPane.js).
    moveTutorPointer({ pane, rx, ry }) {
      tutorPointerWriter.push({ pane, rx, ry, t: now() })
    },

    // `f` is the pane's scroll position as a fraction 0..1 (tutorPane.js scrollFractionOf).
    moveTutorScroll({ pane, f }) {
      scrollWriterFor(pane).push({ f, t: now() })
    },

    hideTutorPointer() {
      tutorPointerWriter.cancel()
      return quietly(set(tutorPointerRef, null), 'hide the tutor pointer')
    },

    // One write per click; `n` changes every time so two clicks on the same spot both ripple.
    tutorClick({ pane, rx, ry }) {
      clickCount += 1
      return quietly(set(tutorClickRef, { pane, rx, ry, n: clickCount, t: now() }), 'send a click')
    },

    // Closing the Presentation window (or losing its connection) wipes every annotation, so
    // nothing is left stranded on students' screens with no way to clear it.
    armDisconnectCleanup() {
      return quietly(onDisconnect(rootRef).remove(), 'arm the disconnect cleanup')
    },

    // `position` is `{ c, dx, dy }` (over text) or `{ rx, ry }` (box fractions); only that
    // form's keys are written, since the rules accept one form or the other.
    movePointer({ surface, anchor, ...position }) {
      const coords =
        position.c != null
          ? { c: position.c, dx: position.dx, dy: position.dy }
          : { rx: position.rx, ry: position.ry }
      pointerWriter.push({ surface, anchor, ...coords, t: now() })
    },

    hidePointer() {
      pointerWriter.cancel()
      return quietly(set(pointerRef, null), 'hide the pointer')
    },

    // Written once, on pointer-up. The teacher's window deletes it after the fade; every
    // screen also fades it on its own clock, so a late delete is never visible.
    addStroke({ surface, anchor, points }) {
      const strokeRef = push(ref(db, liveInkPath(lessonId, 'strokes')))
      const written = quietly(
        set(strokeRef, { surface, anchor, points, colour: INK_COLOUR, t: now() }),
        'draw a stroke'
      )
      const timer = setTimer(() => {
        strokeTimers.delete(timer)
        quietly(remove(strokeRef), 'remove a faded stroke')
      }, STROKE_REMOVE_AFTER_MS)
      strokeTimers.add(timer)
      return written
    },

    addHighlight({ surface, anchor, quote, occurrence }) {
      const highlightRef = push(ref(db, liveInkPath(lessonId, 'highlights')))
      return quietly(
        set(highlightRef, { surface, anchor, quote, occurrence, t: now() }),
        'add a highlight'
      )
    },

    removeHighlight(id) {
      return quietly(remove(ref(db, liveInkPath(lessonId, 'highlights', id))), 'remove a highlight')
    },

    clearAll() {
      pointerWriter.cancel()
      tutorPointerWriter.cancel()
      for (const writer of scrollWriters.values()) writer.cancel()
      return quietly(remove(rootRef), 'clear the annotations')
    },

    dispose() {
      pointerWriter.cancel()
      tutorPointerWriter.cancel()
      for (const writer of scrollWriters.values()) writer.cancel()
      scrollWriters.clear()
      for (const timer of strokeTimers) clearTimer(timer)
      strokeTimers.clear()
    },
  }
}
