// Cross-lesson carry (W3-a, Ryan 2026-10-14): a task starts from the student's own saved work
// on a task in an EARLIER lesson (two-lesson projects: Lesson 12 starts from each student's own
// Lesson 11 program). Pure and Node-safe; the Firebase side is crossLessonCarryService.js.
//
// Authoring: `carryCodeFromLesson: { lesson, task }` (code and files modules) or
// `carryBlocksFromLesson: { lesson, task }` (Scratch). The field is the module's in-lesson carry
// field plus "Lesson" (`carryThroughField` + 'Lesson'), on modules that save roster work
// (`capabilities.rosterWork`). `lesson` is the STOCK lesson id and `task` the stock task id: the
// roster saver keys work by stock ids (rosterModel's resolveSourceIds), so a class fork of
// Lesson 12 finds the work saved from a class fork of Lesson 11.
//
// Identity is tutor-mediated: students never read the roster. The tutor's client reads each
// matched student's saved work (rosterService.getSavedWork) and writes it to
//   carryInbox/{lessonId}/{anonymousId}/{taskId}           { kind, payload, … }  (teacher write,
//                                                           the student reads their own)
//   sessions/{lessonId}/carryStatus/{anonymousId}/{taskId} { status, … }        (teacher write,
//                                                           read with the session)
// status: 'found' (work in the inbox) | 'none' (nothing saved) | 'starter' (the tutor chose
// "Use the starter"). A live student on such a task with no status and no saved work of their
// own HOLDS ("Waiting for your tutor to find your Lesson 11 work…"). Solo, the presentation
// window, the Builder preview and "No class" sessions never hold: they use the starter.
// No localStorage scanning (shared-device risk).
//
// Activity carry slots (an activity definition's `carrySlot`, docs/architecture/activities.md)
// ride the same route: a hosted activity task whose activity has a `carrySlot` is a carry task
// with kind 'activity_slot' and no source lesson/task. Its work is saved under the fixed roster
// work id `slot__<slotId>` (latest wins, whichever lesson it came from); the inbox entry and
// status are the same.

import { getModuleDefinition, getModuleDefinitions } from '../../modules/definitions.js'
import { getEffectiveLessonForTask, isCodeTask } from '../composedLesson.js'
import { getTaskActivity, isHostedActivityTask } from '../../activities/registry.pure.js'
import { flattenTasks } from '../taskUtils.js'
import { isPlainObject } from '../textUtils.js'
import { makeRosterSlotWorkId } from './rosterModel.js'

export const CARRY_INBOX_ROOT = 'carryInbox'
// The inbox payload is one JSON string. RTDB rules cap it at this many characters, well under
// RTDB's per-write limit; bigger work is reported as 'none' (reason 'too_large').
export const CARRY_INBOX_MAX_CHARS = 1_000_000
export const CARRY_STATUSES = Object.freeze(['found', 'none', 'starter'])

// What a student's task does about its cross-lesson carry (resolveCrossLessonCarry):
// 'off'      the task has no cross-lesson carry;
// 'own'      the student already has saved work for this task: it wins;
// 'solo'     no live tutor (solo, presentation window, Builder preview, sandbox): starter;
// 'no_class' the live session has "No class": starter;
// 'hold'     waiting for the tutor (no status yet);
// 'found' | 'none' | 'starter'  the tutor's status.
export const CARRY_OUTCOMES = Object.freeze([
  'off',
  'own',
  'solo',
  'no_class',
  'hold',
  'found',
  'none',
  'starter',
])

// ── Fields ────────────────────────────────────────────────────────────────────

// The module's cross-lesson carry field (`carryCodeFromLesson`, `carryBlocksFromLesson`), or
// null when the module saves no roster work (so nothing could ever be carried).
export function crossLessonCarryField(definition) {
  if (!definition?.capabilities?.rosterWork || !definition.carryThroughField) return null
  return `${definition.carryThroughField}Lesson`
}

