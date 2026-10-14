// Typing history (W3-b, Ryan 2026-10-14): each matched student's keyboard scores kept across
// lessons on their class-roster entry, and the last / best / first scores pushed back to them.
// Pure: no Firebase, React or DOM.
//
// Data flow (tutor-mediated: students never touch Firestore):
// 1. The tutor's signed-in TeacherView (useTypingHistory) reads each matched student's finished
//    typing results from what it already receives: the live activity state on
//    students/{anonymousId}/currentAnswer (the class's current task) and every attemptLog
//    submission of this session. Results from before the student was matched are picked up as
//    soon as they are matched.
// 2. Each finished result becomes one entry (buildTypingEntry) in Firestore
//    classes/{classId}/roster/{rosterId}/typing/{entryId}. The entry id is the dedupe key: the
//    stock lesson and task, the item and a hash of the result, so the same finished attempt is
//    saved once however often the tutor's client sees it (reloads, two tutor tabs, a later
//    session restoring the same result from the student's device).
// 3. The tutor's client summarises the entries from earlier sessions per mode (last, best and
//    first; summariseTypingHistory) and writes them to the teacher-write-only RTDB node
//    sessions/{lessonId}/typingHistory/{anonymousId}. The student's Keyboard activity reads its
//    own node (showHistory) and the tutor's card, modal and session report read every node.
// An activity takes part through its definition's `history` hooks (defineActivity.js):
//   history: { modes(task) → string[], results(task, state) → [result], shows(task, item) → bool }
// so nothing here names an activity or a mode.

import { getTaskActivity } from '../activities/registry.pure.js'
import { readStudentActivityState } from '../activities/state.js'
import { isAutoAttempt } from './autoCheck.js'
import { hashText, makeRosterWorkId, resolveSourceIds } from './roster/rosterModel.js'
import { flattenTasks } from './taskUtils.js'

// How many of a student's entries the tutor's client reads per class (newest first).
export const TYPING_HISTORY_LOAD_MAX = 500
// Entries shown in the StudentModal's "Typing history" list.
export const TYPING_HISTORY_RECENT = 10

const RESULT_NUMBER_FIELDS = ['cpm', 'wpm', 'accuracy', 'corrections', 'timeMs']

function finiteOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function roundAccuracy(value) {
  return Math.round(Math.min(1, Math.max(0, finiteOr(value))) * 100) / 100
}

// The activity's typing-history hooks for a task, or null when the task keeps no history.
export function getTaskHistory(task) {
  const history = getTaskActivity(task)?.history
  if (!history || typeof history.modes !== 'function') return null
  return history.modes(task)?.length ? history : null
}

// The mode a task's history is kept under (its first mode), or null.
export function taskHistoryMode(task) {
  return getTaskHistory(task)?.modes(task)?.[0] ?? null
}

export function lessonKeepsTypingHistory(lesson) {
  return flattenTasks(lesson?.tasks ?? []).some((task) => getTaskHistory(task) !== null)
}

// Whether the student sees their history beside this item (`showHistory` on the item or task).
export function showsTypingHistory(task, item) {
  const history = getTaskHistory(task)
  return !!history?.shows?.(task, item)
}

// The finished, genuinely typed results in an activity state: [{ itemId, mode, cpm, wpm,
// accuracy, corrections, timeMs, score? }]. The teacher's "Complete (show answers)" results
// (`solution: true`) are never history.
export function typingResultsOf(task, state) {
  const history = getTaskHistory(task)
  if (!history || !state) return []
  return (history.results(task, state) ?? []).filter(
    (result) => result && !result.solution && Number.isFinite(Number(result.cpm))
  )
}

// A stable hash of one finished attempt's numbers (and what was typed).
export function typingAttemptHash(result) {
  const parts = [
    result?.mode ?? '',
    ...RESULT_NUMBER_FIELDS.map((field) => finiteOr(result?.[field])),
    result?.score ?? '',
    typeof result?.typed === 'string' ? result.typed : '',
  ]
  return hashText(parts.join('|'))
}

// The Firestore id of an entry, which is also its dedupe key:
// `{sourceLessonId}__{sourceTaskId}__{itemId}__{attemptHash}` ('/' becomes '_'), or null.
export function makeTypingEntryId({ sourceLessonId, sourceTaskId, itemId, hash }) {
  const base = makeRosterWorkId(sourceLessonId, sourceTaskId)
  if (!base || itemId == null || itemId === '' || !hash) return null
  return `${base}__${String(itemId).replace(/\//g, '_')}__${hash}`
}

