// Data shape of Presentation annotations at `liveInk/{lessonId}` (RTDB). Kept outside
// `sessions/{lessonId}` on purpose: every client subscribes to the whole session node, and a
// 12Hz pointer stream there would re-render every student's view. See
// docs/agents/runtime-model.md (Presentation annotations) and database.rules.json.
//
//   liveInk/{lessonId}/pointer              { surface, anchor, c, dx, dy, t }  over text
//                                           { surface, anchor, rx, ry, t }     anywhere else
//   liveInk/{lessonId}/strokes/{pushId}     { surface, anchor, points: [point, ...], colour, t }
//                                           point: { c, dx, dy } over text, [rx, ry] elsewhere
//   liveInk/{lessonId}/highlights/{pushId}  { surface, anchor, quote, occurrence, t }
//
// `{ c, dx, dy }`: character offset `c` in the anchor element's textContent, plus an offset in
// em from that character, so ink follows the words when text reflows. `[rx, ry]`: fractions
// of the anchor element's box (images, margins). See geometry.js.

import { MAX_QUOTE_LENGTH, MAX_STROKE_POINTS, fractionPairOf, isTextPoint } from './geometry.js'

export const LIVE_INK_ROOT = 'liveInk'

export function liveInkPath(lessonId, ...parts) {
  return [LIVE_INK_ROOT, lessonId, ...parts].join('/')
}

/** Pointer writes per second (~12Hz) through createThrottledMirrorWriter. */
export const POINTER_INTERVAL_MS = 80

/** A stroke stays fully drawn for this long after it arrives on a screen… */
export const STROKE_HOLD_MS = 2500
/** …then fades out over this long (removed instantly under reduced motion). */
export const STROKE_FADE_MS = 1500
/** The presenting teacher deletes a stroke from RTDB this long after writing it. */
export const STROKE_REMOVE_AFTER_MS = STROKE_HOLD_MS + STROKE_FADE_MS + 500

/** The off-screen chip points at a new stroke or highlight for this long after it arrives. */
export const RECENT_MARK_MS = 10000

/** Re-pushing "open the explainer" no more often than this while annotating it. */
export const EXPLAINER_FORCE_INTERVAL_MS = 8000

/** Ink colour - the --colour-error token (a classroom red pen). */
export const INK_COLOUR = 'var(--colour-error)'

// Surface ids name *which* rendered content an annotation belongs to, and include the task id
// so annotations from a previous task can never land on the next one.
export const SURFACE_KINDS = Object.freeze({
  info: 'info',
  recapLeft: 'recap-left',
  recap: 'recap',
  intro: 'intro',
  explainer: 'explainer',
})

export function surfaceId(kind, taskId) {
  return `${kind}:${taskId}`
}

export function surfaceKindOf(id) {
  return String(id ?? '').split(':')[0]
}

export function surfaceTaskIdOf(id) {
  const text = String(id ?? '')
  const colon = text.indexOf(':')
  return colon < 0 ? '' : text.slice(colon + 1)
}

export function isExplainerSurface(id) {
  return surfaceKindOf(id) === SURFACE_KINDS.explainer
}

function isShortString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function textPointOf(raw) {
  return isTextPoint(raw) ? { c: raw.c, dx: raw.dx, dy: raw.dy } : null
}

function normalisePointer(raw) {
  if (!raw || !isShortString(raw.surface, 120) || !isShortString(raw.anchor, 80)) return null
  const base = { surface: raw.surface, anchor: raw.anchor, t: raw.t ?? 0 }
  const text = textPointOf(raw)
  if (text) return { ...base, ...text }
  const pair = fractionPairOf({ rx: raw.rx, ry: raw.ry })
  return pair ? { ...base, rx: pair[0], ry: pair[1] } : null
}

// Each point stays in its own form: `{ c, dx, dy }` (text) or `[rx, ry]` (box fractions).
function normaliseStrokePoints(points) {
  const list = Array.isArray(points) ? points : Object.values(points ?? {})
  return list
    .slice(0, MAX_STROKE_POINTS)
    .map((point) => textPointOf(point) ?? fractionPairOf(point))
    .filter(Boolean)
}

function normaliseStroke(id, raw) {
  if (!raw || !isShortString(raw.surface, 120) || !isShortString(raw.anchor, 80)) return null
  const points = normaliseStrokePoints(raw.points)
  if (!points.length) return null
  return {
    id,
    surface: raw.surface,
    anchor: raw.anchor,
    points,
    colour: typeof raw.colour === 'string' ? raw.colour : INK_COLOUR,
    t: raw.t ?? 0,
  }
}

function normaliseHighlight(id, raw) {
  if (!raw || !isShortString(raw.surface, 120) || !isShortString(raw.anchor, 80)) return null
  if (!isShortString(raw.quote, MAX_QUOTE_LENGTH)) return null
  const occurrence = Number.isInteger(raw.occurrence) && raw.occurrence >= 0 ? raw.occurrence : 0
  return {
    id,
    surface: raw.surface,
    anchor: raw.anchor,
    quote: raw.quote,
    occurrence,
    t: raw.t ?? 0,
  }
}

/** RTDB snapshot value → `{ pointer, strokes: [], highlights: [] }`, dropping malformed entries. */
export function normaliseLiveInk(value) {
  const strokes = Object.entries(value?.strokes ?? {})
    .map(([id, raw]) => normaliseStroke(id, raw))
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
  const highlights = Object.entries(value?.highlights ?? {})
    .map(([id, raw]) => normaliseHighlight(id, raw))
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
  return { pointer: normalisePointer(value?.pointer), strokes, highlights }
}

export const EMPTY_LIVE_INK = Object.freeze({
  pointer: null,
  strokes: Object.freeze([]),
  highlights: Object.freeze([]),
})

/** The pointer, strokes and highlights that belong to one surface. */
export function inkForSurface(ink, surface) {
  if (!ink || !surface) return EMPTY_LIVE_INK
  return {
    pointer: ink.pointer?.surface === surface ? ink.pointer : null,
    strokes: ink.strokes.filter((stroke) => stroke.surface === surface),
    highlights: ink.highlights.filter((highlight) => highlight.surface === surface),
  }
}
