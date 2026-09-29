// Shared logic for the five legacy quiz activities (quiz_multiple_choice, quiz_match,
// quiz_fill_blank, quiz_short_answer, quiz_confidence). Each quiz_<type>/definition.js is built
// with defineQuizActivity below; the old helpers (studentQuizContent.js, taskItemProgress.js,
// lessonReport.js, printLesson.js) are thin adapters over these functions, so the stored and
// reported formats stay exactly as they were before quizzes became activities.
//
// Stored answer formats (students/{id}/currentAnswer, the `__activity_state__` aux file,
// teacherLive.answer, teacherAnswerEdit.answer) are unchanged:
//   multiple_choice  the chosen option id ("b")
//   match            JSON map of pair id -> placed pair id ('{"p1":"p2"}')
//   fill_blank       JSON map of blank id -> tile id (drag) or typed text (type)
//   short_answer     the free-text answer
//   confidence       "1".."5"
//
// Pure and Node-safe: imported by the CLI, validation, reports and print.
import { defineActivity } from '../defineActivity.js'
import { validateQuizTask, quizHasCheckValue, quizHasStarter } from '../legacyValidation.js'
import { evaluateCheck, getFirstFailedCheckHint } from '../../modules/checks.js'
import { answerTextMatches, parseQuizAnswerState } from '../../shared/quizAnswers.js'

export const QUIZ_TYPES = Object.freeze([
  'multiple_choice',
  'match',
  'fill_blank',
  'short_answer',
  'confidence',
])

function quizTypeOf(task) {
  return task?.quizType ?? 'multiple_choice'
}

// ─── Submissions (attempt log) ───────────────────────────────────────────────

function fillBlankTiles(task) {
  return [
    ...(task?.blanks ?? []).map((blank) => ({ id: blank.id, text: blank.answer })),
    ...(task?.distractors ?? []).map((distractor) => ({
      id: distractor.id,
      text: distractor.text,
    })),
  ]
}

// Per-blank { value, expected, correct } for a fill-in-the-gaps answer (object or JSON string).
export function buildFillBlankSubmission(task, answer) {
  const state = parseQuizAnswerState(answer)
  const mode = task?.mode ?? 'drag'
  const tiles = fillBlankTiles(task)
  return Object.fromEntries(
    (task?.blanks ?? []).map((blank) => {
      const rawValue = state[blank.id]
      const value =
        mode === 'drag'
          ? (tiles.find((tile) => tile.id === rawValue)?.text ?? rawValue ?? '')
          : (rawValue ?? '')
      const expected = blank.answer ?? ''
      const correct =
        mode === 'drag'
          ? String(value ?? '') === String(expected)
          : answerTextMatches(value, expected)
      return [blank.id, { value, expected, correct }]
    })
  )
}

// Per-pair { prompt, value, expected, correct } for a match answer (object or JSON string).
export function buildMatchSubmission(task, answer) {
  const state = parseQuizAnswerState(answer)
  return Object.fromEntries(
    (task?.pairs ?? []).map((pair) => {
      const placedId = state[pair.id]
      const placedPair = (task?.pairs ?? []).find((candidate) => candidate.id === placedId)
      return [
        pair.id,
        {
          prompt: pair.prompt ?? '',
          value: placedPair?.answer ?? placedId ?? '',
          expected: pair.answer ?? '',
          correct: placedId === pair.id,
        },
      ]
    })
  )
}

export function normalizeConfidenceRating(answer) {
  const rating = Number(answer)
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : answer
}

function textSubmission(answer) {
  return typeof answer === 'string' ? answer : String(answer ?? '')
}

// The attempt-log submission for a quiz answer, dispatched on quizType (tasks without a
// taskType are accepted, as the Builder preview passes them).
export function buildQuizSubmission(task, answer) {
  const quizType = quizTypeOf(task)
  if (quizType === 'fill_blank') return buildFillBlankSubmission(task, answer)
  if (quizType === 'match') return buildMatchSubmission(task, answer)
  if (quizType === 'confidence') return normalizeConfidenceRating(answer)
  return textSubmission(answer)
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function getQuizSuggestion(task, answer) {
  if (!task) return ''
  if (quizTypeOf(task) === 'multiple_choice') {
    const option = task.options?.find((o) => o.id === answer)
    return String(
      option?.feedback ?? option?.hint ?? task.feedback ?? task.check?.hint ?? ''
    ).trim()
  }
  if (task.quizType === 'short_answer' && task.check) {
    return getFirstFailedCheckHint(task.check, answer, {
      answer: typeof answer === 'string' ? answer : '',
    })
  }
  return String(task.feedback ?? task.check?.hint ?? '').trim()
}

// ─── Teacher progress (StudentCard / StudentModal item badge) ────────────────

function isFilled(value) {
  return value != null && String(value).trim() !== ''
}

// { kind, filled, total, correct } for the per-item quizzes (match, fill_blank).
export function quizItemProgress(task, state, items) {
  if (items.length === 0) return null
  const answer = parseQuizAnswerState(state)
  const submission = buildQuizSubmission(task, answer)
  let filled = 0
  let correct = 0
  for (const item of items) {
    if (!isFilled(answer[item.id])) continue
    filled += 1
    if (submission?.[item.id]?.correct) correct += 1
  }
  return { kind: quizTypeOf(task), filled, total: items.length, correct }
}

// StudentCard text for the per-item quizzes (match, fill_blank), from the student's mirrored
// run status and check result.
export function itemsSummaryText({ submitted, passed } = {}) {
  if (passed === true) return '✓ All correct'
  if (passed === false && submitted) return '✗ Some incorrect'
  return submitted ? 'Answered' : 'In progress…'
}

// ─── Session report ──────────────────────────────────────────────────────────

// Attempt logs written before submissions were detailed carry the raw answer map; newer ones
// already hold { value, expected, correct } per item and are passed through.
function hasDetailedShape(state, items) {
  return items.some((item) => {
    const entry = state[item.id]
    return entry && typeof entry === 'object' && ('expected' in entry || 'correct' in entry)
  })
}

export function normalizeFillBlankReportSubmission(task, submission) {
  const state = parseQuizAnswerState(submission)
  if (hasDetailedShape(state, task?.blanks ?? [])) return state
  return buildFillBlankSubmission(task, state)
}

export function normalizeMatchReportSubmission(task, submission) {
  const state = parseQuizAnswerState(submission)
  if (hasDetailedShape(state, task?.pairs ?? [])) return state
  return buildMatchSubmission(task, state)
}

function countValues(values) {
  const counts = new Map()
  for (const value of values) {
    const key = String(value ?? '')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }))
}

