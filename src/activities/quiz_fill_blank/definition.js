// Fill-in-the-gaps quiz (legacy `taskType: 'quiz'`, `quizType: 'fill_blank'`). State:
// { [blankId]: tileId } in drag mode, { [blankId]: typedText } in type mode. Filling the last gap
// (drag) or pressing Submit (type) submits; the teacher can edit a student's answers. Typed gaps
// not yet submitted reach the tutor as an answer draft (src/shared/answerDrafts.js).
import { parseQuizAnswerState } from '../../shared/quizAnswers.js'
import {
  buildFillBlankSubmission,
  defineQuizActivity,
  getQuizSuggestion,
  itemsSummaryText,
  normalizeFillBlankReportSubmission,
  printTable,
  quizItemProgress,
  summarizeItemFailures,
} from '../quiz/quizActivity.js'

export default defineQuizActivity('fill_blank', {
  description: 'Drag tiles (or type words) into the gaps in a passage or code.',

  fields: {
    modeField: 'mode',
    task: [
      {
        name: 'mode',
        type: 'string',
        values: ['drag', 'type'],
        description: 'drag tiles (default) or type the words.',
      },
      {
        name: 'text',
        type: 'string',
        required: true,
        authored: true,
        description: 'The passage, with ___ for each blank.',
      },
      {
        name: 'blanks',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'answer', type: 'string', required: true, authored: true },
        ],
      },
      {
        name: 'distractors',
        type: 'array',
        authored: true,
        itemFields: [
          { name: 'id', type: 'string' },
          { name: 'text', type: 'string', required: true, authored: true },
        ],
      },
    ],
  },
  completion: 'auto',
  teacherEditable: true,
  // Typing a gap is continuous, like code: mirrored to currentAnswer only while the teacher
  // watches this student. The unwatched tutor sees the typed gaps as an answer draft instead
  // (onDraft, src/shared/answerDrafts.js). Placing a tile (drag mode) is discrete.
  classifyChange: (prev, next, task) =>
    (task?.mode ?? 'drag') === 'type' ? 'continuous' : 'discrete',

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'fill_blank',
    explainer: prev.explainer ?? '',
    mode: 'drag',
    text: 'Use ___ to show text on the screen.',
    blanks: [{ id: 'b1', answer: 'print' }],
    distractors: [{ id: 'd1', text: 'input' }],
    check: null,
  }),

  initialState: () => ({}),
  // Each blank holds its answer.
  sealedFields: ['blanks'],
  solutionState: (task) =>
    Object.fromEntries(
      (task?.blanks ?? []).map((blank) => [
        blank.id,
        (task?.mode ?? 'drag') === 'drag' ? blank.id : blank.answer,
      ])
    ),
  serialize: (state) => JSON.stringify(state ?? {}),
  deserialize: (raw) => parseQuizAnswerState(raw),

  grade: (task, state) => {
    const submission = buildFillBlankSubmission(task, state)
    const passed = (task?.blanks ?? []).every((blank) => submission[blank.id]?.correct)
    return { passed, suggestion: passed ? '' : getQuizSuggestion(task, state) }
  },

  getProgress: (task, state) => quizItemProgress(task, state, task?.blanks ?? []),
  summarize: (task, state, result) => ({ text: itemsSummaryText(result), tone: 'neutral' }),

  report: {
    typeFields: () => ({ taskType: 'quiz', quizType: 'fill_blank' }),
    normalizeSubmission: normalizeFillBlankReportSubmission,
    summaryFields: (task, perStudent) => ({
      blankFailures: summarizeItemFailures(
        perStudent,
        task.blanks ?? [],
        (submission) => normalizeFillBlankReportSubmission(task, submission),
        'blankId',
        (blank) => ({ expected: blank.answer ?? '' })
      ),
    }),
  },

  printHtml: (task, { esc }) => {
    const parts = []
    if (task.text) {
      parts.push(
        `<div class="field"><div class="field-label">Text</div><div class="field-value">${esc(task.text)}</div></div>`
      )
    }
    if (task.blanks?.length) {
      parts.push(
        printTable(
          'Blanks',
          ['ID', 'Answer'],
          task.blanks.map((b) => [b.id, b.answer]),
          esc
        )
      )
    }
    if (task.distractors?.length) {
      parts.push(
        printTable(
          'Distractors',
          ['ID', 'Text'],
          task.distractors.map((d) => [d.id, d.text]),
          esc
        )
      )
    }
    return parts.join('')
  },
})
