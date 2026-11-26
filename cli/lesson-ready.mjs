// `hsc lessons ready`: the pure half, with no browser or Firebase. It validates a lesson as
// published, finds the asset URLs it uses, plans what to run for each task, judges the runs
// (cli/lesson-ready-run.mjs drives the browser) and rolls it all up into one report.
//
// Honesty rule: anything not actually run or fetched is "not_checked" with its reason, and a
// lesson with anything not checked is "not_fully_checked", never "ready".

import { validateLessonForMcp } from './validate.mjs'
import { flattenTasks } from '../src/shared/taskUtils.js'
import { getTaskModuleType } from '../src/shared/composedLesson.js'
import {
  getTaskActivity,
  getTaskFormat,
  isLegacyQuizTask,
  isModuleHostedActivityTask,
} from '../src/activities/registry.pure.js'
import { assembleCodeArrangement, buildSolutionSlotState } from '../src/shared/codeArrange.js'
import { isIndentArrangeTask } from '../src/shared/codeArrangeIndent.js'
import { formatStageLabel, getStageRole } from '../src/shared/taskStages.js'
import {
  isRunAttemptedCheck,
  normalizeChecks,
  normalizeFeedbackChecks,
} from '../src/modules/checks.js'
import { codeCallsInput } from '../src/shared/scrub/runOnOpen.js'
import { getTaskSetupCode } from '../src/shared/puzzle/setupCode.js'
import { resolveAssetsPath } from '../src/shared/assetPaths.js'
import { getPredictRunLock } from '../src/shared/variablesPanel/variablesPanel.js'
import { getRunCountLock } from '../src/shared/runCounts.js'
import {
  evaluateScratchStage,
  getScratchVerificationStages,
} from '../src/modules/scratch/checkVerification.js'

export const PASS = 'pass'
export const FAIL = 'fail'
export const NOT_CHECKED = 'not_checked'
export const NOTHING_TO_RUN = 'nothing_to_run'

// How `lessons ready` checks each module's code tasks (a map, so a new module is "not run yet"
// until it is added here):
// - run: run in the browser on the #/shot page;
// - blocks: checks judged on each stage's blocks without a run, as the classroom judges block
//   checks (run-time checks are reported not checked);
// - frozen: reported not checked, never built for.
export const READY_METHOD_BY_MODULE = Object.freeze({
  python: 'run',
  turtle: 'run',
  scratch: 'blocks',
  html: 'frozen',
  filesystem: 'frozen',
  desktop: 'frozen',
})

// What `lessons ready` never looks at, listed in every report.
export const NOT_COVERED = Object.freeze([
  'Topic Library links (use lessons preflight)',
  'tutor views, live sessions and the Admin screens',
  'how the lesson reads or looks (use lessons screenshot)',
  'Starter stages after the first, and Python or Turtle Complete stages after the first',
  'Scratch run-time checks, and Scratch starters carried from another task (the authored starter is judged)',
  'activities, Arcade and Electronics tasks',
  'quiz feedback and hints, and code_arrange tile hints and arrangements other than the model one',
])

// ── 1. Validate as published ─────────────────────────────────────────────────

/** The CLI validation with the draft flag ignored, so a Draft gets every check rule. */
export function validateAsPublished(lesson) {
  const { errors, warnings } = validateLessonForMcp({ ...lesson, draft: false })
  return {
    status: errors.length === 0 ? PASS : FAIL,
    wasDraft: lesson?.draft === true,
    errors,
    warnings,
  }
}

// ── 2. Assets ────────────────────────────────────────────────────────────────

// Code, blocks and files are the child's program, not lesson assets.
const SKIP_KEYS =
  /^(?:.*code|.*blocks|prebuiltStacks|starterFiles|completeFiles|files|starter|_sealed|assetsPath)$/i
// A whole-string value under one of these keys is an asset URL.
const URL_KEYS = /(url|src|image|img|icon|thumb|costume|sound|audio|asset|picture|sprite)/i
const MD_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g
const SRC_ATTR = /\bsrc\s*=\s*["']([^"']+)["']/gi

