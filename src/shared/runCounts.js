// Run counts (a task's `runCounts`, p6-26): how many times a marked line of the student's code
// ran. Pure and Node-safe, so the validator, the CLI, the classroom and the tutor views share one
// reading of the field, the marks and the counts.
//
// AUTHORING: `#@count` on the line above the line to count (Python syntax: Python and Turtle;
// stripped like `#@peek`, see ./lineHints.js), up to 3 a task, and the task field
// `runCounts: predict | show` (not under showVariables; works with or without the name-tag panel):
//   predict  a small number box at the end of each marked line ("How many times will this run?").
//            Run waits until every box has a number (predict mode's Run lock and its words,
//            getRunCountLock); after a Run each box becomes "ran 3 times ✓" / "ran 1 time ✗".
//   show     no boxes: after each Run each marked line reads "ran 3 times".
// Checks: `runs_predicted` (optional `lines`) and `line_run_count` (`line` or the marked line,
// `operator` equals | min | max, `value`). A check's `line` / `lines` are line numbers of the
// starter as the student sees it (marker lines removed), re-anchored by text like the marks.
//
// KEYS: a counted line is keyed `L<n>` by its starter line number (so a mark keeps its key when
// the student moves code about; `L` keeps the realtime database from turning the map into an
// array). The run's counts are `{ L3: 4 }`; predictions `{ L3: '4' }`.
//
// COUNTING: the worker counts the 'line' events of the listed lines (src/modules/python/
// pyodide.worker.js, the same line watch as #@peek and slow-mo), so a loop body counts once a
// pass, a line that never ran counts 0, and a stamp or drawing line counts its runs. Marking a
// `for` / `while` header counts every check of the loop (one more than its passes).
import { anchorLineHints, parseLineHints } from './lineHints.js'
import { getStarterStage } from './taskStages.js'
import {
  PREDICT_RUN_LOCK_MESSAGE,
  readSyncedVariables,
  variableCaptureOptions,
} from './variablesPanel/variablesPanel.js'

export const RUN_COUNTS_MODES = Object.freeze(['predict', 'show'])
export const MAX_COUNT_MARKS = 3
export const RUN_COUNT_CHECK_OPERATORS = Object.freeze(['equals', 'min', 'max'])
export const RUN_COUNT_BOX_LABEL = 'How many times will this run?'

// The task field, as python and turtle declare it in their definitions' taskFields.
export const RUN_COUNTS_TASK_FIELD = Object.freeze({
  name: 'runCounts',
  type: 'string',
  values: RUN_COUNTS_MODES,
  description:
    'How many times each #@count line ran (up to 3 marked lines): predict (a number box at the end of each marked line, Run waits until every box is filled; after Run it reads "ran 3 times ✓") or show (after each Run, "ran 3 times"). Works with or without showVariables.',
})

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function checkList(check) {
  if (!check) return []
  return Array.isArray(check) ? check.filter((c) => c?.type) : [check]
}

const sameTask = (value, task) =>
  value?.taskId != null && task?.id != null && String(value.taskId) === String(task.id)

export const countKey = (line) => `L${line}`

/** The task's `runCounts` mode ('predict' | 'show'), or null when it has none. */
export function getRunCounts(task) {
  return RUN_COUNTS_MODES.includes(task?.runCounts) ? task.runCounts : null
}

// The starter code of a task: its first starter stage's code, else starterCode.
function starterCode(task) {
  const code = getStarterStage(task)?.stage?.code
  if (typeof code === 'string') return code
  return typeof task?.starterCode === 'string' ? task.starterCode : ''
}

// The starter as the student sees it, with its count marks: the classroom's tasks are already
// stripped (parsing again changes nothing), an authored task (the session report, the
// validator) still has its marker lines.
export function parsedStarter(task) {
  return parseLineHints(starterCode(task), 'python')
}

/**
 * The task's `#@count` marks: `[{ key, line, target }]`, at most MAX_COUNT_MARKS, `line` in the
 * stripped code. A stripped (classroom) task's runtime-only `countSets` (starter first; the first
 * set with marks), else the authored starter's own markers.
 */