// Every distinct cross-lesson carry field, in registry order.
export const CROSS_LESSON_CARRY_FIELDS = Object.freeze([
  ...new Set(getModuleDefinitions().map(crossLessonCarryField).filter(Boolean)),
])

function isTaskId(value) {
  return (
    (typeof value === 'number' && Number.isInteger(value) && value > 0) ||
    (typeof value === 'string' && value.trim() !== '')
  )
}

// `{ lesson, task }` → `{ lesson, task }` (trimmed lesson id), or null when it isn't usable.
export function normaliseCarrySpec(value) {
  if (!isPlainObject(value)) return null
  const lesson = typeof value.lesson === 'string' ? value.lesson.trim() : ''
  if (!lesson || !isTaskId(value.task)) return null
  return { lesson, task: value.task }
}

// The task's cross-lesson carry, or null: { field, kind, moduleType, sourceLessonId,
// sourceTaskId }. Composed lessons use the task's own module. A hosted activity task whose
// activity has a `carrySlot` carries too: { field: 'carrySlot', kind: 'activity_slot',
// moduleType: 'activity', slotId, slotWorkId, sourceLessonId: null, sourceTaskId: null }.
export function getCrossLessonCarry(lesson, task) {
  if (task && isHostedActivityTask(task)) return getActivitySlotCarry(task)
  if (!task || !isCodeTask(task)) return null
  const definition = getModuleDefinition(getEffectiveLessonForTask(lesson, task)?.type)
  const field = crossLessonCarryField(definition)
  const spec = field ? normaliseCarrySpec(task[field]) : null
  if (!spec) return null
  return {
    field,
    kind: definition.capabilities.rosterWork,
    moduleType: definition.type,
    sourceLessonId: spec.lesson,
    sourceTaskId: spec.task,
  }
}

// The activity carry slot of a hosted activity task, as a carry, or null.
export function getActivitySlotCarry(task) {
  const slot = task && isHostedActivityTask(task) ? getTaskActivity(task)?.carrySlot : null
  const slotWorkId = slot ? makeRosterSlotWorkId(slot.id) : null
  if (!slotWorkId) return null
  return {
    field: 'carrySlot',
    kind: 'activity_slot',
    moduleType: 'activity',
    slotId: slot.id,
    slotWorkId,
    sourceLessonId: null,
    sourceTaskId: null,
  }
}

// Every task in the lesson with a cross-lesson carry: [{ taskId, ...carry }].
export function listCrossLessonCarryTasks(lesson) {
  const result = []
  for (const task of flattenTasks(lesson?.tasks ?? [])) {
    const carry = getCrossLessonCarry(lesson, task)
    if (carry) result.push({ taskId: task.id, ...carry })
  }
  return result
}

// The distinct source lesson ids the lesson's cross-lesson carries name (for a source check).
export function crossLessonSourceIds(lesson) {
  return [
    ...new Set(
      listCrossLessonCarryTasks(lesson)
        .map((carry) => carry.sourceLessonId)
        .filter(Boolean)
    ),
  ]
}

