// Pure helpers for Presentation annotations (live pointer, fading ink, text highlights).
//
// Screens differ in size, so nothing is sent as pixels. A position is named against the
// `data-md-anchor` of the content element under it (see src/shared/markdown/anchors.js), in
// one of two forms:
//   - over text: `{ c, dx, dy }` - the character at textContent offset `c` of the anchor
//     element, plus an offset from that character (left edge, line midline) in em of its font
//     size. Text reflows differently at every width, so this keeps an underline under the same
//     words on every screen.
//   - anywhere else (an image, empty space): `[rx, ry]` / `{ rx, ry }` - fractions of the anchor
//     element's bounding box (right for images, which scale with their box).
// Every client looks the anchor up in its own DOM and maps the position back onto it.

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

/** Text-anchored offsets (`dx`, `dy`, in em) are dropped beyond this. Mirrors database.rules.json. */
export const TEXT_OFFSET_LIMIT_EM = 50

/** Largest character offset `c` a text-anchored point may name. Mirrors database.rules.json. */
export const MAX_TEXT_OFFSET = 1000000

/** A point snaps to the text only when it is this close (in em) to the nearest character's
 * line midline - further away (a margin, a gap between paragraphs) it uses box fractions. */
export const TEXT_SNAP_DY_EM = 2
/** ...and no further than this (in em) to the side of that character. */
export const TEXT_SNAP_DX_EM = 12

/** Font size assumed when the computed one can't be read. */
export const DEFAULT_FONT_SIZE = 16

/** Consecutive text-anchored points further apart than this many line heights, whose
 * characters sit on different lines, start a new stroke segment (see splitStrokeSegments). */
export const LINE_JUMP_FACTOR = 0.8

function round4(value) {
  return Math.round(value * 10000) / 10000
}

