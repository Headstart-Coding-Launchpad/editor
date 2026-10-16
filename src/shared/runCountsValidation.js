// Lesson validation for run counts (a task's `runCounts` and its `#@count` markers, p6-26) and
// the `runs_predicted` / `line_run_count` checks. Shared by the Builder and the CLI (through the
// python and turtle module definitions' validateTask and the check registry). Messages are
// documented in docs/authoring/validation-errors.md.
import { parseLineHints } from './lineHints.js'
import {
  MAX_COUNT_MARKS,
  RUN_COUNTS_MODES,
  RUN_COUNT_CHECK_OPERATORS,
  parsedStarter,
} from './runCounts.js'

function checkList(check) {
  if (!check) return []
  return Array.isArray(check) ? check.filter((c) => c?.type) : [check]
}

// The task's completion and feedback checks.
function allChecks(task) {
  return [...checkList(task?.check), ...checkList(task?.feedbackChecks)]
}

// Every piece of authored code that can hold markers (starter, complete, every stage).
function codeSources(task) {
  return [
    task?.starterCode,
    task?.completeCode,
    ...(Array.isArray(task?.codeStages) ? task.codeStages.map((stage) => stage?.code) : []),
  ].filter((code) => typeof code === 'string')
}

const isCodeLine = (text) => {
  const trimmed = String(text ?? '').trim()
  return trimmed !== '' && !trimmed.startsWith('#')
}

/** `validateTask` for Python and Turtle: the `runCounts` field and the `#@count` markers. */
export function validateRunCounts(task, n, errors, warnings = []) {
  const mode = task?.runCounts
  if (mode != null && !RUN_COUNTS_MODES.includes(mode)) {
    errors.push(`Task ${n} has runCounts "${mode}" — use one of: ${RUN_COUNTS_MODES.join(', ')}`)
  }
  let markerCount = 0
  for (const code of codeSources(task)) {
    const parsed = parseLineHints(code, 'python')
    markerCount = Math.max(markerCount, parsed.counts.length)
    if (parsed.counts.length > MAX_COUNT_MARKS) {
      warnings.push(
        `Task ${n} has ${parsed.counts.length} #@count lines — only the first 3 are counted`
      )
    }
    if (parsed.countMissed > 0) {
      warnings.push(
        `Task ${n} has a #@count marker with no line of code after it; it counts nothing`
      )
    }
  }
  const checks = allChecks(task)
  const hasLineCheck = checks.some((check) => check?.type === 'line_run_count')
  if (RUN_COUNTS_MODES.includes(mode) && markerCount === 0) {
    warnings.push(
      `Task ${n} has runCounts but no #@count line in its code — put #@count on the line above the line to count`
    )
  }
  if (mode == null && markerCount > 0 && !hasLineCheck) {
    warnings.push(
      `Task ${n} has #@count lines but no runCounts — add runCounts: predict or show to show the counts`
    )
  }

  const starter = parsedStarter(task)
  const starterLines = String(starter.code ?? '').split('\n')
  const markedLines = starter.counts.slice(0, MAX_COUNT_MARKS).map((mark) => mark.line)
  const markedWords = markedLines.length > 0 ? markedLines.join(', ') : 'none'
  for (const check of checks) {
    if (check?.type === 'runs_predicted') {
      if (mode !== 'predict') {
        errors.push(`Task ${n} has a runs_predicted check but runCounts is not predict`)
        continue
      }
      const lines = Array.isArray(check.lines) ? check.lines : []
      const unknown = lines.filter((line) => !markedLines.includes(line))
      if (unknown.length > 0) {
        errors.push(
          `Task ${n} has a runs_predicted check naming line ${unknown.join(', ')}, which is not a #@count line of the starter — the marked lines are ${markedWords}`
        )
      }
    }
    if (check?.type === 'line_run_count') {
      if (check.line == null) {
        if (markedLines.length === 0) {
          errors.push(
            `Task ${n} has a line_run_count check with no line and no #@count line in its starter`
          )
        }
      } else if (Number.isInteger(check.line) && !isCodeLine(starterLines[check.line - 1])) {
        errors.push(
          `Task ${n} has a line_run_count check on line ${check.line}, which is not a line of code in the starter (lines count without marker lines)`
        )
      }
    }
  }
}

function moduleHasRunCounts(moduleDefinition) {
  return !!moduleDefinition?.taskFields?.some((field) => field.name === 'runCounts')
}

const isWholeNumber = (value) => Number.isInteger(value) && value > 0

// The registry `validate` of the runs_predicted check (src/modules/python/checks.js).
export function validateRunsPredictedCheck(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  if (moduleDefinition && !moduleHasRunCounts(moduleDefinition)) {
    errors.push(
      `Task ${n} has a runs_predicted ${label}, but it only works in Python and Turtle tasks`
    )
  }
  if (
    check.lines != null &&
    (!Array.isArray(check.lines) || check.lines.length === 0 || !check.lines.every(isWholeNumber))
  ) {
    errors.push(`Task ${n} has a runs_predicted ${label} whose lines is not a list of line numbers`)
  }
  return errors
}

// The registry `validate` of the line_run_count check (src/modules/python/checks.js).
export function validateLineRunCountCheck(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  if (moduleDefinition && !moduleHasRunCounts(moduleDefinition)) {
    errors.push(
      `Task ${n} has a line_run_count ${label}, but it only works in Python and Turtle tasks`
    )
  }
  if (check.line != null && !isWholeNumber(check.line)) {
    errors.push(`Task ${n} has a line_run_count ${label} whose line is not a line number`)
  }
  if (check.operator != null && !RUN_COUNT_CHECK_OPERATORS.includes(check.operator)) {
    errors.push(
      `Task ${n} has a line_run_count ${label} with operator "${check.operator}" — use one of: ${RUN_COUNT_CHECK_OPERATORS.join(', ')}`
    )
  }
  const value = typeof check.value === 'string' ? Number(check.value.trim()) : check.value
  if (check.value == null || check.value === '' || !Number.isInteger(value) || value < 0) {
    errors.push(`Task ${n} has a line_run_count ${label} without a whole-number value`)
  }
  return errors
}
