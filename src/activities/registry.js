// UI activity registry: each pure definition (registry.pure.js) merged with its ui.jsx
// ({ StudentView, TeacherLiveView?, BuilderEditor?, CardSummary? }). Imported by the classroom
// (ActivityHost, teacher views) — never by the CLI.
//
// To add an activity: add its definition import to registry.pure.js and its ui import here.
import { getActivityDefinition, getTaskActivity } from './registry.pure.js'
import binaryUi from './binary/ui.jsx'
import keyboardUi from './keyboard/ui.jsx'
import mouseUi from './mouse/ui.jsx'

export const ACTIVITY_UIS = Object.freeze({
  binary: binaryUi,
  keyboard: keyboardUi,
  mouse: mouseUi,
})

const merged = new Map()

function withUi(definition) {
  if (!definition) return null
  if (!merged.has(definition.id)) {
    merged.set(definition.id, Object.freeze({ ...definition, ...(ACTIVITY_UIS[definition.id] ?? {}) }))
  }
  return merged.get(definition.id)
}

export function getActivityUi(id) {
  return withUi(getActivityDefinition(id))
}

// The merged definition + UI for a stored task (the unknown fallback has no StudentView and
// renders ActivityHost's "not available" notice), or null for a non-activity task.
export function getTaskActivityUi(task) {
  return withUi(getTaskActivity(task))
}
