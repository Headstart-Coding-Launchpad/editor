import yaml from 'js-yaml'
import { flattenTasks, getTaskPriority } from './taskUtils.js'
import { buildPeerHelpAudit } from './peerHelp.js'
import { getTaskActivity } from '../activities/registry.pure.js'
import { SUPPORT_REVEAL_SOURCES } from './taskStages.js'
import { normalizeCodeSubmission } from './codeSubmission.js'
import { isAutoAttempt, latestLeaveAttempt, leaveAttemptResult } from './autoCheck.js'
import { buildShownResponsesByTask } from './shownResponses.js'
import { buildPollsReport } from './classPolls.js'
import {
  buildBadgeSummary,
  buildQuizGroupReport,
  buildReportTimelines,
  buildShortcutSummary,
  buildTeacherSandboxReport,
  capSessionReportSize,
  findFirstRealPasses,
  median,
  studentBadgeFields,
  studentTaskBadgeFields,
  taskSummaryBadgeFields,
} from '../badges/reportMetrics.js'
import { typingReportFields } from './typingStats.js'

const YAML_OPTIONS = { lineWidth: 100, noRefs: true, sortKeys: false, quotingType: '"' }

function getAnonymousStudentLabel(index) {
  return `Student ${index + 1}`
}

function isReportableTask(task) {
  return !!task && task.taskType !== 'information'
}

// Quiz and activity tasks report through their activity definition (report.typeFields,
// normalizeSubmission, summaryFields): quizzes keep the stored shape `{ taskType: 'quiz',
// quizType }`, activities report `{ taskType: 'activity', activityType }`, and code_arrange (an
// activity hosted in the python / html module) keeps `{ taskType: 'code' }`. Code tasks report
// as code.
function getReportActivity(task) {
  return getTaskActivity(task)
}

// A `taskType: 'activity'` task (not a legacy quiz): its report also carries item progress.
function getItemActivity(task) {
  const activity = getTaskActivity(task)
  return activity && !activity.legacy ? activity : null
}

// { correct, total } items right in a submitted activity state, or null.
function getItemProgress(task, submission) {
  const activity = getItemActivity(task)
  if (!activity || submission == null || typeof submission !== 'object') return null
  try {
    const progress = activity.getProgress(task, submission)
    if (!progress || !Number.isFinite(progress.total) || progress.total <= 0) return null
    return { correct: Number(progress.correct) || 0, total: progress.total }
  } catch {
    return null
  }
}

// Mean fraction of items right across the students who submitted (latest attempt each).
function summarizeItemProgress(perStudent) {
  const scored = perStudent.map((t) => t.itemProgress).filter(Boolean)
  if (scored.length === 0) return {}
  const mean = scored.reduce((sum, p) => sum + p.correct / p.total, 0) / scored.length
  return { avgItemProgress: Number(mean.toFixed(2)) }
}

function getTypeFields(task) {
  return getReportActivity(task)?.report.typeFields(task) ?? { taskType: 'code' }
}

// Ungraded quizzes (a confidence rating, an unmarked short answer) are responses, not passes.
function isNotApplicableTask(task) {
  const activity = getReportActivity(task)
  return !!activity && !activity.isGraded(task)
}

// Code submissions (normalizeCodeSubmission, src/shared/codeSubmission.js) are parsed back to
// their object shape when they are JSON; activities normalise their own.
function normalizeSubmission(task, submission) {
  const activity = getReportActivity(task)
  return activity
    ? activity.report.normalizeSubmission(task, submission)
    : normalizeCodeSubmission(submission)
}

// Inverse of normalizeCodeSubmission, applied right at the Firestore write
// boundary (see saveSessionReport). A submitted Scratch workspace state can
// serialize with an array nested directly inside another array (Blockly's
// mutator/extraState shape for some block types) — a shape Firestore rejects
// outright, failing the whole report write. Re-stringifying every
// object-shaped submission here undoes normalizeCodeSubmission's parse and
// sidesteps that, mirroring the starterBlocks/completeBlocks codec in
// lessonBlocksCodec.js. Reports are never read back into objects for further
// processing (TeacherReportModal renders a string submission as-is), so this
// is safe to apply unconditionally.
function encodeSubmissionForFirestore(submission) {
  if (submission && typeof submission === 'object') return JSON.stringify(submission)
  return submission
}

