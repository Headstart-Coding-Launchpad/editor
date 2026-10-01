import {
  evaluateSingleCheck,
  normalizeChecks,
  normalizeFeedbackChecks,
} from '../src/modules/checks.js'
import { findTaskById, flattenTasks } from '../src/shared/taskUtils.js'
import { getTaskModuleType } from '../src/shared/composedLesson.js'
import { getTaskValidationKind } from '../src/shared/lessonValidation.js'
import { getModuleDefinition } from '../src/modules/definitions.js'
import { getTaskActivityPatternId } from '../src/shared/taskActivity.js'

const EXPECTED_COMPLETION = new Set(['pass', 'fail'])

function completionResult(passed) {
  return passed ? 'pass' : 'fail'
}

function assertCasesFile(casesFile) {
  if (!casesFile || typeof casesFile !== 'object' || Array.isArray(casesFile)) {
    throw new Error('Check cases must be an object with a tasks array')
  }
  if (!Array.isArray(casesFile.tasks) || casesFile.tasks.length === 0) {
    throw new Error('Check cases must include at least one task in tasks')
  }
}

function evaluateCase(task, taskId, testCase, caseIndex) {
  if (!testCase || typeof testCase !== 'object' || Array.isArray(testCase)) {
    throw new Error(`Task ${taskId} case ${caseIndex + 1} must be an object`)
  }
  if (!String(testCase.name ?? '').trim()) {
    throw new Error(`Task ${taskId} case ${caseIndex + 1} is missing a name`)
  }
  if (typeof testCase.code !== 'string') {
    throw new Error(`Task ${taskId} case "${testCase.name}" must provide code as a string`)
  }
  if (!EXPECTED_COMPLETION.has(testCase.completion)) {
    throw new Error(`Task ${taskId} case "${testCase.name}" completion must be "pass" or "fail"`)
  }

  const context = { code: testCase.code }
  const completionChecks = normalizeChecks(task.check)
  const completionPassed =
    completionChecks.length > 0 &&
    completionChecks.every((check) => evaluateSingleCheck(check, '', context))
  const actualCompletion = completionResult(completionPassed)
  const feedback = normalizeFeedbackChecks(task).map((check, index) => ({
    index: index + 1,
    type: check.type,
    operator: check.operator,
    hint: check.hint ?? '',
    mode: check.mode,
    show: check.show,
    result: completionResult(evaluateSingleCheck(check, '', context)),
  }))
  const matchedFeedback = feedback.filter((check) => check.result === 'pass')
  const mismatches = []
  if (actualCompletion !== testCase.completion) {
    mismatches.push(`completion: expected ${testCase.completion}, got ${actualCompletion}`)
  }

  return {
    taskId,
    name: testCase.name,
    expected: { completion: testCase.completion },
    actual: { completion: actualCompletion },
    matchedFeedback,
    mismatches,
  }
}

// Runs source-code examples through the same check dispatcher used at runtime.
// It deliberately supplies only { code }: this command does not execute code or
// fabricate output, variables, or DOM state for checks that require them.
export function testLessonChecks(lesson, casesFile) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    throw new Error('Lesson must be an object')
  }
  assertCasesFile(casesFile)

  const cases = []
  for (const taskCases of casesFile.tasks) {
    const taskId = taskCases?.id
    if (taskId == null || taskId === '') throw new Error('Each check-case task must include an id')
    if (!Array.isArray(taskCases.cases) || taskCases.cases.length === 0) {
      throw new Error(`Task ${taskId} must include at least one case`)
    }

    const task = findTaskById(lesson.tasks, taskId)
    if (!task) throw new Error(`Lesson task ${taskId} was not found`)

    taskCases.cases.forEach((testCase, caseIndex) => {
      cases.push(evaluateCase(task, taskId, testCase, caseIndex))
    })
  }

  const failed = cases.filter((testCase) => testCase.mismatches.length > 0)
  return {
    success: failed.length === 0,
    lessonId: lesson.id ?? null,
    cases,
    summary: {
      total: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length,
    },
  }
}

// ── Stage verification (no cases file) ───────────────────────────────────────
// Tasks whose module declares `verifyTaskChecks` (Scratch) need no cases file: each task's
// completion and feedback checks are evaluated against its own authored stages (Scratch:
// Complete blocks, starter, Complete-role code stages). Checks that need a run are reported as
// skipped.

function stageVerifier(lesson, task) {
  if (!task || typeof task !== 'object' || getTaskValidationKind(task) !== 'module') return null
  // Each task's own module: composed lessons mix modules.
  const moduleType = getTaskModuleType(lesson, task) ?? lesson.type
  return getModuleDefinition(moduleType)?.verifyTaskChecks ?? null
}

// The lesson's tasks that `test-checks` can verify without a cases file.
export function getStageVerifiableTasks(lesson) {
  return flattenTasks(lesson?.tasks ?? []).filter((task) => stageVerifier(lesson, task))
}

const countSkipped = (stage) =>
  [...(stage?.completion?.checks ?? []), ...(stage?.feedback ?? [])].filter(
    (check) => check.result === 'skipped'
  ).length

export function testStageChecks(lesson, { taskId } = {}) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    throw new Error('Lesson must be an object')
  }
  let verifiable = getStageVerifiableTasks(lesson)
  if (taskId != null && taskId !== '') {
    verifiable = verifiable.filter((task) => String(task.id) === String(taskId))
    if (verifiable.length === 0) throw new Error(`Scratch task ${taskId} was not found`)
  }
  if (verifiable.length === 0) throw new Error('The lesson has no Scratch tasks')

  const warnings = []
  let stagesChecked = 0
  let skippedRuntimeChecks = 0
  const tasks = verifiable.map((task) => {
    const verify = stageVerifier(lesson, task)
    const { warnings: taskWarnings, ...result } = verify(task, task.id, {
      activityPattern: getTaskActivityPatternId(task),
    })
    warnings.push(...taskWarnings)
    stagesChecked += result.stages.length
    skippedRuntimeChecks += countSkipped(result.stages.find((stage) => stage.completion))
    return result
  })

  return {
    success: warnings.length === 0,
    lessonId: lesson.id ?? null,
    mode: 'stages',
    tasks,
    warnings,
    summary: {
      tasks: tasks.length,
      stagesChecked,
      failed: warnings.length,
      skippedRuntimeChecks,
    },
  }
}
