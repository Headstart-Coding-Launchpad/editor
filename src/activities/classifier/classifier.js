// Pure logic for the Classifier activity: drawings turned into small greyscale grids, an
// in-house k-nearest-neighbours classifier that is ready as soon as every thing has its
// drawings (no Train step), the live round (draw it, will it get it?), held-out / teacher
// tests, mix-ups, task validation, state transitions, grading and hints.
// Node-safe (no React, JSX or DOM) so the CLI, the Builder, reports and print share it.
// See docs/authoring/activities/classifier.md.
//
// Privacy: the student's drawings (`examples`) and raw strokes live only in the local state.
// `sharedState` strips them down to counts, whether the model is ready, tries, rights, misses
// and the result, plus (so the tutor can see the work live) the pad as it is now and the last few
// misses, each as its 16 x 16 grid only. That is the only form ever written to Firebase (see
// definition.js `serializeShared`).

export const CLASSIFIER_MODES = ['drawing']
// Modes that are planned but not built yet (validation says so instead of "unknown mode").
export const CLASSIFIER_MODES_NOT_BUILT = ['sound']
// 'live' is the default: the round of "draw it, will it get it?". held_out and teacher are the
// older tests (a Test button on kept-back or teacher drawings).
export const TEST_SETS = ['held_out', 'teacher', 'live']
// Extra parts a lesson can switch on (the pad, the teach step and the guess bars always show):
// grid = what it sees, sure = how sure is it, fool = fool-it-and-fix-it.
export const PANELS = ['grid', 'sure', 'fool']
export const DEFAULT_PANELS = ['fool']
// Tries in a round and mix-up drawings kept on the device.
export const MAX_ATTEMPTS = 200
export const MAX_MISSES_KEPT = 8

// Side of the square grid a drawing is shrunk to. 16 x 16 = 256 numbers per drawing.
export const GRID = 16
// The classifier looks at the K closest drawings (fewer when there are fewer) and weights each by
// how close it is, so the shares move smoothly instead of in thirds.
export const K = 7
// How many recent misses the tutor sees (as grids).
export const MAX_SHARED_MISSES = 3
export const MIN_CLASSES = 2
export const MAX_CLASSES = 6
// Students who name their own things get 2 to 4.
export const MAX_STUDENT_CLASSES = 4
export const MAX_LABEL_LENGTH = 16
export const MAX_EXAMPLES_PER_CLASS = 40
export const DEFAULT_MIN_EXAMPLES = 3
export const DEFAULT_TARGET_ACCURACY = 0.8
export const DEFAULT_LIVE_TEST_SIZE = 5
export const MIN_LIVE_TEST_SIZE = 3
export const MAX_LIVE_TEST_SIZE = 20
// held_out: every HELD_OUT_EVERY-th drawing in a class (the 4th, 8th, ...) is kept back for the
// test and never used for training.
export const HELD_OUT_EVERY = 4
export const MAX_TEST_ITEMS = 24
// Pre-loaded (given) examples a lesson can write, in total across the things.
export const MAX_GIVEN_EXAMPLES = 40
// Serialised shared state must stay well under the ~2 KB currentAnswer budget.
export const MAX_SHARED_CHARS = 1800