export function getTaskCountMarks(task) {
  const set = (Array.isArray(task?.countSets) ? task.countSets : []).find(
    (entry) => (entry?.file ?? null) === null && Array.isArray(entry?.counts) && entry.counts.length
  )
  const counts = set ? set.counts : parsedStarter(task).counts
  return (counts ?? [])
    .filter((mark) => Number.isInteger(mark?.line) && typeof mark?.target === 'string')
    .slice(0, MAX_COUNT_MARKS)
    .map((mark) => ({ key: countKey(mark.line), line: mark.line, target: mark.target }))
}

/**
 * The lines a task's `line_run_count` checks name with `line` (completion and feedback checks),
 * as `[{ key, line, target }]` with the target read from the starter as the student sees it (a
 * line that isn't code there is left out; validation reports it).
 */
export function getCheckCountLines(task) {
  const lines = String(parsedStarter(task).code ?? '').split('\n')
  const out = []
  for (const check of [...checkList(task?.check), ...checkList(task?.feedbackChecks)]) {
    if (check?.type !== 'line_run_count' || !Number.isInteger(check.line)) continue
    const target = (lines[check.line - 1] ?? '').trim()
    if (!target || target.startsWith('#')) continue
    if (out.some((entry) => entry.line === check.line)) continue
    out.push({ key: countKey(check.line), line: check.line, target })
  }
  return out
}

/** Every line the task counts: its marks, then check lines that aren't marks. */
export function getCountTargets(task) {
  const marks = getTaskCountMarks(task)
  const extra = getCheckCountLines(task).filter(
    (entry) => !marks.some((mark) => mark.key === entry.key)
  )
  return [...marks, ...extra]
}

/**
 * Whether a run of the task counts lines: it has `runCounts` and marks, or a `line_run_count`
 * check (which counts its `line`, or the first mark) with something to count.
 */
export function taskCountsRuns(task) {
  if (getRunCounts(task) != null && getTaskCountMarks(task).length > 0) return true
  const hasCheck = [...checkList(task?.check), ...checkList(task?.feedbackChecks)].some(
    (check) => check?.type === 'line_run_count'
  )
  return hasCheck && getCountTargets(task).length > 0
}

/**
 * Places counted lines on the student's current `code`, the way hints are re-anchored (the same
 * line if it still reads the same, else the one line whose trimmed text matches; a line deleted or
 * duplicated is dropped): `[{ key, line }]` with `line` 1-based in `code`.
 */
export function anchorCountLines(targets, code) {
  const lines = String(code ?? '').split('\n')
  const out = []
  for (const target of targets ?? []) {
    const [anchored] = anchorLineHints(lines, [
      { line: target.line, target: target.target, text: target.key },
    ])
    if (anchored) out.push({ key: target.key, line: anchored.line })
  }
  return out
}

/** The task's marks placed on `code` (anchorCountLines): `[{ key, line }]`. */
export function anchorCountMarks(task, code) {
  return anchorCountLines(getTaskCountMarks(task), code)
}

/**
 * What a run of `code` asks the worker to capture: the name-tag panel's options
 * (variableCaptureOptions) plus `countLines` (the counted lines placed on `code`) and
 * `lineOffset` (the runtime's own first lines: Turtle's shim). Null for neither.
 */
export function runCaptureOptions(task, code, { lineOffset = 0 } = {}) {
  const panel = variableCaptureOptions(task, code, { lineOffset })
  const countLines = taskCountsRuns(task)
    ? [...new Set(anchorCountLines(getCountTargets(task), code).map((entry) => entry.line))]
    : []
  if (countLines.length === 0) return panel
  return { ...(panel ?? { panel: false }), countLines, lineOffset }
}

/**
 * A finished run's counts by key (`{ L3: 4 }`): each counted line placed on the `code` that ran,
 * with the worker's count for that line (0 when it never ran). Null when the worker counted
 * nothing (`lineCounts` null: the code never started) or the task counts no lines.
 */
