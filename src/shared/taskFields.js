// Task fields that don't belong to one module or activity, as data (./fieldSpec.js): the common
// fields every task can carry, and the non-module task types. Module definitions declare their
// own fields (`taskFields`) and activities theirs (`fields`); `lessons capabilities` lists all
// three so lesson tooling doesn't keep its own field lists. Pure.
import { normaliseFieldSpecs } from './fieldSpec.js'

const specs = (list, where) => normaliseFieldSpecs(list, { where })

export const COMMON_TASK_FIELDS = specs(
  [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', authored: true },
    {
      name: 'explainer',
      type: 'string',
      authored: true,
      description: 'Markdown shown to the student (a quiz question for quizzes).',
    },
    { name: 'description', type: 'string', authored: true },
    {
      name: 'taskType',
      type: 'string',
      description: 'information, quiz, code_arrange, activity; omitted for module tasks.',
    },
    {
      name: 'moduleType',
      type: 'string',
      description: 'The workspace module in composed lessons.',
    },
    { name: 'activityType', type: 'string', description: 'With taskType: activity.' },
    { name: 'quizType', type: 'string', description: 'With taskType: quiz.' },
    {
      name: 'check',
      type: 'object',
      authored: true,
      description: 'Completion check (one or a list).',
    },
    { name: 'feedbackChecks', type: 'array', authored: true },
    {
      name: 'taskActivity',
      type: 'string',
      authored: true,
      description:
        'Teacher-only Lesson Format Glossary type, e.g. "Code Task, Debug Code Task" (see taskActivity in capabilities).',
    },
    {
      name: 'badgeHints',
      type: 'object',
      description: '{ suggest: [badgeId], suppress: [badgeId] } (docs/authoring/badges.md).',
    },
    {
      name: 'intent',
      type: 'string',
      authored: true,
      description: 'What the task should do; required while the lesson is a draft.',
    },
    { name: 'topicLinks', type: 'array' },
    { name: 'estimatedMinutes', type: 'number' },
    { name: 'priority', type: 'string' },
    { name: 'taskMode', type: 'string' },
    { name: 'allowSharing', type: 'boolean' },
    {
      name: 'peerHints',
      type: 'array',
      authored: true,
      description:
        'Extra preset hints a classmate can send when helping on this task (peer help); up to 10 short strings.',
    },
  ],
  'COMMON_TASK_FIELDS'
)

// Task types that aren't a module or an activity. Groups are containers, not tasks.
export const TASK_TYPE_FIELDS = Object.freeze({
  information: specs(
    [
      {
        name: 'informationType',
        type: 'string',
        values: ['standard', 'recap', 'introduction', 'badges'],
      },
      {
        name: 'explainer',
        type: 'string',
        required: true,
        authored: true,
        description: 'Required unless informationType is introduction or badges.',
      },
      { name: 'leftContent', type: 'string', authored: true, description: 'Recap only.' },
    ],
    'TASK_TYPE_FIELDS.information'
  ),
  group: specs(
    [
      { name: 'id', type: 'string', required: true },
      { name: 'type', type: 'string', required: true, values: ['group'] },
      { name: 'title', type: 'string', authored: true },
      { name: 'subtasks', type: 'array', required: true },
    ],
    'TASK_TYPE_FIELDS.group'
  ),
})

// `codeStages` for a module whose stages carry `payload` (FieldSpecs besides label/role).
export function codeStagesField(payload) {
  return {
    name: 'codeStages',
    type: 'array',
    authored: true,
    description: 'Starter / Support / Complete stages.',
    itemFields: [
      { name: 'label', type: 'string', required: true, authored: true },
      { name: 'role', type: 'string', values: ['starter', 'support', 'complete'] },
      ...payload,
    ],
  }
}