// Soft authoring warnings about each cross-lesson carry's source, given the source lessons that
// could be read (`sourceLessons`: Map of lesson id → lesson, or null when it doesn't exist). A
// source that couldn't be checked (not in the map) is skipped. The CLI's publish runs this; the
// shared validator can't (it has no Firestore).
export function crossLessonCarrySourceWarnings(lesson, sourceLessons) {
  const warnings = []
  const flat = flattenTasks(lesson?.tasks ?? [])
  flat.forEach((task, i) => {
    const n = i + 1
    const carry = getCrossLessonCarry(lesson, task)
    if (!carry || !sourceLessons?.has(carry.sourceLessonId)) return
    const source = sourceLessons.get(carry.sourceLessonId)
    const { field, sourceLessonId, sourceTaskId } = carry
    if (!source) {
      warnings.push(
        `Task ${n} ${field}: lesson ${sourceLessonId} was not found, so every student will start from the starter`
      )
      return
    }
    const sourceTask = flattenTasks(source.tasks ?? []).find(
      (item) => String(item?.id) === String(sourceTaskId)
    )
    if (!sourceTask) {
      warnings.push(`Task ${n} ${field}: lesson ${sourceLessonId} has no task ${sourceTaskId}`)
      return
    }
    const sourceCarry = getModuleDefinition(getEffectiveLessonForTask(source, sourceTask)?.type)
    if (!isCodeTask(sourceTask) || sourceCarry?.capabilities?.rosterWork !== carry.kind) {
      warnings.push(
        `Task ${n} ${field}: task ${sourceTaskId} of lesson ${sourceLessonId} saves a different kind of work, so nothing will carry`
      )
    }
  })
  return warnings
}

// ── Paths ─────────────────────────────────────────────────────────────────────

export function carryInboxPath(lessonId, anonymousId, taskId) {
  const base = `${CARRY_INBOX_ROOT}/${lessonId}`
  if (anonymousId == null) return base
  return taskId == null ? `${base}/${anonymousId}` : `${base}/${anonymousId}/${taskId}`
}

export function carryStatusPath(lessonId, anonymousId, taskId) {
  return `sessions/${lessonId}/carryStatus/${anonymousId}/${taskId}`
}

// ── Inbox entries ─────────────────────────────────────────────────────────────

function workContent(work) {
  if (!work) return null
  if (work.kind === 'code' && typeof work.code === 'string') return { code: work.code }
  if (work.kind === 'files' && Array.isArray(work.files)) {
    return {
      files: work.files
        .filter((file) => file && typeof file.name === 'string')
        .map((file) => ({ name: file.name, content: String(file.content ?? '') })),
    }
  }
  if (work.kind === 'blocks' && isPlainObject(work.scratchState)) {
    return { scratchState: work.scratchState }
  }
  if (work.kind === 'activity_slot' && typeof work.slotId === 'string' && work.state != null) {
    return { slotId: work.slotId, state: work.state }
  }
  return null
}

// The inbox entry for a roster work record (rosterService.getSavedWork's result), or
// { error: 'empty' | 'kind' | 'too_large' }. The content travels as one JSON string (`payload`),
// because RTDB drops empty arrays and turns arrays into objects (Scratch state has both).
export function buildCarryInboxEntry(work, { kind, sourceLessonId, sourceTaskId } = {}) {
  if (!work) return { error: 'empty' }
  if (kind && work.kind !== kind) return { error: 'kind' }
  const content = workContent(work)
  if (!content) return { error: 'empty' }
  const payload = JSON.stringify(content)
  if (payload.length > CARRY_INBOX_MAX_CHARS) return { error: 'too_large' }
  return {
    entry: {
      kind: work.kind,
      payload,
      sourceLessonId: String(sourceLessonId ?? work.sourceLessonId ?? ''),
      sourceTaskId: String(sourceTaskId ?? work.sourceTaskId ?? ''),
      savedAt: typeof work.savedAt?.toMillis === 'function' ? work.savedAt.toMillis() : null,
    },
  }
}

// The inbox entry's work as the student's selectors read it: { kind, code } |
// { kind, files: [{ name, content }] } | { kind, scratchState } | { kind, slotId, state }, or null when it is missing,
// of another kind, or unreadable.
export function readCarryInboxEntry(entry, kind) {
  if (!isPlainObject(entry) || typeof entry.payload !== 'string') return null
  if (kind && entry.kind !== kind) return null
  let content
  try {
    content = JSON.parse(entry.payload)
  } catch {
    return null
  }
  if (!isPlainObject(content)) return null
  if (entry.kind === 'code' && typeof content.code === 'string') {
    return { kind: 'code', code: content.code }
  }
  if (entry.kind === 'files' && Array.isArray(content.files)) {
    return { kind: 'files', files: content.files }
  }
  if (entry.kind === 'blocks' && isPlainObject(content.scratchState)) {
    return { kind: 'blocks', scratchState: content.scratchState }
  }
  if (entry.kind === 'activity_slot' && typeof content.slotId === 'string' && 'state' in content) {
    return { kind: 'activity_slot', slotId: content.slotId, state: content.state }
  }
  return null
}

