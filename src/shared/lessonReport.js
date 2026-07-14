import yaml from 'js-yaml'
import { flattenTasks } from './taskUtils'

const YAML_OPTIONS = { lineWidth: 100, noRefs: true, sortKeys: false, quotingType: '"' }

function isGradedTask(task) {
  return !!task && task.taskType !== 'information' && task.check != null
}

// Combines a (possibly still-live) RTDB session snapshot with the lesson's task
// list into a plain, serializable report object. Only tasks with a check are
// included — information tasks have no pass/fail/attempts concept.
export function buildSessionReport({ session, lesson }) {
  const tasks = flattenTasks(lesson?.tasks ?? []).filter(isGradedTask)
  const studentsSnapshot = session?.students ?? {}
  const attemptLog = session?.attemptLog ?? {}
  const anonymousIds = Array.from(new Set([...Object.keys(studentsSnapshot), ...Object.keys(attemptLog)]))

  const taskStartTimes = session?.taskStartTimes ?? {}

  const students = anonymousIds.map(anonymousId => {
    const studentSnap = studentsSnapshot[anonymousId] ?? {}
    const studentAttempts = attemptLog[anonymousId] ?? {}

    const taskResults = tasks.map(task => {
      const entries = Object.values(studentAttempts[task.id] ?? {})
        .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0))
      const attempts = entries.reduce((sum, entry) => sum + 1 + (entry.retries ?? 0), 0)
      const completed = entries.some(entry => entry.passed)

      // Time on task: elapsed time between the task becoming current and either the
      // moment a passing attempt was logged, or (if not yet completed) the latest attempt.
      const startedAt = taskStartTimes[task.id] ?? null
      const passingEntry = entries.find(entry => entry.passed)
      const referenceTime = completed
        ? (passingEntry?.passedAt ?? passingEntry?.loggedAt ?? null)
        : (entries[entries.length - 1]?.loggedAt ?? null)
      const timeOnTaskMs = (startedAt != null && typeof referenceTime === 'number')
        ? Math.max(0, referenceTime - startedAt)
        : null

      return {
        taskId: task.id,
        title: task.title ?? `Task ${task.id}`,
        completed,
        attempts,
        finalResult: entries.length === 0 ? 'not attempted' : (completed ? 'passed' : 'failed'),
        timeOnTaskMs,
        distinctAttempts: entries.map(entry => ({
          attemptNumber: entry.attemptNumber,
          passed: !!entry.passed,
          retries: entry.retries ?? 0,
          suggestion: entry.suggestion || null,
          submission: entry.submission ?? null,
        })),
      }
    })

    return {
      anonymousId,
      displayName: studentSnap.displayName || anonymousId,
      tasks: taskResults,
    }
  })

  const taskSummary = tasks.map(task => {
    const perStudent = students.map(s => s.tasks.find(t => t.taskId === task.id)).filter(Boolean)
    const attemptedStudents = perStudent.filter(t => t.finalResult !== 'not attempted')
    const completedCount = perStudent.filter(t => t.completed).length
    const totalAttempts = perStudent.reduce((sum, t) => sum + t.attempts, 0)

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

    return {
      taskId: task.id,
      title: task.title ?? `Task ${task.id}`,
      totalStudents: perStudent.length,
      completedCount,
      completionRate: perStudent.length ? Number((completedCount / perStudent.length).toFixed(2)) : 0,
      avgAttempts: attemptedStudents.length ? Number((totalAttempts / attemptedStudents.length).toFixed(2)) : 0,
      avgTimeOnTaskMs,
      commonFailures,
    }
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
  return yaml.dump(report, YAML_OPTIONS)
}
