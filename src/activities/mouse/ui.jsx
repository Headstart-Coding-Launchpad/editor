import React, { useEffect, useRef, useState } from 'react'
import MouseBuilderEditor from './MouseBuilderEditor.jsx'
import { activeMouseItems, describeMouseItem, gradeMouseItem } from './mouse.js'
import {
  DEFAULT_GESTURE_OPTIONS,
  createInputRecorder,
  gestureSatisfies,
  normalizePointerEvent,
  recognizeGestures,
} from '../../shared/input/index.js'

// Mouse activity UI: a stage of positioned targets (data-input-id) and one instruction at a
// time. Pointer, click, dblclick, contextmenu, wheel/scroll and enter/leave events are
// normalised into an in-memory recorder and recognised as gestures (src/shared/input); only
// the gesture that completed each item is stored: { v, device: { touch }, items: { [id]: { via } } }.
// On a touch screen the touch equivalent counts (tap, double-tap, press-and-hold, touch drag)
// and hover items are skipped; task.touch 'block' shows a "needs a mouse" notice instead.

const TOUCH_WORDS = {
  click: 'Tap',
  double_click: 'Double-tap',
  right_click: 'Press and hold',
  drag: 'Drag',
  scroll: 'Swipe to scroll inside',
  hover: 'Hover over',
}
const DOUBLE_TAP_MS = 350
// How long after a drag or press-and-hold completes an item its trailing click is ignored.
const POST_GESTURE_CLICK_MS = 100

function targetName(task, id) {
  return task?.targets?.find((target) => target.id === id)?.label ?? id
}

function instructionFor(task, item, touch) {
  if (!item) return ''
  if (item.prompt) return item.prompt
  if (item.action === 'scroll') {
    return `${touch ? 'Swipe to scroll' : 'Scroll'} inside the ${targetName(task, item.target)}`
  }
  if (!touch) return describeMouseItem(task, item)
  const verb = TOUCH_WORDS[item.action] ?? item.action
  return item.action === 'drag'
    ? `${verb} the ${targetName(task, item.target)} to the ${targetName(task, item.to)}`
    : `${verb} the ${targetName(task, item.target)}`
}

function gestureKey(gesture) {
  return `${gesture.gesture}:${gesture.targetId}:${gesture.toTargetId ?? ''}:${gesture.at}`
}

