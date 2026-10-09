// The live-badge metrics in the session report (docs/architecture/live-badges-plan.md, "Data
// model" → Session report). buildSessionReport (src/shared/lessonReport.js) calls these with the
// same session snapshot the badge engine reads. Real passes, first tries and error attempts come
// from the engine's own timelines and guards (./liveTimeline.js, ./rules.js), so the report and
// the suggestions always agree. Pure and Node-safe.
//
// The report never stores names or anonymous ids: every student reference here is the report's
// `studentLabel` ("Student 3"), looked up through `labelFor(anonymousId)`.
import { findTaskById } from '../shared/taskUtils.js'
import { resolveBadgeOptions } from './badgeOptions.js'
import { listMyMoments } from './celebration.js'
import { buildBadgeLessonIndex } from './lessonIndex.js'
import { buildStudentTimeline, buildTaskLookup, buildTopicTitles } from './liveTimeline.js'
import { eventsOf, getFirstTryRealPass, getRealPass, getTaskAttempts } from './rules.js'
import { getKeyboardWizardShortcut } from './shortcuts.js'
import { TOPIC_LIBRARY_OPEN_ID } from './signals.js'

/** Firestore's document limit is 1 MiB; the report is trimmed above this. */
export const REPORT_MAX_BYTES = 900 * 1024

/** The report's `sizeNote` when student sandbox code had to be left out. */
export const REPORT_SIZE_NOTE_SNAPSHOTS =
  "Students' teacher-sandbox code was left out to keep this report under Firestore's 1 MiB limit."
/** The report's `sizeNote` when the teacher's sandbox pushes had to go too. */
export const REPORT_SIZE_NOTE_PUSHES =
  "Students' and the teacher's sandbox code were left out to keep this report under Firestore's 1 MiB limit."

const sameId = (a, b) => a != null && b != null && String(a) === String(b)
const isTime = (value) => typeof value === 'number' && Number.isFinite(value)

