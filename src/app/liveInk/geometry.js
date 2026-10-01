// Pure helpers for Presentation annotations (live pointer, fading ink, text highlights).
//
// Screens differ in size, so nothing is sent as pixels. A position is `{ anchor, rx, ry }`:
// the `data-md-anchor` of the content element under it (see src/shared/markdown/anchors.js)
// and fractions of that element's bounding box. Every client looks the anchor up in its own
// DOM and maps the fractions back onto its own box, so the dot lands on the same word or the
// same part of an image even after the text has reflowed.

import { MD_ANCHOR_ATTR } from '../../shared/markdown/anchors.js'

/** Anchor name used when no `data-md-anchor` element contains the point: the surface itself. */
export const ROOT_ANCHOR = 'root'

/** Ink and pointer fractions may run a little outside their anchor's box (a circle drawn round
 * a word), but never further than this — anything wilder is dropped. Mirrors database.rules.json. */
export const FRACTION_LIMIT = 10

/** Points kept per stroke (database.rules.json caps the list at the same length). */
export const MAX_STROKE_POINTS = 200

/** Longest highlight quote, in characters (also capped in database.rules.json). */
export const MAX_QUOTE_LENGTH = 500

function round4(value) {
  return Math.round(value * 10000) / 10000
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Client point → fractions of `rect` (a DOMRect-like `{ left, top, width, height }`). */
export function pointToFraction(point, rect) {
  if (!point || !rect) return null
  const width = rect.width || 1
  const height = rect.height || 1
  const rx = round4((point.x - rect.left) / width)
  const ry = round4((point.y - rect.top) / height)
  if (Math.abs(rx) > FRACTION_LIMIT || Math.abs(ry) > FRACTION_LIMIT) return null
  return { rx, ry }
}

/** Fractions of `rect` → client point. */
export function fractionToPoint(fraction, rect) {
  if (!fraction || !rect) return null
  if (!isFiniteNumber(fraction.rx) || !isFiniteNumber(fraction.ry)) return null
  return {
    x: rect.left + fraction.rx * rect.width,
    y: rect.top + fraction.ry * rect.height,
  }
}

/**
 * Thins a stroke's client points: drops points closer than `minDistance` px to the last kept
 * one, then evenly samples down to `maxPoints` (always keeping the first and last).
 */
export function simplifyStrokePoints(
  points,
  { minDistance = 3, maxPoints = MAX_STROKE_POINTS } = {}
) {
  const kept = []
  for (const point of points ?? []) {
    if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue
    const last = kept[kept.length - 1]
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) continue
    kept.push(point)
  }
  const lastInput = (points ?? []).at?.(-1)
  if (
    kept.length &&
    lastInput &&
    isFiniteNumber(lastInput.x) &&
    isFiniteNumber(lastInput.y) &&
    kept[kept.length - 1] !== lastInput
  ) {
    kept.push(lastInput)
  }
  if (kept.length <= maxPoints) return kept
  const step = (kept.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => kept[Math.round(i * step)])
}

/** Client points → `[[rx, ry], ...]` fractions of `rect`, dropping any out of range. */
export function strokeToFractions(points, rect) {
  return (points ?? [])
    .map((point) => pointToFraction(point, rect))
    .filter(Boolean)
    .map(({ rx, ry }) => [rx, ry])
}

/** `[[rx, ry], ...]` (or RTDB's object form of the same) → client points on `rect`. */
export function fractionsToStroke(fractions, rect) {
  const list = Array.isArray(fractions) ? fractions : Object.values(fractions ?? {})
  return list
    .map((pair) => {
      const tuple = Array.isArray(pair) ? pair : [pair?.[0], pair?.[1]]
      return fractionToPoint({ rx: tuple[0], ry: tuple[1] }, rect)
    })
    .filter(Boolean)
}

/** SVG path data through `points` (a dot for a single point, so a tap still shows). */
export function pointsToSvgPath(points) {
  if (!points?.length) return ''
  const [first, ...rest] = points
  const head = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  if (!rest.length) return `${head} l0.01 0`
  return `${head} ${rest.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`
}

// ─── Text quotes ────────────────────────────────────────────────────────────

