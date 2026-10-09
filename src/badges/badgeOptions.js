// Lesson-level tuning for the built-in badge rules: the optional `badgeOptions` envelope field
// (docs/authoring/badges.md). Lessons define no badges; they can only tune these numbers. Pure.

// kind: 'fraction' (0–1), 'count' (whole number ≥ 1), 'seconds' or 'minutes' (a positive number).
export const BADGE_OPTION_SPECS = Object.freeze({
  quizMasterThreshold: Object.freeze({
    kind: 'fraction',
    default: 0.8,
    description: 'Share of a quiz group right first time for 🎯 Quiz Master.',
  }),
  quizMasterMinQuizzes: Object.freeze({
    kind: 'count',
    default: 3,
    description: 'Graded quizzes a group needs before 🎯 Quiz Master can be suggested for it.',
  }),
  persistenceMinFails: Object.freeze({
    kind: 'count',
    default: 2,
    description: 'Different failed submissions before a pass for 🔨 Persistence.',
  }),
  readyToCodeSeconds: Object.freeze({
    kind: 'seconds',
    default: 10,
    description: 'Seconds from a code task opening to the first real edit for 🚀 Ready to Code.',
  }),
  earlyBirdMinutes: Object.freeze({
    kind: 'minutes',
    default: 5,
    description:
      'Minutes before the tutor presses Start that a student must join for 🐦 Early Bird.',
  }),
  sideQuesterMinDone: Object.freeze({
    kind: 'count',
    default: 2,
    description: 'Side-quests a student must mark Done in the session for 🗺️ Side Quester.',
  }),
})

export const DEFAULT_BADGE_OPTIONS = Object.freeze(
  Object.fromEntries(Object.entries(BADGE_OPTION_SPECS).map(([key, spec]) => [key, spec.default]))
)

// Whether `value` is valid for the option's kind.
export function isValidBadgeOptionValue(key, value) {
  const spec = BADGE_OPTION_SPECS[key]
  if (!spec || typeof value !== 'number' || !Number.isFinite(value)) return false
  if (spec.kind === 'fraction') return value >= 0 && value <= 1
  if (spec.kind === 'count') return Number.isInteger(value) && value >= 1
  return value > 0
}

/**
 * The effective options: the lesson's `badgeOptions` over the defaults, then `overrides`.
 * Invalid values fall back to the default (validation reports them to the author).
 */
export function resolveBadgeOptions(lesson, overrides = null) {
  const out = { ...DEFAULT_BADGE_OPTIONS }
  for (const source of [lesson?.badgeOptions, overrides]) {
    if (!source || typeof source !== 'object') continue
    for (const key of Object.keys(BADGE_OPTION_SPECS)) {
      if (isValidBadgeOptionValue(key, source[key])) out[key] = source[key]
    }
  }
  return out
}