const GRID_CELLS = GRID * GRID
const GRID_CHARS = /^[0-9]+$/
const ROW_CHARS = /^[.#0-9]+$/

const clamp01 = (value) => Math.min(1, Math.max(0, value))

// ── drawings → grids ─────────────────────────────────────────────────────────

// strokes: [[[x, y], ...], ...] with x and y between 0 and 1. The drawing is moved and scaled
// (keeping its shape) to fill the middle of a size x size grid, so where and how big the
// student drew does not matter. Returns size * size numbers from 0 (empty) to 1 (ink).
export function rasterize(strokes, size = GRID) {
  const cells = new Array(size * size).fill(0)
  const lines = []
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    const points = []
    for (const point of Array.isArray(stroke) ? stroke : []) {
      const x = Number(point?.[0])
      const y = Number(point?.[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const last = points[points.length - 1]
      if (last && Math.abs(last[0] - x) < 0.004 && Math.abs(last[1] - y) < 0.004) continue
      points.push([x, y])
    }
    if (points.length) lines.push(points)
  }
  if (!lines.length) return cells
  const all = lines.flat()
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const minY = Math.min(...all.map((p) => p[1]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const w = maxX - minX
  const h = maxY - minY
  const span = Math.max(w, h)
  const margin = 1.5
  const inner = size - margin * 2
  const scale = span > 1e-6 ? inner / span : 0
  const offX = span > 1e-6 ? margin + (inner - w * scale) / 2 : size / 2
  const offY = span > 1e-6 ? margin + (inner - h * scale) / 2 : size / 2
  const mapped = lines.map((line) =>
    line.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY])
  )
  const segments = []
  for (const line of mapped) {
    if (line.length === 1) segments.push([line[0], line[0]])
    for (let i = 1; i < line.length; i += 1) segments.push([line[i - 1], line[i]])
  }
  for (let cy = 0; cy < size; cy += 1) {
    for (let cx = 0; cx < size; cx += 1) {
      const px = cx + 0.5
      const py = cy + 0.5
      let best = Infinity
      for (const [a, b] of segments) {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len2 = dx * dx + dy * dy
        const t = len2 > 0 ? clamp01(((px - a[0]) * dx + (py - a[1]) * dy) / len2) : 0
        const ex = a[0] + t * dx - px
        const ey = a[1] + t * dy - py
        const d2 = ex * ex + ey * ey
        if (d2 < best) best = d2
      }
      const d = Math.sqrt(best)
      cells[cy * size + cx] = clamp01(1 - Math.max(0, d - 0.6) / 0.9)
    }
  }
  return cells
}

// A grid as text: one digit (0-9) per cell, row by row. Compact to store.
export function encodeGrid(cells) {
  return cells.map((v) => String(Math.round(clamp01(Number(v) || 0) * 9))).join('')
}

export function isGridString(value) {
  return typeof value === 'string' && value.length === GRID_CELLS && GRID_CHARS.test(value)
}

export function decodeGrid(text) {
  if (!isGridString(text)) return new Array(GRID_CELLS).fill(0)
  return Array.from(text, (ch) => Number(ch) / 9)
}

// Authored grid rows: '.' empty, '#' full ink, digits 0-9 for shades.
export function gridFromRows(rows) {
  return rows
    .join('')
    .split('')
    .map((ch) => (ch === '.' ? '0' : ch === '#' ? '9' : ch))
    .join('')
}

// ── k-nearest-neighbours ─────────────────────────────────────────────────────

function distance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

// The k closest examples to a grid, nearest first: [{ label, d }].
function nearestOf(examples, grid, k) {
  const vec = decodeGrid(grid)
  return examples
    .map((example) => ({ label: example.label, d: distance(decodeGrid(example.grid), vec) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.min(k, examples.length))
}

// Each near example counts 1 / (distance + 1), so a closer drawing counts for more. Returns a
// Map of label -> { w (weight), d (closest distance) } for the labels among them.
function weigh(nearest) {
  const by = new Map()
  for (const { label, d } of nearest) {
    const entry = by.get(label) ?? { w: 0, d }
    entry.w += 1 / (d + 1)
    entry.d = Math.min(entry.d, d)
    by.set(label, entry)
  }
  return by
}

function topOf(by) {
  let best = null
  for (const [label, entry] of by) {
    if (
      !best ||
      entry.w > best.w + 1e-12 ||
      (Math.abs(entry.w - best.w) <= 1e-12 && entry.d < best.d)
    ) {
      best = { label, ...entry }
    }
  }
  return best?.label ?? null
}

// examples: [{ label, grid }] (grid = encoded text). Returns the label with the most weight among
// the K nearest examples (ties go to the label with the closest example), or null with none.
export function classify(examples, grid, k = K) {
  if (!examples.length) return null
  return topOf(weigh(nearestOf(examples, grid, k)))
}

// ── guessing ─────────────────────────────────────────────────────────────────

// What the model says about one drawing: its answer (as `classify`) and a share for every class
// (its part of the distance-weighted vote of the K nearest drawings, 0 to 1, adding up to 1). The
// shares are the bars shown while the student draws; they change a little with every drawing
// taught, not in thirds.
export function guessOf(examples, grid, classes, k = K) {
  const labels = classes ?? []
  const scores = Object.fromEntries(labels.map((label) => [label, 0]))
  if (!examples.length || !isGridString(grid)) return { label: null, scores }
  const by = weigh(nearestOf(examples, grid, k))
  let total = 0
  for (const [label, entry] of by) if (label in scores) total += entry.w
  if (total > 0) {
    for (const [label, entry] of by) if (label in scores) scores[label] = entry.w / total
  }
  return { label: topOf(by), scores }
}

// ── things (a class may start with an emoji: "🐱 cat") ───────────────────────

const LEADING_EMOJI =
  /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)\s*/u

// "🐱 cat" -> { emoji: '🐱', name: 'cat' }; "cat" -> { emoji: '', name: 'cat' }.
export function splitLabel(label) {
  const text = String(label ?? '').trim()
  const match = text.match(LEADING_EMOJI)
  return match
    ? { emoji: match[1], name: text.slice(match[0].length).trim() }
    : { emoji: '', name: text }
}

// What to show for a thing in a sentence or bar: its emoji when it has one, else its name.
export function shortLabel(label) {
  const { emoji, name } = splitLabel(label)
  return emoji || name
}

// ── state ────────────────────────────────────────────────────────────────────

export function cleanLabel(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LENGTH)
}

function cleanClasses(list) {
  const seen = new Set()
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const label = cleanLabel(item)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push(label)
    if (out.length >= MAX_CLASSES) break
  }
  return out
}

export function taskMinExamples(task) {
  return Number.isInteger(task?.minExamplesPerClass)
    ? task.minExamplesPerClass
    : DEFAULT_MIN_EXAMPLES
}

export function taskTarget(task) {
  return typeof task?.targetAccuracy === 'number' ? task.targetAccuracy : DEFAULT_TARGET_ACCURACY
}

// For the live round this is how many tries make the round (the core): a try is a drawing the
// student pressed Done on and said what it was, whether the pad got it right or wrong.
export function taskLiveTestSize(task) {
  return Number.isInteger(task?.liveTestSize) ? task.liveTestSize : DEFAULT_LIVE_TEST_SIZE
}

// testSet is optional: missing means the live round.
export function testSetOf(task) {
  return TEST_SETS.includes(task?.testSet) ? task.testSet : 'live'
}

// Which extra parts show (see PANELS). Missing means DEFAULT_PANELS; [] means none.
export function panelsOf(task) {
  return Array.isArray(task?.panels)
    ? task.panels.filter((panel) => PANELS.includes(panel))
    : DEFAULT_PANELS
}

function emptyExamples(classes) {
  return Object.fromEntries(classes.map((label) => [label, []]))
}

// The lesson's pre-loaded examples as { label: [grid text] } for the lesson's own things, or null
// when there are none. Derived from the task, never saved with the student's state, so a lesson
// edit takes effect on reload.
export function givenExamplesOf(task) {
  if (!Array.isArray(task?.examples) || !task.examples.length) return null
  const classes = cleanClasses(task.classes)
  if (!classes.length) return null
  const out = Object.fromEntries(classes.map((label) => [label, []]))
  for (const item of itemsToGrids(task.examples).slice(0, MAX_GIVEN_EXAMPLES)) {
    if (out[item.label]) out[item.label].push(item.grid)
  }
  return Object.values(out).some((list) => list.length) ? out : null
}

// A grid as 16 authored rows ('.' empty, '#' full ink, digits for shades), for saving in a lesson.
export function gridToRows(text) {
  if (!isGridString(text)) return null
  const rows = []
  for (let r = 0; r < GRID; r += 1) {
    rows.push(
      text
        .slice(r * GRID, (r + 1) * GRID)
        .replace(/0/g, '.')
        .replace(/9/g, '#')
    )
  }
  return rows
}

export function initialClassifierState(task) {
  const classes = cleanClasses(task?.classes)
  const given = givenExamplesOf(task)
  return {
    v: 1,
    classes,
    min: taskMinExamples(task),
    ...(given ? { given } : {}),
    examples: emptyExamples(classes),
    // The round: [drawn, predicted] for every try. `drawn` is what the student said they drew
    // (not what the pad suggested), `predicted` is what the pad said. Right = they match.
    live: [],
    // The tries the pad got wrong ({ actual (= drawn), predicted, grid, fixed? }), kept on the
    // device only.
    misses: [],
    // The drawing on the pad right now: { grid, target } (target = the thing the pad suggested or
    // is teaching), or null. Shared with the tutor as a grid; the strokes never leave the device.
    pad: null,
    result: null,
    tests: 0,
  }
}

function cleanResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  const right = Number(raw.right)
  const total = Number(raw.total)
  if (!Number.isInteger(right) || !Number.isInteger(total) || total <= 0 || right < 0) return null
  if (right > total) return null
  const confusion = {}
  for (const [actual, row] of Object.entries(raw.confusion ?? {})) {
    if (!row || typeof row !== 'object') continue
    confusion[actual] = {}
    for (const [pred, n] of Object.entries(row)) {
      if (Number.isInteger(n) && n > 0) confusion[actual][pred] = n
    }
  }
  return { right, total, confusion }
}