/** Start offsets of every (non-overlapping-start) occurrence of `quote` in `text`. */
export function findQuoteOffsets(text, quote) {
  const offsets = []
  if (!quote) return offsets
  const haystack = String(text ?? '')
  let from = 0
  while (from <= haystack.length) {
    const index = haystack.indexOf(quote, from)
    if (index < 0) break
    offsets.push(index)
    from = index + 1
  }
  return offsets
}

/** Which occurrence of `quote` in `text` starts at `startOffset` (0 when it can't tell). */
export function occurrenceAt(text, quote, startOffset) {
  const offsets = findQuoteOffsets(text, quote)
  const index = offsets.indexOf(startOffset)
  if (index >= 0) return index
  // Closest earlier match — the selection may have started inside surrounding whitespace.
  const before = offsets.filter((offset) => offset <= startOffset).length
  return Math.max(0, before - 1)
}

function collapseWhitespace(text) {
  // Builds the whitespace-collapsed string plus, for each of its characters, the index of the
  // character it came from, so a match in the collapsed text maps back to the original.
  const map = []
  let out = ''
  let lastWasSpace = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue
      lastWasSpace = true
      out += ' '
      map.push(i)
    } else {
      lastWasSpace = false
      out += ch
      map.push(i)
    }
  }
  return { out, map }
}

/**
 * Re-finds a highlighted quote: `{ start, end }` offsets into `text` for the `occurrence`-th
 * match of `quote`, or null. Falls back to the last match when there are fewer occurrences
 * than expected, then to a whitespace-insensitive match (a line break rendered differently).
 */
export function findQuoteRange(text, quote, occurrence = 0) {
  const haystack = String(text ?? '')
  const needle = String(quote ?? '')
  if (!needle.trim()) return null
  const offsets = findQuoteOffsets(haystack, needle)
  if (offsets.length) {
    const pick = offsets[Math.min(Math.max(0, occurrence | 0), offsets.length - 1)]
    return { start: pick, end: pick + needle.length }
  }
  const collapsedText = collapseWhitespace(haystack)
  const collapsedQuote = collapseWhitespace(needle.trim()).out
  const loose = findQuoteOffsets(collapsedText.out, collapsedQuote)
  if (!loose.length) return null
  const pick = loose[Math.min(Math.max(0, occurrence | 0), loose.length - 1)]
  const lastIndex = pick + collapsedQuote.length - 1
  return { start: collapsedText.map[pick], end: collapsedText.map[lastIndex] + 1 }
}

/**
 * Trims a selected quote and moves its start offset past the trimmed leading whitespace.
 * Returns null for an empty or over-long selection.
 */
export function normaliseSelectedQuote(rawQuote, startOffset) {
  const raw = String(rawQuote ?? '')
  const leading = raw.length - raw.trimStart().length
  const quote = raw.trim()
  if (!quote || quote.length > MAX_QUOTE_LENGTH) return null
  return { quote, start: startOffset + leading }
}

