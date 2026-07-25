import yaml from 'js-yaml'
import { flattenTasks, getTaskPriority } from './taskUtils'

const YAML_OPTIONS = { lineWidth: 100, noRefs: true, sortKeys: false, quotingType: '"' }

function getAnonymousStudentLabel(index) {
  return `Student ${index + 1}`
}

function isReportableTask(task) {
  return !!task && task.taskType !== 'information'
}

function getReportTaskType(task) {
  if (task?.taskType === 'quiz') return 'quiz'
  return 'code'
}

function getTypeFields(task) {
  const fields = { taskType: getReportTaskType(task) }
  if (task?.taskType === 'quiz') fields.quizType = task.quizType ?? 'multiple_choice'
  return fields
}

function isNotApplicableTask(task) {
  return task?.taskType === 'quiz' && (
    task.quizType === 'confidence'
    || (task.quizType === 'short_answer' && task.check == null)
  )
}

function parseAnswerState(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

function textMatches(value, expected) {
  return String(value ?? '').trim().toLowerCase() === String(expected ?? '').trim().toLowerCase()
}

function normalizeFillBlankSubmission(task, submission) {
  const state = parseAnswerState(submission)
  const hasDetailedShape = (task?.blanks ?? []).some(blank => {
    const entry = state[blank.id]
    return entry && typeof entry === 'object' && ('expected' in entry || 'correct' in entry)
  })
  if (hasDetailedShape) return state

  const mode = task?.mode ?? 'drag'
  const tiles = [
    ...(task?.blanks ?? []).map(blank => ({ id: blank.id, text: blank.answer })),
    ...(task?.distractors ?? []).map(distractor => ({ id: distractor.id, text: distractor.text })),
  ]
  return Object.fromEntries((task?.blanks ?? []).map(blank => {
    const rawValue = state[blank.id]
    const value = mode === 'drag'
      ? (tiles.find(tile => tile.id === rawValue)?.text ?? rawValue ?? '')
      : (rawValue ?? '')
    const expected = blank.answer ?? ''
    const correct = mode === 'drag'
      ? String(value ?? '') === String(expected)
      : textMatches(value, expected)
    return [blank.id, { value, expected, correct }]
  }))
}

function normalizeMatchSubmission(task, submission) {
  const state = parseAnswerState(submission)
  const hasDetailedShape = (task?.pairs ?? []).some(pair => {
    const entry = state[pair.id]
    return entry && typeof entry === 'object' && ('expected' in entry || 'correct' in entry)
  })
  if (hasDetailedShape) return state

  return Object.fromEntries((task?.pairs ?? []).map(pair => {
    const placedId = state[pair.id]
    const placedPair = (task?.pairs ?? []).find(candidate => candidate.id === placedId)
    return [pair.id, {
      prompt: pair.prompt ?? '',
      value: placedPair?.answer ?? placedId ?? '',
      expected: pair.answer ?? '',
      correct: placedId === pair.id,
    }]
  }))
}

function normalizeConfidenceSubmission(submission) {
  const rating = Number(submission)
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : submission
}

function normalizeSubmission(task, submission) {
  if (task?.taskType !== 'quiz') return submission ?? null
  if (task.quizType === 'fill_blank') return normalizeFillBlankSubmission(task, submission)
  if (task.quizType === 'match') return normalizeMatchSubmission(task, submission)
  if (task.quizType === 'confidence') return normalizeConfidenceSubmission(submission)
  return submission ?? null
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
  const previousCheckState = raw.previousCheckState === 'failed' || raw.previousCheckState === 'unattempted'
    ? raw.previousCheckState
    : attempts > 0 ? 'failed' : 'unattempted'
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
  if (entries.some(entry => entry.passed) || isNotApplicableTask(task)) return null
  return normalizeOverrideRecord(overrides?.[anonymousId]?.[taskId], taskId, entries)
}

function addOverrideSummaryFields(summary, perStudent) {
  const overrideCounts = perStudent.reduce((counts, task) => {
    if (task.finalResult === 'overridden_failed') counts.failed += 1
    if (task.finalResult === 'overridden_unattempted') counts.unattempted += 1
    return counts
  }, { failed: 0, unattempted: 0 })
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
  const fallbacks = perStudent.map(task => task.carryFallback).filter(Boolean)
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
    stageIndex: Number.isFinite(numericStageIndex) ? numericStageIndex : raw.stageIndex ?? null,
    stageLabel: raw.stageLabel ?? null,
    source: raw.source === 'teacher' ? 'teacher' : 'student',
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

function summarizeSupportReveals(perStudent) {
  const reveals = perStudent.flatMap(task => task.supportReveals ?? [])
  const sourceCounts = reveals.reduce((counts, reveal) => {
    counts[reveal.source] = (counts[reveal.source] ?? 0) + 1
    return counts
  }, { teacher: 0, student: 0 })
  return {
    supportRevealCount: reveals.length,
    supportRevealStudentCount: perStudent.filter(task => (task.supportReveals ?? []).length > 0).length,
    supportRevealSources: sourceCounts,
  }
}

function getFinalResult(task, entries, override) {
  if (isNotApplicableTask(task)) return entries.length > 0 ? 'not_applicable' : 'not_attempted'
  if (entries.some(entry => entry.passed)) return 'passed'
  const overrideResult = getOverrideFinalResult(override)
  if (overrideResult) return overrideResult
  if (entries.length === 0) return 'not_attempted'
  return 'failed'
}

function getCompleted(task, entries, override) {
  if (isNotApplicableTask(task)) return entries.length > 0
  return entries.some(entry => entry.passed) || !!override
}

function countValues(values) {
  const counts = new Map()
  for (const value of values) {
    const key = String(value ?? '')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }))
}

