// Multiple-choice quiz (legacy `taskType: 'quiz'`, `quizType: 'multiple_choice'` or no
// quizType). State: the chosen option id, '' before answering. Choosing an option submits it.
import {
  defineQuizActivity,
  gradeAnswerCheck,
  gradeResult,
  printTable,
} from '../quiz/quizActivity.js'
import {
  isHttpsUrl,
  quizHasPictureOptions,
  quizOptionDescription,
} from '../../shared/quizPictureOptions.js'

function optionIds(task) {
  return (task?.options ?? []).map((option) => option.id)
}

export default defineQuizActivity('multiple_choice', {
  description: 'Pick one answer from a list of options.',

  fields: {
    task: [
      {
        name: 'options',
        type: 'array',
        required: true,
        authored: true,
        description: 'At least 2 (2 to 4 when any option has a picture).',
        itemFields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'text',
            type: 'string',
            authored: true,
            description: 'Required, except on a picture option, where it is an optional caption.',
          },
          {
            name: 'image',
            type: 'string',
            authored: true,
            description: 'Picture option: an https URL (a lesson asset). Needs `alt`.',
          },
          {
            name: 'emoji',
            type: 'string',
            authored: true,
            description: 'Picture option: one emoji as the picture. Needs `alt`.',
          },
          {
            name: 'alt',
            type: 'string',
            authored: true,
            description: 'What the picture shows. Required with `image` or `emoji`.',
          },
          { name: 'feedback', type: 'string', authored: true },
          { name: 'hint', type: 'string', authored: true },
        ],
      },
      {
        name: 'check',
        type: 'object',
        required: true,
        authored: true,
        description: '{ type: answer_equals, value: <option id> }; YAML shorthand `answer`.',
      },
      { name: 'feedback', type: 'string', authored: true, description: 'Fallback feedback.' },
    ],
  },
  // `answer: <option-id>` in YAML is this quiz's `check: { type: answer_equals }`.
  yaml: Object.freeze({ type: 'quiz', quizType: 'multiple_choice', answerShorthand: true }),

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    explainer: prev.explainer ?? '',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ],
    check: { type: 'answer_equals', value: 'a' },
  }),

  initialState: () => '',
  solutionState: (task) => (task?.check?.type === 'answer_equals' ? (task.check.value ?? '') : ''),
  // The answer is in `check`; per-option `feedback` often gives it away too.
  sealedFields: ['options'],
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Only an id the task still offers is an answer (an option removed since is dropped).
  deserialize: (raw, task) => (typeof raw === 'string' && optionIds(task).includes(raw) ? raw : ''),

  grade: (task, answer) => gradeResult(task, answer, gradeAnswerCheck(task, answer)),

  summarize: (task, state) => {
    const option = (task?.options ?? []).find((candidate) => candidate.id === state)
    return {
      text: `${state} ${quizOptionDescription(option) || 'Selected answer'}`,
      tone: 'neutral',
    }
  },

  // Printed only for tasks that name their quizType (unchanged print output). Picture options
  // add a Picture column and the alt text.
  printHtml: (task, { esc }) =>
    task.quizType !== 'multiple_choice' || !task.options?.length
      ? ''
      : quizHasPictureOptions(task)
        ? printPictureOptions(task, esc)
        : printTable(
            'Options',
            ['ID', 'Text', 'Feedback'],
            task.options.map((opt) => [opt.id, opt.text, opt.feedback || '']),
            esc
          ),
})

function printPictureOptions(task, esc) {
  const head = ['ID', 'Picture', 'Caption', 'Alt text', 'Feedback']
    .map((header) => `<th>${header}</th>`)
    .join('')
  const rows = task.options
    .map((opt) => {
      const picture = isHttpsUrl(opt.image)
        ? `<img src="${esc(opt.image.trim())}" alt="${esc(opt.alt)}" style="max-width:120px;max-height:90px;object-fit:contain">`
        : opt.emoji
          ? `<span style="font-size:2em" role="img" aria-label="${esc(opt.alt)}">${esc(opt.emoji)}</span>`
          : ''
      const cells = [opt.id, null, opt.text ?? '', opt.alt ?? '', opt.feedback || '']
      return `<tr>${cells.map((cell) => (cell === null ? `<td>${picture}</td>` : `<td>${esc(cell)}</td>`)).join('')}</tr>`
    })
    .join('')
  return `<div class="field"><div class="field-label">Options</div><table class="data-table"><tr>${head}</tr>${rows}</table></div>`
}
