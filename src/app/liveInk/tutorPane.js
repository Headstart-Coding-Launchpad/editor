// Tutor pointer layer: which pane the tutor's mouse is over, and where in it, as fractions.
// Panes opt in with a `data-tp-pane="<id>"` attribute; the innermost tagged ancestor wins, so
// a pane nested in the page gets its own fractions. Fractions (not pixels) are what makes the
// dot land on the same spot of the same pane on a student's different-sized screen.

export const TUTOR_PANE_ATTR = 'data-tp-pane'

/** Pointer idle this long on a student's screen and the dot goes away. */
export const TUTOR_POINTER_IDLE_MS = 4000
/** A click ripple stays on screen this long. */
export const TUTOR_RIPPLE_MS = 700

const round3 = (value) => Math.round(value * 1000) / 1000

/** The innermost tagged pane around `target`, as `{ el, id }`, or null. */
export function tutorPaneOf(target) {
  const el = target?.closest?.(`[${TUTOR_PANE_ATTR}]`)
  return el ? { el, id: el.getAttribute(TUTOR_PANE_ATTR) } : null
}

export function findTutorPane(root, id) {
  if (!root || !id) return null
  for (const el of root.querySelectorAll(`[${TUTOR_PANE_ATTR}]`)) {
    if (el.getAttribute(TUTOR_PANE_ATTR) === id) return el
  }
  return null
}

/** Client coordinates → fractions of the pane's box, or null for an empty box. */
export function fractionsInPane(el, clientX, clientY) {
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return null
  return {
    rx: round3((clientX - box.left) / box.width),
    ry: round3((clientY - box.top) / box.height),
  }
}

/** Fractions → client coordinates inside the pane, or null for an empty box. */
export function clientPointInPane(el, rx, ry) {
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return null
  return { x: box.left + rx * box.width, y: box.top + ry * box.height }
}
