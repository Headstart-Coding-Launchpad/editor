// Node-safe activity registry: every activity's pure definition.js. Imported by the CLI,
// validation, reports, print and YAML conversion. The UI registry (registry.js, added with the
// activity host) merges each definition with its ui.jsx.
//
// To add an activity: create src/activities/<id>/definition.js and add one import here (and one
// in registry.js once it exists). activityInterface.test.js checks every folder is registered.
import binary from './binary/definition.js'
import keyboard from './keyboard/definition.js'
import mouse from './mouse/definition.js'
import unknown from './unknown/definition.js'
import { UNKNOWN_ACTIVITY_ID, getActivityId } from './resolve.js'

const ACTIVITIES = [binary, keyboard, mouse, unknown]

const BY_ID = new Map()
for (const activity of ACTIVITIES) {
  if (BY_ID.has(activity.id)) throw new Error(`Duplicate activity id "${activity.id}"`)
  BY_ID.set(activity.id, activity)
}

// Activities an author can pick (the fallback is internal).
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
// fallback; tasks that aren't activities (code, information, draft) get null. Legacy quiz and
// code_arrange ids resolve to null until their definitions are registered (plan 2.2 / 4.9).
export function getTaskActivity(task) {
  const id = getActivityId(task)
  if (id === null) return null
  if (BY_ID.has(id)) return BY_ID.get(id)
  return task.taskType === 'activity' ? BY_ID.get(UNKNOWN_ACTIVITY_ID) : null
}

// YAML `type:` shorthand → activity id (e.g. `type: binary`).
export function activityIdForYamlType(type) {
  return ACTIVITIES.find((activity) => activity.yaml?.type === type)?.id ?? null
}