// sessions/{lessonId}/carryStatus/{anonymousId}/{taskId}. `reason` explains a 'none'
// ('not_saved' | 'too_large' | 'error'); `rosterId` is the opaque roster id the work was looked
// up for (never a name).
export function makeCarryStatus(
  status,
  { sourceLessonId, sourceTaskId, reason = null, rosterId = null, by = null, at = Date.now() } = {}
) {
  if (!CARRY_STATUSES.includes(status)) throw new Error(`Unknown carry status: ${status}`)
  return {
    status,
    sourceLessonId: String(sourceLessonId ?? ''),
    sourceTaskId: String(sourceTaskId ?? ''),
    reason: reason ?? null,
    rosterId: rosterId ?? null,
    by: by ?? null,
    at,
  }
}

// ── Student side ──────────────────────────────────────────────────────────────

// What the student's task does (see CARRY_OUTCOMES). `live`: a real student in a live lesson
// (not solo, the presentation window, the Builder preview or a sandbox). `classSource`:
// resolveSessionClass(lesson, session).source. `status`: the task's carryStatus entry.
// `hasOwnWork`: the student already has saved work for this task.
export function resolveCrossLessonCarry({ carry, live, classSource, status, hasOwnWork }) {
  if (!carry) return 'off'
  if (hasOwnWork) return 'own'
  if (!live) return 'solo'
  if (classSource === 'none') return 'no_class'
  const value = status?.status
  if (CARRY_STATUSES.includes(value)) return value
  return 'hold'
}

const FALLBACK_REASONS = Object.freeze({
  none: 'none',
  starter: 'starter',
  no_class: 'no_class',
  missing: 'missing',
})

// The carryFallbackLog reason for a student-side state that falls back to the starter in a live
// lesson ('none' | 'starter' | 'no_class' | 'missing'), or null ('solo' falls back silently).
export function crossLessonFallbackReason(state) {
  return FALLBACK_REASONS[state] ?? null
}

// The carryFallbackLog record for a task that fell back to its starter, or null.
// reason: 'none' (nothing saved), 'starter' (the tutor's override), 'no_class', 'missing'
// (the status said found but the inbox was empty or unreadable).
export function crossLessonFallbackRecord(taskId, carry, reason) {
  if (!carry || !reason) return null
  return {
    taskId,
    field: carry.field,
    crossLesson: true,
    reason,
    sourceLessonId: carry.sourceLessonId,
    sourceTaskId: carry.sourceTaskId,
  }
}

// A friendly name for the source lesson in the hold message: "Lesson 11" when its
// lessonNumber is known, else null (the message then says "your last lesson").
export function carrySourceLessonLabel(sourceLesson) {
  const number = sourceLesson?.lessonNumber
  return Number.isInteger(number) && number > 0 ? `Lesson ${number}` : null
}

// ── Tutor side ────────────────────────────────────────────────────────────────

function joinedIds(session) {
  return Object.keys(session?.students ?? {})
}

