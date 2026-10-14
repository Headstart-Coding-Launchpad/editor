// The DOM half of control highlights (./controlHighlight.js): finds the control on screen, keeps
// a ring over it, and ends the highlight when the student uses that control or after 20 s.
// Workspaces only mark their controls with data-highlight-target / data-highlight-reveal; this
// hook and ControlHighlightRing do the rest, so no workspace keeps its own pulse code.
import { useEffect, useRef, useState } from 'react'
import {
  CONTROL_HIGHLIGHT_ATTR,
  CONTROL_HIGHLIGHT_REVEAL_ATTR,
  CONTROL_HIGHLIGHT_REVEAL_EVENT,
  CONTROL_HIGHLIGHT_TIMEOUT_MS,
  highlightRevealSelector,
  highlightTargetSelector,
} from './controlHighlight.js'

// How long a control may stay off screen before the hook asks for its pane to be pointed at
// (long enough for a task slide to land).
const REVEAL_GRACE_MS = 600
// How often the reveal event is re-sent while the control stays out of view (a workspace that
// mounts late still gets one), and how many times at most.
const REVEAL_EVENT_EVERY_MS = 700
const REVEAL_EVENT_MAX = 3

function intersect(a, b) {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  return right - left < 1 || bottom - top < 1 ? null : { left, top, right, bottom }
}

function isCssShown(el) {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })
  }
  const view = el.ownerDocument?.defaultView
  return !view || view.getComputedStyle(el).visibility !== 'hidden'
}

/**
 * The part of `el` the student can actually see, as { left, top, right, bottom } in viewport
 * pixels, or null when it is hidden, unmounted, scrolled away or clipped out (a category label
 * scrolled out of Scratch's palette). Clips to every scrolling/clipping ancestor and the
 * outermost <svg> holding it.
 */
export function visibleRect(el) {
  if (!el?.isConnected || typeof el.getBoundingClientRect !== 'function') return null
  const box = el.getBoundingClientRect()
  if (box.width < 1 || box.height < 1 || !isCssShown(el)) return null
  const view = el.ownerDocument.defaultView
  let rect = { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
  rect = intersect(rect, {
    left: 0,
    top: 0,
    right: view?.innerWidth ?? Infinity,
    bottom: view?.innerHeight ?? Infinity,
  })
  for (let node = el.parentElement; node && rect; node = node.parentElement) {
    const isOuterSvg =
      node.namespaceURI === 'http://www.w3.org/2000/svg' &&
      node.tagName.toLowerCase() === 'svg' &&
      !node.ownerSVGElement
    let clips = isOuterSvg
    if (!clips && node.namespaceURI !== 'http://www.w3.org/2000/svg' && view) {
      const style = view.getComputedStyle(node)
      clips = style.overflowX !== 'visible' || style.overflowY !== 'visible'
    }
    if (clips) {
      const outer = node.getBoundingClientRect()
      rect = intersect(rect, outer)
    }
  }
  return rect
}

// Blockly flyout category headings (Scratch's always-open palette) whose text is `name`.
function findCategoryLabels(root, name) {
  const wanted = name.toLowerCase()
  return [...root.querySelectorAll('.blocklyFlyoutLabel')].filter(
    (label) => label.textContent.trim().toLowerCase() === wanted
  )
}

// Every element on the page that is this target's control (shown or not).
export function findHighlightElements(root, target) {
  if (!root || !target) return []
  if (target.option && target.revealKey === 'category') {
    return findCategoryLabels(root, target.option)
  }
  return [...root.querySelectorAll(highlightTargetSelector(target.id))]
}

function firstShown(elements) {
  for (const el of elements) {
    const rect = visibleRect(el)
    if (rect) return { el, rect }
  }
  return null
}

// Whether any marked control of any target is on screen: when none is, the whole workspace is
// hidden behind another tab (a compact Instructions/Code switcher).
function anyMarkedControlShown(root) {
  return !!firstShown(
    root.querySelectorAll(`[${CONTROL_HIGHLIGHT_ATTR}], [${CONTROL_HIGHLIGHT_REVEAL_ATTR}]`)
  )
}

/**
 * Where the ring should go right now: on the control ({ kind: 'target' }), on a control that
 * reveals it ({ kind: 'reveal' }: a collapsed panel rail, a palette toggle), or nowhere (null).
 */
export function locateHighlight(root, target) {
  const shown = firstShown(findHighlightElements(root, target))
  if (shown) return { kind: 'target', ...shown }
  const reveal = firstShown(root.querySelectorAll(highlightRevealSelector(target.revealKey)))
  if (reveal) return { kind: 'reveal', ...reveal }
  return null
}

// The panes to point at (through the existing pane highlight) while the control is off screen:
// the module's own compact tab for it, plus the workspace's 'code' tab when the workspace
// itself is hidden.
export function revealPanesFor(root, target) {
  const panes = []
  if (target.pane) panes.push(target.pane)
  if (!anyMarkedControlShown(root)) panes.push('code')
  return panes.length ? panes : null
}

function sameRect(a, b) {
  return (
    !!a &&
    !!b &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.right) === Math.round(b.right) &&
    Math.round(a.bottom) === Math.round(b.bottom)
  )
}