export function MouseStudentView({
  task,
  state,
  onChange,
  onSubmit,
  readOnly = false,
  device = {},
}) {
  const touch = !!state?.device?.touch || !!device.touch
  const blocked = (task?.touch ?? 'equivalent') === 'block' && touch && !readOnly
  const items = activeMouseItems(task, { touch })
  const allowTouch = (task?.touch ?? 'equivalent') !== 'block'
  const isDone = (item) => gradeMouseItem(task, item, state?.items?.[item.id]).correct
  const current = items.find((item) => !isDone(item)) ?? null
  const currentIndex = current ? items.indexOf(current) : items.length
  const [message, setMessage] = useState(null)
  const [drag, setDrag] = useState(null)
  const stageRef = useRef(null)
  const recorderRef = useRef(createInputRecorder())
  const handledRef = useRef(new Set())
  const lastPointerTypeRef = useRef('mouse')
  const lastTapRef = useRef({ targetId: null, at: 0 })
  const hoverTimersRef = useRef(new Map())
  // Resetting the recorder also drops the recogniser's "ignore the click after a drag" guard,
  // so the view keeps its own window for the click the browser sends after the pointerup.
  const suppressClickUntilRef = useRef(0)
  const latestRef = useRef({})
  latestRef.current = { current, state, touch }

  // A touch-only device is recorded in the state as soon as the activity opens, so grading
  // (which reads state.device) skips hover items and accepts touch gestures from the start.
  useEffect(() => {
    if (readOnly || !device.touch || state?.device?.touch) return
    onChange?.((prev) => ({
      ...(prev ?? { v: 1, items: {} }),
      device: { ...(prev?.device ?? {}), touch: true },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.touch, readOnly])

  useEffect(() => {
    const timers = hoverTimersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  function stageRect() {
    return stageRef.current?.getBoundingClientRect?.() ?? null
  }

  function markTouch() {
    if (readOnly || latestRef.current.state?.device?.touch) return
    onChange?.((prev) => ({
      ...(prev ?? { v: 1, items: {} }),
      device: { ...(prev?.device ?? {}), touch: true },
    }))
  }

  function setItemResult(item, via) {
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      // The platform (Mac, Chromebook…) lets the teacher see how right-click was done.
      device: {
        ...(prev?.device ?? { touch: false }),
        ...(device.platform ? { platform: device.platform } : {}),
      },
      items: { ...(prev?.items ?? {}), [item.id]: { via } },
    }))
  }

  // Evaluates newly recognised gestures against the current item.
  function evaluate() {
    const { current: item } = latestRef.current
    const gestures = recognizeGestures(recorderRef.current.events())
    for (const gesture of gestures) {
      const key = gestureKey(gesture)
      if (handledRef.current.has(key)) continue
      handledRef.current.add(key)
      if (!item || readOnly) continue
      // Resting the pointer on a target is only an answer when the item asks for a hover.
      if (gesture.gesture === 'hover' && item.action !== 'hover') continue
      if (gesture.targetId !== item.target) {
        if (gesture.targetId)
          setMessage(
            `That was the ${targetName(task, gesture.targetId)}. Find the ${targetName(task, item.target)}.`
          )
        continue
      }
      // The first click of a double-click (or tap of a double-tap) is not a mistake yet.
      if (
        item.action === 'double_click' &&
        (gesture.gesture === 'click' || gesture.gesture === 'tap')
      ) {
        continue
      }
      if (item.action === 'drag' && gesture.gesture === 'drag' && gesture.toTargetId !== item.to) {
        setMessage(`Drop it on the ${targetName(task, item.to)}.`)
        continue
      }
      setMessage(null)
      setItemResult(item, gesture.gesture)
      if (gestureSatisfies(item.action, gesture.gesture, { allowTouchEquivalent: allowTouch })) {
        if (gesture.gesture === 'drag' || gesture.gesture === 'long_press') {
          suppressClickUntilRef.current = Date.now() + POST_GESTURE_CLICK_MS
        }
        recorderRef.current.reset()
        handledRef.current.clear()
        const remaining = items.filter((other) => other !== item && !isDone(other))
        if (remaining.length === 0) {
          // Every item done: mark the task (the host grades, logs and shows feedback).
          setTimeout(() => onSubmit?.(), 0)
        }
        return
      }
    }
  }

  function record(event) {
    if (readOnly || blocked) return
    recorderRef.current.record(event)
    evaluate()
  }

  function fromDom(event, overrides = {}) {
    return normalizePointerEvent(
      {
        type: overrides.type ?? event.type,
        pointerType: overrides.pointerType ?? event.pointerType ?? lastPointerTypeRef.current,
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target,
        targetId: overrides.targetId,
      },
      stageRect()
    )
  }

  // ─── Pointer handlers (targets) ───────────────────────────────────────────
  function onTargetPointerDown(event, target) {
    if (readOnly || blocked) return
    lastPointerTypeRef.current = event.pointerType || 'mouse'
    if (event.pointerType === 'touch') markTouch()
    if (event.button !== 0 && event.pointerType !== 'touch') {
      record(fromDom(event, { targetId: target.id }))
      return
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Capture is best-effort (synthetic events in tests have no active pointer).
    }
    setDrag({
      id: target.id,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    })
    record(fromDom(event, { targetId: target.id }))
  }

  function onTargetPointerMove(event, target) {
    if (!drag || drag.id !== target.id) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const moved = drag.moved || Math.hypot(dx, dy) > DEFAULT_GESTURE_OPTIONS.dragThresholdPx
    setDrag({ ...drag, dx, dy, moved })
    record(fromDom(event, { targetId: target.id }))
  }

  // The target under the pointer when a drag ends, skipping the dragged target itself (it sits
  // under the cursor/finger). elementsFromPoint lists every layer, so this works for mouse and
  // touch drags without relying on pointer-events tricks on the captured element.
  function dropTargetAt(event, draggedId) {
    const idOf = (element) =>
      element?.closest?.('[data-input-id]')?.getAttribute('data-input-id') ?? null
    if (typeof document.elementsFromPoint === 'function') {
      for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
        const id = idOf(element)
        if (id && id !== draggedId) return id
      }
      return null
    }
    if (typeof document.elementFromPoint !== 'function') return null
    const id = idOf(document.elementFromPoint(event.clientX, event.clientY))
    return id === draggedId ? null : id
  }

  function onTargetPointerUp(event, target) {
    if (!drag || drag.id !== target.id) return
    const dropId = drag.moved ? dropTargetAt(event, target.id) : target.id
    setDrag(null)
    record(fromDom(event, { targetId: dropId }))
  }

  function onTargetPointerCancel() {
    setDrag(null)
  }

  // ─── Click family (stage, bubbling from targets) ──────────────────────────
  function onStageClick(event) {
    if (Date.now() <= suppressClickUntilRef.current) return
    const targetId = event.target?.closest?.('[data-input-id]')?.getAttribute('data-input-id')
    // A keyboard "click" (Enter/Space on a focused target) has no pointer behind it.
    if (event.detail === 0 && targetId) {
      setMessage('This one is for the mouse (or your finger), not the keyboard.')
      return
    }
    const pointerType = event.nativeEvent?.pointerType || lastPointerTypeRef.current
    record(fromDom(event, { type: 'click', pointerType }))
    if (pointerType === 'touch' && targetId) {
      // Phones don't reliably send dblclick, so two quick taps make one.
      const last = lastTapRef.current
      const now = Date.now()
      if (last.targetId === targetId && now - last.at <= DOUBLE_TAP_MS) {
        lastTapRef.current = { targetId: null, at: 0 }
        record(fromDom(event, { type: 'dblclick', pointerType: 'touch' }))
      } else {
        lastTapRef.current = { targetId, at: now }
      }
    }
  }

  function onStageDoubleClick(event) {
    const pointerType = event.nativeEvent?.pointerType || lastPointerTypeRef.current
    if (pointerType === 'touch') return // counted from the two taps above
    record(fromDom(event, { type: 'dblclick', pointerType }))
  }

  function onStageContextMenu(event) {
    // The browser's own menu would cover the stage; the right-click is what we're practising.
    event.preventDefault()
    const pointerType = event.nativeEvent?.pointerType || lastPointerTypeRef.current
    record(fromDom(event, { type: 'contextmenu', pointerType }))
  }

  function onTargetScroll(event, target) {
    record(
      fromDom(event, {
        type: 'scroll',
        targetId: target.id,
        pointerType: lastPointerTypeRef.current,
      })
    )
  }

  function onTargetWheel(event, target) {
    record(fromDom(event, { type: 'wheel', targetId: target.id, pointerType: 'mouse' }))
  }

  // Hover: a dwell timer completes the hover while the pointer is still over the target (the
  // recogniser otherwise only sees it on leave).
  function onTargetPointerEnter(event, target) {
    if (event.pointerType === 'touch') return
    record(
      fromDom(event, {
        type: 'pointerenter',
        targetId: target.id,
        pointerType: event.pointerType || 'mouse',
      })
    )
    clearTimeout(hoverTimersRef.current.get(target.id))
    const enteredAt = Date.now()
    hoverTimersRef.current.set(
      target.id,
      setTimeout(() => {
        hoverTimersRef.current.delete(target.id)
        record({
          ...fromDom(
            { type: 'pointerleave' },
            { type: 'pointerleave', targetId: target.id, pointerType: 'mouse' }
          ),
          t: enteredAt + DEFAULT_GESTURE_OPTIONS.hoverDwellMs,
        })
      }, DEFAULT_GESTURE_OPTIONS.hoverDwellMs)
    )
  }

  function onTargetPointerLeave(event, target) {
    if (event.pointerType === 'touch') return
    clearTimeout(hoverTimersRef.current.get(target.id))
    hoverTimersRef.current.delete(target.id)
    record(
      fromDom(event, {
        type: 'pointerleave',
        targetId: target.id,
        pointerType: event.pointerType || 'mouse',
      })
    )
  }

  if (blocked) {
    return (
      <div className="act-notice act-notice--warning" role="status" data-testid="mouse-blocked">
        🖱️ This activity needs a mouse or trackpad. Ask your teacher if you can use a computer with
        a mouse.
      </div>
    )
  }

  const currentResult = current ? state?.items?.[current.id] : null
  const hint =
    current && currentResult?.via ? gradeMouseItem(task, current, currentResult).hint : null
  const scrollTargets = new Set(
    items.filter((item) => item.action === 'scroll').map((item) => item.target)
  )

  return (
    <div className="act-panel" data-testid="mouse-activity">
      <p className="act-row" aria-live="polite">
        <span className="act-badge">
          {Math.min(currentIndex + (current ? 1 : 0), items.length)} of {items.length}
        </span>
        <span className="act-prompt" data-testid="mouse-instruction">
          {current ? instructionFor(task, current, touch) : '✓ All done — great mousing!'}
        </span>
      </p>
      {message && <p role="status">{message}</p>}
      {hint && !message && (
        <p className="act-hint" role="status">
          💡 {hint}
        </p>
      )}
      <div
        ref={stageRef}
        className="act-stage"
        data-testid="mouse-stage"
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onContextMenu={onStageContextMenu}
      >
        {(task?.targets ?? []).map((target) => {
          const dragging = drag?.id === target.id && drag.moved
          const isScroll = scrollTargets.has(target.id)
          const isCurrent =
            current &&
            (current.target === target.id ||
              (current.action === 'drag' && current.to === target.id))
          const className = [
            'act-target',
            `act-target--${target.size ?? 'large'}`,
            isCurrent ? 'act-target--current' : '',
            dragging ? 'act-target--dragging' : '',
            isScroll ? 'act-target--scroll' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div
              key={target.id}
              className={className}
              data-input-id={target.id}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={target.label ?? target.id}
              style={{
                left: `${(target.x ?? 0.5) * 100}%`,
                top: `${(target.y ?? 0.5) * 100}%`,
                ...(dragging
                  ? { transform: `translate(calc(-50% + ${drag.dx}px), calc(-50% + ${drag.dy}px))` }
                  : null),
              }}
              onPointerDown={(event) => onTargetPointerDown(event, target)}
              onPointerMove={(event) => onTargetPointerMove(event, target)}
              onPointerUp={(event) => onTargetPointerUp(event, target)}
              onPointerCancel={onTargetPointerCancel}
              onPointerEnter={(event) => onTargetPointerEnter(event, target)}
              onPointerLeave={(event) => onTargetPointerLeave(event, target)}
              onScroll={isScroll ? (event) => onTargetScroll(event, target) : undefined}
              onWheel={(event) => onTargetWheel(event, target)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setMessage('This one is for the mouse (or your finger), not the keyboard.')
                }
              }}
            >
              <span className="act-target__emoji" aria-hidden="true">
                {target.emoji ?? '⬤'}
              </span>
              <span>{target.label}</span>
              {isScroll && <span className="act-scroll-filler" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
      {!readOnly && (
        <div className="act-row">
          <button type="button" className="btn-primary act-btn" onClick={() => onSubmit?.()}>
            Check my work
          </button>
        </div>
      )}
    </div>
  )
}

export default {
  StudentView: MouseStudentView,
  BuilderEditor: MouseBuilderEditor,
}