// The inbox writes the tutor's client still owes: one per matched, joined student per
// cross-lesson carry task with no status yet. `matches`: { anonymousId: rosterId }
// (activeRosterMatches). Every carry task in the lesson is prepared as soon as the student is
// matched, so a later task is ready before the class gets there.
export function collectCarryInboxRequests({ session, lesson, matches }) {
  const carryTasks = listCrossLessonCarryTasks(lesson)
  if (!carryTasks.length || !session) return []
  const joined = new Set(joinedIds(session))
  const result = []
  for (const [anonymousId, rosterId] of Object.entries(matches ?? {})) {
    if (!rosterId || !joined.has(anonymousId)) continue
    for (const carry of carryTasks) {
      if (session.carryStatus?.[anonymousId]?.[carry.taskId]?.status) continue
      result.push({
        key: `${anonymousId}:${carry.taskId}:${rosterId}`,
        anonymousId,
        rosterId,
        ...carry,
      })
    }
  }
  return result
}

// The joined students the tutor should know are (or will be) held on the class's current task:
// it has a cross-lesson carry, the session has (or may get) a class, and there's no status for
// them yet. Students who already had their own work for the task never actually hold, which the
// tutor can't see; they're listed until the status is written. Returns [] when nobody waits.
export function carryWaitingStudentIds({ session, lesson, classSource }) {
  if (!session || session.state !== 'active' || classSource === 'none') return []
  const task = flattenTasks(lesson?.tasks ?? []).find(
    (item) => String(item?.id) === String(session.currentTaskId)
  )
  const carry = getCrossLessonCarry(lesson, task)
  if (!carry) return []
  return joinedIds(session).filter((anonymousId) => {
    const student = session.students?.[anonymousId]
    if (student?.inPersonalSandbox) return false
    return !session.carryStatus?.[anonymousId]?.[task.id]?.status
  })
}

// The RTDB update (relative to sessions/{lessonId}) that gives these students the starter on
// every cross-lesson carry task they don't have a status for yet ("Use the starter").
export function carryStarterUpdates({ session, lesson, anonymousIds, by = null, at = Date.now() }) {
  const updates = {}
  for (const carry of listCrossLessonCarryTasks(lesson)) {
    for (const anonymousId of anonymousIds ?? []) {
      if (session?.carryStatus?.[anonymousId]?.[carry.taskId]?.status) continue
      updates[`carryStatus/${anonymousId}/${carry.taskId}`] = makeCarryStatus('starter', {
        sourceLessonId: carry.sourceLessonId,
        sourceTaskId: carry.sourceTaskId,
        by,
        at,
      })
    }
  }
  return updates
}

// ── Session report ────────────────────────────────────────────────────────────

// The per-student task field: `{ crossLessonCarry: { outcome, sourceLessonId, sourceTaskId,
// reason? } }` with outcome 'found' | 'none' | 'starter' | 'no_class', or `{}`. Anonymous: no
// roster ids or names.
export function crossLessonCarryReportFields(session, anonymousId, taskId) {
  const status = session?.carryStatus?.[anonymousId]?.[taskId]
  if (status && CARRY_STATUSES.includes(status.status)) {
    return {
      crossLessonCarry: {
        outcome: status.status,
        sourceLessonId: status.sourceLessonId ?? null,
        sourceTaskId: status.sourceTaskId ?? null,
        ...(status.reason ? { reason: status.reason } : {}),
      },
    }
  }
  const fallback = session?.carryFallbackLog?.[anonymousId]?.[taskId]
  if (fallback?.crossLesson && fallback.reason === 'no_class') {
    return {
      crossLessonCarry: {
        outcome: 'no_class',
        sourceLessonId: fallback.sourceLessonId ?? null,
        sourceTaskId: fallback.sourceTaskId ?? null,
      },
    }
  }
  return {}
}

// The task summary field: `{ crossLessonCarryCounts: { found, none, starter, no_class } }`
// (zero counts left out), or `{}` when no student has an outcome.
export function summarizeCrossLessonCarry(perStudentTasks) {
  const counts = {}
  for (const task of perStudentTasks ?? []) {
    const outcome = task?.crossLessonCarry?.outcome
    if (outcome) counts[outcome] = (counts[outcome] ?? 0) + 1
  }
  return Object.keys(counts).length ? { crossLessonCarryCounts: counts } : {}
}