function splitBase(base) {
  const url = new URL(base)
  return { origin: url.origin, baseUrl: url.pathname }
}

// One asset reference as written: its URL, or null with the reason it can't be fetched.
function resolveRef(ref, base) {
  // Inline data, and folders (assetsPath), are not files to fetch.
  if (/^(?:data|blob):/i.test(ref) || ref.endsWith('/')) return null
  if (/^https?:\/\//i.test(ref)) return { url: ref }
  if (ref.startsWith('//')) return { url: `https:${ref}` }
  if (ref.startsWith('/')) {
    if (!base) return { url: null, reason: 'a path on the app (no --base to resolve it)' }
    return { url: resolveAssetsPath(ref, splitBase(base)) }
  }
  return {
    url: null,
    reason: "a relative path: the app resolves it against the lesson's files, not checked",
  }
}

/**
 * Every image or asset the lesson references: Markdown images and src attributes in any text,
 * and URL-like fields (storageAssets, picture options, sprites). One entry per URL with every
 * place it is used (`where`). Code, blocks and files are skipped.
 */
export function collectAssetRefs(lesson, { base = null } = {}) {
  const byKey = new Map()
  const add = (ref, where) => {
    const resolved = resolveRef(ref.trim(), base)
    if (!resolved) return
    const key = resolved.url ?? `ref:${ref}`
    const entry = byKey.get(key) ?? { url: resolved.url, ref, where: [] }
    if (resolved.reason) entry.reason = resolved.reason
    if (!entry.where.includes(where)) entry.where.push(where)
    byKey.set(key, entry)
  }
  const scanText = (text, key, where) => {
    for (const m of text.matchAll(MD_IMAGE)) add(m[1], where)
    for (const m of text.matchAll(SRC_ATTR)) add(m[1], where)
    if (URL_KEYS.test(key) && /^(?:https?:\/\/|\/\/|\/)[^\s]+$/i.test(text.trim())) {
      add(text, where)
    }
  }
  const walk = (value, key, where) => {
    if (typeof value === 'string') return scanText(value, key, where)
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) return value.forEach((v) => walk(v, key, where))
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.test(k)) continue
      walk(v, k, where)
    }
  }
  for (const [k, v] of Object.entries(lesson ?? {})) {
    if (k === 'tasks' || SKIP_KEYS.test(k)) continue
    walk(v, k, k)
  }
  for (const task of flattenTasks(lesson?.tasks ?? [])) {
    for (const [k, v] of Object.entries(task ?? {})) {
      if (SKIP_KEYS.test(k)) continue
      walk(v, k, `task ${task.id} ${k}`)
    }
  }
  return [...byKey.values()]
}

async function fetchOne(url, fetchImpl, timeoutMs) {
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    await res.body?.cancel?.().catch(() => {})
    // 416: the file is there but has no byte 0 (an empty file).
    const ok = res.ok || res.status === 416
    return { ok, status: res.status }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Fetches each URL (one byte of it). Broken ones fail; refs with no URL are not checked. */
export async function checkAssets(
  refs,
  { fetchImpl = fetch, concurrency = 6, timeoutMs = 15_000 } = {}
) {
  const fetchable = refs.filter((r) => r.url)
  const notChecked = refs
    .filter((r) => !r.url)
    .map(({ ref, where, reason }) => ({ ref, where, reason }))
  const broken = []
  let next = 0
  const worker = async () => {
    while (next < fetchable.length) {
      const ref = fetchable[next++]
      const res = await fetchOne(ref.url, fetchImpl, timeoutMs)
      if (!res.ok) broken.push({ url: ref.url, where: ref.where, ...res, ok: undefined })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, fetchable.length) }, worker))
  for (const b of broken) delete b.ok
  const status = broken.length ? FAIL : notChecked.length ? NOT_CHECKED : PASS
  return { status, checked: fetchable.length, broken, notChecked }
}

// ── 3. What to run per task ──────────────────────────────────────────────────

