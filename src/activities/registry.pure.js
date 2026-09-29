// Node-safe activity registry: every activity's pure definition.js. Imported by the CLI,
// validation, reports, print and YAML conversion. The UI registry (registry.js, added with the
// activity host) merges each definition with its ui.jsx.
//
// To add an activity: create src/activities/<id>/definition.js and add one import here (and one
// in registry.js once it exists). activityInterface.test.js checks every folder is registered.
import binary from './binary/definition.js'
import keyboard from './keyboard/definition.js'
import mouse from './mouse/definition.js'
import quizMultipleChoice from './quiz_multiple_choice/definition.js'
import quizMatch from './quiz_match/definition.js'
import quizFillBlank from './quiz_fill_blank/definition.js'
import quizShortAnswer from './quiz_short_answer/definition.js'
import quizConfidence from './quiz_confidence/definition.js'
import codeArrange from './code_arrange/definition.js'
import unknown from './unknown/definition.js'
import { UNKNOWN_ACTIVITY_ID, getActivityId } from './resolve.js'

const ACTIVITIES = [
  binary,
  keyboard,
  mouse,
  quizMultipleChoice,
  quizMatch,
  quizFillBlank,
  quizShortAnswer,
  quizConfidence,
  codeArrange,
  unknown,
]

const BY_ID = new Map()
for (const activity of ACTIVITIES) {
  if (BY_ID.has(activity.id)) throw new Error(`Duplicate activity id "${activity.id}"`)
  BY_ID.set(activity.id, activity)
}

// Every registered activity except the internal fallback, including the legacy quiz sub-types
// (authored as `taskType: 'quiz'` + `quizType`; see each definition's `legacy`).
export const ACTIVITY_IDS = Object.freeze(
  ACTIVITIES.map((activity) => activity.id).filter((id) => id !== UNKNOWN_ACTIVITY_ID)
)

export function getActivityDefinitions() {
  return ACTIVITIES.filter((activity) => activity.id !== UNKNOWN_ACTIVITY_ID)
}

export function getActivityDefinition(id) {
  return BY_ID.get(id) ?? null
}

// The definition for a stored task. Tasks resolving to an id this bundle doesn't have get the
// fallback; tasks that aren't activities (code, information, draft) get null. Legacy quiz tasks
// resolve to their quiz_<type> definition and code_arrange tasks to code_arrange (hosted by a
// workspace module, see getModuleHostedActivity).
export function getTaskActivity(task) {
  const id = getActivityId(task)
  if (id === null) return null
  // An activityType (or quizType) this bundle doesn't know gets the "not available" fallback.
  return BY_ID.get(id) ?? BY_ID.get(UNKNOWN_ACTIVITY_ID)
}

// An activity that runs inside a workspace module (its definition's `hostModules`) rather than
// ActivityHost: code_arrange's assembled program goes through the python / html module's own
// work slot, Run and checks, so the task stays a code task (Run, sandbox, share, carry-through
// source) with the activity's surface in place of the module's StudentWorkspace. Null for
// every other task.
export function getModuleHostedActivity(task) {
  const activity = getTaskActivity(task)
  return activity?.hostModules ? activity : null
}

export function isModuleHostedActivityTask(task) {
  return getModuleHostedActivity(task) !== null
}

// The Builder's extra task formats (Arrange): module-hosted activities, each offered where its
// definition's availableIn(lesson) allows (composed lessons for code_arrange).
export function getModuleHostedActivityDefinitions() {
  return getActivityDefinitions().filter((activity) => activity.hostModules)
}

// YAML `type:` shorthand → activity id (e.g. `type: binary`). Legacy quizzes keep their own
// `type: quiz` + `quizType` YAML (cli/yaml-converter.mjs), so they are not shorthands.
export function activityIdForYamlType(type) {
  if (typeof type !== 'string' || !type) return null
  return (
    getActivityDefinitions().find((activity) => !activity.legacy && activity.yaml?.type === type)
      ?.id ?? null
  )
}

// The YAML `type:` shorthand for a stored `taskType: 'activity'` task, or null when the task
// isn't one this bundle knows (an unknown activityType keeps its explicit fields).
export function yamlTypeForActivityTask(task) {
  if (task?.taskType !== 'activity') return null
  const activity = BY_ID.get(task.activityType)
  if (!activity || activity.legacy || activity.id === UNKNOWN_ACTIVITY_ID) return null
  return activity.yaml?.type ?? null
}

// The Builder's quiz-type picker: the legacy quiz sub-types (category 'quiz'), in registry order.
export function getQuizActivityDefinitions() {
  return getActivityDefinitions().filter((activity) => activity.category === 'quiz')
}

// The Builder's activity gallery: every `taskType: 'activity'` activity (not the quizzes).
export function getGalleryActivityDefinitions() {
  return getActivityDefinitions().filter(
    (activity) => !activity.legacy && activity.category !== 'quiz'
  )
}

// The Builder task format a stored task belongs to: 'information', 'quiz' (legacy quiz
// sub-types), 'activity' (taskType 'activity', including an unknown activityType), a
// module-hosted activity's own id ('code_arrange') or 'code'. 'draft' tasks report their own
// taskType.
export function getTaskFormat(task) {
  if (!task) return 'code'
  if (task.taskType === 'information' || task.taskType === 'draft') return task.taskType
  const moduleHosted = getModuleHostedActivity(task)
  if (moduleHosted) return moduleHosted.id
  if (isLegacyQuizTask(task)) return 'quiz'
  if (getTaskActivity(task)) return 'activity'
  return 'code'
}

// Tasks rendered by ActivityHost: a full-screen activity surface, never a code task (no Run,
// personal sandbox, share or carry) — `taskType: 'activity'` and legacy quiz tasks. Activities
// hosted by a workspace module (code_arrange) are code tasks and are not included.
export function isHostedActivityTask(task) {
  if (!task) return false
  const activity = getTaskActivity(task)
  return activity !== null && !activity.hostModules
}

// A legacy `taskType: 'quiz'` task (any quizType). Quizzes keep a few quiz-only surfaces (the
// quiz feedback banner rules, the StudentModal header), so callers ask this rather than
// comparing taskType.
export function isLegacyQuizTask(task) {
  return getTaskActivity(task)?.legacy?.taskType === 'quiz'
}

// Whether a teacher may broadcast a STUDENT's work to the class ("Go Live for All") on this
// task. Quiz and activity tasks only allow the teacher's own broadcast; module-hosted activities
// (code_arrange) keep student broadcast because their board is code the class can learn from.
export function allowsStudentBroadcast(task) {
  const activity = getTaskActivity(task)
  return activity === null || !!activity.hostModules
}
