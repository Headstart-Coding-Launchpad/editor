// Reading an activity's state back from its serialised form (localStorage aux file,
// students/{id}/currentAnswer, teacherLive.answer, teacherAnswerEdit.answer). Shared by the
// student host, the teacher card/modal and the teacher-live display. Pure.
import { getTaskActivity } from './registry.pure.js'

// Tolerant load: a definition's deserialize is already tolerant; this also guards one that
// throws, and always returns the activity's initial state rather than null.
export function deserializeActivityState(definition, task, raw) {
  if (!definition) return null
  try {
    return definition.deserialize(raw ?? '', task) ?? definition.initialState(task)
  } catch {
    return definition.initialState(task)
  }
}

export function solutionOrInitialState(definition, task) {
  return definition?.solutionState
    ? definition.solutionState(task)
    : (definition?.initialState(task) ?? null)
}

// The state a stored answer string represents for a task, or null for non-activity tasks.
export function readActivityAnswer(task, raw) {
  return deserializeActivityState(getTaskActivity(task), task, raw)
}

// The students/{id} field an activity mirrors its live state to: `currentAnswer` for the
// default 'answer' channel, `current<Channel>` otherwise (code_arrange's 'codeArrangeSlots'
// channel → `currentCodeArrangeSlots`).
export function studentStateField(definition) {
  const channel = definition?.liveChannel || 'answer'
  return `current${channel[0].toUpperCase()}${channel.slice(1)}`
}

// The state a student's mirrored record holds for a task, or null for non-activity tasks.
export function readStudentActivityState(task, student) {
  const definition = getTaskActivity(task)
  if (!definition) return null
  return deserializeActivityState(definition, task, student?.[studentStateField(definition)])
}

// Teacher-card summary ({ text, tone }) of a student's mirrored answer, or null.
export function summarizeActivityAnswer(task, raw) {
  const definition = getTaskActivity(task)
  if (!definition) return null
  const hasAnswer = raw != null && raw !== ''
  if (!hasAnswer) return { text: 'Not started', tone: 'neutral' }
  try {
    return definition.summarize(task, deserializeActivityState(definition, task, raw)) ?? null
  } catch {
    return null
  }
}
