// Click-the-line quiz (legacy `taskType: 'quiz'`, `quizType: 'code_lines'`): a read-only, numbered
// code block; the student taps the line (or `pick` lines) the question asks for, then Check.
// State: the picked line numbers, "3" for one, a JSON array "[4,5]" (in pick order) for more, ''
// before picking: the same currentAnswer field as every quiz, so the tutor sees the pick live.
// Helpers and lesson rules: ./lines.js.
import { defineQuizActivity, printTable } from '../quiz/quizActivity.js'
import {
  codeRows,
  correctLinesOf,
  encodeLinePicks,
  gradeLinePicks,
  linesLabel,
  parseLinePicks,
} from './lines.js'

const field = (name, type, description, extra = {}) => ({
  name,
  type,
  authored: true,
  description,
  ...extra,
})

export default defineQuizActivity('code_lines', {
  label: 'Click the line',
  description: 'Tap the line (or lines) of a numbered code block that answer the question.',
  fields: {
    task: [
      field(
        'code',
        'string',
        'The program, shown numbered and read-only (no line numbers in it).',
        {
          required: true,
        }
      ),
      field('language', 'string', 'Colouring: python (default), html, css or js.'),
      field('correctLines', 'array', 'The right line numbers, from 1: [3], or [4, 5].', {
        required: true,
      }),
      field('pick', 'number', 'How many lines to pick; defaults to the length of correctLines.'),
      field('explanation', 'string', 'One line saying why, shown after Check.'),
      field(
        'lineFeedback',
        'object',
        'Line number to the words shown when that wrong line is picked.'
      ),
      field('feedback', 'string', 'Shown for a wrong pick with no lineFeedback.'),
    ],
  },
  sealedFields: ['correctLines', 'lineFeedback', 'explanation'],

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'code_lines',
    explainer: prev.explainer ?? 'This program crashes. Which line is wrong?',
    language: 'python',
    code: 'name = "Ava"\nprint("Hello, " + name)\nprint("Age: " + 10)',
    correctLines: [3],
    explanation: 'Line 3 adds a word and a number, and Python cannot.',
    check: null,
  }),

  initialState: () => '',
  solutionState: (task) => encodeLinePicks(correctLinesOf(task)),
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Only lines the code still has are an answer (a block shortened since drops the rest).
  deserialize: (raw, task) =>
    encodeLinePicks(parseLinePicks(raw).filter((n) => n <= codeRows(task).length)),
  grade: gradeLinePicks,
  summarize: (task, state) => ({ text: linesLabel(parseLinePicks(state)), tone: 'neutral' }),
  printHtml: (task, { esc }) =>
    printTable(
      'Lines',
      ['Line', 'Code', 'Answer'],
      codeRows(task).map((code, i) => [
        i + 1,
        code,
        correctLinesOf(task).includes(i + 1) ? 'Yes' : '',
      ]),
      esc
    ),
})
