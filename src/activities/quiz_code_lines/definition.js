// Click-the-line quiz (legacy `taskType: 'quiz'`, `quizType: 'code_lines'`): a read-only, numbered
// code block; the student taps the line (or `pick` lines) the question asks for, then Check.
// State: the picked line numbers, "3" for one, a JSON array "[4,5]" (in pick order) for more, ''
// before picking: the same currentAnswer field as every quiz, so the tutor sees the pick live.
// Helpers and lesson rules: ./lines.js.
import { defineQuizActivity, printTable } from '../quiz/quizActivity.js'
import * as lines from './lines.js'

// [name, type, description, required]
const FIELDS = [
  ['code', 'string', 'The program, shown numbered and read-only (no line numbers in it).', true],
  ['language', 'string', 'Colouring: python (default), html, css or js.'],
  ['correctLines', 'array', 'The right line numbers, from 1: [3], or [4, 5].', true],
  ['pick', 'number', 'How many lines to pick; defaults to the length of correctLines.'],
  ['explanation', 'string', 'One line saying why, shown after Check.'],
  ['lineFeedback', 'object', 'Line number to the words shown when that wrong line is picked.'],
  ['feedback', 'string', 'Shown for a wrong pick with no lineFeedback.'],
]

export default defineQuizActivity('code_lines', {
  label: 'Click the line',
  description: 'Tap the line (or lines) of a numbered code block that answer the question.',
  fields: {
    task: FIELDS.map(([name, type, description, required]) => ({
      ...{ name, type, authored: true, description },
      ...(required ? { required } : {}),
    })),
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
  solutionState: (task) => lines.encodeLinePicks(lines.correctLinesOf(task)),
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Only lines the code still has are an answer (a block shortened since drops the rest).
  deserialize: (raw, task) => lines.encodeLinePicks(lines.parseLinePicks(raw, task)),
  grade: lines.gradeLinePicks,
  // Try again turns a checked answer back into a draft (the tutor stops seeing a verdict).
  retryClearsCheck: true,
  summarize: (task, state) => ({
    text: lines.linesLabel(lines.parseLinePicks(state, task)) || 'No line picked',
    tone: 'neutral',
  }),
  printHtml: (task, { esc }) => {
    const right = lines.correctLinesOf(task)
    const rows = lines
      .codeRows(task)
      .map((code, i) => [i + 1, code, right.includes(i + 1) ? 'Yes' : ''])
    return printTable('Lines', ['Line', 'Code', 'Answer'], rows, esc)
  },
})