export function buildRunCounts(task, code, lineCounts) {
  if (!isPlainObject(lineCounts) || !taskCountsRuns(task)) return null
  const counts = {}
  for (const { key, line } of anchorCountLines(getCountTargets(task), code)) {
    const count = Number(lineCounts[String(line)])
    counts[key] = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0
  }
  return counts
}

// ─── Predictions ─────────────────────────────────────────────────────────────

/** Whether a typed count matches the real count: a whole number, spaces ignored. */
export function countPredictionMatches(text, count) {
  const typed = String(text ?? '').replace(/\s+/g, '')
  return /^\d+$/.test(typed) && Number.isInteger(count) && Number(typed) === count
}

/**
 * Marks each count prediction: `{ results: { key: bool }, entries: [{ key, line, value, ran,
 * correct }], allCorrect }`, in `marks` order (`ran` the real count, null when the line wasn't
 * placed on the code that ran). A blank prediction is wrong.
 */
export function evaluateCountPredictions(marks, values, counts) {
  const typed = isPlainObject(values) ? values : {}
  const entries = (marks ?? []).map((mark) => {
    const value = typeof typed[mark.key] === 'string' ? typed[mark.key] : ''
    const ran =
      isPlainObject(counts) && Number.isInteger(counts[mark.key]) ? counts[mark.key] : null
    return {
      key: mark.key,
      line: mark.line,
      value,
      ran,
      correct: ran != null && countPredictionMatches(value, ran),
    }
  })
  return {
    results: Object.fromEntries(entries.map((entry) => [entry.key, entry.correct])),
    entries,
    allCorrect: entries.length > 0 && entries.every((entry) => entry.correct),
  }
}

/** "ran 3 times", "ran 1 time", "ran 0 times". */
export function ranTimesText(count) {
  const n = Number.isInteger(count) ? count : 0
  return `ran ${n} ${n === 1 ? 'time' : 'times'}`
}

/**
 * What screen readers hear for a counted line: "Line 3 ran 4 times. You predicted 4: right."
 * (`line` as the editor numbers it; without a prediction, just the count).
 */
export function describeRunCount({ line, count, value = '', correct = null }) {
  const ran = `Line ${line} ${ranTimesText(count)}.`
  const typed = String(value ?? '').trim()
  if (!typed || correct == null) return ran
  return `${ran} You predicted ${typed}: ${correct ? 'right' : 'not quite'}.`
}

/**
 * Predict mode's Run lock for count boxes (`runCounts: predict`), sharing the name-tag panel's
 * lock and words (getPredictRunLock in ./variablesPanel/variablesPanel.js): until the first Run of
 * the task, Run waits for a number in every box shown on `code` (a mark that no longer anchors has
 * no box, so it never blocks). `predictions` is useVariablesPanel's state (`counts`, `ran`).
 * `showVariables.lockRun: false` turns it off too. Returns `{ message, missing }` or null.
 */
export function getRunCountLock(task, predictions, code) {
  if (getRunCounts(task) !== 'predict') return null
  if (task?.showVariables?.lockRun === false) return null
  const own = sameTask(predictions, task) ? predictions : null
  if (own?.ran) return null
  const typed = isPlainObject(own?.counts) ? own.counts : {}
  const missing = anchorCountMarks(task, code)
    .filter((mark) => !String(typed[mark.key] ?? '').trim())
    .map((mark) => `line ${mark.line} (runs)`)
  return missing.length > 0 ? { message: PREDICT_RUN_LOCK_MESSAGE, missing } : null
}

/**
 * Both predict locks together (the name-tag panel's and the count boxes'): null when neither
 * locks, else one `{ message, missing }`.
 */
export function combineRunLocks(...locks) {
  const set = locks.filter(Boolean)
  if (set.length === 0) return null
  return { message: set[0].message, missing: set.flatMap((lock) => lock.missing ?? []) }
}

// ─── The editor's boxes and labels ───────────────────────────────────────────

/**
 * The run-count state a view shows for a task, from the student's own hook state (`panel`:
 * useVariablesPanel's `{ predictions, countRun }`) or a synced copy (`synced`: a tutor's view of
 * students/{id}/currentVariables, a Go Live broadcast): `{ values, counts, ran }`.
 */