function round3(value) {
  return Math.round(value * 1000) / 1000
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

/** SVG path data through several segments (a stroke broken where its text reflowed). */
export function segmentsToSvgPath(segments) {
  return (segments ?? [])
    .map((segment) => pointsToSvgPath(segment))
    .filter(Boolean)
    .join(' ')
}

// ─── Text-anchored points ({ c, dx, dy }) ──────────────────────────────────

/** True for a well-formed text-anchored point `{ c, dx, dy }`. */
export function isTextPoint(point) {
  return (
    !!point &&
    typeof point === 'object' &&
    !Array.isArray(point) &&
    isFiniteNumber(point.c) &&
    point.c >= 0 &&
    point.c <= MAX_TEXT_OFFSET &&
    isFiniteNumber(point.dx) &&
    Math.abs(point.dx) <= TEXT_OFFSET_LIMIT_EM &&
    isFiniteNumber(point.dy) &&
    Math.abs(point.dy) <= TEXT_OFFSET_LIMIT_EM
  )
}

/** The `[rx, ry]` of a box-fraction point (`[rx, ry]`, `{ rx, ry }` or RTDB's `{ 0, 1 }`), or null. */
export function fractionPairOf(point) {
  if (!point || typeof point !== 'object') return null
  let pair
  if (Array.isArray(point)) pair = point
  else if ('rx' in point || 'ry' in point) pair = [point.rx, point.ry]
  else pair = [point[0], point[1]]
  const [rx, ry] = pair
  if (!isFiniteNumber(rx) || !isFiniteNumber(ry)) return null
  if (Math.abs(rx) > FRACTION_LIMIT || Math.abs(ry) > FRACTION_LIMIT) return null
  return [rx, ry]
}

function usableFontSize(fontSize) {
  return isFiniteNumber(fontSize) && fontSize > 0 ? fontSize : DEFAULT_FONT_SIZE
}

/** Pixels -> em of `fontSize` (rounded to 3 places). */
export function pxToEm(px, fontSize) {
  return round3(px / usableFontSize(fontSize))
}

/** Em of `fontSize` -> pixels. */
export function emToPx(em, fontSize) {
  return em * usableFontSize(fontSize)
}

/**
 * Client point -> `{ c, dx, dy }` against `charBox` (`{ x, mid, fontSize }`: the character's
 * left edge, its line's vertical midline and its font size). Null when the point is too far
 * from the character to count as "on the text" (`maxDxEm` / `maxDyEm`).
 */
export function encodeTextPoint(
  point,
  charBox,
  c,
  { maxDxEm = TEXT_SNAP_DX_EM, maxDyEm = TEXT_SNAP_DY_EM } = {}
) {
  if (!point || !charBox || !isFiniteNumber(c) || c < 0 || c > MAX_TEXT_OFFSET) return null
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null
  if (!isFiniteNumber(charBox.x) || !isFiniteNumber(charBox.mid)) return null
  const dx = pxToEm(point.x - charBox.x, charBox.fontSize)
  const dy = pxToEm(point.y - charBox.mid, charBox.fontSize)
  if (Math.abs(dx) > maxDxEm || Math.abs(dy) > maxDyEm) return null
  return { c: Math.round(c), dx, dy }
}

/** `{ c, dx, dy }` + where that character sits on this screen (`charBox`) -> client point. */
export function decodeTextPoint(textPoint, charBox) {
  if (!isTextPoint(textPoint) || !charBox) return null
  if (!isFiniteNumber(charBox.x) || !isFiniteNumber(charBox.mid)) return null
  return {
    x: charBox.x + emToPx(textPoint.dx, charBox.fontSize),
    y: charBox.mid + emToPx(textPoint.dy, charBox.fontSize),
  }
}

/**
 * Breaks a stroke's resolved client points into segments where the text has reflowed, so a
 * stroke that ran along one line on the teacher's screen doesn't cut diagonally across the
 * paragraph where those words wrap onto two lines here.
 *
 * Each point is `{ x, y }`, plus - for text-anchored points - `line: { mid, height }` (its
 * character's line midline and height on this screen) and `dyPx` (the teacher's offset from
 * that line, in px here). A break goes between two text-anchored points when all hold:
 *   - they land more than LINE_JUMP_FACTOR line heights apart vertically,
 *   - their characters sit on different lines here,
 *   - their offsets from the line barely differ, i.e. the teacher drew them along one line
 *     (a pen genuinely moving down a line has its offset reset to the new line - no split), and
 *   - they also jump sideways by more than a line height (a wrap sends the next word back to
 *     the start of the line; a fast downward flick barely moves sideways).
 */
export function splitStrokeSegments(points, { jumpFactor = LINE_JUMP_FACTOR } = {}) {
  const segments = []
  let current = []
  for (const point of points ?? []) {
    if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue
    const previous = current[current.length - 1]
    if (previous && isLineJump(previous, point, jumpFactor)) {
      segments.push(current)
      current = []
    }
    current.push(point)
  }
  if (current.length) segments.push(current)
  return segments
}

function isLineJump(a, b, jumpFactor) {
  if (!a.line || !b.line) return false
  const lineHeight = Math.max(a.line.height || 0, b.line.height || 0)
  if (!(lineHeight > 0)) return false
  if (Math.abs(b.y - a.y) <= jumpFactor * lineHeight) return false
  if (Math.abs(b.line.mid - a.line.mid) <= lineHeight / 2) return false
  if (Math.abs(b.x - a.x) <= lineHeight) return false
  return Math.abs((b.dyPx ?? 0) - (a.dyPx ?? 0)) < lineHeight / 2
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

// ─── Text-anchored points: DOM side ─────────────────────────────────────────

const MEDIA_TAGS = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'])

function isMediaElement(el) {
  return !!el?.tagName && MEDIA_TAGS.has(String(el.tagName).toUpperCase())
}

/** The caret position nearest client point (x, y) as `{ node, offset }`, or null. */
export function caretPositionAtPoint(doc, x, y) {
  if (!doc) return null
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y)
    if (position?.offsetNode) return { node: position.offsetNode, offset: position.offset }
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range?.startContainer) return { node: range.startContainer, offset: range.startOffset }
  }
  return null
}

/** Computed font size (px) of the element holding `node`. */
export function fontSizeOf(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement
  const view = el?.ownerDocument?.defaultView
  const size = parseFloat(view?.getComputedStyle?.(el)?.fontSize)
  return size > 0 ? size : DEFAULT_FONT_SIZE
}

function measuredRects(range) {
  if (!range || typeof range.getClientRects !== 'function') return []
  return Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
}

function charBox(x, rect, range) {
  return {
    x,
    mid: rect.top + rect.height / 2,
    height: rect.height,
    fontSize: fontSizeOf(range.startContainer),
  }
}