export function encodeSessionReportForFirestore(report) {
  if (!Array.isArray(report?.students)) return report
  return {
    ...report,
    students: report.students.map((student) => ({
      ...student,
      tasks: (student.tasks ?? []).map((task) => ({
        ...task,
        distinctAttempts: (task.distinctAttempts ?? []).map((attempt) => ({
          ...attempt,
          submission: encodeSubmissionForFirestore(attempt.submission),
        })),
        ...(task.autoCheck
          ? {
              autoCheck: {
                ...task.autoCheck,
                submission: encodeSubmissionForFirestore(task.autoCheck.submission),
              },
            }
          : {}),
      })),
    })),
  }
}

function entryReportPassed(task, entry) {
  if (isNotApplicableTask(task)) return null
  return !!entry.passed
}

function countAttempts(entries) {
  return entries.reduce((sum, entry) => sum + 1 + (entry.retries ?? 0), 0)
}

// Override `source`: 'teacher' (a tutor passed the student by hand) or 'class_advance' (written
// when the teacher moved the class on). Records from before 2026-10 carry neither and are left
// without one (read as before: complete).
const OVERRIDE_SOURCES = ['teacher', 'class_advance']

function normalizeOverrideRecord(raw, taskId, entries) {
  if (!raw) return null
  const attempts = countAttempts(entries)
  const previousCheckState =
    raw.previousCheckState === 'failed' || raw.previousCheckState === 'unattempted'
      ? raw.previousCheckState
      : attempts > 0
        ? 'failed'
        : 'unattempted'
  return {
    taskId,
    overriddenAt: raw.overriddenAt ?? raw.timestamp ?? null,
    attemptNumber: Number.isFinite(raw.attemptNumber) ? raw.attemptNumber : attempts,
    previousCheckState,
    ...(OVERRIDE_SOURCES.includes(raw.source) ? { source: raw.source } : {}),
  }
}

// A graded task: one a student can pass or fail. Code tasks need a `check` or `tests`
// (a check-less code task is free practice); quizzes and activities need to be marked.
function isGradedTask(task) {
  if (isNotApplicableTask(task)) return false
  if (getReportActivity(task)) return true
  const check = task?.check
  const hasCheck = Array.isArray(check) ? check.some((c) => c?.type) : !!check?.type
  return hasCheck || (Array.isArray(task?.tests) && task.tests.length > 0)
}

// The auto-check made when the teacher moved the class on (src/shared/autoCheck.js), for a
// student with no real pass: `{ result, suggestion, submission, checkedAt }`, or null.
function getAutoCheck(task, entries) {
  if (entries.some((entry) => entry.passed && !isAutoAttempt(entry))) return null
  const leave = latestLeaveAttempt(entries)
  if (!leave) return null
  return {
    result: leaveAttemptResult(leave),
    suggestion: leave.suggestion || null,
    submission: normalizeSubmission(task, leave.submission),
    checkedAt: typeof leave.loggedAt === 'number' ? leave.loggedAt : null,
  }
}

function getOverrideFinalResult(override) {
  if (!override) return null
  return override.previousCheckState === 'failed' ? 'overridden_failed' : 'overridden_unattempted'
}

function getStudentTaskOverride(overrides, anonymousId, taskId, entries, task) {
  if (entries.some((entry) => entry.passed) || isNotApplicableTask(task)) return null
  return normalizeOverrideRecord(overrides?.[anonymousId]?.[taskId], taskId, entries)
}