export function runCountStateFor(task, { panel = null, synced = undefined } = {}) {
  if (synced !== undefined) {
    const part = readSyncedVariables(synced).runCounts
    const own = part && (part.taskId == null || sameTask(part, task)) ? part : null
    return { values: own?.values ?? {}, counts: own?.counts ?? null, ran: !!own?.counts }
  }
  const predictions = sameTask(panel?.predictions, task) ? panel.predictions : null
  const countRun = sameTask(panel?.countRun, task) ? panel.countRun : null
  return {
    values: isPlainObject(predictions?.counts) ? predictions.counts : {},
    counts: isPlainObject(countRun?.counts) ? countRun.counts : null,
    ran: !!predictions?.ran,
  }
}

/**
 * What the code editor shows on each marked line (CodeEditor's `runCounts`, ./runCountsEditor.js):
 * `{ mode, readOnly, marks: [{ key, line, value, count, correct, editable }] }`, or null when the
 * task has no runCounts or no mark is placed on `code`. `count` is the last run's count (null
 * before one), `correct` whether the prediction matched (null without both), and `editable` that
 * the student types in the box (predict mode, their own view, before their first Run, not while
 * it runs).
 */
export function getRunCountWidgets(
  task,
  code,
  source = {},
  { readOnly = false, running = false } = {}
) {
  const mode = getRunCounts(task)
  if (!mode) return null
  const marks = anchorCountMarks(task, code)
  if (marks.length === 0) return null
  const state = runCountStateFor(task, source)
  return {
    mode,
    readOnly: !!readOnly,
    marks: marks.map(({ key, line }) => {
      const count = state.counts && Number.isInteger(state.counts[key]) ? state.counts[key] : null
      const value = mode === 'predict' ? String(state.values[key] ?? '') : ''
      return {
        key,
        line,
        value,
        count,
        correct: count == null || !value.trim() ? null : countPredictionMatches(value, count),
        editable: mode === 'predict' && !readOnly && !running && count == null && !state.ran,
      }
    }),
  }
}

// ─── Checks ──────────────────────────────────────────────────────────────────

/**
 * The `runs_predicted` check: every marked line's prediction (or those named by starter line in
 * `lines`) matched its real count. Reads `context.runCounts` (`{ marks, values, counts }`, from
 * the run), so it can't pass without a real run.
 */
export function evaluateRunsPredictedCheck(check, _output, context = {}) {
  const state = context?.runCounts
  if (!state || !isPlainObject(state.counts)) return false
  let marks = Array.isArray(state.marks) ? state.marks : []
  if (Array.isArray(check?.lines) && check.lines.length > 0) {
    const keys = check.lines.map(countKey)
    marks = marks.filter((mark) => keys.includes(mark.key))
    if (marks.length !== keys.length) return false
  }
  if (marks.length === 0) return false
  return evaluateCountPredictions(marks, state.values, state.counts).allCorrect
}

/**
 * The `line_run_count` check: the counted line (`line`, a starter line number, else the first
 * `#@count` mark) ran `value` times (`operator` equals, the default), at least (`min`) or at most
 * (`max`) that many. Reads `context.runCounts.counts`.
 */
export function evaluateLineRunCountCheck(check, _output, context = {}) {
  const state = context?.runCounts
  if (!state || !isPlainObject(state.counts)) return false
  const key = Number.isInteger(check?.line)
    ? countKey(check.line)
    : Array.isArray(state.marks)
      ? state.marks[0]?.key
      : null
  const count = key != null ? state.counts[key] : undefined
  const value = Number(check?.value)
  if (!Number.isInteger(count) || !Number.isFinite(value)) return false
  const operator = check?.operator ?? 'equals'
  if (operator === 'min') return count >= value
  if (operator === 'max') return count <= value
  return count === value
}

// ─── Tutor card and session report ───────────────────────────────────────────

/**
 * A runCounts: predict task's count boxes as the tutor chip counts them (predictionChipSummary
 * in ./variablesPanel/predictions.js): `[{ label, value, result }]`, labelled "line N runs".
 */