// ─── DOM helpers (need a real or jsdom DOM) ─────────────────────────────────

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return String(value).replace(/["\\]/g, '\\$&')
}

/** The element an anchor names inside a surface (the surface itself for ROOT_ANCHOR). */
export function findAnchorElement(surfaceEl, anchor) {
  if (!surfaceEl) return null
  if (!anchor || anchor === ROOT_ANCHOR) return surfaceEl
  return surfaceEl.querySelector(`[${MD_ANCHOR_ATTR}="${cssEscape(anchor)}"]`)
}

/** The innermost anchored element containing `node`, within `surfaceEl` (else the surface). */
export function anchorElementFor(node, surfaceEl) {
  if (!surfaceEl) return null
  let el = node?.nodeType === 1 ? node : node?.parentElement
  while (el && el !== surfaceEl) {
    if (el.hasAttribute?.(MD_ANCHOR_ATTR) && surfaceEl.contains(el)) return el
    el = el.parentElement
  }
  return surfaceEl
}

export function anchorNameOf(el, surfaceEl) {
  if (!el || el === surfaceEl) return ROOT_ANCHOR
  return el.getAttribute(MD_ANCHOR_ATTR) || ROOT_ANCHOR
}

/** Character offset of (container, offset) within `root`'s textContent. */
export function textOffsetWithin(root, container, offset) {
  const doc = root.ownerDocument
  const range = doc.createRange()
  range.selectNodeContents(root)
  range.setEnd(container, offset)
  return range.toString().length
}

/** A DOM Range covering textContent offsets [start, end) of `root`, or null. */
export function rangeFromTextOffsets(root, start, end) {
  if (!root || start == null || end == null || end <= start) return null
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  let position = 0
  let startNode = null
  let startOffset = 0
  let node = walker.nextNode()
  while (node) {
    const length = node.data.length
    if (!startNode && start < position + length) {
      startNode = node
      startOffset = start - position
    }
    if (startNode && end <= position + length) {
      const range = doc.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(node, end - position)
      return range
    }
    position += length
    node = walker.nextNode()
  }
  return null
}

/**
 * Describes a selection Range inside a surface as `{ anchor, quote, occurrence }`, anchored on
 * the innermost anchored element containing the whole selection. Null if the selection is
 * empty, too long, or outside the surface.
 */
export function describeSelection(range, surfaceEl) {
  if (!range || !surfaceEl || range.collapsed) return null
  if (!surfaceEl.contains(range.commonAncestorContainer)) return null
  const anchorEl = anchorElementFor(range.commonAncestorContainer, surfaceEl)
  const rawStart = textOffsetWithin(anchorEl, range.startContainer, range.startOffset)
  const picked = normaliseSelectedQuote(range.toString(), rawStart)
  if (!picked) return null
  return {
    anchor: anchorNameOf(anchorEl, surfaceEl),
    quote: picked.quote,
    occurrence: occurrenceAt(anchorEl.textContent ?? '', picked.quote, picked.start),
  }
}

/** Re-finds a highlight `{ anchor, quote, occurrence }` as a DOM Range inside a surface. */
export function resolveHighlightRange(surfaceEl, highlight) {
  const anchorEl = findAnchorElement(surfaceEl, highlight?.anchor)
  if (!anchorEl) return null
  const found = findQuoteRange(anchorEl.textContent ?? '', highlight.quote, highlight.occurrence)
  if (!found) return null
  return rangeFromTextOffsets(anchorEl, found.start, found.end)
}

/** Nearest scrolling ancestor of `el` (or null when the page itself scrolls). */
export function findScrollContainer(el) {
  let node = el?.parentElement
  while (node && node !== node.ownerDocument.body) {
    const style = node.ownerDocument.defaultView?.getComputedStyle?.(node)
    const overflowY = style?.overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/** A Range's client rects, or [] where the DOM can't measure ranges (jsdom). */
export function rangeClientRects(range) {
  if (!range || typeof range.getClientRects !== 'function') return []
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
}

function rectContains(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** The highlight (of `highlights`, all on this surface) drawn under client point (x, y). */
export function highlightAtPoint(surfaceEl, highlights, x, y) {
  for (const highlight of highlights ?? []) {
    const range = resolveHighlightRange(surfaceEl, highlight)
    if (rangeClientRects(range).some((rect) => rectContains(rect, x, y))) return highlight
  }
  return null
}

/**
 * The anchored content element under client point (x, y), looking through the annotation
 * layers (`ignoreSelector`) to the Markdown below. Falls back to the surface itself.
 */
export function anchorElementAtPoint(surfaceEl, x, y, ignoreSelector = '[data-live-ink-layer]') {
  if (!surfaceEl) return null
  const doc = surfaceEl.ownerDocument
  const stack = typeof doc.elementsFromPoint === 'function' ? doc.elementsFromPoint(x, y) : []
  const hit = stack.find(
    (el) => surfaceEl.contains(el) && !(ignoreSelector && el.closest?.(ignoreSelector))
  )
  return anchorElementFor(hit ?? surfaceEl, surfaceEl)
}

/**
 * Where a target rect sits against the visible area of its scroll container: 'above',
 * 'below' or 'visible'. `margin` px of a target still showing counts as visible.
 */
export function offscreenDirection(targetRect, viewRect, margin = 8) {
  if (!targetRect || !viewRect) return 'visible'
  if (targetRect.bottom < viewRect.top + margin) return 'above'
  if (targetRect.top > viewRect.bottom - margin) return 'below'
  return 'visible'
}