function stage(task, role) {
  const stages = Array.isArray(task?.codeStages) ? task.codeStages : []
  const found = stages.find((s) => s?.role === role)
  if (found?.code != null) return String(found.code)
  if (role === 'complete' && task?.completeCode != null) return String(task.completeCode)
  if (role === 'starter' && task?.starterCode != null) return String(task.starterCode)
  return null
}

// The code a child starts the task with: the starter, or (carryCodeFrom) the code a child who
// finished that task carries in, which is its complete code.
function starterFor(lesson, task) {
  if (task.carryCodeFromLesson) {
    return {
      code: null,
      skip: "the starter is carried from an earlier lesson (the child's own work)",
    }
  }
  if (task.carryCodeFrom != null && task.carryCodeFrom !== '') {
    const from = flattenTasks(lesson.tasks).find(
      (t) => String(t?.id) === String(task.carryCodeFrom)
    )
    const code = from ? stage(from, 'complete') : null
    if (code == null) {
      return {
        code: null,
        skip: `the starter is carried from task ${task.carryCodeFrom}, which has no complete code`,
      }
    }
    return { code, note: `carried from task ${task.carryCodeFrom}'s complete code` }
  }
  return { code: stage(task, 'starter') ?? '' }
}

function authoredHints(task) {
  const hints = []
  normalizeChecks(task.check).forEach((c, i) => {
    if (typeof c.hint === 'string' && c.hint.trim())
      hints.push({ source: `check[${i}]`, index: i, hint: c.hint })
  })
  normalizeFeedbackChecks(task).forEach((c, i) => {
    if (typeof c.hint === 'string' && c.hint.trim()) {
      hints.push({ source: `feedbackChecks[${i}]`, index: i, hint: c.hint })
    }
  })
  return hints
}

// The same program but for trailing spaces and blank lines at either end.
const sameCode = (a, b) => {
  const plain = (text) =>
    String(text ?? '')
      .replace(/[ \t]+$/gm, '')
      .trim()
  return a != null && b != null && plain(a) === plain(b)
}

const INPUT_SKIP = "the code calls input(): answers can't be guessed (give them with --inputs)"

const LOCK_SKIP = 'predict mode locks Run until the child fills in their predictions'

// The --inputs answers for one run: a list for every run of the task, or { starter, complete }.
function answersFor(taskInputs, role) {
  const list = Array.isArray(taskInputs) ? taskInputs : taskInputs?.[role]
  return Array.isArray(list) ? list.map((v) => String(v)) : null
}

/** A run's own key in the results (`starter`, `complete`, `support:<n>`). */
export const runKey = (run) => run.key ?? run.role

function codeRun(task, role, code, expect, extra = {}, taskInputs = null) {
  const run = { role, key: role, code, expect, ...extra }
  if (run.skip != null || code == null) return run
  const answers = answersFor(taskInputs, role)
  if (answers) run.inputs = answers
  if (!answers && (codeCallsInput(code) || codeCallsInput(getTaskSetupCode(task)))) {
    run.skip = INPUT_SKIP
  } else if (getPredictRunLock(task, null) || getRunCountLock(task, null, code))
    run.skip = LOCK_SKIP
  return run
}

/**
 * What `lessons ready` does with one task: `status` and `reason` when it runs nothing, else
 * `runs` ({ role, code, expect: 'not_pass' | 'pass' | 'runs_clean' | 'runs', skip? }) and the
 * authored `hints` to look for. `inputs`: this task's answers to input() (see answersFor).
 */
