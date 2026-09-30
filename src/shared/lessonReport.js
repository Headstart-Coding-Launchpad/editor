import yaml from 'js-yaml'
import { flattenTasks, getTaskPriority } from './taskUtils.js'
import { getTaskActivity } from '../activities/registry.pure.js'
import { SUPPORT_REVEAL_SOURCES } from './taskStages.js'
import { normalizeCodeSubmission } from './codeSubmission.js'
import {
  buildBadgeSummary,
  buildQuizGroupReport,
  buildReportTimelines,
  buildShortcutSummary,
  buildTeacherSandboxReport,
  capSessionReportSize,
  findFirstRealPasses,
  studentBadgeFields,
  studentTaskBadgeFields,
  taskSummaryBadgeFields,
} from '../badges/reportMetrics.js'

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

function getFinalResult(task, entries, override) {
  if (isNotApplicableTask(task)) return entries.length > 0 ? 'not_applicable' : 'not_attempted'
  if (entries.some((entry) => entry.passed)) return 'passed'
  const overrideResult = getOverrideFinalResult(override)
  if (overrideResult) return overrideResult
  if (entries.length === 0) return 'not_attempted'
  return 'failed'
}

function getCompleted(task, entries, override) {
  if (isNotApplicableTask(task)) return entries.length > 0
  return entries.some((entry) => entry.passed) || !!override
}

// A student reference inside a report section ({ studentLabel, ... }) relabelled through
// `relabel`, with any stray name or id removed.
function relabelStudentRef(ref, relabel) {
  if (!ref || typeof ref !== 'object') return ref
  const { anonymousId, displayName, studentLabel, ...rest } = ref
  return { studentLabel: relabel(studentLabel ?? displayName ?? anonymousId), ...rest }
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
          taskSummary: report.taskSummary.map((task) =>
            task?.firstRealPass
              ? { ...task, firstRealPass: relabelStudentRef(task.firstRealPass, relabel) }
              : task
          ),
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
      const entries = Object.values(studentAttempts[task.id] ?? {}).sort(
        (a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0)
      )
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
      const attempts = countAttempts(entries)
      const completed = getCompleted(task, entries, override)
      const itemProgress =
        entries.length > 0
          ? getItemProgress(task, normalizeSubmission(task, entries[entries.length - 1].submission))
          : null

      // Time on task: elapsed time between the task becoming current and either the
      // moment a passing attempt/override was logged, or (if not yet completed) the latest attempt.
      const startedAt = taskStartTimes[task.id] ?? null
      const passingEntry = entries.find((entry) => entry.passed)
      const referenceTime = completed
        ? (passingEntry?.passedAt ?? passingEntry?.loggedAt ?? override?.overriddenAt ?? null)
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
        finalResult: getFinalResult(task, entries, override),
        timeOnTaskMs,
        ...(override ? { override } : {}),
        ...(passingEntry?.teacherAssisted ? { teacherAssisted: true } : {}),
        ...(carryFallback ? { carryFallback } : {}),
        ...(supportReveals.length > 0 ? { supportReveals } : {}),
        ...(pastes ? { pastes } : {}),
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
      ...studentBadgeFields({ session, studentId: anonymousId, timeline, catalogueBadges }),
      tasks: taskResults,
    }
  })

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
      ...addOverrideSummaryFields(
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
      ...summarizeCarryFallbacks(perStudent),
      ...summarizeSupportReveals(perStudent),
      ...summarizePastes(perStudent),
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

  return capSessionReportSize({
    lessonId: lesson?.id ?? session?.lessonId ?? null,
    lessonTitle: lesson?.title ?? null,
    sessionId: session?.startedAt != null ? String(session.startedAt) : null,
    startedAt: session?.startedAt ?? null,
    endedAt: session?.endedAt ?? Date.now(),
    students,
    taskSummary,
    ...(quizGroups.length > 0 ? { quizGroups } : {}),
    ...(teacherSandbox ? { teacherSandbox } : {}),
    ...(Object.keys(badgeSummary).length > 0 ? { badgeSummary } : {}),
    ...(Object.keys(shortcutSummary).length > 0 ? { shortcutSummary } : {}),
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