// One typing-history entry (no names): { date, sessionId, lessonId, sourceLessonId, taskId,
// sourceTaskId, itemId, mode, cpm, wpm, accuracy, corrections, timeMs, score? }.
export function buildTypingEntry({
  result,
  date,
  sessionId,
  lessonId,
  sourceLessonId,
  taskId,
  sourceTaskId,
}) {
  const entry = {
    date: finiteOr(date, Date.now()),
    sessionId: sessionId == null ? null : String(sessionId),
    lessonId: lessonId ?? null,
    sourceLessonId: sourceLessonId ?? null,
    taskId: taskId == null ? null : String(taskId),
    sourceTaskId: sourceTaskId == null ? null : String(sourceTaskId),
    itemId: String(result.itemId),
    mode: String(result.mode),
    cpm: Math.round(finiteOr(result.cpm)),
    wpm: Math.round(finiteOr(result.wpm) * 10) / 10,
    accuracy: roundAccuracy(result.accuracy),
    corrections: Math.round(finiteOr(result.corrections)),
    timeMs: Math.round(finiteOr(result.timeMs)),
  }
  if (result.score != null && Number.isFinite(Number(result.score))) {
    entry.score = Math.round(Number(result.score))
  }
  return entry
}

// The session's id for history (the report's sessionId), or null before the session starts.
export function typingSessionId(session) {
  return session?.startedAt == null ? null : String(session.startedAt)
}

function parseState(task, submission) {
  if (typeof submission !== 'string' || !submission) return null
  const definition = getTaskActivity(task)
  try {
    return definition.deserialize(submission, task)
  } catch {
    return null
  }
}

// Every finished typing result of the matched students this session, as entries to save:
// [{ id, anonymousId, rosterId, entry }], one per id. Read from each attemptLog submission
// (attempts the tutor edited are skipped) and, on the class's current task, the live state on
// currentAnswer (unless the tutor edited it). `matches`: { anonymousId: rosterId }.
export function collectTypingEntries({ session, lesson, lessonId, matches }) {
  const sessionId = typingSessionId(session)
  if (!session || !lesson || !sessionId) return []
  const tasks = flattenTasks(lesson.tasks ?? []).filter((task) => getTaskHistory(task))
  if (tasks.length === 0) return []
  const byId = new Map()
  for (const [anonymousId, rosterId] of Object.entries(matches ?? {})) {
    if (!rosterId) continue
    const student = session.students?.[anonymousId]
    for (const task of tasks) {
      const sources = []
      for (const attempt of Object.values(session.attemptLog?.[anonymousId]?.[task.id] ?? {})) {
        if (!attempt || isAutoAttempt(attempt) || attempt.teacherAssisted) continue
        const state = parseState(task, attempt.submission)
        if (state) sources.push({ state, at: finiteOr(attempt.loggedAt, Date.now()) })
      }
      if (
        session.state === 'active' &&
        student &&
        String(session.currentTaskId) === String(task.id) &&
        String(student.teacherAssistedTaskId ?? '') !== String(task.id)
      ) {
        const state = readStudentActivityState(task, student)
        if (state) sources.push({ state, at: Date.now() })
      }
      if (sources.length === 0) continue
      const { sourceLessonId, sourceTaskId } = resolveSourceIds(lesson, lessonId, task.id)
      for (const { state, at } of sources) {
        for (const result of typingResultsOf(task, state)) {
          const id = makeTypingEntryId({
            sourceLessonId,
            sourceTaskId,
            itemId: result.itemId,
            hash: typingAttemptHash(result),
          })
          if (!id || byId.has(`${rosterId}/${id}`)) continue
          byId.set(`${rosterId}/${id}`, {
            id,
            anonymousId,
            rosterId,
            entry: buildTypingEntry({
              result,
              date: at,
              sessionId,
              lessonId,
              sourceLessonId,
              taskId: task.id,
              sourceTaskId,
            }),
          })
        }
      }
    }
  }
  return [...byId.values()]
}

// ── Summaries ─────────────────────────────────────────────────────────────────

// Better score first: characters a minute, then accuracy. Negative when `a` is better.
export function compareTypingScores(a, b) {
  const cpm = finiteOr(b?.cpm) - finiteOr(a?.cpm)
  if (cpm !== 0) return cpm
  return finiteOr(b?.accuracy) - finiteOr(a?.accuracy)
}

function scoreOf(entries) {
  const count = entries.length
  const mean = (field) => entries.reduce((sum, entry) => sum + finiteOr(entry[field]), 0) / count
  return {
    cpm: Math.round(mean('cpm')),
    accuracy: roundAccuracy(mean('accuracy')),
    date: Math.max(...entries.map((entry) => finiteOr(entry.date))),
  }
}

function sessionKeyOf(entry) {
  return entry.sessionId ?? `date:${finiteOr(entry.date)}`
}

