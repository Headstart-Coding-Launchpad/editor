// Recognise mouse and touch gestures from normalised pointer events (see events.js). Native
// click/dblclick/contextmenu events are trusted where the browser provides them; drags,
// long-presses, hovers and scrolls are recognised from pointer timing and movement. HTML5
// drag-and-drop (dragstart → drop/dragend, which cancels the pointer stream) is a drag too.
// Gestures carry the target's semantic kind (data-input-kind) when the element declares one.
// Pure: works on plain event objects.

export const GESTURES = [
  'click',
  'double_click',
  'right_click',
  'drag',
  'scroll',
  'hover',
  'tap',
  'double_tap',
  'long_press',
]

// What a touch-screen student does instead of each mouse gesture. Hover has no touch
// equivalent, so an activity must skip or block hover items on touch devices.
export const TOUCH_EQUIVALENTS = {
  click: 'tap',
  double_click: 'double_tap',
  right_click: 'long_press',
  drag: 'drag',
  scroll: 'scroll',
  hover: null,
}

export const DEFAULT_GESTURE_OPTIONS = {
  dragThresholdPx: 8,
  longPressMs: 500,
  longPressMovePx: 10,
  hoverDwellMs: 800,
  scrollMergeMs: 300,
}

const isTouch = (event) => event.pointerType === 'touch'

function distance(a, b) {
  if (a.px == null || b.px == null) return 0
  return Math.hypot(b.px - a.px, b.py - a.py)
}

export function recognizeGestures(events, options = {}) {
  const opts = { ...DEFAULT_GESTURE_OPTIONS, ...options }
  const gestures = []
  let down = null
  let suppressClickUntil = -Infinity
  let nativeDrag = null
  const hoverStart = new Map()

  const emit = (gesture, event, extra = {}) =>
    gestures.push({
      gesture,
      targetId: event.targetId ?? null,
      ...(event.targetKind ? { targetKind: event.targetKind } : {}),
      at: event.t,
      ...extra,
    })
  const dropTarget = (event) => ({
    toTargetId: event?.targetId ?? null,
    ...(event?.targetKind ? { toTargetKind: event.targetKind } : {}),
  })

  for (const event of events) {
    switch (event.kind) {
      case 'pointerdown':
        down = { ...event, dragging: false, maxMove: 0, longPressed: false }
        break
      case 'pointermove':
        if (down) {
          const moved = distance(down, event)
          down.maxMove = Math.max(down.maxMove, moved)
          if (moved > opts.dragThresholdPx) down.dragging = true
        }
        break
      case 'pointerup':
        if (down) {
          if (down.dragging) {
            emit('drag', down, { ...dropTarget(event), at: event.t })
            // Browsers can fire a click after a drag that starts and ends on one element.
            suppressClickUntil = event.t + 50
          } else if (
            isTouch(down) &&
            !down.longPressed &&
            event.t - down.t >= opts.longPressMs &&
            down.maxMove <= opts.longPressMovePx
          ) {
            emit('long_press', down, { at: event.t })
            suppressClickUntil = event.t + 50
          }
        }
        down = null
        break
      case 'pointercancel':
        down = null
        break
      case 'dragstart':
        // The browser takes over the pointer (pointercancel follows); the source is where the
        // press started, or the dragstart target when the press wasn't recorded.
        nativeDrag = down ?? event
        down = null
        break
      case 'drop':
        if (nativeDrag) {
          emit('drag', nativeDrag, { ...dropTarget(event), at: event.t })
          nativeDrag = null
          suppressClickUntil = event.t + 50
        }
        break
      case 'dragend':
        // Dropped outside any drop zone (a drop inside one was already counted).
        if (nativeDrag) {
          emit('drag', nativeDrag, { ...dropTarget(null), at: event.t })
          nativeDrag = null
        }
        break
      case 'click':
        if (event.t > suppressClickUntil) emit(isTouch(event) ? 'tap' : 'click', event)
        break
      case 'dblclick':
        emit(isTouch(event) ? 'double_tap' : 'double_click', event)
        break
      case 'contextmenu':
        // Android fires contextmenu on a long press; count it once.
        if (isTouch(event)) {
          if (down) down.longPressed = true
          emit('long_press', event)
        } else {
          emit('right_click', event)
        }
        break
      case 'wheel':
      case 'scroll': {
        const last = gestures[gestures.length - 1]
        const merges =
          last?.gesture === 'scroll' &&
          last.targetId === (event.targetId ?? null) &&
          event.t - last.lastAt <= opts.scrollMergeMs
        if (merges) last.lastAt = event.t
        else emit('scroll', event, { lastAt: event.t })
        break
      }
      case 'pointerenter':
        if (!isTouch(event) && event.targetId) hoverStart.set(event.targetId, event.t)
        break
      case 'pointerleave':
        if (event.targetId && hoverStart.has(event.targetId)) {
          const start = hoverStart.get(event.targetId)
          hoverStart.delete(event.targetId)
          if (event.t - start >= opts.hoverDwellMs) emit('hover', event, { at: start })
        }
        break
      default:
        break
    }
  }
  return gestures.map(({ lastAt: _lastAt, ...gesture }) => gesture)
}

// Does a performed gesture satisfy a required mouse gesture? With allowTouchEquivalent, the
// touch counterpart also counts (double_tap for double_click, long_press for right_click).
export function gestureSatisfies(required, performed, { allowTouchEquivalent = true } = {}) {
  if (required === performed) return true
  return allowTouchEquivalent && TOUCH_EQUIVALENTS[required] === performed
}