/**
 * Where character `c` of `root`'s textContent sits on this screen: `{ x, mid, height,
 * fontSize }` - its left edge, its line's midline and height, and its font size. A character
 * with no box (collapsed whitespace, the end of the text) uses the previous character's right
 * edge instead. Null when neither can be measured. Teacher and students use the same rule, so
 * the fallback lands consistently.
 */
export function charBoxAt(root, c) {
  if (!root || !isFiniteNumber(c) || c < 0) return null
  const length = (root.textContent ?? '').length
  if (c < length) {
    const range = rangeFromTextOffsets(root, c, c + 1)
    const rect = measuredRects(range)[0]
    if (rect) return charBox(rect.left, rect, range)
  }
  if (c > 0 && c <= length) {
    const range = rangeFromTextOffsets(root, c - 1, c)
    const rect = measuredRects(range).at(-1)
    if (rect) return charBox(rect.right, rect, range)
  }
  return null
}

/**
 * Client point (x, y) as a text-anchored `{ c, dx, dy }` within `anchorEl`, or null when it
 * isn't over or near that element's text: over an image, outside the anchor, or further than
 * TEXT_SNAP_DY_EM / TEXT_SNAP_DX_EM from the nearest character. The annotation layers must not
 * take hits while this runs (InkSurface turns the capture layer's pointer events off).
 */
export function textPointAt(anchorEl, x, y, ignoreSelector = '[data-live-ink-layer]') {
  if (!anchorEl || isMediaElement(anchorEl)) return null
  const doc = anchorEl.ownerDocument
  if (typeof doc?.elementsFromPoint === 'function') {
    const hit = doc
      .elementsFromPoint(x, y)
      .find((el) => !(ignoreSelector && el.closest?.(ignoreSelector)))
    if (isMediaElement(hit)) return null
  }
  const caret = caretPositionAtPoint(doc, x, y)
  if (!caret || caret.node?.nodeType !== 3 || !anchorEl.contains(caret.node)) return null
  if (ignoreSelector && caret.node.parentElement?.closest?.(ignoreSelector)) return null
  const c = textOffsetWithin(anchorEl, caret.node, caret.offset)
  return encodeTextPoint({ x, y }, charBoxAt(anchorEl, c), c)
}

/**
 * Client point -> the position sent to students: `{ c, dx, dy }` over text, else `{ rx, ry }`
 * fractions of `anchorRect` (default: the anchor's box), else null.
 */
export function encodeInkPoint(anchorEl, point, anchorRect) {
  if (!anchorEl || !point) return null
  return (
    textPointAt(anchorEl, point.x, point.y) ??
    pointToFraction(point, anchorRect ?? anchorEl.getBoundingClientRect())
  )
}

/** A stroke's client points -> stored points: `{ c, dx, dy }` over text, `[rx, ry]` elsewhere. */
export function strokeToInkPoints(points, anchorEl) {
  if (!anchorEl) return []
  const rect = anchorEl.getBoundingClientRect()
  return (points ?? [])
    .map((point) => encodeInkPoint(anchorEl, point, rect))
    .filter(Boolean)
    .map((encoded) => (isTextPoint(encoded) ? encoded : [encoded.rx, encoded.ry]))
}

/**
 * A stored point (`{ c, dx, dy }`, `[rx, ry]` or `{ rx, ry }`) -> client point on this screen.
 * Text-anchored ones also carry `line` and `dyPx` for splitStrokeSegments.
 */
export function resolveInkPoint(anchorEl, anchorRect, point) {
  if (isTextPoint(point)) {
    const box = charBoxAt(anchorEl, point.c)
    const resolved = decodeTextPoint(point, box)
    if (!resolved) return null
    return {
      ...resolved,
      line: { mid: box.mid, height: box.height },
      dyPx: emToPx(point.dy, box.fontSize),
    }
  }
  const pair = fractionPairOf(point)
  return pair ? fractionToPoint({ rx: pair[0], ry: pair[1] }, anchorRect) : null
}

/** A stored stroke's points -> client-point segments, broken where its text reflowed. */
export function resolveInkStroke(anchorEl, points) {
  if (!anchorEl) return []
  const rect = anchorEl.getBoundingClientRect()
  const list = Array.isArray(points) ? points : Object.values(points ?? {})
  const resolved = list.map((point) => resolveInkPoint(anchorEl, rect, point)).filter(Boolean)
  return splitStrokeSegments(resolved)
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
