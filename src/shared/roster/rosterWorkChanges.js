// Class roster: which matched students have new work for the tutor's client to save (pure).
// The tutor never saves per keystroke: only a new Run (the student node's `lastRunAt` with a
// `lastRunStatus`, read from `currentCode` / `currentFiles`) or a new attempt (an `attemptLog`
// entry or retry, auto-check-on-leave entries included) counts as a change.
import { getModuleDefinition } from '../../modules/definitions.js'
import { getEffectiveLessonForTask, isCodeTask } from '../composedLesson.js'
import { flattenTasks } from '../taskUtils.js'
import { getTaskActivity, isHostedActivityTask } from '../../activities/registry.pure.js'
import { deserializeActivityState, studentStateField } from '../../activities/state.js'
import {
  extractRosterWork,
  hashText,
  makeRosterSlotWorkId,
  makeRosterWorkId,
  resolveSourceIds,
} from './rosterModel.js'

function findTask(lesson, taskId) {
  return (
    flattenTasks(lesson?.tasks ?? []).find((task) => String(task?.id) === String(taskId)) ?? null
  )
}

// The module definition whose roster work a task saves, or null (information tasks, activities
// and quizzes, and modules with no `capabilities.rosterWork`). Composed lessons resolve each
// task's own module type.
export function rosterWorkDefinition(lesson, task) {
  if (!task || !isCodeTask(task)) return null
  const type = getEffectiveLessonForTask(lesson, task)?.type
  const definition = getModuleDefinition(type)
  return definition?.capabilities?.rosterWork ? definition : null
}

// The roster work of an activity carry slot (`definition.carrySlot`) from a student's mirrored
// state (`students/{id}/currentAnswer`): { kind: 'activity_slot', slotId, state }, or null when
// there is nothing to save (no mirrored state yet, or `extract` returned null/undefined).
export function extractActivitySlotWork(definition, task, raw) {
  const slot = definition?.carrySlot
  if (!slot || typeof raw !== 'string' || raw === '') return null
  let state
  try {
    state = slot.extract(deserializeActivityState(definition, task, raw))
  } catch {
    return null
  }
  return state == null ? null : { kind: 'activity_slot', slotId: slot.id, state }
}

// The slot candidate for one matched student, or null: their mirrored state on the class's
// current task when that task's activity has a `carrySlot`. Keyed per slot (not per task), so
// the latest state in any lesson is the one that is saved (`slot__<slotId>`). Not in a sandbox.
function slotCandidate({ session, lesson, lessonId, anonymousId, rosterId }) {
  if (session.state !== 'active') return null
  const student = session.students?.[anonymousId]
  if (!student || student.inPersonalSandbox) return null
  const task = findTask(lesson, session.currentTaskId)
  if (!task || !isHostedActivityTask(task)) return null
  const definition = getTaskActivity(task)
  const slot = definition?.carrySlot
  const workId = makeRosterSlotWorkId(slot?.id)
  if (!workId) return null
  const raw = student[studentStateField(definition)]
  if (typeof raw !== 'string' || raw === '') return null
  const { sourceLessonId, sourceTaskId } = resolveSourceIds(lesson, lessonId, task.id)
  return {
    key: `${anonymousId}:slot:${slot.id}`,
    // The state's own text is the change marker; there is no timestamp, so `at` is 0 (nothing
    // else competes for this key).
    trigger: `${rosterId}:slot:${hashText(raw)}`,
    anonymousId,
    rosterId,
    taskId: task.id,
    origin: 'slot',
    at: 0,
    moduleType: 'activity',
    workId,
    sourceLessonId,
    sourceTaskId,
    extract: () => extractActivitySlotWork(definition, task, raw),
  }
}

function latestAttempt(entries) {
  let best = null
  for (const [pushId, entry] of Object.entries(entries ?? {})) {
    if (!entry || typeof entry.submission !== 'string') continue
    const at = Number(entry.loggedAt) || 0
    if (!best || at >= best.at) best = { pushId, entry, at }
  }
  return best
}