// A grid for the wire: a run of 4 or more of the same digit becomes "digit*count|" (most of a
// drawing is empty, so 256 characters shrink to well under half).
export function packGrid(text) {
  if (!isGridString(text)) return null
  return text.replace(/(\d)\1{3,}/g, (run) => `${run[0]}*${run.length}|`)
}

// The grid text back from packGrid, or null when it is not a whole grid.
export function unpackGrid(packed) {
  if (typeof packed !== 'string') return null
  const text = packed.replace(/(\d)\*(\d+)\|/g, (_, ch, n) => ch.repeat(Number(n)))
  return isGridString(text) ? text : null
}

const wholeNumber = (value) => (Number.isInteger(value) && value > 0 ? value : 0)

// Tolerant load of either form (the full local state, or the shared summary a teacher reads).
export function normalizeClassifierState(task, raw) {
  const base = initialClassifierState(task)
  if (!raw || typeof raw !== 'object') return base
  // A lesson-set class list always wins over what was saved.
  const classes = base.classes.length ? base.classes : cleanClasses(raw.classes)
  const examples = {}
  for (const label of classes) {
    const list = Array.isArray(raw.examples?.[label]) ? raw.examples[label] : []
    examples[label] = list.filter(isGridString).slice(0, MAX_EXAMPLES_PER_CLASS)
  }
  const isShared = raw.shared === true || (!raw.examples && !!raw.counts)
  const padGrid = typeof raw.pad === 'string' ? unpackGrid(raw.pad) : raw.pad?.grid
  const padTarget = typeof raw.pad === 'string' ? raw.target : raw.pad?.target
  const next = {
    v: 1,
    classes,
    min: base.min,
    result: cleanResult(raw.result),
    live: Array.isArray(raw.live)
      ? raw.live
          .filter((p) => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string')
          .slice(0, MAX_ATTEMPTS)
          .map((p) => [p[0], p[1]])
      : [],
    tests: wholeNumber(raw.tests),
    ...(base.given ? { given: base.given } : {}),
    pad: isGridString(padGrid)
      ? { grid: padGrid, target: typeof padTarget === 'string' ? padTarget : null }
      : null,
  }
  if (!isShared) {
    next.examples = examples
    next.misses = (Array.isArray(raw.misses) ? raw.misses : [])
      .filter(
        (m) =>
          m &&
          typeof m.actual === 'string' &&
          typeof m.predicted === 'string' &&
          isGridString(m.grid)
      )
      .slice(-MAX_MISSES_KEPT)
      .map((m) => ({
        actual: m.actual,
        predicted: m.predicted,
        grid: m.grid,
        ...(m.fixed ? { fixed: true } : {}),
      }))
  } else {
    // Shared summary: no drawings (no `examples` key), just counts.
    next.shared = true
    next.counts = {}
    for (const label of classes) next.counts[label] = wholeNumber(Number(raw.counts?.[label]))
    next.liveCount = wholeNumber(raw.liveCount)
    next.rights = wholeNumber(raw.rights)
    // The last few misses as grids (what it said, what they drew), for the tutor.
    next.recent = (Array.isArray(raw.recent) ? raw.recent : [])
      .map((m) => ({ actual: m?.d, predicted: m?.s, grid: unpackGrid(m?.g) }))
      .filter((m) => typeof m.actual === 'string' && typeof m.predicted === 'string' && m.grid)
      .slice(-MAX_SHARED_MISSES)
  }
  return next
}

// Drawings per class: the given ones plus the student's own (from the drawings when the state has
// them, else the shared counts, which already add the two).
export function countsOf(state) {
  const counts = {}
  for (const label of state?.classes ?? []) {
    counts[label] = state.examples?.[label]
      ? state.examples[label].length + givenCountOf(state, label)
      : Number(state.counts?.[label]) || 0
  }
  return counts
}

export function givenCountOf(state, label) {
  return state?.given?.[label]?.length ?? 0
}

export function hasGiven(state) {
  return Object.values(state?.given ?? {}).some((list) => list.length > 0)
}

// The student's own drawings per class (the total less the given ones).
export function ownCountsOf(state) {
  const counts = countsOf(state)
  return Object.fromEntries(
    (state?.classes ?? []).map((label) => [
      label,
      Math.max(0, (counts[label] ?? 0) - givenCountOf(state, label)),
    ])
  )
}

// Every named thing has its minimum and there are at least two: the model is ready, with no
// Train button (k-NN just uses every drawing).
export function readyOf(state) {
  const labels = (state?.classes ?? []).filter(Boolean)
  if (labels.length < MIN_CLASSES) return false
  const counts = countsOf(state)
  const min = state?.min ?? DEFAULT_MIN_EXAMPLES
  return labels.every((label) => (counts[label] ?? 0) >= min)
}

// Tries in the round (drawings the student finished and named).
export function liveCountOf(state) {
  return Array.isArray(state?.live) && state.live.length
    ? state.live.length
    : (state?.liveCount ?? 0)
}

// Tries the pad got right (its guess was what the student said they drew).
export function rightsOf(state) {
  if (Array.isArray(state?.live) && state.live.length) {
    return state.live.filter(([actual, predicted]) => actual === predicted).length
  }
  return state?.rights ?? 0
}

export function missesOf(state) {
  return Math.max(0, liveCountOf(state) - rightsOf(state))
}

// The drawing on the pad right now, or null.
export function padOf(state) {
  return state?.pad?.grid ? state.pad : null
}

// The last few misses as { actual (what they drew), predicted (what it said), grid }, from the
// device's own list or the shared summary's.
export function recentMissesOf(state) {
  const list = Array.isArray(state?.misses) ? state.misses : (state?.recent ?? [])
  return list.slice(-MAX_SHARED_MISSES)
}

// The only form written to Firebase and the session report: no strokes and none of the taught
// drawings. It does carry the pad as it is now and the last few misses, each only as its 16 x 16
// grid (packed), so the tutor can see the work live. It is trimmed to stay under
// MAX_SHARED_CHARS: the oldest misses go first, then the pad.
export function sharedState(state) {
  const pad = padOf(state)
  const out = {
    v: 1,
    shared: true,
    classes: state?.classes ?? [],
    counts: countsOf(state),
    trained: readyOf(state),
    result: state?.result ?? null,
    liveCount: liveCountOf(state),
    rights: rightsOf(state),
    misses: missesOf(state),
    tests: state?.tests ?? 0,
    pad: pad ? packGrid(pad.grid) : null,
    target: pad?.target ?? null,
    recent: recentMissesOf(state).map((m) => ({
      g: packGrid(m.grid),
      s: m.predicted,
      d: m.actual,
    })),
  }
  while (out.recent.length && JSON.stringify(out).length > MAX_SHARED_CHARS) out.recent.shift()
  if (JSON.stringify(out).length > MAX_SHARED_CHARS) {
    out.pad = null
    out.target = null
  }
  return out
}

// ── state changes (each returns a new state) ─────────────────────────────────

// A change to the drawings makes a kept-back / teacher test result out of date. The round's
// tries stay: teaching it a miss is the point of the round.
function stale(state) {
  // eslint-disable-next-line no-unused-vars
  const { shared, counts, liveCount, rights, recent, ...rest } = state
  return { ...rest, result: rest.live?.length ? rest.result : null }
}

// The drawing on the pad now (null clears it). Same state back when nothing changed.
export function setPad(state, grid, target = null) {
  const next = isGridString(grid) ? { grid, target: target ?? null } : null
  const now = state?.pad ?? null
  if (!next && !now) return state
  if (next && now && now.grid === next.grid && now.target === next.target) return state
  return { ...state, pad: next }
}

export function addExample(state, label, grid) {
  const index = state.classes.indexOf(label)
  const clean = cleanLabel(label)
  if (index < 0 || !clean || !isGridString(grid)) return state
  // The class name is fixed (trimmed) the moment it gets its first drawing.
  const classes =
    clean === label ? state.classes : state.classes.map((c, i) => (i === index ? clean : c))
  if (classes.filter((c) => c === clean).length > 1) return state
  const list = state.examples?.[clean] ?? []
  if (list.length >= MAX_EXAMPLES_PER_CLASS) return state
  return stale({ ...state, classes, examples: { ...state.examples, [clean]: [...list, grid] } })
}

export function removeExample(state, label, index) {
  const list = state.examples?.[label] ?? []
  if (!(index >= 0 && index < list.length)) return state
  return stale({
    ...state,
    examples: { ...state.examples, [label]: list.filter((_, i) => i !== index) },
  })
}

// Wipes the drawings and the round.
export function clearExamples(state) {
  return stale({
    ...state,
    examples: emptyExamples(state.classes),
    live: [],
    misses: [],
    result: null,
  })
}

// "Teach it this one": the drawing it got wrong becomes an example of what it really was.
export function teachMiss(state, actual, grid) {
  const next = addExample(state, actual, grid)
  if (next === state) return state
  return {
    ...next,
    misses: (next.misses ?? []).map((m) =>
      m.actual === actual && m.grid === grid ? { ...m, fixed: true } : m
    ),
  }
}

// Student-named classes: only before that class has drawings.
export function setClassName(state, index, name) {
  if (index < 0 || index >= MAX_CLASSES) return state
  const next = [...state.classes]
  while (next.length <= index) next.push('')
  if ((state.examples?.[next[index]] ?? []).length) return state
  next[index] = String(name ?? '').slice(0, MAX_LABEL_LENGTH)
  return { ...state, classes: next }
}

// The class rows start as two blanks, so adding pads to MIN_CLASSES before adding one more.
export function addClass(state, max = MAX_CLASSES) {
  const next = [...state.classes]
  while (next.length < MIN_CLASSES) next.push('')
  if (next.length >= max) return state
  return { ...state, classes: [...next, ''] }
}

export function removeClass(state, index) {
  const label = state.classes[index]
  if (label === undefined || state.classes.length <= 1) return state
  const examples = { ...state.examples }
  delete examples[label]
  return stale({ ...state, classes: state.classes.filter((_, i) => i !== index), examples })
}

// Blank names are dropped and duplicates are made unique, so a half-typed class never reaches
// the model. Used by the UI.
export function namedClasses(state) {
  return cleanClasses(state.classes)
}

// ── testing ──────────────────────────────────────────────────────────────────

// Which positions in a class's list are kept back for the test (held_out only).
export function heldOutIndexes(count) {
  const out = []
  for (let i = HELD_OUT_EVERY - 1; i < count; i += HELD_OUT_EVERY) out.push(i)
  return out
}

export function isHeldOut(task, state, label, index) {
  if (testSetOf(task) !== 'held_out') return false
  return heldOutIndexes((state.examples?.[label] ?? []).length).includes(index)
}

// { train: [{ label, grid }], held: [{ label, grid }] }. Given examples always train; only the
// student's own drawings are ever kept back.
export function splitExamples(task, state) {
  const train = []
  const held = []
  for (const label of state.classes) {
    for (const grid of state.given?.[label] ?? []) train.push({ label, grid })
    const list = state.examples?.[label] ?? []
    const keep = testSetOf(task) === 'held_out' ? new Set(heldOutIndexes(list.length)) : new Set()
    list.forEach((grid, i) => (keep.has(i) ? held : train).push({ label, grid }))
  }
  return { train, held }
}

// The teacher's test drawings as { label, grid }.
export function teacherTestItems(task) {
  return itemsToGrids(task?.testItems)
}

// Authored { label, grid | strokes } items as { label, grid } (bad ones are dropped).
function itemsToGrids(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      if (Array.isArray(item?.grid)) {
        return { label: String(item.label), grid: gridFromRows(item.grid.map(String)) }
      }
      return { label: String(item?.label), grid: encodeGrid(rasterize(toStrokes(item?.strokes))) }
    })
    .filter((item) => isGridString(item.grid))
}