function addOverrideSummaryFields(summary, perStudent) {
  const overrideCounts = perStudent.reduce(
    (counts, task) => {
      if (task.finalResult === 'overridden_failed') counts.failed += 1
      if (task.finalResult === 'overridden_unattempted') counts.unattempted += 1
      return counts
    },
    { failed: 0, unattempted: 0 }
  )
  return {
    ...summary,
    overrideCount: overrideCounts.failed + overrideCounts.unattempted,
    overriddenFailedCount: overrideCounts.failed,
    overriddenUnattemptedCount: overrideCounts.unattempted,
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function normalizeCarryFallbackRecord(raw, taskId) {
  if (!raw) return null
  return {
    taskId,
    field: raw.field ?? null,
    requestedSourceTaskId: raw.requestedSourceTaskId ?? null,
    resolvedSourceTaskId: raw.resolvedSourceTaskId ?? null,
    skippedSourceTaskIds: normalizeArray(raw.skippedSourceTaskIds),
    fallbackAt: raw.fallbackAt ?? raw.timestamp ?? null,
    ...(raw.files ? { files: normalizeArray(raw.files) } : {}),
  }
}

function summarizeCarryFallbacks(perStudent) {
  const fallbacks = perStudent.map((task) => task.carryFallback).filter(Boolean)
  const grouped = new Map()

  for (const fallback of fallbacks) {
    const key = JSON.stringify({
      field: fallback.field,
      requestedSourceTaskId: fallback.requestedSourceTaskId,
      resolvedSourceTaskId: fallback.resolvedSourceTaskId,
      skippedSourceTaskIds: fallback.skippedSourceTaskIds,
    })
    const existing = grouped.get(key) ?? {
      field: fallback.field,
      requestedSourceTaskId: fallback.requestedSourceTaskId,
      resolvedSourceTaskId: fallback.resolvedSourceTaskId,
      skippedSourceTaskIds: fallback.skippedSourceTaskIds,
      count: 0,
    }
    existing.count += 1
    grouped.set(key, existing)
  }

  return {
    carryFallbackCount: fallbacks.length,
    carryFallbacks: Array.from(grouped.values()).sort((a, b) => b.count - a.count),
  }
}

function normalizeSupportRevealRecord(raw, taskId, stageIndex) {
  if (!raw) return null
  const numericStageIndex = Number(stageIndex)
  return {
    taskId,
    stageIndex: Number.isFinite(numericStageIndex) ? numericStageIndex : (raw.stageIndex ?? null),
    stageLabel: raw.stageLabel ?? null,
    source: SUPPORT_REVEAL_SOURCES.includes(raw.source) ? raw.source : 'student',
    attemptNumber: Number.isFinite(raw.attemptNumber) ? raw.attemptNumber : 0,
    revealedAt: raw.revealedAt ?? raw.timestamp ?? null,
  }
}

function normalizeSupportReveals(raw, taskId) {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw)
    .map(([stageIndex, reveal]) => normalizeSupportRevealRecord(reveal, taskId, stageIndex))
    .filter(Boolean)
    .sort((a, b) => (a.stageIndex ?? 0) - (b.stageIndex ?? 0))
}

// Large pastes into the editor (students.{id}.pasteLog.{taskId}, see
// recordStudentPaste). Only present when something was pasted.
function normalizePasteRecord(raw) {
  if (!raw || !(raw.count > 0)) return null
  return { count: raw.count, chars: Number.isFinite(raw.chars) ? raw.chars : 0 }
}

function summarizePastes(perStudent) {
  const pasted = perStudent.filter((task) => task.pastes)
  if (pasted.length === 0) return {}
  return {
    pasteCount: pasted.reduce((n, task) => n + task.pastes.count, 0),
    pastedStudentCount: pasted.length,
  }
}

// Typing measures on a code task (students.{id}.typingLog.{taskId}, see useStudentTypingStats
// and src/shared/typingStats.js). Code tasks only: quizzes and activities (Code Arrange
// included) have no typing editor, and a Scratch task never records any.
function studentTypingFields(task, studentNode) {
  if (getReportActivity(task)) return null
  return typingReportFields(studentNode?.typingLog?.[task.id])
}

// The class's typing on a task: the spread of typing rates (students with a rate) and the
// median corrections (students with a typing record). Omitted when nobody typed.
function summarizeTyping(perStudent) {
  const typed = perStudent.map((task) => task.typing).filter(Boolean)
  if (typed.length === 0) return {}
  const rates = typed.map((typing) => typing.charsPerMin).filter((rate) => rate != null)
  return {
    typingSummary: {
      ...(rates.length > 0
        ? {
            charsPerMin: {
              medianPerMin: median(rates),
              minPerMin: Math.min(...rates),
              maxPerMin: Math.max(...rates),
              studentCount: rates.length,
            },
          }
        : {}),
      correctionsMedian: median(typed.map((typing) => typing.corrections)),
    },
  }
}

// The nearest-rank percentile (0-100) of a non-empty list.
function percentile(numbers, p) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[rank - 1]
}

// The spread of students' timeOnTaskMs, so the gap between the median and the slowest student
// is in the report. Omitted when no student has a time.
function summarizeTimeOnTaskSpread(perStudent) {
  const times = perStudent.map((task) => task.timeOnTaskMs).filter((ms) => typeof ms === 'number')
  if (times.length === 0) return {}
  return {
    timeOnTaskSpread: {
      medianMs: median(times),
      p90Ms: percentile(times, 90),
      maxMs: Math.max(...times),
      studentCount: times.length,
    },
  }
}