/** The median of a list of numbers (the mean of the middle two, rounded, for an even count). */
export function median(numbers) {
  if (numbers.length === 0) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Every report student's badge timeline, keyed by anonymous id. Unlike the live engine these
 * aren't narrowed to the current roster: the report covers everyone who took part.
 */
export function buildReportTimelines({ session, lesson, studentIds, topics = null }) {
  const tasks = buildTaskLookup(lesson)
  const topicTitles = buildTopicTitles(topics)
  return Object.fromEntries(
    studentIds.map((studentId) => [
      studentId,
      buildStudentTimeline({ session, studentId, tasks, topicTitles }),
    ])
  )
}

// A sandbox counter node as reported: activity only, no runsLog. Null when nothing happened.
function sandboxActivity(raw) {
  if (!raw || typeof raw !== 'object') return null
  const activity = {
    timeMs: Number(raw.timeMs) || 0,
    runs: Number(raw.runs) || 0,
    errorRuns: Number(raw.errorRuns) || 0,
    fixes: Number(raw.fixes) || 0,
  }
  return activity.timeMs > 0 || activity.runs > 0 ? activity : null
}

/**
 * One student's report fields: `badges` (their awarded moments), `topicsOpened`,
 * `shortcutsUsed`, `personalSandbox` and `teacherSandbox` activity. Empty ones are left out.
 */
export function studentBadgeFields({ session, studentId, timeline, catalogueBadges = [] }) {
  const badges = listMyMoments(session?.badges, studentId, catalogueBadges).map(
    ({ badgeId, badge, decision }) => ({
      badgeId,
      emoji: badge.emoji,
      title: badge.title,
      source: decision.source ?? null,
      reason: decision.reason ?? null,
      taskId: decision.taskId ?? null,
      awardedAt: decision.decidedAt ?? null,
    })
  )
  const topicsOpened = eventsOf(timeline, 'topic_open').map((event) => ({
    topicId: event.topicId,
    title: event.topicId === TOPIC_LIBRARY_OPEN_ID ? 'Topic Library' : (event.topicTitle ?? null),
    context: event.context,
    taskId: event.taskId ?? null,
    source: event.source,
    openedAt: event.at,
  }))
  const shortcutsUsed = eventsOf(timeline, 'shortcut').map((event) => ({
    shortcutId: event.shortcutId,
    label: getKeyboardWizardShortcut(event.shortcutId)?.label ?? event.shortcutId,
    context: event.context,
    taskId: event.taskId ?? null,
    firstUsedAt: event.at,
  }))
  const signals = session?.studentSignals?.[studentId]?.sandbox
  const personalSandbox = sandboxActivity(signals?.personal)
  const teacherSandbox = sandboxActivity(signals?.session)
  return {
    ...(badges.length > 0 ? { badges } : {}),
    ...(topicsOpened.length > 0 ? { topicsOpened } : {}),
    ...(shortcutsUsed.length > 0 ? { shortcutsUsed } : {}),
    ...(personalSandbox ? { personalSandbox } : {}),
    ...(teacherSandbox ? { teacherSandbox } : {}),
  }
}

/**
 * The class's first real pass on each task (the engine's guards: not assisted, overridden,
 * complete shown or revealed, or pasted): `Map<taskId string, { studentId, at }>`.
 */
export function findFirstRealPasses(timelines, tasks) {
  const firsts = new Map()
  for (const task of tasks) {
    let first = null
    for (const [studentId, timeline] of Object.entries(timelines)) {
      const pass = getRealPass(timeline, task.id)
      if (!pass || !isTime(pass.at)) continue
      if (!first || pass.at < first.at) first = { studentId, at: pass.at }
    }
    if (first) firsts.set(String(task.id), first)
  }
  return firsts
}

/**
 * One student's per-task fields: `timeToFirstEditMs`, `errorAttempts`, `uniqueFailedAttempts`
 * (different failed submissions, by hash) and `firstPassInClass`. Zero, false and unknown ones
 * are left out.
 */
export function studentTaskBadgeFields({ timeline, studentId, taskId, firstPass }) {
  const attempts = getTaskAttempts(timeline, taskId)
  const firstEdit = eventsOf(timeline, 'first_edit', taskId)[0]
  const timeToFirstEditMs = isTime(firstEdit?.elapsedMs) ? firstEdit.elapsedMs : null
  const errorAttempts = attempts.filter((attempt) => attempt.error).length
  const failedHashes = new Set(
    attempts
      .filter((attempt) => !attempt.passed && attempt.submissionHash)
      .map((attempt) => attempt.submissionHash)
  )
  const firstPassInClass = !!firstPass && sameId(firstPass.studentId, studentId)
  return {
    ...(timeToFirstEditMs != null ? { timeToFirstEditMs } : {}),
    ...(errorAttempts > 0 ? { errorAttempts } : {}),
    ...(failedHashes.size > 0 ? { uniqueFailedAttempts: failedHashes.size } : {}),
    ...(firstPassInClass ? { firstPassInClass: true } : {}),
  }
}

/**
 * One task's summary fields: `timeToFirstEdit` ({ medianMs, minMs, maxMs, studentCount }),
 * `errorStudentCount` (students who hit a console error), `topicOpens` ({ student, teacher }
 * Topic Library opens on the task) and `firstRealPass` ({ studentLabel, afterMs } after the
 * task opened). Empty ones are left out.
 */
export function taskSummaryBadgeFields({
  task,
  perStudent,
  timelines,
  firstPass,
  taskStartTimes,
  labelFor,
}) {
  const edits = perStudent.map((t) => t.timeToFirstEditMs).filter(isTime)
  const errorStudentCount = perStudent.filter((t) => t.errorAttempts > 0).length
  const topicOpens = { student: 0, teacher: 0 }
  for (const timeline of Object.values(timelines)) {
    for (const event of eventsOf(timeline, 'topic_open', task.id)) {
      if (event.context !== 'task') continue
      topicOpens[event.source === 'teacher' ? 'teacher' : 'student'] += 1
    }
  }
  const startedAt = taskStartTimes?.[task.id]
  return {
    ...(edits.length > 0
      ? {
          timeToFirstEdit: {
            medianMs: median(edits),
            minMs: Math.min(...edits),
            maxMs: Math.max(...edits),
            studentCount: edits.length,
          },
        }
      : {}),
    ...(errorStudentCount > 0 ? { errorStudentCount } : {}),
    ...(topicOpens.student + topicOpens.teacher > 0 ? { topicOpens } : {}),
    ...(firstPass
      ? {
          firstRealPass: {
            studentLabel: labelFor(firstPass.studentId),
            afterMs: isTime(startedAt) ? Math.max(0, firstPass.at - startedAt) : null,
          },
        }
      : {}),
  }
}

/**
 * Each quiz group (a lesson group with at least `quizMasterMinQuizzes` graded quizzes, as for
 * 🎯 Quiz Master): every student who attempted one of its quizzes, with how many they got right
 * first time (the engine's first-try real pass) and the class median percentage.
 */
export function buildQuizGroupReport({ lesson, timelines, labelFor }) {
  const index = buildBadgeLessonIndex(lesson)
  const { quizMasterMinQuizzes } = resolveBadgeOptions(lesson)
  return index.groups
    .map((group) => ({
      group,
      quizzes: group.taskIds.map((id) => index.get(id)).filter((info) => info?.isGradedQuiz),
    }))
    .filter(({ quizzes }) => quizzes.length >= quizMasterMinQuizzes)
    .map(({ group, quizzes }) => {
      const students = Object.entries(timelines)
        .filter(([, timeline]) =>
          quizzes.some((info) => getTaskAttempts(timeline, info.id).length > 0)
        )
        .map(([studentId, timeline]) => {
          const right = quizzes.filter((info) => getFirstTryRealPass(timeline, info.id)).length
          return {
            studentLabel: labelFor(studentId),
            right,
            total: quizzes.length,
            firstTryPercent: Math.round((right / quizzes.length) * 100),
          }
        })
      return {
        groupId: group.id,
        title: group.title,
        quizTaskIds: quizzes.map((info) => info.id),
        students,
        medianFirstTryPercent: median(students.map((s) => s.firstTryPercent)),
      }
    })
}

/**
 * The teacher sandbox, from the session archive (normaliseSessionArchive's shape), flagged as a
 * possible lesson gap: each visit with the task it followed, the teacher's explainer and pushes,
 * and each student's last sandbox code. Null when the class never went in.
 */
export function buildTeacherSandboxReport({ archive, lesson, labelFor }) {
  const visits = archive?.visits ?? []
  if (visits.length === 0) return null
  return {
    possibleLessonGap: true,
    visits: visits.map((visit) => {
      const previousTask =
        visit.previousTaskId != null
          ? findTaskById(lesson?.tasks ?? [], visit.previousTaskId)
          : null
      return {
        visitId: visit.visitId,
        enteredAt: visit.enteredAt ?? null,
        exitedAt: visit.exitedAt ?? null,
        durationMs: visit.durationMs ?? null,
        previousTaskId: visit.previousTaskId ?? null,
        previousTaskTitle: previousTask?.title ?? null,
        explainer: visit.explainer ?? null,
        pushes: (visit.pushes ?? []).map((push) => ({ ...push })),
        studentSnapshots: Object.entries(visit.studentSnapshots ?? {})
          .filter(([, snapshot]) => snapshot)
          .map(([studentId, snapshot]) => ({ studentLabel: labelFor(studentId), ...snapshot })),
      }
    }),
  }
}

/**
 * Per badge: `{ suggested, awarded, autoAwarded, manual, dismissed, revoked }`. `suggested` is
 * every rule-sourced decision (tutor-decided or auto) plus the suggestions still pending at
 * session end; `awarded` counts badges still held, split into `autoAwarded` and `manual`.
 */
export function buildBadgeSummary(decisions, pendingSuggestions = []) {
  const summary = {}
  const row = (badgeId) =>
    (summary[badgeId] ??= {
      suggested: 0,
      awarded: 0,
      autoAwarded: 0,
      manual: 0,
      dismissed: 0,
      revoked: 0,
    })
  for (const byBadge of Object.values(decisions ?? {})) {
    for (const [badgeId, decision] of Object.entries(byBadge ?? {})) {
      if (!decision) continue
      const counts = row(badgeId)
      if (decision.source === 'rule' || decision.source === 'auto') counts.suggested += 1
      if (decision.status === 'awarded') {
        counts.awarded += 1
        if (decision.source === 'auto') counts.autoAwarded += 1
        if (decision.source === 'manual') counts.manual += 1
      } else if (decision.status === 'dismissed') {
        counts.dismissed += 1
      } else if (decision.status === 'revoked') {
        counts.revoked += 1
      }
    }
  }
  for (const suggestion of pendingSuggestions ?? []) {
    if (suggestion?.badgeId) row(suggestion.badgeId).suggested += 1
  }
  return summary
}

/** `{ [shortcutId]: studentCount }` from the report's students. */
export function buildShortcutSummary(students) {
  const summary = {}
  for (const student of students) {
    const ids = new Set((student.shortcutsUsed ?? []).map((used) => used.shortcutId))
    for (const id of ids) summary[id] = (summary[id] ?? 0) + 1
  }
  return summary
}

const reportBytes = (report) => new TextEncoder().encode(JSON.stringify(report)).length

/**
 * Keeps a report under Firestore's document limit (`maxBytes`, default REPORT_MAX_BYTES): if it
 * is over, the students' teacher-sandbox snapshots are dropped first, then the teacher's pushed
 * code, and `sizeNote` says so. A report that fits is returned unchanged.
 */
export function capSessionReportSize(report, maxBytes = REPORT_MAX_BYTES) {
  if (!report?.teacherSandbox || reportBytes(report) <= maxBytes) return report
  const withoutSnapshots = {
    ...report,
    teacherSandbox: {
      ...report.teacherSandbox,
      studentSnapshotsDropped: true,
      visits: report.teacherSandbox.visits.map((visit) => ({ ...visit, studentSnapshots: [] })),
    },
    sizeNote: REPORT_SIZE_NOTE_SNAPSHOTS,
  }
  if (reportBytes(withoutSnapshots) <= maxBytes) return withoutSnapshots
  return {
    ...withoutSnapshots,
    teacherSandbox: {
      ...withoutSnapshots.teacherSandbox,
      pushesDropped: true,
      visits: withoutSnapshots.teacherSandbox.visits.map((visit) => ({
        ...visit,
        pushes: visit.pushes.map(({ at }) => ({ at })),
      })),
    },
    sizeNote: REPORT_SIZE_NOTE_PUSHES,
  }
}