export function planTask(lesson, task, { inputs = null } = {}) {
  const module = getTaskModuleType(lesson, task) ?? lesson?.type ?? null
  const format = getTaskFormat(task)
  const base = { id: task.id, title: task.title ?? '', module, format, runs: [], hints: [] }
  const stop = (status, reason) => ({ ...base, status, reason })

  if (format === 'information') return stop(NOTHING_TO_RUN, 'information task')
  if (isLegacyQuizTask(task)) return planQuizTask(task, base, stop)
  // code_arrange: an activity hosted by a workspace module, run as that module's code.
  const arrange = isModuleHostedActivityTask(task)
  if (format !== 'code' && !arrange)
    return stop(NOT_CHECKED, `${format} tasks are not run by lessons ready yet`)
  const method = Object.hasOwn(READY_METHOD_BY_MODULE, module ?? '')
    ? READY_METHOD_BY_MODULE[module]
    : null
  if (method === 'frozen') return stop(NOT_CHECKED, `${module} is a frozen module: not checked`)
  if (method === 'blocks' && !arrange) return planBlocksTask(task, base)
  if (method !== 'run') return stop(NOT_CHECKED, `${module} tasks are not run by lessons ready yet`)
  if (task.tests?.length > 0) return stop(NOT_CHECKED, 'Python tests (Run Tests) are not run yet')
  if (task.interactionMode === 'submit') {
    return stop(NOT_CHECKED, 'a submit-mode task (Submit is not pressed yet)')
  }
  if (arrange) return planArrangeTask(task, base, inputs)

  const setupCode = getTaskSetupCode(task)
  const starter = starterFor(lesson, task)
  const complete = stage(task, 'complete')
  const hasCheck = normalizeChecks(task.check).length > 0
  const starterExtra = {
    ...(starter.skip ? { skip: starter.skip } : {}),
    ...(starter.note ? { note: starter.note } : {}),
  }
  const runs = []
  // A run-and-read task: the child only presses Run, so its starter is meant to pass (the
  // authored starter is the complete code, or every completion check is run_attempted). Carried
  // code that equals the complete code is not that: the child would start with the answer.
  const runAndRead =
    hasCheck &&
    ((complete != null && sameCode(stage(task, 'starter') ?? '', complete)) ||
      normalizeChecks(task.check).every(isRunAttemptedCheck))
  if (runAndRead) {
    runs.push(
      codeRun(
        task,
        'starter',
        starter.code,
        'pass',
        { ...starterExtra, note: 'a run-and-read task: the starter is meant to pass' },
        inputs
      )
    )
    // run_attempted passes any run, so different complete code is only checked for errors.
    if (complete != null && !sameCode(starter.code, complete)) {
      runs.push(codeRun(task, 'complete', complete, 'runs_clean', {}, inputs))
    }
  } else if (hasCheck) {
    runs.push(codeRun(task, 'starter', starter.code, 'not_pass', starterExtra, inputs))
    runs.push(
      complete == null
        ? {
            role: 'complete',
            code: null,
            expect: 'pass',
            skip: 'no complete code to prove the checks can pass',
          }
        : codeRun(task, 'complete', complete, 'pass', {}, inputs)
    )
  } else if (complete != null) {
    runs.push(codeRun(task, 'complete', complete, 'runs_clean', {}, inputs))
  } else {
    runs.push(codeRun(task, 'starter', starter.code, 'runs', starterExtra, inputs))
  }
  // A Support stage is a hint a child (or tutor) can take over: it must not pass the checks.
  if (hasCheck && !runAndRead) {
    ;(Array.isArray(task.codeStages) ? task.codeStages : []).forEach((s, i) => {
      if (getStageRole(s) !== 'support' || s?.code == null) return
      runs.push(codeRun(task, 'support', String(s.code), 'not_pass', supportRunExtra(s, i), inputs))
    })
  }
  const hints = authoredHints(task).map(({ index: _index, ...h }) => h)
  return { ...base, setup: setupCode != null, runs, hints }
}

const SUPPORT_PASSES = 'already passes the checks: offering it hands the child the answer'

function supportRunExtra(stage, index) {
  const label = formatStageLabel(stage, index)
  return {
    key: `support:${index}`,
    name: `${label} does not pass`,
    failDetail: `${label} ${SUPPORT_PASSES}`,
  }
}