// One candidate per matched student per task, the most recent of their last Run on the class's
// current task and their latest attempt on each task:
// { key, trigger, anonymousId, rosterId, taskId, origin, at, moduleType, workId, sourceLessonId,
//   sourceTaskId, extract() }. `trigger` changes exactly when there is something new to save;
// `extract()` reads the work only when the caller needs it (Scratch state is parsed there).
// `matches` is { anonymousId: rosterId } (activeRosterMatches).
export function collectRosterWorkCandidates({ session, lesson, lessonId, matches }) {
  const result = []
  if (!session || !lesson) return result
  for (const [anonymousId, rosterId] of Object.entries(matches ?? {})) {
    if (!rosterId) continue
    const byTask = new Map()
    const consider = (candidate) => {
      const previous = byTask.get(String(candidate.taskId))
      if (!previous || candidate.at >= previous.at) byTask.set(String(candidate.taskId), candidate)
    }

    for (const [taskId, entries] of Object.entries(session.attemptLog?.[anonymousId] ?? {})) {
      const task = findTask(lesson, taskId)
      const definition = rosterWorkDefinition(lesson, task)
      const latest = latestAttempt(entries)
      if (!definition || !latest) continue
      consider({
        taskId: task.id,
        definition,
        origin: latest.entry.auto ? 'leave' : 'submission',
        at: latest.at,
        trigger: `attempt:${latest.pushId}:${latest.entry.retries ?? 0}`,
        extract: () => extractRosterWork(definition, { submission: latest.entry.submission }),
      })
    }

    // The last Run belongs to the class's current task; not in a session sandbox or the
    // student's personal sandbox, whose runs aren't task work. setTaskId clears lastRunStatus.
    const student = session.students?.[anonymousId]
    if (
      session.state === 'active' &&
      student &&
      !student.inPersonalSandbox &&
      student.lastRunStatus &&
      student.lastRunAt
    ) {
      const task = findTask(lesson, session.currentTaskId)
      const definition = rosterWorkDefinition(lesson, task)
      const snapshot = {
        currentCode: student.currentCode,
        currentFiles: student.currentFiles,
      }
      if (definition) {
        consider({
          taskId: task.id,
          definition,
          origin: 'run',
          at: Number(student.lastRunAt) || 0,
          trigger: `run:${student.lastRunAt}`,
          extract: () => extractRosterWork(definition, { student: snapshot }),
        })
      }
    }

    for (const candidate of byTask.values()) {
      const { sourceLessonId, sourceTaskId } = resolveSourceIds(lesson, lessonId, candidate.taskId)
      const workId = makeRosterWorkId(sourceLessonId, sourceTaskId)
      if (!workId) continue
      result.push({
        key: `${anonymousId}:${candidate.taskId}`,
        trigger: `${rosterId}:${candidate.trigger}`,
        anonymousId,
        rosterId,
        taskId: candidate.taskId,
        origin: candidate.origin,
        at: candidate.at,
        moduleType: candidate.definition.type,
        workId,
        sourceLessonId,
        sourceTaskId,
        extract: candidate.extract,
      })
    }

    const slot = slotCandidate({ session, lesson, lessonId, anonymousId, rosterId })
    if (slot) result.push(slot)
  }
  return result
}

// The candidates with something new for their key: a different trigger, and not older than the
// work last queued for that key (`seen`: a Map of key → { trigger, at }, which the caller
// updates with markRosterWorkSeen once it has queued them). The age check stops an older attempt
// replacing a later Run once setTaskId clears the Run (attempts stop being logged after a pass).
export function changedRosterWorkCandidates(candidates, seen) {
  return candidates.filter((candidate) => {
    const previous = seen.get(candidate.key)
    if (!previous) return true
    return previous.trigger !== candidate.trigger && candidate.at >= previous.at
  })
}

export function markRosterWorkSeen(seen, candidate) {
  seen.set(candidate.key, { trigger: candidate.trigger, at: candidate.at })
}
