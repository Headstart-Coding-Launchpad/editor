// The platform copy of the Lesson Format Glossary vocabulary used in a task's `taskActivity`
// (content workspace: guides/Lesson Format Glossary.md and guides/Task Intent Format.md; this
// file is the source of truth). `taskActivity` stays free text: parseTaskActivity reads the
// Glossary pattern it names, so badges (src/badges) and audits can tell a Debug Code Task from a
// Copy the Code task without re-tagging lessons. Pure and Node-safe.
//
//   taskActivity: "Code Task, Debug Code Task"   → { format: 'code_task', pattern: 'debug_code_task' }
//   taskActivity: "Quiz: What Is the Error?"     → { format: 'quiz', pattern: 'quiz_what_is_the_error' }
//   taskActivity: "Quiz, Multiple Choice"        → { format: 'quiz', pattern: 'quiz_multiple_choice' }
//   taskActivity: "Information"                  → { format: 'information', pattern: null }
//   taskActivity: "Activity, Binary: to_decimal" → { format: 'activity', pattern: null,
//                                                    activityId: 'binary', mode: 'to_decimal' }
import { getActivityDefinitions } from '../activities/registry.pure.js'

// The task formats a `taskActivity` starts with. Ids are stable (badges and reports store them).
export const TASK_ACTIVITY_FORMATS = Object.freeze([
  Object.freeze({ id: 'information', name: 'Information' }),
  Object.freeze({ id: 'quiz', name: 'Quiz' }),
  Object.freeze({ id: 'code_task', name: 'Code Task' }),
  Object.freeze({ id: 'arrange_task', name: 'Arrange Task' }),
  Object.freeze({ id: 'activity', name: 'Activity' }),
])

const pattern = (id, name, formats, aliases = []) =>
  Object.freeze({
    id,
    name,
    formats: Object.freeze(formats),
    aliases: Object.freeze(aliases),
  })

// Every Glossary pattern a `taskActivity` can name after its format. Ids are stable machine ids:
// badges, `badgeHints` and reports refer to them, so never rename one (add an alias instead).
// `formats` lists the formats the pattern is written under. Quiz patterns come in two forms,
// both listed here: the Glossary's pedagogical patterns (`Quiz: Fix a Common Bug`) and the
// mechanical quiz types (`Quiz, Multiple Choice`) used when no pedagogical pattern applies.
export const TASK_ACTIVITY_PATTERNS = Object.freeze([
  // Information
  pattern('brief_description', 'Brief Description', ['information']),
  pattern('coming_up_next', 'Coming Up Next', ['information']),
  // Information or Code Task
  pattern('take_it_further', 'Take It Further', ['information', 'code_task']),
  pattern('tooling_introduction', 'Tooling Introduction', ['information', 'code_task']),
  // Code Task
  pattern('complete_example', 'Complete Example', ['code_task']),
  pattern('meaningful_change', 'Meaningful Change', ['code_task']),
  pattern('copy_the_code', 'Copy the Code', ['code_task']),
  pattern('debug_code_task', 'Debug Code Task', ['code_task'], ['Debug Code', 'Debug Task']),
  pattern('challenge_open_ended', 'Challenge (Open-Ended)', ['code_task'], ['Challenge']),
  pattern('make_it_your_own', 'Make It Your Own', ['code_task']),
  pattern('visual_fun_application', 'Visual Fun Application', ['code_task']),
  // Arrange Task (and the Quiz form used where code_arrange isn't available)
  pattern(
    'meaningful_fill_in_the_blanks',
    'Meaningful Fill in the Blanks',
    ['arrange_task', 'quiz'],
    ['Meaningful Fill in the Gaps', 'Meaningful Fill in the Blanks / Gaps']
  ),
  // Quiz: pedagogical patterns
  pattern('quiz_what_do_you_expect', 'What Do You Expect the Code to Do', ['quiz']),
  pattern('quiz_when_to_implement', 'When to Implement', ['quiz']),
  pattern('quiz_fix_a_common_bug', 'Fix a Common Bug', ['quiz']),
  pattern('quiz_what_is_the_error', 'What Is the Error?', ['quiz']),
  pattern(
    'quiz_confirm_the_syntax',
    'Confirm / Recall the Syntax',
    ['quiz'],
    ['Confirm the Syntax', 'Recall the Syntax']
  ),
  pattern('quiz_vocabulary_check', 'Vocabulary Check', ['quiz']),
  pattern('quiz_which_of_these_is_a_type', 'Which of These Is a [Type]', ['quiz']),
  pattern('quiz_vocabulary_match', 'Vocabulary Match', ['quiz']),
  pattern('quiz_block_match', 'Block Match', ['quiz']),
  pattern('quiz_design', 'Design', ['quiz']),
  pattern('quiz_confidence_check', 'Confidence Check', ['quiz']),
  pattern('quiz_concept_refresh_check', 'Concept Refresh Check', ['quiz']),
  // Quiz: mechanical types (docs/authoring/quiz-types.md)
  pattern('quiz_multiple_choice', 'Multiple Choice', ['quiz']),
  pattern('quiz_match', 'Match', ['quiz']),
  pattern('quiz_fill_in_the_blank', 'Fill in the Blank', ['quiz'], ['Fill in the Blanks']),
  pattern('quiz_short_answer', 'Short Answer', ['quiz']),
  pattern('quiz_confidence_rating', 'Confidence Rating', ['quiz']),
])