function summarizeFillBlankFailures(task, perStudent) {
  const failuresByBlank = new Map()
  for (const t of perStudent) {
    for (const attempt of t.distinctAttempts) {
      const submission = normalizeFillBlankSubmission(task, attempt.submission)
      for (const blank of task.blanks ?? []) {
        const entry = submission[blank.id]
        if (!entry || entry.correct) continue
        const current = failuresByBlank.get(blank.id) ?? { expected: blank.answer ?? '', values: [] }
        current.values.push(entry.value)
        failuresByBlank.set(blank.id, current)
      }
    }
  }
  return Array.from(failuresByBlank.entries())
    .map(([blankId, info]) => ({
      blankId,
      expected: info.expected,
      count: info.values.length,
      values: countValues(info.values),
    }))
    .sort((a, b) => b.count - a.count)
}

function summarizeMatchFailures(task, perStudent) {
  const failuresByPair = new Map()
  for (const t of perStudent) {
    for (const attempt of t.distinctAttempts) {
      const submission = normalizeMatchSubmission(task, attempt.submission)
      for (const pair of task.pairs ?? []) {
        const entry = submission[pair.id]
        if (!entry || entry.correct) continue
        const current = failuresByPair.get(pair.id) ?? {
          prompt: pair.prompt ?? '',
          expected: pair.answer ?? '',
          values: [],
        }
        current.values.push(entry.value)
        failuresByPair.set(pair.id, current)
      }
    }
  }
  return Array.from(failuresByPair.entries())
    .map(([pairId, info]) => ({
      pairId,
      prompt: info.prompt,
      expected: info.expected,
      count: info.values.length,
      values: countValues(info.values),
    }))
    .sort((a, b) => b.count - a.count)
}

export function anonymizeSessionReport(report) {
  if (!report) return report
  const students = Array.isArray(report.students)
    ? report.students.map((student, index) => {
        const { anonymousId, displayName, studentLabel, ...rest } = student ?? {}
        return {
          studentLabel: getAnonymousStudentLabel(index),
          ...rest,
        }
      })
    : []

  return {
    ...report,
    students,
  }
}