export function countPredictionItems(task, synced) {
  if (getRunCounts(task) !== 'predict') return []
  const { runCounts } = readSyncedVariables(synced)
  const own =
    runCounts && (runCounts.taskId == null || sameTask(runCounts, task)) ? runCounts : null
  const values = own?.values ?? {}
  const results = own?.results ?? null
  return getTaskCountMarks(task).map((mark) => ({
    label: `line ${mark.line} runs`,
    value: String(values[mark.key] ?? ''),
    result: results && mark.key in results ? results[mark.key] === true : null,
  }))
}

// One count reveal as kept in a predictionLog entry's `counts` (buildPredictionLogEntry).
export function countLogEntries(countEvaluation) {
  return Object.fromEntries(
    (countEvaluation?.entries ?? []).map((entry) => [
      entry.key,
      {
        value: String(entry.value ?? '').slice(0, 20),
        ran: Number.isInteger(entry.ran) ? entry.ran : null,
        correct: !!entry.correct,
      },
    ])
  )
}

function normalizeCountReveal(raw, marks) {
  if (!isPlainObject(raw) || !isPlainObject(raw.counts)) return null
  const entries = marks
    .filter((mark) => isPlainObject(raw.counts[mark.key]))
    .map((mark) => {
      const entry = raw.counts[mark.key]
      return {
        line: mark.line,
        value: String(entry.value ?? ''),
        ran: Number.isInteger(entry.ran) ? entry.ran : null,
        correct: entry.correct === true,
      }
    })
  if (entries.length === 0) return null
  return {
    at: typeof raw.at === 'number' ? raw.at : null,
    entries,
    allCorrect: entries.every((entry) => entry.correct),
  }
}

/**
 * The per-student report fields of a `runCounts: predict` task, from the count part of
 * students/{id}/predictionLog/{taskId}: `{ runCountPredictions: { reveals, first, last,
 * firstAllCorrect, lastAllCorrect } }` with `first` / `last` as `[{ line, value, ran, correct }]`
 * in mark order (`line` the starter line), or `{}`.
 */
export function runCountReportFields(task, studentNode) {
  if (getRunCounts(task) !== 'predict') return {}
  const raw = studentNode?.predictionLog?.[task?.id]
  if (!isPlainObject(raw)) return {}
  const marks = getTaskCountMarks(task)
  const reveals = Object.values(raw)
    .map((entry) => normalizeCountReveal(entry, marks))
    .filter(Boolean)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  if (reveals.length === 0) return {}
  const first = reveals[0]
  const last = reveals[reveals.length - 1]
  return {
    runCountPredictions: {
      reveals: reveals.length,
      first: first.entries,
      last: last.entries,
      firstAllCorrect: first.allCorrect,
      lastAllCorrect: last.allCorrect,
    },
  }
}

/**
 * The task-summary fields over every student's `runCountPredictions`: how many predicted, how
 * many were all right first time, and per marked line how many first predictions were right
 * (`runCountFirstByLine: [{ line, correct, total, offByOne }]`, `offByOne` the wrong ones one away:
 * the misconception the pilot measures). `{}` when nobody predicted.
 */
export function summarizeRunCountPredictions(perStudent) {
  const predicted = (perStudent ?? []).filter((task) => task?.runCountPredictions)
  if (predicted.length === 0) return {}
  const byLine = new Map()
  for (const task of predicted) {
    for (const entry of task.runCountPredictions.first ?? []) {
      const tally = byLine.get(entry.line) ?? {
        line: entry.line,
        correct: 0,
        total: 0,
        offByOne: 0,
      }
      tally.total += 1
      if (entry.correct) tally.correct += 1
      else if (
        Number.isInteger(entry.ran) &&
        /^\d+$/.test(entry.value.trim()) &&
        Math.abs(Number(entry.value.trim()) - entry.ran) === 1
      ) {
        tally.offByOne += 1
      }
      byLine.set(entry.line, tally)
    }
  }
  return {
    runCountStudentCount: predicted.length,
    runCountFirstAllCorrectCount: predicted.filter(
      (task) => task.runCountPredictions.firstAllCorrect
    ).length,
    runCountFirstByLine: [...byLine.values()],
  }
}
