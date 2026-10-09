// The confidence check's rating scale (quiz `quizType: confidence`), shared by the quiz UI,
// the teacher's card pill and class spread, the activity definition and the session report.
//
// Since 2026-10-09 every confidence check is rated 1 to 10 (it used to be 1 to 5). Session
// reports record the scale beside the ratings (`ratingScale`), and a report without it was
// made on the old 1 to 5 scale, so a 4 in an old report is never read as 4/10.
//
// Pure and Node-safe: imported by the CLI, validation and reports.

export const CONFIDENCE_SCALE = 10
// The scale of every report written before `ratingScale` existed.
export const LEGACY_CONFIDENCE_SCALE = 5

// Red (1) to green (10). Each level also has the text colour to put on its fill: the middle
// (amber, yellow, lime) levels are too light for white text.
export const CONFIDENCE_COLOURS = Object.freeze([
  '#dc2626',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#a3e635',
  '#84cc16',
  '#22c55e',
  '#16a34a',
  '#15803d',
])
const DARK_TEXT_LEVELS = new Set([4, 5, 6, 7])

// The levels of a scale, 1..scale.
export function confidenceLevels(scale = CONFIDENCE_SCALE) {
  return Array.from({ length: scale }, (_, i) => i + 1)
}

// A rating as a whole number in 1..scale, or null (strings, numbers and junk accepted).
export function parseConfidenceRating(value, scale = CONFIDENCE_SCALE) {
  if (value == null || value === '') return null
  const rating = Number(value)
  return Number.isInteger(rating) && rating >= 1 && rating <= scale ? rating : null
}

// The scale a session report's ratings were given on: `ratingScale` when recorded, otherwise
// the old 1 to 5 scale.
export function reportConfidenceScale(entry) {
  const scale = Number(entry?.ratingScale)
  return Number.isInteger(scale) && scale > 0 ? scale : LEGACY_CONFIDENCE_SCALE
}

// The fill colour for a level. A level on another scale (an old 1 to 5 report) is placed at
// the same point of the red-to-green range.
export function confidenceColour(level, scale = CONFIDENCE_SCALE) {
  const rating = parseConfidenceRating(level, scale)
  if (rating === null) return '#9ca3af'
  const index =
    scale === CONFIDENCE_SCALE
      ? rating - 1
      : Math.round(((rating - 1) / Math.max(1, scale - 1)) * (CONFIDENCE_SCALE - 1))
  return CONFIDENCE_COLOURS[index]
}

// The text colour to put on confidenceColour(level, scale).
export function confidenceTextColour(level, scale = CONFIDENCE_SCALE) {
  const colour = confidenceColour(level, scale)
  const index = CONFIDENCE_COLOURS.indexOf(colour)
  return index >= 0 && DARK_TEXT_LEVELS.has(index + 1) ? '#1f2937' : '#fff'
}

// "7/10".
export function formatConfidence(level, scale = CONFIDENCE_SCALE) {
  const rating = parseConfidenceRating(level, scale)
  return rating === null ? '' : `${rating}/${scale}`
}

// An empty count per level: { 1: 0, ..., scale: 0 }.
export function emptyConfidenceDistribution(scale = CONFIDENCE_SCALE) {
  return Object.fromEntries(confidenceLevels(scale).map((level) => [level, 0]))
}

/**
 * The class's live spread on a confidence check from each student's mirrored rating
 * (students/{id}/currentAnswer, discrete so always written): `{ respondedCount, total,
 * levels: [{ level, count, studentIds }] }`. `students` is the teacher's student list (each
 * with `anonymousId` and `currentAnswer`); answers outside the scale are ignored.
 */
export function tallyConfidenceSpread(students, scale = CONFIDENCE_SCALE) {
  const levels = confidenceLevels(scale).map((level) => ({ level, count: 0, studentIds: [] }))
  let respondedCount = 0
  const list = Array.isArray(students) ? students : []
  for (const student of list) {
    const rating = parseConfidenceRating(student?.currentAnswer, scale)
    if (rating === null) continue
    respondedCount += 1
    levels[rating - 1].count += 1
    levels[rating - 1].studentIds.push(student.anonymousId)
  }
  return { respondedCount, total: list.length, levels }
}

// The grid's highlight group for the students at one level (ConfidenceSpreadStrip).
export function confidenceGroup(level) {
  return `confidence:${level}`
}

// Highlight entries ({ group, studentIds }) for the grid's shared card outline: one per level
// someone chose.
export function confidenceSpreadEntries(spread) {
  return (spread?.levels ?? [])
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ group: confidenceGroup(entry.level), studentIds: entry.studentIds }))
}
