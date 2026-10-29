import React, { useEffect, useRef, useState } from 'react'
import { useLiveInkData } from './liveInkContext'
import {
  TUTOR_POINTER_IDLE_MS,
  TUTOR_RIPPLE_MS,
  applyScrollFraction,
  clientPointInPane,
  findTutorPane,
  fractionsInPane,
  scrollFractionOf,
  tutorPaneOf,
} from './tutorPane'

// Tutor pointer layer (slice 1): what the presenting tutor does with the mouse, shown on
// students' own panes. Two halves, mounted by LiveInkProvider:
//   TutorPointerTracker  - the Presentation window; writes the pane + fractions under the mouse
//   TutorPointerLayer    - a student's screen; draws a dot and click ripples on the same pane
// Both are non-interactive (pointer-events: none) and add no controls.

export function TutorPointerTracker({ writer }) {
  useEffect(() => {
    if (!writer) return undefined
    function onMove(event) {
      const pane = tutorPaneOf(event.target)
      const at = pane && fractionsInPane(pane.el, event.clientX, event.clientY)
      if (at) writer.moveTutorPointer?.({ pane: pane.id, ...at })
    }
    function onDown(event) {
      const pane = tutorPaneOf(event.target)
      const at = pane && fractionsInPane(pane.el, event.clientX, event.clientY)
      if (at) writer.tutorClick?.({ pane: pane.id, ...at })
    }
    function onLeave(event) {
      if (!event.relatedTarget) writer.hideTutorPointer?.()
    }
    // scroll doesn't bubble, so listen in the capture phase to hear nested scrollers.
    function onScroll(event) {
      const scroller = event.target
      const pane = scroller instanceof Element ? tutorPaneOf(scroller) : null
      const f = pane && scrollFractionOf(scroller)
      if (f !== null && f !== undefined) writer.moveTutorScroll?.({ pane: pane.id, f })
    }
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('mouseout', onLeave, true)
    return () => {
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('mouseout', onLeave, true)
      writer.hideTutorPointer?.()
    }
  }, [writer])
  return null
}

const keyframes = `
@keyframes tutor-ripple { from { transform: translate(-50%, -50%) scale(0.3); opacity: 0.9 }
  to { transform: translate(-50%, -50%) scale(1.6); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .tutor-ripple { animation: none !important; opacity: 0.7 } }`

const layerStyle = { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }
const dotStyle = {
  position: 'absolute',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'var(--colour-error, #d33)',
  border: '2px solid #fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  transform: 'translate(-50%, -50%)',
}
const rippleStyle = {
  position: 'absolute',
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: '3px solid var(--colour-error, #d33)',
  animation: `tutor-ripple ${TUTOR_RIPPLE_MS}ms ease-out forwards`,
}

export default function TutorPointerLayer({ followTutor = false }) {
  const { tutorPointer, tutorClick, tutorScroll } = useLiveInkData()
  const [idle, setIdle] = useState(false)
  const [ripple, setRipple] = useState(null)
  const seenClick = useRef(undefined)

  // The dot goes away when the tutor's mouse has been still (or gone) for a while.
  const pointerStamp = tutorPointer
    ? `${tutorPointer.t}:${tutorPointer.rx}:${tutorPointer.ry}`
    : null
  useEffect(() => {
    setIdle(false)
    if (!pointerStamp) return undefined
    const timer = setTimeout(() => setIdle(true), TUTOR_POINTER_IDLE_MS)
    return () => clearTimeout(timer)
  }, [pointerStamp])

  // A click ripples once per `n`. The first value seen (a late joiner) is not a new click.
  const clickN = tutorClick?.n
  useEffect(() => {
    if (!tutorClick || clickN === undefined) return undefined
    if (seenClick.current === undefined) {
      seenClick.current = clickN
      return undefined
    }
    if (seenClick.current === clickN) return undefined
    seenClick.current = clickN
    setRipple({ ...tutorClick })
    const timer = setTimeout(() => setRipple(null), TUTOR_RIPPLE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickN])

  // A student locked to the tutor's screen scrolls where the tutor scrolls. An unlocked student
  // is never moved: the view does not auto-scroll under someone who is reading.
  const appliedScroll = useRef({})
  useEffect(() => {
    if (!followTutor) return
    for (const [pane, entry] of Object.entries(tutorScroll ?? {})) {
      if (appliedScroll.current[pane] === entry.t) continue
      const el = findTutorPane(document, pane)
      if (el && applyScrollFraction(el, entry.f)) appliedScroll.current[pane] = entry.t
    }
  }, [followTutor, tutorScroll])

  const dot = !idle && tutorPointer ? placeOn(tutorPointer) : null
  const rippleAt = ripple ? placeOn(ripple) : null
  if (!dot && !rippleAt) return null
  return (
    <div style={layerStyle} data-testid="tutor-pointer-layer" aria-hidden="true">
      <style>{keyframes}</style>
      {dot && (
        <div data-testid="tutor-pointer-dot" style={{ ...dotStyle, left: dot.x, top: dot.y }} />
      )}
      {rippleAt && (
        <div
          key={ripple.n}
          className="tutor-ripple"
          data-testid="tutor-click-ripple"
          style={{ ...rippleStyle, left: rippleAt.x, top: rippleAt.y }}
        />
      )}
    </div>
  )
}

// Where a `{ pane, rx, ry }` lands on this screen, or null when the pane isn't on it.
function placeOn(point) {
  const el = findTutorPane(document, point.pane)
  return el ? clientPointInPane(el, point.rx, point.ry) : null
}
