import {
  canEvaluateCheckWithoutRun,
  checkNeedsRunResult,
  evaluateSingleCheck,
  getCheckDefinition,
  normalizeCheckShape,
  normalizeChecks,
  normalizeFeedbackChecks,
} from '../src/modules/checks.js'
import { findTaskById, flattenTasks } from '../src/shared/taskUtils.js'
import { getTaskModuleType } from '../src/shared/composedLesson.js'
import { getTaskValidationKind } from '../src/shared/lessonValidation.js'
import { getModuleDefinition } from '../src/modules/definitions.js'
import { getTaskActivityPatternId } from '../src/shared/taskActivity.js'

const EXPECTED_COMPLETION = new Set(['pass', 'fail'])

const SKIPPED = 'skipped'
const NEEDS_RUN_REASON = 'needs a run, which test-checks never does'
const TESTS_REASON = 'the task has Python tests, which decide completion on a run'

function assertCasesFile(casesFile) {
  if (!casesFile || typeof casesFile !== 'object' || Array.isArray(casesFile)) {
    throw new Error('Check cases must be an object with a tasks array')
  }
  if (!Array.isArray(casesFile.tasks) || casesFile.tasks.length === 0) {
    throw new Error('Check cases must include at least one task in tasks')
  }
}

// Why a check can't be judged from a cases file's source code alone, or null when it can.
// Uses the registry (requiresRun / run-only context keys) rather than a list of type names.
function skipReason(check, context) {
  if (canEvaluateCheckWithoutRun(check, context)) return null
  if (checkNeedsRunResult(check)) return NEEDS_RUN_REASON
  const def = getCheckDefinition(normalizeCheckShape(check)?.type)
  if (!def) return 'not a source-code check this command can evaluate'
  return `reads ${def.contextKey} state, which a cases file does not supply`
}

// One check against the case's source: 'pass' | 'fail' | 'skipped' (with a reason).
function judgeCaseCheck(check, context) {
  const reason = skipReason(check, context)
  if (reason) return { result: SKIPPED, reason }
  return { result: evaluateSingleCheck(check, '', context) ? 'pass' : 'fail' }
}

function checkSummary(check, index) {
  const summary = { index: index + 1, type: check.type }
  if (check.operator) summary.operator = check.operator
  return summary
}

/**
 * Completion over a check list. A task's `check` list is AND-ed (the only compound shape the
 * check system has): 'fail' when any check that can be judged fails; otherwise 'pass' when at
 * least one check was judged (the run-only ones are left out); 'skipped' when every check needs
 * a run. A task with no completion check reads 'fail', as at runtime.
 */
export function combineCompletion(results) {
  if (results.length === 0) return 'fail'
  if (results.some((r) => r.result === 'fail')) return 'fail'
  if (results.every((r) => r.result === SKIPPED)) return SKIPPED
  return 'pass'
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
  // A task with Python `tests` is graded by the tests alone at runtime (its checks and
  // feedback checks are not evaluated), and the tests need a run.
  const hasTests = Array.isArray(task.tests) && task.tests.length > 0
  const judge = (check) =>
    hasTests ? { result: SKIPPED, reason: TESTS_REASON } : judgeCaseCheck(check, context)

  const checks = normalizeChecks(task.check).map((check, index) => ({
    ...checkSummary(check, index),
    ...judge(check),
  }))
  const actualCompletion = hasTests ? SKIPPED : combineCompletion(checks)
  const feedback = normalizeFeedbackChecks(task).map((check, index) => ({
    ...checkSummary(check, index),
    hint: check.hint ?? '',
    mode: check.mode,
    show: check.show,
    ...judge(check),
  }))
  const matchedFeedback = feedback.filter((check) => check.result === 'pass')
  const skippedFeedback = feedback.filter((check) => check.result === SKIPPED)
  const mismatches = []
  // A skipped completion can't be compared with the expectation: it is reported, not failed.
  if (actualCompletion !== SKIPPED && actualCompletion !== testCase.completion) {
    mismatches.push(`completion: expected ${testCase.completion}, got ${actualCompletion}`)
  }

  const result = {
    taskId,
    name: testCase.name,
    expected: { completion: testCase.completion },
    actual: { completion: actualCompletion, checks },
    matchedFeedback,
    mismatches,
  }
  if (skippedFeedback.length > 0) result.skippedFeedback = skippedFeedback
  const skippedRuntimeChecks =
    checks.filter((c) => c.result === SKIPPED).length + skippedFeedback.length
  if (skippedRuntimeChecks > 0) result.skippedRuntimeChecks = skippedRuntimeChecks
  return result
}

// Runs source-code examples through the same check dispatcher used at runtime.
// It deliberately supplies only { code }: this command does not execute code or
// fabricate output, variables, or DOM state. Checks that need a run (output,
// code_no_error, variable_*, Turtle, HTML element checks, Python `tests`) are
// reported as 'skipped' and left out of the completion verdict.
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
  const skipped = cases.filter((testCase) => testCase.actual.completion === SKIPPED)
  return {
    success: failed.length === 0,
    lessonId: lesson.id ?? null,
    mode: 'cases',
    cases,
    summary: {
      total: cases.length,
      passed: cases.length - failed.length - skipped.length,
      failed: failed.length,
      skipped: skipped.length,
      skippedRuntimeChecks: cases.reduce((n, c) => n + (c.skippedRuntimeChecks ?? 0), 0),
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