// A pad stroke list as the flat [x1, y1, x2, y2, ...] lists lessons use, to 3 decimal places.
export function strokesToFlat(strokes) {
  return strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) =>
      stroke.flatMap(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
    )
}

// Authored strokes are flat lists [x1, y1, x2, y2, ...]; return [[x, y], ...] lists.
function toStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map((stroke) => {
    const points = []
    for (let i = 0; i + 1 < (stroke?.length ?? 0); i += 2) points.push([stroke[i], stroke[i + 1]])
    return points
  })
}

export function tally(pairs) {
  const confusion = {}
  let right = 0
  for (const [actual, predicted] of pairs) {
    confusion[actual] = confusion[actual] ?? {}
    confusion[actual][predicted] = (confusion[actual][predicted] ?? 0) + 1
    if (actual === predicted) right += 1
  }
  return { right, total: pairs.length, confusion }
}

// The mix-ups in a result, most common first: [{ actual, predicted, count }].
export function mixupsOf(result) {
  const out = []
  for (const [actual, row] of Object.entries(result?.confusion ?? {})) {
    for (const [predicted, count] of Object.entries(row)) {
      if (predicted !== actual) out.push({ actual, predicted, count })
    }
  }
  return out.sort((a, b) => b.count - a.count)
}

// What a kept-back / teacher test can be tested on right now: the test drawings waiting.
export function testSize(task, state) {
  if (testSetOf(task) === 'teacher') return teacherTestItems(task).length
  if (testSetOf(task) === 'held_out') return splitExamples(task, state).held.length
  return 0
}