// Per mode, from a student's entries (excluding `excludeSessionId`, the session in progress):
// { byMode: { [mode]: { last, best, first, sessions } } } or null when there are none.
// `last` and `first` are the averages of the most recent and the earliest session's entries in
// that mode; `best` is the single best entry (characters a minute, then accuracy). Each score is
// { cpm, accuracy (0-1), date }.
export function summariseTypingHistory(entries, { excludeSessionId = null } = {}) {
  const byMode = {}
  const grouped = new Map()
  for (const entry of entries ?? []) {
    if (!entry?.mode || !Number.isFinite(Number(entry.cpm))) continue
    if (excludeSessionId != null && entry.sessionId === String(excludeSessionId)) continue
    if (!grouped.has(entry.mode)) grouped.set(entry.mode, new Map())
    const sessions = grouped.get(entry.mode)
    const key = sessionKeyOf(entry)
    if (!sessions.has(key)) sessions.set(key, [])
    sessions.get(key).push(entry)
  }
  for (const [mode, sessions] of grouped) {
    const ordered = [...sessions.values()]
      .map((list) => ({ list, score: scoreOf(list) }))
      .sort((a, b) => a.score.date - b.score.date)
    const best = [...sessions.values()].flat().sort(compareTypingScores)[0]
    byMode[mode] = {
      last: ordered[ordered.length - 1].score,
      best: {
        cpm: Math.round(finiteOr(best.cpm)),
        accuracy: roundAccuracy(best.accuracy),
        date: finiteOr(best.date),
      },
      first: ordered[0].score,
      sessions: ordered.length,
    }
  }
  return Object.keys(byMode).length ? { byMode } : null
}

// A key-sorted JSON form, for comparing a summary with the node RTDB hands back.
export function stableTypingJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableTypingJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined && value[key] !== null)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableTypingJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

// Whether the pushed node (sessions/{lessonId}/typingHistory/{anonymousId}) already holds this
// summary (`updatedAt` aside).
export function sameTypingSummary(node, summary) {
  const strip = (value) => (value?.byMode ? { byMode: value.byMode } : null)
  return stableTypingJson(strip(node)) === stableTypingJson(strip(summary))
}

// The pushed history for one student and mode: { last, best, first, sessions } or null.
export function typingHistoryForMode(node, mode) {
  return (mode && node?.byMode?.[mode]) || null
}

// This session's score on a task from its activity state: the average of the finished
// results, or null.
export function currentTypingScore(task, state) {
  const results = typingResultsOf(task, state)
  if (results.length === 0) return null
  return scoreOf(results.map((result) => ({ ...result, date: 0 })))
}

// ── Words ─────────────────────────────────────────────────────────────────────

function percent(accuracy) {
  return `${Math.round(finiteOr(accuracy) * 100)}%`
}

// "Last time: 62 cpm, 91% · Best: 75 cpm", or '' with no history.
export function formatTypingHistoryLine(modeHistory) {
  if (!modeHistory?.last) return ''
  const last = `Last time: ${modeHistory.last.cpm} cpm, ${percent(modeHistory.last.accuracy)}`
  return modeHistory.best ? `${last} · Best: ${modeHistory.best.cpm} cpm` : last
}

// What a finished item says about progress, or '' when there is nothing warm to say:
// a new best, then "You went from 40 to 75 characters a minute".
export function formatTypingTrend(modeHistory, cpm) {
  const now = Math.round(finiteOr(cpm, NaN))
  if (!modeHistory || !Number.isFinite(now)) return ''
  const first = modeHistory.first?.cpm
  const best = modeHistory.best?.cpm
  const parts = []
  if (Number.isFinite(best) && now > best) parts.push('New best!')
  if (Number.isFinite(first) && now > first) {
    parts.push(`You went from ${first} to ${now} characters a minute.`)
  }
  return parts.join(' ')
}

// The tutor's short line: "Last 62 · Best 75 cpm · first 40", or ''.
export function formatTypingHistoryChip(modeHistory) {
  if (!modeHistory?.last) return ''
  const best = modeHistory.best ? ` · Best ${modeHistory.best.cpm}` : ''
  const first =
    modeHistory.sessions > 1 && modeHistory.first ? ` · first ${modeHistory.first.cpm}` : ''
  return `Last ${modeHistory.last.cpm}${best} cpm${first}`
}

// ── Session report ────────────────────────────────────────────────────────────

// The report's `typingHistory` for one student's task: this session's score beside the pushed
// history ({ mode, cpm?, accuracy?, previousCpm, previousAccuracy, bestCpm, firstCpm }), or {}
// when the task keeps no history or the student has none (unmatched, or no earlier scores).
// `state` is the task's latest submitted activity state, if any.
export function typingHistoryReportFields(session, task, anonymousId, state) {
  const mode = taskHistoryMode(task)
  const history = typingHistoryForMode(session?.typingHistory?.[anonymousId], mode)
  if (!history) return {}
  const current = state ? currentTypingScore(task, state) : null
  return {
    typingHistory: {
      mode,
      ...(current ? { cpm: current.cpm, accuracy: current.accuracy } : {}),
      previousCpm: history.last?.cpm ?? null,
      previousAccuracy: history.last?.accuracy ?? null,
      bestCpm: history.best?.cpm ?? null,
      firstCpm: history.first?.cpm ?? null,
    },
  }
}