// The session's current task over time (sessions/{lessonId}/taskTimeline, written by the
// teacher's setTaskId / startSession / exitSandbox): `[{ taskId, startedAt }]`, oldest first,
// every task including information tasks, with consecutive repeats of a task collapsed.
// Sessions from before 2026-10-09 have none (empty list).
export function buildTaskTimeline(session) {
  const entries = Object.values(session?.taskTimeline ?? {})
    .filter(
      (entry) =>
        entry != null &&
        entry.taskId != null &&
        typeof entry.startedAt === 'number' &&
        Number.isFinite(entry.startedAt)
    )
    .sort((a, b) => a.startedAt - b.startedAt)
  const timeline = []
  for (const entry of entries) {
    const last = timeline[timeline.length - 1]
    if (last && String(last.taskId) === String(entry.taskId)) continue
    timeline.push({ taskId: entry.taskId, startedAt: entry.startedAt })
  }
  return timeline
}

function summarizeSupportReveals(perStudent) {
  const reveals = perStudent.flatMap((task) => task.supportReveals ?? [])
  const sourceCounts = reveals.reduce(
    (counts, reveal) => {
      counts[reveal.source] = (counts[reveal.source] ?? 0) + 1
      return counts
    },
    { teacher: 0, student: 0 }
  )
  return {
    supportRevealCount: reveals.length,
    supportRevealStudentCount: perStudent.filter((task) => (task.supportReveals ?? []).length > 0)
      .length,
    supportRevealSources: sourceCounts,
  }
}

// Teacher's live per-task rating (see setTaskRating in useSession.js and
// TaskRatingPanel.jsx). Mirrors attachTeacherFeedback's shape/validation but
// for a single task rather than the whole session, and reads straight off the
// live session snapshot rather than being merged in as a separate step, since
// the rating is already written to RTDB by the time the report is built.
function normalizeTaskRating(raw) {
  if (!raw) return null
  const rating =
    Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null
  const whatWorkedWell = String(raw.whatWorkedWell ?? '').trim()
  const whatDidntWork = String(raw.whatDidntWork ?? '').trim()
  if (rating == null && !whatWorkedWell && !whatDidntWork) return null
  return { rating, whatWorkedWell, whatDidntWork, submittedAt: raw.submittedAt ?? null }
}

// One student's result on one task: `{ finalResult, completed }`. `entries` are the student's
// real attempts (auto-check records removed), `autoCheck` the auto-check made when the class
// moved on (getAutoCheck). Precedence:
// 1. a real pass → passed;
// 2. a tutor's hand pass (override source 'teacher') → overridden_*, complete;
// 3. the auto-check: passed → auto_passed (complete); failed → auto_failed; not_run with no
//    real attempt → auto_not_run (a not_run after real failed attempts falls through: the runs
//    the student did make decide it);
// 4. a class-advance override → overridden_*, NOT complete on a graded task (a check-less code
//    task keeps counting as complete); an override from before sources existed stays complete;
// 5. no attempts → not_attempted, else failed.
// The auto-check outranks the class-advance override because students write it after the
// teacher wrote the override (the override's previousCheckState was taken before it existed).
function resolveTaskOutcome(task, entries, override, autoCheck) {
  if (isNotApplicableTask(task)) {
    return {
      finalResult: entries.length > 0 ? 'not_applicable' : 'not_attempted',
      completed: entries.length > 0,
    }
  }
  if (entries.some((entry) => entry.passed)) return { finalResult: 'passed', completed: true }
  if (override?.source === 'teacher') {
    return { finalResult: getOverrideFinalResult(override), completed: true }
  }
  if (autoCheck?.result === 'passed') return { finalResult: 'auto_passed', completed: true }
  if (autoCheck?.result === 'failed') return { finalResult: 'auto_failed', completed: false }
  if (autoCheck?.result === 'not_run' && entries.length === 0) {
    return { finalResult: 'auto_not_run', completed: false }
  }
  if (override) {
    // Moving the class on still completes quizzes and activities; only graded code tasks
    // (which the auto-check covers) stay incomplete.
    const movedPastCodeTask =
      override.source === 'class_advance' && isGradedTask(task) && !getReportActivity(task)
    return { finalResult: getOverrideFinalResult(override), completed: !movedPastCodeTask }
  }
  return { finalResult: entries.length === 0 ? 'not_attempted' : 'failed', completed: false }
}