// ── code_arrange: the model arrangement run as the host module's code ─────────
//
// The classroom marks an arrangement by running the assembled program through the host module's
// Run and checks, so the model arrangement (every blank holding its own tile, or every line at
// its authored depth) runs as that module's code task (lesson-ready-run.mjs runTaskCopy). In
// indent mode the lines' start depths are a runnable program too, which must not pass. A slot
// board can't Run until every blank is filled, so it has no starter run.
function planArrangeTask(task, base, inputs) {
  const hasCheck = normalizeChecks(task.check).length > 0
  const model = assembleCodeArrangement(task, buildSolutionSlotState(task))
  const runs = []
  if (hasCheck && isIndentArrangeTask(task)) {
    const start = assembleCodeArrangement(task, {})
    runs.push(
      codeRun(
        task,
        'starter',
        start,
        'not_pass',
        {
          name: 'start arrangement does not pass',
          failDetail:
            'every line already starts at a depth that passes: a child could finish without moving anything',
        },
        inputs
      )
    )
  }
  const expect = hasCheck ? 'pass' : 'runs_clean'
  const extra = {
    name: hasCheck ? 'model arrangement passes' : 'model arrangement runs without an error',
    what: 'model arrangement',
  }
  runs.push(
    model == null
      ? {
          role: 'complete',
          key: 'complete',
          code: null,
          expect,
          ...extra,
          skip: 'the model arrangement does not assemble',
        }
      : codeRun(task, 'complete', model, expect, extra, inputs)
  )
  const hints = authoredHints(task).map(({ index: _index, ...h }) => h)
  return { ...base, setup: getTaskSetupCode(task) != null, runs, hints }
}

// ── Quizzes: graded by the quiz's own grader ──────────────────────────────────
//
// The classroom marks a quiz with its definition's grade(task, answer) (useActivityState), so
// that is what judges here: the model answer (solutionState, read back the way a stored answer
// is, so an option the quiz no longer offers is no answer) must pass, and a blank one must not.
function gradeQuiz(def, task, state) {
  try {
    const answer = def.deserialize(def.serialize(state), task)
    return { passed: !!def.grade(task, answer)?.passed }
  } catch (e) {
    return { error: e.message }
  }
}

function planQuizTask(task, base, stop) {
  const def = getTaskActivity(task)
  if (def.completion === 'none' || !def.isGraded(task)) {
    return stop(NOTHING_TO_RUN, 'an ungraded quiz: any answer completes it')
  }
  if (!def.solutionState) {
    return stop(NOT_CHECKED, 'no model answer to grade (a typed answer is not guessed)')
  }
  const graded = (name, state, expectPass, failDetail) => {
    const result = gradeQuiz(def, task, state)
    if (result.error) return { name, status: FAIL, detail: `grading stopped: ${result.error}` }
    return result.passed === expectPass
      ? { name, status: PASS }
      : { name, status: FAIL, detail: failDetail }
  }
  const checks = [
    graded(
      'blank answer does not pass',
      def.initialState(task),
      false,
      'a blank answer already passes: a child could finish without answering'
    ),
    graded(
      'model answer passes',
      def.solutionState(task),
      true,
      "the quiz's own answer is marked wrong: no child can pass it"
    ),
  ]
  return { ...base, method: 'grade', gradeChecks: checks }
}

// ── Scratch: the checks judged on each stage's blocks ─────────────────────────

const BLOCKS_NOTE = 'judged on the blocks without a run, as in class'

// One stage's completion verdict as a check: `expectPass` for complete stages. `passDetail`: why
// a stage that must not pass is a problem when it does.
function blocksCheck(
  name,
  entry,
  expectPass,
  passDetail = 'the starter blocks already pass every completion check: a child could finish without changing anything'
) {
  if (!entry) return { name, status: NOT_CHECKED, reason: 'no such stage' }
  if (entry.error) return { name, status: FAIL, detail: `the ${entry.stage} ${entry.error}` }
  const result = entry.completion.result
  if (result === 'none') return { name, status: NOT_CHECKED, reason: 'no completion check' }
  if (result === 'incomplete') {
    return expectPass
      ? { name, status: NOT_CHECKED, reason: 'its run-time checks need a run, which is not made' }
      : { name, status: NOT_CHECKED, reason: 'the block checks pass; run-time checks not judged' }
  }
  const passed = result === 'pass'
  if (passed === expectPass) return { name, status: PASS, note: BLOCKS_NOTE }
  const failed = entry.completion.checks.filter((c) => c.result === 'fail').map((c) => c.type)
  return {
    name,
    status: FAIL,
    detail: expectPass
      ? `the ${entry.stage} blocks fail completion check(s): ${failed.join(', ')}`
      : passDetail,
  }
}

