import { useCallback, useEffect, useRef } from 'react'
import { normalizeKeyEvent, normalizePointerEvent } from './events.js'
import { DEFAULT_GESTURE_OPTIONS } from './gestures.js'
import { createInputTally } from './targetSummary.js'

const WHEEL_THROTTLE_MS = 150

function closestTarget(node) {
  const el = node?.closest?.('[data-input-id]')
  if (!el) return null
  return { id: el.getAttribute('data-input-id'), kind: el.getAttribute('data-input-kind') }
}

/**
 * Records how the student works inside a surface (e.g. the Desktop): normalised key and pointer
 * events from capture-phase listeners on `rootRef`, tagged with the nearest element's
 * data-input-id / data-input-kind, into an in-memory tally (./targetSummary.js). Calls
 * `onSummary(summary)` only when the small summary changes — capped counts, so never once per
 * keystroke. Capture phase means a gesture is recorded before the React handler it triggers
 * runs (a drop is counted before the file moves), so the resulting check sees both.
 *
 * `resetKey` starts a fresh tally (e.g. per task). Returns `recordCommand(combo, via)` for
 * menu/toolbar actions that have a keyboard shortcut (context-menu Copy → 'mod+c', 'menu').
 * Raw events never leave the tally. Kept out of index.js so the input library stays Node-safe.
 */
export function useSurfaceInputRecorder(
  rootRef,
  { enabled = true, cap, resetKey = null, onSummary } = {}
) {
  const tallyRef = useRef(null)
  const lastJsonRef = useRef(null)
  const onSummaryRef = useRef(onSummary)
  onSummaryRef.current = onSummary
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  if (tallyRef.current == null || tallyRef.current.cap !== cap) {
    tallyRef.current = { cap, tally: createInputTally(cap ? { cap } : undefined) }
    lastJsonRef.current = null
  }

  // A new task (or cap) starts a fresh tally.
  useEffect(() => {
    tallyRef.current.tally.reset()
    lastJsonRef.current = null
  }, [resetKey, cap])

  const emit = useCallback(() => {
    const summary = tallyRef.current.tally.summary()
    const json = JSON.stringify(summary)
    if (json === lastJsonRef.current) return
    lastJsonRef.current = json
    onSummaryRef.current?.(summary)
  }, [])

  const record = useCallback(
    (event, { flush = false } = {}) => {
      if (!enabledRef.current) return
      tallyRef.current.tally.record(event)
      if (flush) emit()
    },
    [emit]
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) return undefined
    let down = null
    let lastPointerType = 'mouse'
    let lastWheel = -Infinity
    let hovered = null

    const pointer = (e, overrides = {}) =>
      normalizePointerEvent({
        type: overrides.type ?? e.type,
        pointerType: e.pointerType || lastPointerType,
        button: e.button,
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target,
        ...overrides,
      })

    function setHover(next) {
      if (hovered?.id === next?.id) return
      if (hovered) {
        record(
          pointer({}, { type: 'pointerleave', targetId: hovered.id, targetKind: hovered.kind }),
          {
            flush: true,
          }
        )
      }
      hovered = next
      if (hovered) {
        record(
          pointer({}, { type: 'pointerenter', targetId: hovered.id, targetKind: hovered.kind })
        )
      }
    }

    const handlers = {
      pointerdown(e) {
        lastPointerType = e.pointerType || 'mouse'
        down = { x: e.clientX, y: e.clientY, moved: false }
        record(pointer(e))
      },
      pointermove(e) {
        // Only the move that turns a press into a drag matters to the recogniser.
        if (!down || down.moved) return
        if (
          Math.hypot(e.clientX - down.x, e.clientY - down.y) <=
          DEFAULT_GESTURE_OPTIONS.dragThresholdPx
        )
          return
        down.moved = true
        record(pointer(e))
      },
      pointerup(e) {
        down = null
        record(pointer(e), { flush: true })
      },
      pointercancel(e) {
        down = null
        record(pointer(e))
      },
      pointerover(e) {
        if ((e.pointerType || 'mouse') !== 'mouse') return
        setHover(closestTarget(e.target))
      },
      pointerleave(e) {
        if (e.target === root) setHover(null)
      },
      click: (e) => record(pointer(e), { flush: true }),
      dblclick: (e) => record(pointer(e), { flush: true }),
      contextmenu: (e) => record(pointer(e), { flush: true }),
      wheel(e) {
        if (e.timeStamp - lastWheel < WHEEL_THROTTLE_MS) return
        lastWheel = e.timeStamp
        record(pointer(e, { type: 'wheel' }), { flush: true })
      },
      dragstart: (e) => record(pointer(e)),
      drop: (e) => record(pointer(e), { flush: true }),
      dragend: (e) => record(pointer(e), { flush: true }),
      keydown: (e) => record(normalizeKeyEvent(e), { flush: true }),
    }
    for (const [type, handler] of Object.entries(handlers)) {
      root.addEventListener(type, handler, true)
    }
    return () => {
      for (const [type, handler] of Object.entries(handlers)) {
        root.removeEventListener(type, handler, true)
      }
    }
    // resetKey: a keyed surface remounts per task, so listeners move to the new element.
  }, [rootRef, enabled, record, resetKey])

  return useCallback(
    (combo, via = 'menu') =>
      record({ t: Date.now(), kind: 'command', combo, via }, { flush: true }),
    [record]
  )
}