// Combines a (possibly still-live) RTDB session snapshot with the lesson's task
// list into a plain, serializable report object. Information tasks are excluded
// because they have no student interaction to report.
export function buildSessionReport({ session, lesson }) {
  const tasks = flattenTasks(lesson?.tasks ?? []).filter(isReportableTask)
  const studentsSnapshot = session?.students ?? {}
  const attemptLog = session?.attemptLog ?? {}
  const overrideLog = session?.overrideLog ?? {}
  const carryFallbackLog = session?.carryFallbackLog ?? {}
  const supportRevealLog = session?.supportRevealLog ?? {}
  const anonymousIds = Array.from(new Set([
    ...Object.keys(studentsSnapshot),
    ...Object.keys(attemptLog),
    ...Object.keys(overrideLog),
    ...Object.keys(carryFallbackLog),
    ...Object.keys(supportRevealLog),
  ]))

  const taskStartTimes = session?.taskStartTimes ?? {}

  const students = anonymousIds.map((anonymousId, index) => {
    const studentAttempts = attemptLog[anonymousId] ?? {}

    const taskResults = tasks.map(task => {
      const entries = Object.values(studentAttempts[task.id] ?? {})
        .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0))
      const override = getStudentTaskOverride(overrideLog, anonymousId, task.id, entries, task)
      const carryFallback = normalizeCarryFallbackRecord(carryFallbackLog?.[anonymousId]?.[task.id], task.id)
      const supportReveals = normalizeSupportReveals(supportRevealLog?.[anonymousId]?.[task.id], task.id)
      const attempts = countAttempts(entries)
      const completed = getCompleted(task, entries, override)

      // Time on task: elapsed time between the task becoming current and either the
      // moment a passing attempt/override was logged, or (if not yet completed) the latest attempt.
      const startedAt = taskStartTimes[task.id] ?? null
      const passingEntry = entries.find(entry => entry.passed)
      const referenceTime = completed
        ? (passingEntry?.passedAt ?? passingEntry?.loggedAt ?? override?.overriddenAt ?? null)
        : (entries[entries.length - 1]?.loggedAt ?? null)
      const timeOnTaskMs = (startedAt != null && typeof referenceTime === 'number')
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
        ...(carryFallback ? { carryFallback } : {}),
        ...(supportReveals.length > 0 ? { supportReveals } : {}),
        distinctAttempts: entries.map(entry => ({
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
      tasks: taskResults,
    }
  })

  const taskSummary = tasks.map(task => {
    const perStudent = students.map(s => s.tasks.find(t => t.taskId === task.id)).filter(Boolean)
    const attemptedStudents = perStudent.filter(t => t.finalResult !== 'not_attempted')
    const completedCount = perStudent.filter(t => t.completed).length
    const totalAttempts = perStudent.reduce((sum, t) => sum + t.attempts, 0)
    const typeFields = getTypeFields(task)

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

    const timedStudents = perStudent.filter(t => t.timeOnTaskMs != null)
    const avgTimeOnTaskMs = timedStudents.length
      ? Math.round(timedStudents.reduce((sum, t) => sum + t.timeOnTaskMs, 0) / timedStudents.length)
      : null

    if (task.taskType === 'quiz' && task.quizType === 'confidence') {
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const t of perStudent) {
        const latest = t.distinctAttempts[t.distinctAttempts.length - 1]
        const rating = Number(latest?.submission)
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
          ratingDistribution[rating] += 1
        }
      }
      return {
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        priority: getTaskPriority(task),
        ...typeFields,
        totalStudents: perStudent.length,
        respondedCount: attemptedStudents.length,
        ratingDistribution,
        avgTimeOnTaskMs,
        commonFailures: [],
        overrideCount: 0,
        overriddenFailedCount: 0,
        overriddenUnattemptedCount: 0,
        ...summarizeCarryFallbacks(perStudent),
        ...summarizeSupportReveals(perStudent),
      }
    }

    if (task.taskType === 'quiz' && task.quizType === 'short_answer' && task.check == null) {
      return {
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        priority: getTaskPriority(task),
        ...typeFields,
        totalStudents: perStudent.length,
        respondedCount: attemptedStudents.length,
        avgTimeOnTaskMs,
        commonFailures: [],
        overrideCount: 0,
        overriddenFailedCount: 0,
        overriddenUnattemptedCount: 0,
        ...summarizeCarryFallbacks(perStudent),
        ...summarizeSupportReveals(perStudent),
      }
    }

    const summary = {
      ...addOverrideSummaryFields({
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        priority: getTaskPriority(task),
        ...typeFields,
        totalStudents: perStudent.length,
        completedCount,
        completionRate: perStudent.length ? Number((completedCount / perStudent.length).toFixed(2)) : 0,
        avgAttempts: attemptedStudents.length ? Number((totalAttempts / attemptedStudents.length).toFixed(2)) : 0,
        avgTimeOnTaskMs,
        commonFailures,
      }, perStudent),
      ...summarizeCarryFallbacks(perStudent),
      ...summarizeSupportReveals(perStudent),
    }
    if (task.taskType === 'quiz' && task.quizType === 'fill_blank') {
      summary.blankFailures = summarizeFillBlankFailures(task, perStudent)
    }
    if (task.taskType === 'quiz' && task.quizType === 'match') {
      summary.pairFailures = summarizeMatchFailures(task, perStudent)
    }
    return summary
  })

  return {
    lessonId: lesson?.id ?? session?.lessonId ?? null,
    lessonTitle: lesson?.title ?? null,
    sessionId: session?.startedAt != null ? String(session.startedAt) : null,
    startedAt: session?.startedAt ?? null,
    endedAt: session?.endedAt ?? Date.now(),
    students,
    taskSummary,
  }
}

export function reportToYamlText(report) {
  return yaml.dump(anonymizeSessionReport(report), YAML_OPTIONS)
}