function planBlocksTask(task, base) {
  if (normalizeChecks(task.check).length === 0) {
    return { ...base, status: NOTHING_TO_RUN, reason: 'no completion check' }
  }
  const stages = getScratchVerificationStages(task, { includeSupport: true }).map(
    ({ stage, kind, blocks }) => {
      // A task with no starter blocks starts on an empty workspace.
      if (blocks == null && kind !== 'starter') return { stage, kind, missing: true }
      blocks = blocks ?? {}
      try {
        return { stage, kind, blocks, ...evaluateScratchStage(task, blocks) }
      } catch (e) {
        return { stage, kind, error: `blocks are not valid JSON (${e.message})` }
      }
    }
  )
  const starter = stages.find((s) => s.kind === 'starter' && !s.missing)
  const completes = stages.filter((s) => s.kind === 'complete' && !s.missing)
  // A run-and-read task: the starter is the complete blocks.
  const runAndRead =
    starter?.blocks != null &&
    completes.some((c) => JSON.stringify(c.blocks) === JSON.stringify(starter.blocks))
  const checks = []
  if (!runAndRead) checks.push(blocksCheck('starter does not pass', starter, false))
  if (completes.length === 0) {
    checks.push({
      name: 'complete blocks pass',
      status: NOT_CHECKED,
      reason: 'no complete blocks to prove the checks can pass',
    })
  }
  for (const c of completes) checks.push(blocksCheck(`${c.stage} blocks pass`, c, true))
  if (!runAndRead) {
    for (const s of stages.filter((x) => x.kind === 'support')) {
      const name = `${s.stage} does not pass`
      const detail = `the ${s.stage} blocks already pass every completion check: offering the stage hands the child the answer`
      checks.push(blocksCheck(name, s, false, detail))
    }
  }
  // A completion check's hint shows when a stage the child could be on fails it; a feedback
  // check's when it fires.
  const hints = authoredHints(task).map(({ index, ...h }) => {
    const shows = h.source.startsWith('check')
      ? (s) => s.kind !== 'complete' && s.completion?.checks[index]?.result === 'fail'
      : (s) => s.feedback?.[index]?.result === 'fires'
    return { ...h, seenIn: stages.filter(shows).map((s) => s.stage) }
  })
  return { ...base, method: 'blocks', blockChecks: checks, blockHints: hints }
}

/** Every task's plan. `inputs`: { [taskId]: answers } from --inputs. */
export function planTasks(lesson, { inputs = {} } = {}) {
  return flattenTasks(lesson?.tasks ?? []).map((task) =>
    planTask(lesson, task, { inputs: inputs?.[String(task.id)] ?? null })
  )
}

// ── 4. Judging the runs ──────────────────────────────────────────────────────

const RUN_NAMES = {
  not_pass: 'starter does not pass',
  pass: 'complete code passes',
  runs_clean: 'complete code runs without an error',
  runs: 'starter runs',
}

const plainText = (text) =>
  String(text ?? '')
    // Links and images read as their text.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

function hintSeen(shown, hint) {
  const a = plainText(shown)
  const b = plainText(hint)
  return !!a && !!b && a.includes(b)
}

const tail = (text, n = 300) => {
  const s = String(text ?? '').trim()
  return s.length > n ? `…${s.slice(-n)}` : s
}