export function canTest(task, state) {
  return readyOf(state) && testSetOf(task) !== 'live' && testSize(task, state) > 0
}

export function runTest(task, state) {
  if (!canTest(task, state)) return state
  const { train: trainSet, held } = splitExamples(task, state)
  const testSet = testSetOf(task) === 'teacher' ? teacherTestItems(task) : held
  const pairs = testSet.map((item) => [item.label, classify(trainSet, item.grid)])
  return { ...state, result: tally(pairs), tests: (state.tests ?? 0) + 1 }
}

// What the model would say about a drawing, or null when it is not ready / the grid is bad.
export function predictLive(task, state, grid) {
  if (!readyOf(state) || !isGridString(grid)) return null
  return classify(splitExamples(task, state).train, grid)
}

// One try in the round: the student drew something, said what it was (`actual`), and the model
// guesses. It is right when the guess is what they said they drew, and a miss when it is not
// (the pad may have suggested another thing: they were free to try to fool it). Returns the new
// state and what the model said (null when it could not guess).
export function recordLive(task, state, actual, grid) {
  if (!readyOf(state) || !state.classes.includes(actual) || !isGridString(grid)) {
    return { state, predicted: null }
  }
  if ((state.live ?? []).length >= MAX_ATTEMPTS) return { state, predicted: null }
  const { train: trainSet } = splitExamples(task, state)
  const predicted = classify(trainSet, grid)
  const live = [...(state.live ?? []), [actual, predicted]]
  const misses =
    predicted === actual
      ? (state.misses ?? [])
      : [...(state.misses ?? []), { actual, predicted, grid }].slice(-MAX_MISSES_KEPT)
  return {
    state: { ...state, live, misses, result: tally(live), tests: live.length, pad: null },
    predicted,
  }
}