// Wrong values per item across every student's attempts, most common first. `describe(item)`
// gives the item's fixed fields; `idKey` names the id field ('blankId' / 'pairId').
export function summarizeItemFailures(perStudent, items, normalize, idKey, describe) {
  const failures = new Map()
  for (const t of perStudent) {
    for (const attempt of t.distinctAttempts) {
      const submission = normalize(attempt.submission)
      for (const item of items) {
        const entry = submission[item.id]
        if (!entry || entry.correct) continue
        const current = failures.get(item.id) ?? { ...describe(item), values: [] }
        current.values.push(entry.value)
        failures.set(item.id, current)
      }
    }
  }
  return Array.from(failures.entries())
    .map(([id, { values, ...fixed }]) => ({
      [idKey]: id,
      ...fixed,
      count: values.length,
      values: countValues(values),
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Print ───────────────────────────────────────────────────────────────────

export function printTable(label, headers, rows, esc) {
  const head = headers.map((header) => `<th>${header}</th>`).join('')
  const body = rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="field"><div class="field-label">${label}</div><table class="data-table"><tr>${head}</tr>${body}</table></div>`
}

// ─── Definition factory ──────────────────────────────────────────────────────

export const QUIZ_LABELS = Object.freeze({
  multiple_choice: 'Multiple choice',
  match: 'Match',
  fill_blank: 'Fill in the gaps',
  short_answer: 'Short answer',
  confidence: 'Confidence check',
})

function validateWithLegacyRules(task, { n } = {}) {
  const errors = []
  validateQuizTask(task, { n, errors })
  return { errors, warnings: [] }
}

/**
 * Build a legacy quiz activity. Everything shared by the five sub-types lives here:
 * the legacy task shape, validation (the shared legacy rules, one wording for Builder + CLI),
 * the stored answer formats, live sync on `currentAnswer` (every change is discrete: debounced
 * 300ms, always), persistence in the `__activity_state__` aux file, and the session-report
 * type fields `{ taskType: 'quiz', quizType }`.
 *
 * Quiz UIs decide themselves when an answer is final (an option chosen, every tile placed,
 * Submit pressed) and call `onSubmit(answer)`; in-progress changes call `onChange(answer)`
 * (`submitsAnswers: true`). Their own screen shows the question, never the answer, because a
 * teacher's screen is often projected (`previewState: 'initial'`).
 */
export function defineQuizActivity(quizType, def) {
  return defineActivity({
    id: `quiz_${quizType}`,
    label: QUIZ_LABELS[quizType],
    category: 'quiz',
    icon: '❓',
    legacy: Object.freeze({ taskType: 'quiz', quizType }),
    yaml: Object.freeze({ type: 'quiz', quizType }),
    validateTask: validateWithLegacyRules,
    hasStarter: (task) => !!quizHasStarter(task),
    hasCheckValue: (task) => !!quizHasCheckValue(task),
    classifyChange: () => 'discrete',
    submitsAnswers: true,
    previewState: 'initial',
    teacherEditable: false,
    buildSubmission: buildQuizSubmission,
    report: Object.freeze({
      typeFields: () => ({ taskType: 'quiz', quizType }),
      normalizeSubmission: (task, submission) => submission ?? null,
      summaryFields: () => ({}),
    }),
    ...def,
  })
}

// Grade an answer against the task's answer_* check (multiple choice, marked short answer).
export function gradeAnswerCheck(task, answer) {
  return task?.check
    ? evaluateCheck(task.check, answer, { answer: typeof answer === 'string' ? answer : '' })
    : false
}

export function gradeResult(task, answer, passed) {
  return { passed, suggestion: passed ? '' : getQuizSuggestion(task, answer) }
}