function judgeRun(run, result) {
  const name =
    run.name ??
    (run.role === 'starter' && run.expect === 'pass'
      ? 'starter passes (run and read)'
      : RUN_NAMES[run.expect])
  // What the run's code is, in a failure's detail.
  const what = run.what ?? (run.role === 'starter' ? 'starter (run and read)' : 'complete code')
  const item = { name, role: run.role }
  if (run.note) item.note = run.note
  if (run.skip) return { ...item, status: NOT_CHECKED, reason: run.skip }
  if (!result) return { ...item, status: NOT_CHECKED, reason: 'not run' }
  if (result.status !== 'done') {
    return { ...item, status: NOT_CHECKED, reason: result.reason ?? 'the run did not finish' }
  }
  const shown = result.hintShown ? `; the child sees: "${result.hintShown}"` : ''
  switch (run.expect) {
    case 'not_pass':
      if (result.verdict === 'passed') {
        return {
          ...item,
          status: FAIL,
          detail:
            run.failDetail ??
            'the starter already passes the checks: a child could finish without changing anything',
        }
      }
      if (result.verdict === 'failed') return { ...item, status: PASS }
      return { ...item, status: NOT_CHECKED, reason: 'no check result appeared after Run' }
    case 'pass':
      if (result.verdict === 'passed') return { ...item, status: PASS }
      if (result.verdict === 'failed') {
        return {
          ...item,
          status: FAIL,
          detail: `the ${what} fails the checks${shown}${result.runError ? `; output: ${tail(result.output)}` : ''}`,
        }
      }
      return { ...item, status: NOT_CHECKED, reason: 'no check result appeared after Run' }
    case 'runs_clean':
      return result.runError
        ? {
            ...item,
            status: FAIL,
            detail: `the ${run.what ?? 'complete code'} stops with an error: ${tail(result.output)}`,
          }
        : { ...item, status: PASS }
    default:
      return result.runError
        ? {
            ...item,
            status: PASS,
            warning: `the starter stops with an error: ${tail(result.output)}`,
          }
        : { ...item, status: PASS }
  }
}

function rollUp(statuses) {
  if (statuses.includes(FAIL)) return FAIL
  if (statuses.includes(NOT_CHECKED)) return NOT_CHECKED
  return PASS
}

/** One task's report from its plan and its run results, by run key ({ starter, complete, … }). */
export function judgeTask(plan, results = {}) {
  const { runs, hints, setup, ...rest } = plan
  const base = { id: rest.id, title: rest.title, module: rest.module, format: rest.format }
  if (plan.status)
    return { ...base, status: plan.status, reason: plan.reason, checks: [], hints: [] }
  if (plan.method === 'grade') {
    const checks = plan.gradeChecks
    return {
      ...base,
      method: 'grade',
      status: rollUp(checks.map((c) => c.status)),
      checks,
      hints: [],
    }
  }
  if (plan.method === 'blocks') {
    const checks = plan.blockChecks
    const hints = plan.blockHints.map(({ seenIn, ...h }) =>
      seenIn.length
        ? { ...h, status: 'shown', seenIn }
        : { ...h, status: NOT_CHECKED, reason: 'no authored stage makes this hint show' }
    )
    const status = rollUp([
      ...checks.map((c) => c.status),
      ...hints.map((h) => (h.status === 'shown' ? PASS : NOT_CHECKED)),
    ])
    return { ...base, method: 'blocks', status, checks, hints }
  }

  const checks = runs.map((run) => judgeRun(run, results[runKey(run)]))
  if (setup) {
    const done = runs.map((r) => results[runKey(r)]).filter((r) => r?.status === 'done')
    const broke = done.find((r) => r.setupError)
    checks.push(
      broke
        ? {
            name: 'setup runs clean',
            status: FAIL,
            detail:
              'setupCode stops with an error: the child sees "This task\'s setup has a problem"',
          }
        : done.length
          ? { name: 'setup runs clean', status: PASS }
          : { name: 'setup runs clean', status: NOT_CHECKED, reason: 'no run finished' }
    )
  }
  const hintReports = hints.map((h) => {
    const seenIn = runs
      .filter((r) => !r.skip && hintSeen(results[runKey(r)]?.hintShown, h.hint))
      .map(runKey)
    return seenIn.length
      ? { ...h, status: 'shown', seenIn }
      : { ...h, status: NOT_CHECKED, reason: 'no run of the authored code showed this hint' }
  })
  const status = rollUp([
    ...checks.map((c) => c.status),
    ...hintReports.map((h) => (h.status === 'shown' ? PASS : NOT_CHECKED)),
  ])
  return { ...base, status, checks, hints: hintReports }
}

