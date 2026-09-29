// Match quiz (legacy `taskType: 'quiz'`, `quizType: 'match'`). State: { [pairId]: placedPairId }.
// Placing the last answer submits the board; the teacher can edit a student's placements.
import { parseQuizAnswerState } from '../../shared/quizAnswers.js'
import {
  defineQuizActivity,
  getQuizSuggestion,
  itemsSummaryText,
  normalizeMatchReportSubmission,
  printTable,
  quizItemProgress,
  summarizeItemFailures,
} from '../quiz/quizActivity.js'

export default defineQuizActivity('match', {
  description: 'Drag each answer to the prompt it matches.',
  completion: 'auto',
  teacherEditable: true,

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'match',
    explainer: prev.explainer ?? '',
    pairs: [
      { id: 'p1', prompt: 'Prompt 1', answer: 'Answer 1' },
      { id: 'p2', prompt: 'Prompt 2', answer: 'Answer 2' },
    ],
    check: null,
  }),

  initialState: () => ({}),
  solutionState: (task) => Object.fromEntries((task?.pairs ?? []).map((p) => [p.id, p.id])),
  serialize: (state) => JSON.stringify(state ?? {}),
  deserialize: (raw) => parseQuizAnswerState(raw),

  grade: (task, state) => {
    const answer = parseQuizAnswerState(state)
    const passed = (task?.pairs ?? []).every((pair) => answer[pair.id] === pair.id)
    return { passed, suggestion: passed ? '' : getQuizSuggestion(task, state) }
  },

  getProgress: (task, state) => quizItemProgress(task, state, task?.pairs ?? []),
  summarize: (task, state, result) => ({ text: itemsSummaryText(result), tone: 'neutral' }),

  report: {
    typeFields: () => ({ taskType: 'quiz', quizType: 'match' }),
    normalizeSubmission: normalizeMatchReportSubmission,
    summaryFields: (task, perStudent) => ({
      pairFailures: summarizeItemFailures(
        perStudent,
        task.pairs ?? [],
        (submission) => normalizeMatchReportSubmission(task, submission),
        'pairId',
        (pair) => ({ prompt: pair.prompt ?? '', expected: pair.answer ?? '' })
      ),
    }),
  },

  printHtml: (task, { esc }) =>
    task.pairs?.length
      ? printTable(
          'Pairs',
          ['Prompt', 'Answer'],
          task.pairs.map((p) => [p.prompt, p.answer]),
          esc
        )
      : '',
})