function samePanes(a, b) {
  return (a ?? []).join(',') === (b ?? []).join(',')
}

function pointIn(rect, event) {
  return (
    !!rect &&
    typeof event.clientX === 'number' &&
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  )
}

/**
 * Runs one highlight. `active` is { key, target } (target from listHighlightTargets) or null;
 * a new `key` restarts it. `onDone` runs once when the student uses the control or the
 * timeout passes. Returns { ring, revealPanes }: `ring` is { kind, rect } for
 * ControlHighlightRing, `revealPanes` the pane ids to add to the pane highlight.
 */
export function useControlHighlight(
  active,
  { onDone, timeoutMs = CONTROL_HIGHLIGHT_TIMEOUT_MS } = {}
) {
  const [ring, setRing] = useState(null)
  const [revealPanes, setRevealPanes] = useState(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const key = active?.key ?? null

  useEffect(() => {
    const current = activeRef.current
    if (!key || !current?.target || typeof document === 'undefined') {
      setRing(null)
      setRevealPanes(null)
      return undefined
    }
    const { target } = current
    const startedAt = Date.now()
    let stopped = false
    let frame = 0
    let hiddenSince = null
    let revealEvents = 0
    let lastRevealEventAt = -Infinity
    let located = null

    function stop() {
      stopped = true
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', handleUse, true)
      document.removeEventListener('click', handleUse, true)
    }

    function finish() {
      if (stopped) return
      stop()
      setRing(null)
      setRevealPanes(null)
      onDoneRef.current?.()
    }

    // Using the control ends it: a click or tap on it (a tab opened, the flag pressed, a
    // category heading tapped). Clicking a reveal control (a rail, a tab) does not.
    function handleUse(event) {
      if (located?.kind !== 'target') return
      if (located.el.contains(event.target) || pointIn(located.rect, event)) finish()
    }

    function tick() {
      if (stopped) return
      const now = Date.now()
      if (now - startedAt >= timeoutMs) {
        finish()
        return
      }
      located = locateHighlight(document, target)
      if (located?.kind === 'target') hiddenSince = null
      else if (hiddenSince == null) hiddenSince = now
      if (
        located?.kind !== 'target' &&
        revealEvents < REVEAL_EVENT_MAX &&
        now - lastRevealEventAt >= REVEAL_EVENT_EVERY_MS
      ) {
        revealEvents += 1
        lastRevealEventAt = now
        window.dispatchEvent(
          new CustomEvent(CONTROL_HIGHLIGHT_REVEAL_EVENT, { detail: { target: target.id } })
        )
      }
      const nextPanes =
        !located && hiddenSince != null && now - hiddenSince >= REVEAL_GRACE_MS
          ? revealPanesFor(document, target)
          : null
      setRing((prev) =>
        !located
          ? null
          : prev && prev.kind === located.kind && sameRect(prev.rect, located.rect)
            ? prev
            : { kind: located.kind, rect: located.rect }
      )
      setRevealPanes((prev) => (samePanes(prev, nextPanes) ? prev : nextPanes))
      frame = requestAnimationFrame(tick)
    }

    document.addEventListener('pointerdown', handleUse, true)
    document.addEventListener('click', handleUse, true)
    frame = requestAnimationFrame(tick)
    return () => {
      stop()
      setRing(null)
      setRevealPanes(null)
    }
  }, [key, timeoutMs])

  return { ring, revealPanes }
}