// ── 5. The report ────────────────────────────────────────────────────────────

/**
 * The whole report. `result`: 'ready' (every step ran and passed), 'not_ready' (something
 * failed) or 'not_fully_checked' (nothing failed, something was not checked). `exitCode` 0 / 1 / 2.
 */
export function buildReadyReport({
  lesson,
  validation,
  assets,
  tasks,
  base = null,
  network = null,
  run = null,
}) {
  const count = (s) => tasks.filter((t) => t.status === s).length
  const summary = {
    tasks: tasks.length,
    passed: count(PASS),
    failed: count(FAIL),
    notChecked: count(NOT_CHECKED),
    nothingToRun: count(NOTHING_TO_RUN),
  }
  const failed = validation.status === FAIL || assets.status === FAIL || summary.failed > 0
  const unchecked = assets.status === NOT_CHECKED || summary.notChecked > 0
  const result = failed ? 'not_ready' : unchecked ? 'not_fully_checked' : 'ready'
  return {
    lessonId: lesson?.id ?? null,
    title: lesson?.title ?? null,
    version: lesson?.version ?? null,
    draft: lesson?.draft === true,
    result,
    exitCode: failed ? 1 : unchecked ? 2 : 0,
    base,
    steps: { validate: validation, assets },
    tasks,
    summary,
    ...(network ? { network } : {}),
    ...(run ? { run } : {}),
    notCovered: NOT_COVERED,
  }
}

function taskLabel(t) {
  return `Task ${t.id}${t.title ? ` "${t.title}"` : ''}`
}

/** A short plain summary: the verdict first, then each problem, then what was not checked. */
export function formatReadySummary(report) {
  const lines = []
  const { summary } = report
  const head = `Lesson ${report.lessonId}${report.title ? ` "${report.title}"` : ''}`
  if (report.result === 'ready') lines.push(`${head}: READY. Every step ran and passed.`)
  else if (report.result === 'not_ready') lines.push(`${head}: NOT READY.`)
  else lines.push(`${head}: NOT FULLY CHECKED. Nothing failed, but some things were not checked.`)

  const v = report.steps.validate
  lines.push(
    `Validate as published${v.wasDraft ? ' (Draft flag ignored)' : ''}: ${v.status === PASS ? 'pass' : `FAIL (${v.errors.length} error(s)): ${v.errors.slice(0, 3).join('; ')}`}`
  )
  const a = report.steps.assets
  lines.push(
    `Assets: ${a.checked} fetched, ${a.broken.length} broken, ${a.notChecked.length} not checked`
  )
  for (const b of a.broken)
    lines.push(`  BROKEN ${b.url} (${b.status ?? b.error}) in ${b.where.join(', ')}`)
  lines.push(
    `Tasks: ${summary.passed} passed, ${summary.failed} failed, ${summary.notChecked} not checked, ${summary.nothingToRun} with nothing to run`
  )
  for (const t of report.tasks.filter((x) => x.status === FAIL)) {
    for (const c of t.checks.filter((x) => x.status === FAIL)) {
      lines.push(`  ${taskLabel(t)}: FAIL ${c.name}: ${c.detail}`)
    }
  }
  const notChecked = report.tasks.filter((x) => x.status === NOT_CHECKED)
  if (notChecked.length) {
    lines.push('Not checked:')
    for (const t of notChecked) {
      const why =
        t.reason ??
        [
          ...t.checks.filter((c) => c.status === NOT_CHECKED).map((c) => `${c.name}: ${c.reason}`),
          ...(t.hints.some((h) => h.status === NOT_CHECKED)
            ? [`${t.hints.filter((h) => h.status === NOT_CHECKED).length} hint(s) never shown`]
            : []),
        ].join('; ')
      lines.push(`  ${taskLabel(t)}: ${why}`)
    }
  }
  if (report.network?.blockedCount) {
    lines.push(
      `Blocked ${report.network.blockedCount} Firebase request(s) the page tried (nothing was written).`
    )
  }
  return lines
}