// The auto-check counts for a graded task's summary, present only when some student's result
// came from an auto-check.
function addAutoCheckSummaryFields(summary, perStudent) {
  const count = (finalResult) => perStudent.filter((t) => t.finalResult === finalResult).length
  const counts = {
    autoPassedCount: count('auto_passed'),
    autoFailedCount: count('auto_failed'),
    autoNotRunCount: count('auto_not_run'),
  }
  if (Object.values(counts).every((n) => n === 0)) return summary
  return { ...summary, ...counts }
}

// A student reference inside a report section ({ studentLabel, ... }) relabelled through
// `relabel`, with any stray name or id removed.
function relabelStudentRef(ref, relabel) {
  if (!ref || typeof ref !== 'object') return ref
  const { anonymousId, displayName, studentLabel, ...rest } = ref
  return { studentLabel: relabel(studentLabel ?? displayName ?? anonymousId), ...rest }
}

// A student's join history for the report, from the RTDB student node (useSession.joinSession /
// recordStudentReturn): `joinedAt` is the first join (`firstJoinedAt`, never overwritten),
// `joinedAfterMs` its gap after the session started (0 if they joined before the start),
// `joinedAtTaskId` the class's current task at that moment, and `rejoins` each later name entry
// or reload-return, oldest first. The node's own `joinedAt` is not used: every re-join
// overwrites it. Anything unknown (sessions from before 2026-10-01, a removed student) is omitted.
export function studentJoinFields(studentNode, session) {
  const fields = {}
  const joinedAt = studentNode?.firstJoinedAt
  if (typeof joinedAt === 'number' && Number.isFinite(joinedAt)) {
    fields.joinedAt = joinedAt
    const startedAt = session?.startedAt
    if (typeof startedAt === 'number' && Number.isFinite(startedAt)) {
      fields.joinedAfterMs = Math.max(0, joinedAt - startedAt)
    }
    if (studentNode.firstJoinTaskId != null) fields.joinedAtTaskId = studentNode.firstJoinTaskId
  }
  const rejoins = Object.values(studentNode?.rejoins ?? {})
    .filter((entry) => typeof entry?.at === 'number' && Number.isFinite(entry.at))
    .map((entry) => ({ at: entry.at, ...(entry.taskId != null ? { taskId: entry.taskId } : {}) }))
    .sort((a, b) => a.at - b.at)
  if (rejoins.length > 0) fields.rejoins = rejoins
  return fields
}

export function anonymizeSessionReport(report) {
  if (!report) return report
  // Old or hand-made reports may name students; every reference to a student elsewhere in the
  // report (first pass, quiz groups, sandbox snapshots) follows the student's new label.
  const labels = new Map()
  const students = Array.isArray(report.students)
    ? report.students.map((student, index) => {
        const { anonymousId, displayName, studentLabel, ...rest } = student ?? {}
        const label = getAnonymousStudentLabel(index)
        for (const key of [studentLabel, displayName, anonymousId, label]) {
          if (key != null && !labels.has(key)) labels.set(key, label)
        }
        return {
          studentLabel: label,
          ...rest,
        }
      })
    : []
  const relabel = (key) => labels.get(key) ?? 'Former student'

  return {
    ...report,
    students,
    ...(Array.isArray(report.taskSummary)
      ? {
          taskSummary: report.taskSummary.map((task) => ({
            ...task,
            ...(task?.firstRealPass
              ? { firstRealPass: relabelStudentRef(task.firstRealPass, relabel) }
              : {}),
            ...(Array.isArray(task?.shownResponses)
              ? {
                  shownResponses: task.shownResponses.map((ref) => relabelStudentRef(ref, relabel)),
                }
              : {}),
          })),
        }
      : {}),
    ...(Array.isArray(report.quizGroups)
      ? {
          quizGroups: report.quizGroups.map((group) => ({
            ...group,
            students: (group.students ?? []).map((ref) => relabelStudentRef(ref, relabel)),
          })),
        }
      : {}),
    ...(Array.isArray(report.polls)
      ? {
          polls: report.polls.map((poll) => ({
            ...poll,
            responses: (poll.responses ?? []).map((ref) => relabelStudentRef(ref, relabel)),
            notResponded: (poll.notResponded ?? []).map((label) => relabel(label)),
          })),
        }
      : {}),
    ...(report.teacherSandbox
      ? {
          teacherSandbox: {
            ...report.teacherSandbox,
            visits: (report.teacherSandbox.visits ?? []).map((visit) => ({
              ...visit,
              studentSnapshots: (visit.studentSnapshots ?? []).map((ref) =>
                relabelStudentRef(ref, relabel)
              ),
            })),
          },
        }
      : {}),
  }
}

