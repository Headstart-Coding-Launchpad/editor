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

/** The innermost tagged pane around `target` that has a box, as `{ el, id }`, or null. */
export function tutorPaneOf(target) {
  let el = target?.closest?.(`[${TUTOR_PANE_ATTR}]`)
  while (el) {
    const box = el.getBoundingClientRect()
    if (box.width && box.height) return { el, id: el.getAttribute(TUTOR_PANE_ATTR) }
    el = el.parentElement?.closest?.(`[${TUTOR_PANE_ATTR}]`)
  }
  return null
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

// ─── Scroll ──────────────────────────────────────────────────────────────────────────────

/** A scroll position as a fraction 0..1 of what can scroll, or null when nothing can. */
export function scrollFractionOf(scroller) {
  const room = scroller.scrollHeight - scroller.clientHeight
  if (!(room > 0)) return null
  return round3(Math.min(1, Math.max(0, scroller.scrollTop / room)))
}

function canScroll(el) {
  return el.scrollHeight - el.clientHeight > 1
}

/** The element in a pane that scrolls: the pane itself, else its first scrollable descendant. */
export function scrollerOfPane(paneEl) {
  if (canScroll(paneEl)) return paneEl
  for (const el of paneEl.querySelectorAll('*')) {
    if (canScroll(el) && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el
  }
  return null
}

/** Scrolls a pane to a fraction the tutor sent. Returns true when something moved. */
export function applyScrollFraction(paneEl, fraction) {
  const scroller = scrollerOfPane(paneEl)
  if (!scroller) return false
  const target = Math.round(fraction * (scroller.scrollHeight - scroller.clientHeight))
  if (scroller.scrollTop === target) return false
  scroller.scrollTop = target
  return true
}