export const TASK_ACTIVITY_PATTERN_IDS = Object.freeze(TASK_ACTIVITY_PATTERNS.map((p) => p.id))

// "Challenge (Open-Ended)" and "challenge open-ended" compare equal: lowercase, and any run of
// punctuation or whitespace is one space.
function normaliseKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const FORMAT_BY_KEY = new Map(TASK_ACTIVITY_FORMATS.map((f) => [normaliseKey(f.name), f.id]))
const PATTERN_BY_ID = new Map(TASK_ACTIVITY_PATTERNS.map((p) => [p.id, p]))
const PATTERNS_BY_KEY = new Map()
for (const entry of TASK_ACTIVITY_PATTERNS) {
  for (const name of [entry.name, ...entry.aliases]) {
    const key = normaliseKey(name)
    PATTERNS_BY_KEY.set(key, [...(PATTERNS_BY_KEY.get(key) ?? []), entry])
  }
}
// "Which of These Is a [Type]" is written with the real type ("Which of These Is an Integer").
const WHICH_OF_THESE_PREFIX = /^which of these is an? /

export function getTaskActivityPattern(id) {
  return PATTERN_BY_ID.get(id) ?? null
}

function findPattern(rest, formatId) {
  const key = normaliseKey(rest)
  const candidates = WHICH_OF_THESE_PREFIX.test(key)
    ? [PATTERN_BY_ID.get('quiz_which_of_these_is_a_type')]
    : (PATTERNS_BY_KEY.get(key) ?? [])
  if (!formatId) return candidates.length === 1 ? candidates[0] : null
  return candidates.find((candidate) => candidate.formats.includes(formatId)) ?? null
}

// "Activity, Binary: to_decimal" names an activity by its label (or id / YAML type), then an
// optional mode.
function parseActivityRest(rest) {
  if (!rest) return { activityId: null, mode: null, known: true }
  const [labelPart, ...modeParts] = rest.split(':')
  const label = normaliseKey(labelPart)
  const mode = modeParts.join(':').trim() || null
  const activity = getActivityDefinitions().find((definition) =>
    [definition.label, definition.label.split(' ')[0], definition.id, definition.yaml?.type].some(
      (name) => name && normaliseKey(name) === label
    )
  )
  return { activityId: activity?.id ?? null, mode, known: !!activity }
}

/**
 * Reads the Glossary format and pattern a `taskActivity` string names. Tolerates case,
 * whitespace, punctuation and `,` vs `:` after the format.
 *
 * Returns `{ format, pattern, known }` (plus `activityId` and `mode` for the Activity format):
 * - `format`: a TASK_ACTIVITY_FORMATS id, or null when the string doesn't start with one;
 * - `pattern`: a TASK_ACTIVITY_PATTERNS id, or null (plain forms such as `Code Task`, or an
 *   unrecognised pattern). A bare pattern with no format (`Debug Code Task`) still resolves when
 *   the name is unambiguous;
 * - `known`: the string is a recognised format with, if anything follows it, a recognised pattern
 *   for that format. Empty / missing values are `known` with a null format (nothing to warn about).
 */
export function parseTaskActivity(value) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!text) return { format: null, pattern: null, known: true }

  const match = /^([^,:]+?)\s*(?:[,:]\s*(.*))?$/.exec(text)
  const formatId = FORMAT_BY_KEY.get(normaliseKey(match?.[1])) ?? null
  if (!formatId) {
    const bare = findPattern(text, null)
    return { format: null, pattern: bare?.id ?? null, known: false }
  }

  const rest = (match[2] ?? '').trim()
  if (formatId === 'activity') {
    const activity = parseActivityRest(rest)
    return { format: formatId, pattern: null, known: activity.known, ...activity }
  }
  if (!rest) return { format: formatId, pattern: null, known: true }
  const found = findPattern(rest, formatId)
  return { format: formatId, pattern: found?.id ?? null, known: !!found }
}

/** The pattern id of a task's `taskActivity`, or null. */
export function getTaskActivityPatternId(task) {
  return parseTaskActivity(task?.taskActivity).pattern
}