// Combines a (possibly still-live) RTDB session snapshot with the lesson's task
// list into a plain, serializable report object. Information tasks are excluded
// because they have no student interaction to report.
//
// Live badges (docs/architecture/live-badges-plan.md, "Session report") add each student's
// moments, topic opens, shortcuts and sandbox activity, per-task first-edit / error / first-pass
// metrics, quiz-group first tries, the teacher sandbox and the badge and shortcut summaries.
// - `sessionArchive`: the teacher-sandbox archive (useSession's readSessionArchive), or null to
//   leave the teacher sandbox out (the in-progress preview before it loads).
// - `pendingSuggestions`: the badge suggestions still waiting for the tutor (useBadgeSuggestions),
//   counted in `badgeSummary[badgeId].suggested`.
// - `topics`: the Topic Library's topics, for topic titles; `catalogueBadges`: Admin badges.
// The report is trimmed to fit a Firestore document (capSessionReportSize).
export function buildSessionReport({
  session,
  lesson,
  sessionArchive = null,
  pendingSuggestions = [],
  topics = null,
  catalogueBadges = [],
  // peerHelp/{lessonId}, read once by the teacher (src/app/hooks/usePeerHelp.js).
  peerHelp = null,
}) {
  const tasks = flattenTasks(lesson?.tasks ?? []).filter(isReportableTask)
  const studentsSnapshot = session?.students ?? {}
  const attemptLog = session?.attemptLog ?? {}
  const overrideLog = session?.overrideLog ?? {}
  const carryFallbackLog = session?.carryFallbackLog ?? {}
  const supportRevealLog = session?.supportRevealLog ?? {}
  const taskRatingLog = session?.taskRatingLog ?? {}
  const anonymousIds = Array.from(
    new Set([
      ...Object.keys(studentsSnapshot),
      ...Object.keys(attemptLog),
      ...Object.keys(overrideLog),
      ...Object.keys(carryFallbackLog),
      ...Object.keys(supportRevealLog),
      ...Object.keys(session?.badges ?? {}),
      ...Object.keys(session?.studentSignals ?? {}),
      ...(sessionArchive?.visits ?? []).flatMap((visit) =>
        Object.keys(visit.studentSnapshots ?? {})
      ),
      ...Object.values(peerHelp ?? {}).flatMap((request) =>
        [request?.stuckId, request?.helperId].filter(Boolean)
      ),
    ])
  )
  const labelIndex = new Map(anonymousIds.map((id, index) => [id, index]))
  const labelFor = (anonymousId) =>
    labelIndex.has(anonymousId)
      ? getAnonymousStudentLabel(labelIndex.get(anonymousId))
      : 'Former student'

  const taskStartTimes = session?.taskStartTimes ?? {}
  const timelines = buildReportTimelines({ session, lesson, studentIds: anonymousIds, topics })
  const gradedTasks = tasks.filter((task) => !isNotApplicableTask(task))
  const firstPasses = findFirstRealPasses(timelines, gradedTasks)

  const students = anonymousIds.map((anonymousId, index) => {
    const studentAttempts = attemptLog[anonymousId] ?? {}
    const timeline = timelines[anonymousId] ?? []

    const taskResults = tasks.map((task) => {
      const allEntries = Object.values(studentAttempts[task.id] ?? {})
      // Auto-check-on-leave records are not attempts: they never count towards attempts,
      // retries, distinctAttempts or common failures, and only decide the result (getAutoCheck).
      const entries = allEntries
        .filter((entry) => !isAutoAttempt(entry))
        .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0))
      const autoCheck = isGradedTask(task) ? getAutoCheck(task, allEntries) : null
      const override = getStudentTaskOverride(overrideLog, anonymousId, task.id, entries, task)
      const carryFallback = normalizeCarryFallbackRecord(
        carryFallbackLog?.[anonymousId]?.[task.id],
        task.id
      )
      const supportReveals = normalizeSupportReveals(
        supportRevealLog?.[anonymousId]?.[task.id],
        task.id
      )
      const pastes = normalizePasteRecord(studentsSnapshot[anonymousId]?.pasteLog?.[task.id])
      const typing = studentTypingFields(task, studentsSnapshot[anonymousId])
      const attempts = countAttempts(entries)
      const { finalResult, completed } = resolveTaskOutcome(task, entries, override, autoCheck)
      const itemProgress =
        entries.length > 0
          ? getItemProgress(task, normalizeSubmission(task, entries[entries.length - 1].submission))
          : null

      // Time on task: elapsed time between the task becoming current and either the
      // moment a passing attempt/override/auto-check was logged, or (if not yet completed) the
      // latest attempt.
      const startedAt = taskStartTimes[task.id] ?? null
      const passingEntry = entries.find((entry) => entry.passed)
      const referenceTime = completed
        ? (passingEntry?.passedAt ??
          passingEntry?.loggedAt ??
          (finalResult === 'auto_passed' ? autoCheck.checkedAt : null) ??
          override?.overriddenAt ??
          null)
        : (entries[entries.length - 1]?.loggedAt ?? null)
      const timeOnTaskMs =
        startedAt != null && typeof referenceTime === 'number'
          ? Math.max(0, referenceTime - startedAt)
          : null

      return {
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        ...getTypeFields(task),
        completed,
        attempts,
        finalResult,
        timeOnTaskMs,
        ...(override ? { override } : {}),
        ...(autoCheck ? { autoCheck } : {}),
        ...(passingEntry?.teacherAssisted ? { teacherAssisted: true } : {}),
        ...(carryFallback ? { carryFallback } : {}),
        ...(supportReveals.length > 0 ? { supportReveals } : {}),
        ...(pastes ? { pastes } : {}),
        ...(typing ? { typing } : {}),
        ...(itemProgress ? { itemProgress } : {}),
        ...(isNotApplicableTask(task)
          ? {}
          : studentTaskBadgeFields({
              timeline,
              studentId: anonymousId,
              taskId: task.id,
              firstPass: firstPasses.get(String(task.id)) ?? null,
            })),
        distinctAttempts: entries.map((entry) => ({
          attemptNumber: entry.attemptNumber,
          passed: entryReportPassed(task, entry),
          retries: entry.retries ?? 0,
          suggestion: entry.suggestion || null,
          submission: normalizeSubmission(task, entry.submission),
        })),
      }
    })

    return {
      studentLabel: getAnonymousStudentLabel(index),
      ...studentJoinFields(studentsSnapshot[anonymousId], session),
      ...studentBadgeFields({ session, studentId: anonymousId, timeline, catalogueBadges }),
      tasks: taskResults,
    }
  })

  // Answers the teacher showed on the presentation window (src/shared/shownResponses.js).
  const shownByTask = buildShownResponsesByTask(session, labelFor)
  const taskSummary = tasks.map((task) => {
    const perStudent = students
      .map((s) => s.tasks.find((t) => t.taskId === task.id))
      .filter(Boolean)
    const attemptedStudents = perStudent.filter((t) => t.finalResult !== 'not_attempted')
    const completedCount = perStudent.filter((t) => t.completed).length
    const totalAttempts = perStudent.reduce((sum, t) => sum + t.attempts, 0)
    const typeFields = getTypeFields(task)
    const reportActivity = getReportActivity(task)
    const teacherRating = normalizeTaskRating(taskRatingLog[task.id])
    const badgeFields = taskSummaryBadgeFields({
      task,
      perStudent,
      timelines,
      firstPass: firstPasses.get(String(task.id)) ?? null,
      taskStartTimes,
      labelFor,
    })

    const failureCounts = new Map()
    for (const t of perStudent) {
      for (const attempt of t.distinctAttempts) {
        if (attempt.passed || !attempt.suggestion) continue
        failureCounts.set(attempt.suggestion, (failureCounts.get(attempt.suggestion) ?? 0) + 1)
      }
    }
    const commonFailures = Array.from(failureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([suggestion, count]) => ({ suggestion, count }))

    const timedStudents = perStudent.filter((t) => t.timeOnTaskMs != null)
    const avgTimeOnTaskMs = timedStudents.length
      ? Math.round(timedStudents.reduce((sum, t) => sum + t.timeOnTaskMs, 0) / timedStudents.length)
      : null

    // Ungraded quizzes report who responded (plus the rating distribution for a confidence
    // check) instead of completion.
    if (isNotApplicableTask(task)) {
      return {
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        priority: getTaskPriority(task),
        ...typeFields,
        totalStudents: perStudent.length,
        respondedCount: attemptedStudents.length,
        ...reportActivity.report.summaryFields(task, perStudent),
        ...(shownByTask[String(task.id)]?.length
          ? { shownResponses: shownByTask[String(task.id)] }
          : {}),
        avgTimeOnTaskMs,
        commonFailures: [],
        overrideCount: 0,
        overriddenFailedCount: 0,
        overriddenUnattemptedCount: 0,
        ...summarizeCarryFallbacks(perStudent),
        ...summarizeSupportReveals(perStudent),
        ...summarizePastes(perStudent),
        ...badgeFields,
        ...(teacherRating ? { teacherRating } : {}),
      }
    }

    const summary = {
      ...addAutoCheckSummaryFields(
        addOverrideSummaryFields(
          {
            taskId: task.id,
            title: task.title ?? `Task ${task.id}`,
            priority: getTaskPriority(task),
            ...typeFields,
            totalStudents: perStudent.length,
            completedCount,
            completionRate: perStudent.length
              ? Number((completedCount / perStudent.length).toFixed(2))
              : 0,
            avgAttempts: attemptedStudents.length
              ? Number((totalAttempts / attemptedStudents.length).toFixed(2))
              : 0,
            avgTimeOnTaskMs,
            commonFailures,
            teacherAssistedCount: perStudent.filter((t) => t.teacherAssisted).length,
          },
          perStudent
        ),
        perStudent
      ),
      ...summarizeCarryFallbacks(perStudent),
      ...summarizeSupportReveals(perStudent),
      ...summarizePastes(perStudent),
      ...summarizeTimeOnTaskSpread(perStudent),
      ...summarizeTyping(perStudent),
      ...badgeFields,
      ...(teacherRating ? { teacherRating } : {}),
    }
    // Per-item failures for match (pairFailures) and fill-in-the-gaps (blankFailures); the
    // average share of items right for activities.
    return reportActivity
      ? {
          ...summary,
          ...reportActivity.report.summaryFields(task, perStudent),
          ...(getItemActivity(task) ? summarizeItemProgress(perStudent) : {}),
        }
      : summary
  })

  const quizGroups = buildQuizGroupReport({ lesson, timelines, labelFor })
  const teacherSandbox = buildTeacherSandboxReport({
    archive: sessionArchive,
    lesson,
    labelFor,
  })
  const badgeSummary = buildBadgeSummary(session?.badges, pendingSuggestions)
  const shortcutSummary = buildShortcutSummary(students)
  // Live class polls from the teacher's top bar (src/shared/classPolls.js), oldest first.
  const polls = buildPollsReport(session, labelFor)
  // Peer help audit (src/shared/peerHelp.js): every request, with every item sent, approved,
  // rejected or blocked, under the report's anonymous labels.
  const peerHelpAudit = buildPeerHelpAudit({
    peerHelp,
    offers: session?.peerHelpOffers,
    nameOf: labelFor,
  })
  // When the class moved onto each task, information tasks included.
  const taskTimeline = buildTaskTimeline(session)

  return capSessionReportSize({
    lessonId: lesson?.id ?? session?.lessonId ?? null,
    lessonTitle: lesson?.title ?? null,
    sessionId: session?.startedAt != null ? String(session.startedAt) : null,
    startedAt: session?.startedAt ?? null,
    endedAt: session?.endedAt ?? Date.now(),
    students,
    taskSummary,
    ...(taskTimeline.length > 0 ? { taskTimeline } : {}),
    ...(quizGroups.length > 0 ? { quizGroups } : {}),
    ...(teacherSandbox ? { teacherSandbox } : {}),
    ...(Object.keys(badgeSummary).length > 0 ? { badgeSummary } : {}),
    ...(Object.keys(shortcutSummary).length > 0 ? { shortcutSummary } : {}),
    ...(polls.length > 0 ? { polls } : {}),
    ...(peerHelpAudit.length > 0 ? { peerHelp: peerHelpAudit } : {}),
  })
}

// Merges optional teacher-submitted end-of-session feedback (star rating plus
// what-worked-well / what-didn't-work notes) onto a built report. Returns the
// report unchanged when the teacher left every field blank, so reports without
// feedback never carry an empty teacherFeedback stub.
export function attachTeacherFeedback(report, feedback) {
  if (!report) return report
  const rating =
    Number.isInteger(feedback?.rating) && feedback.rating >= 1 && feedback.rating <= 5
      ? feedback.rating
      : null
  const whatWorkedWell = String(feedback?.whatWorkedWell ?? '').trim()
  const whatDidntWork = String(feedback?.whatDidntWork ?? '').trim()

  if (rating == null && !whatWorkedWell && !whatDidntWork) return report

  return {
    ...report,
    teacherFeedback: {
      rating,
      whatWorkedWell,
      whatDidntWork,
      submittedAt: Date.now(),
    },
  }
}

export function reportToYamlText(report) {
  return yaml.dump(anonymizeSessionReport(report), YAML_OPTIONS)
}
