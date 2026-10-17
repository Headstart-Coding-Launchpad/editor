// Solo study log: what a real student did in a lesson on their own (a Solo Challenge, or any
// lesson opened solo), outside any live session. Pure helpers only; the Firebase writes are in
// src/app/soloLogService.js, the tutor page is src/admin/SoloPanel.jsx.
//
// Data (RTDB, kept outside `sessions` because createSession clears those):
//   soloLog/{lessonId}/{anonymousId} = {
//     startedAt, lastAt, finishedAt?, name?,
//     tasks: { [taskId]: { attempts, passed, firstTry, firstAt, passedAt? } }
//   }
// Written on discrete events only (first arrival, each checked Run, reaching the completion
// screen), never per keystroke and never any code. `name` is the identity's display name when it
// is a real one (not the 'Solo' placeholder); tutors read it, exports never carry it.
import { flattenTasks } from './taskUtils.js'

export const SOLO_LOG_ROOT = 'soloLog'
export const SOLO_PLACEHOLDER_NAME = 'Solo'
export const SOLO_NAME_MAX = 30

export const soloLogPath = (lessonId, anonymousId) => `${SOLO_LOG_ROOT}/${lessonId}/${anonymousId}`
export const soloLogTaskPath = (lessonId, anonymousId, taskId) =>
  `${soloLogPath(lessonId, anonymousId)}/tasks/${taskId}`

const isTime = (value) => typeof value === 'number' && Number.isFinite(value)
const count = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0)

/** The identity's display name for the log, or null for the 'Solo' placeholder or no name. */
export function soloLogName(displayName) {
  const name = typeof displayName === 'string' ? displayName.trim() : ''
  if (!name || name === SOLO_PLACEHOLDER_NAME) return null
  return name.slice(0, SOLO_NAME_MAX)
}

/**
 * The next per-task record after a checked Run, or the same record when the task has already been
 * passed (later Runs add nothing, like the live attempt log). `firstTry` is true when the very
 * first checked Run passed. Used as a transaction update, so it must stay pure.
 */
export function applySoloAttempt(current, passed, now) {
  if (current?.passed === true) return current
  const attempts = count(current?.attempts) + 1
  const next = {
    attempts,
    passed: passed === true,
    firstTry: passed === true && attempts === 1,
    firstAt: isTime(current?.firstAt) ? current.firstAt : now,
  }
  if (passed === true) next.passedAt = now
  return next
}

/** One student's raw log entry as rows against the lesson's tasks (information tasks skipped). */
export function summariseSoloEntry(entry, lessonTasks = null) {
  const tasksLog = entry?.tasks && typeof entry.tasks === 'object' ? entry.tasks : {}
  const known = lessonTasks
    ? flattenTasks(lessonTasks).filter((task) => task.taskType !== 'information')
    : null
  const rows = (known ?? Object.keys(tasksLog).map((id) => ({ id }))).map((task) => {
    const log = tasksLog[task.id] ?? null
    return {
      taskId: task.id,
      title: task.title ?? `Task ${task.id}`,
      attempts: count(log?.attempts),
      passed: log?.passed === true,
      firstTry: log?.firstTry === true,
      firstAt: isTime(log?.firstAt) ? log.firstAt : null,
      passedAt: log?.passed === true && isTime(log?.passedAt) ? log.passedAt : null,
    }
  })
  return {
    startedAt: isTime(entry?.startedAt) ? entry.startedAt : null,
    lastAt: isTime(entry?.lastAt) ? entry.lastAt : null,
    finishedAt: isTime(entry?.finishedAt) ? entry.finishedAt : null,
    taskCount: rows.length,
    tasksPassed: rows.filter((row) => row.passed).length,
    firstAttemptPasses: rows.filter((row) => row.firstTry).length,
    tasks: rows,
  }
}

/**
 * Every student's solo summary for one lesson, newest activity first.
 * @param {object} lessonLog `soloLog/{lessonId}` ({ [anonymousId]: entry })
 * @returns {{ anonymousId, name, ...summary }[]}
 */
export function buildSoloRows(lessonLog, lessonTasks = null) {
  return Object.entries(lessonLog ?? {})
    .filter(([, entry]) => entry && typeof entry === 'object')
    .map(([anonymousId, entry]) => ({
      anonymousId,
      name: soloLogName(entry.name),
      ...summariseSoloEntry(entry, lessonTasks),
    }))
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))
}

/**
 * The anonymised export of a lesson's solo log: no names, no ids, "Student N" in the order they
 * started, the same wording as a session report. Times are ms.
 */
export function anonymizeSoloRows(rows) {
  return [...rows]
    .sort((a, b) => (a.startedAt ?? a.lastAt ?? 0) - (b.startedAt ?? b.lastAt ?? 0))
    .map((row, index) => {
      // eslint-disable-next-line no-unused-vars
      const { anonymousId, name, ...rest } = row
      return { studentLabel: `Student ${index + 1}`, ...rest }
    })
}

/** The document `lessons solo-log` and the Admin export produce for one lesson. */
export function buildSoloExport({ lessonId, lessonTitle = null, lessonLog, lessonTasks = null }) {
  return {
    lessonId,
    ...(lessonTitle ? { lessonTitle } : {}),
    students: anonymizeSoloRows(buildSoloRows(lessonLog, lessonTasks)),
  }
}

/**
 * Side-quests per student per session, flattened from the stored session reports. Student labels
 * are the report's own ("Student N": reports are anonymous), so a row is only comparable inside
 * one session.
 * @returns {{ lessonId, sessionId, startedAt, studentLabel, taskId, taskTitle, index, title,
 *   kind, openedAt, runs, errorRuns, done, doneAt }[]}
 */
export function buildSideQuestRows(reports) {
  const rows = []
  for (const report of reports ?? []) {
    for (const student of report?.students ?? []) {
      for (const task of student?.tasks ?? []) {
        for (const quest of task?.sideQuests ?? []) {
          rows.push({
            lessonId: report.lessonId ?? null,
            sessionId: report.sessionId ?? null,
            startedAt: isTime(report.startedAt) ? report.startedAt : null,
            studentLabel: student.studentLabel ?? null,
            taskId: task.taskId,
            taskTitle: task.title ?? null,
            index: quest.index,
            title: quest.title ?? null,
            kind: quest.kind ?? null,
            openedAt: isTime(quest.openedAt) ? quest.openedAt : null,
            runs: count(quest.runs),
            errorRuns: count(quest.errorRuns),
            done: quest.done === true,
            doneAt: isTime(quest.doneAt) ? quest.doneAt : null,
          })
        }
      }
    }
  }
  return rows.sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
}