// Which thing the round asks for next: each in turn.
export function nextTarget(state) {
  const labels = (state?.classes ?? []).filter(Boolean)
  return labels.length ? labels[liveCountOf(state) % labels.length] : null
}

// ── results ──────────────────────────────────────────────────────────────────

export function accuracyOf(result) {
  return result && result.total > 0 ? result.right / result.total : null
}

export function percent(result) {
  const accuracy = accuracyOf(result)
  return accuracy == null ? null : Math.round(accuracy * 100)
}

// "7 of 9 right, 78%"
export function describeResult(result) {
  if (!result || !result.total) return ''
  return `${result.right} of ${result.total} right, ${percent(result)}%`
}

// ── grading ──────────────────────────────────────────────────────────────────

// Progress and verdict for a state. `classesMet` counts classes with enough drawings. The live
// round passes at liveTestSize tries, whether the pad got them right or wrong (the student's job
// is to test it, not to make it win; bonus tries after that change nothing); a kept-back or
// teacher test passes at targetAccuracy.
export function gradeTask(task, state) {
  const classes = (state?.classes ?? []).filter(Boolean)
  const counts = countsOf(state)
  const min = taskMinExamples(task)
  const target = taskTarget(task)
  const live = testSetOf(task) === 'live'
  const core = taskLiveTestSize(task)
  const rights = rightsOf(state)
  const tries = liveCountOf(state)
  const classesMet = classes.filter((label) => (counts[label] ?? 0) >= min).length
  const accuracy = accuracyOf(state?.result)
  const enoughClasses =
    classes.length >= MIN_CLASSES &&
    (!task?.classes?.length || classes.length === cleanClasses(task.classes).length)
  const ready = enoughClasses && classesMet === classes.length
  const won = live ? tries >= core : accuracy != null && accuracy + 1e-9 >= target
  const passed = ready && won
  let hint = null
  if (!passed) {
    if (!enoughClasses) {
      hint = 'Name at least two things for the pad to tell apart.'
    } else {
      const short = classes.find((label) => (counts[label] ?? 0) < min)
      if (short) {
        hint = `Draw more ${short}: you have ${counts[short] ?? 0} and need ${min}.`
      } else if (live) {
        hint = `Draw something, press Done and tell it what you drew. It needs ${core} tries: you have ${tries} so far. Try to fool it, and teach it the ones it gets wrong.`
      } else if (!state?.result) {
        hint = 'Press Test to see how the model does on drawings it has not seen.'
      } else {
        hint = `The model got ${percent(state.result)}% and needs ${Math.round(target * 100)}%. Try more drawings in different sizes and shapes, then test again.`
      }
    }
  }
  return {
    passed,
    hint,
    ready,
    classesMet,
    classesTotal: classes.length,
    accuracy,
    target,
    counts,
    min,
    live,
    core,
    rights,
    tries,
  }
}

// Per-class result for the report and card: itemResults by class label.
export function itemResultsOf(task, state) {
  const { counts, min } = gradeTask(task, state)
  return Object.fromEntries(
    (state?.classes ?? []).filter(Boolean).map((label) => [label, (counts[label] ?? 0) >= min])
  )
}

// A finished example state: used for the teacher's "Complete" and the Builder preview. It has
// no drawings (we cannot invent the student's data), just a plausible finished summary.
export function solutionFor(task) {
  const classes = cleanClasses(task?.classes).length
    ? cleanClasses(task.classes)
    : ['class 1', 'class 2']
  const min = taskMinExamples(task)
  const live = testSetOf(task) === 'live'
  const total = live ? taskLiveTestSize(task) : Math.max(2, Math.ceil(taskTarget(task) * 10))
  return {
    v: 1,
    shared: true,
    classes,
    counts: Object.fromEntries(classes.map((label) => [label, min])),
    trained: true,
    result: { right: total, total, confusion: { [classes[0]]: { [classes[0]]: total } } },
    liveCount: live ? total : 0,
    rights: live ? total : 0,
    misses: 0,
    tests: 1,
  }
}

// ── validation ───────────────────────────────────────────────────────────────

function validateTestItem(item, where, errors, classes) {
  const hasStrokes = item?.strokes !== undefined
  const hasGrid = item?.grid !== undefined
  if (typeof item?.label !== 'string' || !item.label.trim()) {
    errors.push(`${where}: needs a label.`)
  } else if (classes.length && !classes.includes(item.label)) {
    errors.push(`${where}: label "${item.label}" is not one of the classes.`)
  }
  if (hasStrokes === hasGrid) {
    errors.push(`${where}: needs either strokes or grid (not both).`)
    return
  }
  if (hasGrid) {
    const rows = item.grid
    const ok =
      Array.isArray(rows) &&
      rows.length === GRID &&
      rows.every((row) => typeof row === 'string' && row.length === GRID && ROW_CHARS.test(row))
    if (!ok) {
      errors.push(
        `${where}: grid must be ${GRID} rows of ${GRID} characters (. empty, # ink, or digits 0-9).`
      )
    }
    return
  }
  const strokes = item.strokes
  const ok =
    Array.isArray(strokes) &&
    strokes.length > 0 &&
    strokes.every(
      (stroke) =>
        Array.isArray(stroke) &&
        stroke.length >= 2 &&
        stroke.length % 2 === 0 &&
        stroke.every((n) => typeof n === 'number' && n >= 0 && n <= 1)
    )
  if (!ok) {
    errors.push(
      `${where}: strokes must be a list of strokes, each a list of x, y numbers between 0 and 1 (x1, y1, x2, y2, ...).`
    )
  }
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
export function validateClassifierTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  if (CLASSIFIER_MODES_NOT_BUILT.includes(task?.mode)) {
    errors.push(`${where}: classifier mode ${task.mode} is not built yet. Use mode: drawing.`)
    return errors
  }
  if (!CLASSIFIER_MODES.includes(task?.mode)) {
    errors.push(`${where}: classifier mode must be drawing.`)
    return errors
  }
  // testSet is optional (missing means the live round); a value that is there must be known.
  if (task.testSet !== undefined && !TEST_SETS.includes(task.testSet)) {
    errors.push(`${where}: classifier testSet must be one of ${TEST_SETS.join(', ')}.`)
    return errors
  }
  const testSet = testSetOf(task)
  let classes = []
  if (task.classes !== undefined) {
    const list = Array.isArray(task.classes) ? task.classes : null
    if (!list) {
      errors.push(`${where}: classifier classes must be a list of names.`)
    } else if (list.length > 0) {
      classes = list.map((label) => String(label ?? '').trim())
      if (classes.some((label) => !label || label.length > MAX_LABEL_LENGTH)) {
        errors.push(`${where}: each class name must be 1 to ${MAX_LABEL_LENGTH} characters.`)
      } else if (new Set(classes.map((label) => label.toLowerCase())).size !== classes.length) {
        errors.push(`${where}: class names must all be different.`)
      } else if (classes.length < MIN_CLASSES || classes.length > MAX_CLASSES) {
        errors.push(`${where}: classifier needs ${MIN_CLASSES} to ${MAX_CLASSES} classes.`)
      }
    }
  }
  const min = task.minExamplesPerClass
  if (min !== undefined) {
    if (!Number.isInteger(min) || min < 2 || min > MAX_EXAMPLES_PER_CLASS) {
      errors.push(
        `${where}: minExamplesPerClass must be a whole number from 2 to ${MAX_EXAMPLES_PER_CLASS}.`
      )
    }
  }
  if (testSet === 'held_out' && taskMinExamples(task) < HELD_OUT_EVERY) {
    errors.push(
      `${where}: testSet held_out needs minExamplesPerClass of at least ${HELD_OUT_EVERY} (every ${HELD_OUT_EVERY}th drawing is kept back for the test).`
    )
  }
  const target = task.targetAccuracy
  if (target !== undefined && (typeof target !== 'number' || !(target > 0) || target > 1)) {
    errors.push(`${where}: targetAccuracy must be a number above 0 and up to 1 (0.8 means 80%).`)
  }
  const live = task.liveTestSize
  if (
    live !== undefined &&
    (!Number.isInteger(live) || live < MIN_LIVE_TEST_SIZE || live > MAX_LIVE_TEST_SIZE)
  ) {
    errors.push(
      `${where}: liveTestSize must be a whole number from ${MIN_LIVE_TEST_SIZE} to ${MAX_LIVE_TEST_SIZE}.`
    )
  }
  if (task.panels !== undefined) {
    if (!Array.isArray(task.panels)) {
      errors.push(`${where}: classifier panels must be a list (any of ${PANELS.join(', ')}).`)
    } else {
      for (const panel of task.panels) {
        if (!PANELS.includes(panel)) {
          errors.push(
            `${where}: classifier panels has an unknown value "${String(panel)}". Use ${PANELS.join(', ')}.`
          )
        }
      }
    }
  }
  if (task.examples !== undefined) {
    const list = task.examples
    if (!Array.isArray(list)) {
      errors.push(`${where}: examples must be a list of pre-loaded drawings.`)
    } else if (list.length > 0) {
      if (!classes.length) {
        errors.push(`${where}: examples need classes (each example uses a class name).`)
      }
      if (list.length > MAX_GIVEN_EXAMPLES) {
        errors.push(`${where}: examples can have at most ${MAX_GIVEN_EXAMPLES} drawings.`)
      } else {
        list.forEach((item, i) =>
          validateTestItem(item, `${where} example ${i + 1}`, errors, classes)
        )
      }
    }
  }
  if (testSet === 'teacher') {
    const items = task.testItems
    if (!classes.length) {
      errors.push(`${where}: testSet teacher needs classes (the test drawings use their names).`)
    }
    if (!Array.isArray(items) || items.length < 2 || items.length > MAX_TEST_ITEMS) {
      errors.push(
        `${where}: testSet teacher needs testItems with 2 to ${MAX_TEST_ITEMS} test drawings.`
      )
    } else {
      items.forEach((item, i) =>
        validateTestItem(item, `${where} test drawing ${i + 1}`, errors, classes)
      )
    }
  }
  return errors
}

export function validateClassifierWarnings(task, n) {
  const warnings = []
  if (task?.testSet === 'teacher' && Array.isArray(task.testItems) && task.classes?.length) {
    const used = new Set(task.testItems.map((item) => item?.label))
    for (const label of task.classes) {
      if (!used.has(label)) {
        warnings.push(`Task ${n}: no test drawing for class "${label}".`)
      }
    }
  }
  if (Array.isArray(task?.examples) && task.examples.length && task.classes?.length) {
    const used = new Set(task.examples.map((item) => item?.label))
    for (const label of task.classes) {
      if (!used.has(label)) {
        warnings.push(`Task ${n}: no pre-loaded example for class "${label}".`)
      }
    }
    if (task.testSet === 'held_out') {
      const need = taskMinExamples(task)
      for (const label of task.classes) {
        if (task.examples.filter((item) => item?.label === label).length >= need) {
          warnings.push(
            `Task ${n}: "${label}" has ${need} or more pre-loaded examples, so the student never has to draw it and nothing is kept back for the test. Raise minExamplesPerClass.`
          )
        }
      }
    }
  }
  return warnings
}
