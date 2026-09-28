// Pure building blocks for the workspace-module contract v2 hooks every definition.js declares
// (see ./defineModule.js and docs/architecture/lesson-type-modules.md, "Contract v2"):
//
// - lifecycle — what a task/lesson means for this module's work (remote reset targets, whether
//   a complete solution exists, the teacher sandbox starter, composed-lesson sandbox fields).
// - storage   — how the module's work maps onto its localStorage record shapes (the shapes in
//   docs/agents/runtime-model.md; they must never change).
// - wire      — how the work travels over Realtime Database strings (`currentCode`,
//   `sandboxCode`, teacherLive extras, logged submissions).
//
// "Work" is the value the student hook holds for the module: a code string (python, turtle,
// arcade, electronics's serialised circuit), the Scratch workspace states, a filesystem tree, a
// desktop state, or (html) an array of files. Node-safe: no JSX, React, DOM or runtimes.
import { getCompleteStage, getStarterStage } from '../shared/taskStages.js'

// ── Lifecycle ────────────────────────────────────────────────────────────────

// A remote-reset action names the state to restore: 'starter', 'complete', or 'stage_<n>' for
// one of the task's authored code stages.
export function stageForAction(task, action) {
  const match = String(action ?? '').match(/^stage_(\d+)$/)
  if (!match) return { stage: null, stageIndex: null }
  const stageIndex = parseInt(match[1], 10)
  return { stage: (task?.codeStages ?? [])[stageIndex] ?? null, stageIndex }
}

export function starterStageOf(task) {
  return getStarterStage(task)?.stage
}

// Shared by the code-string modules (python, arcade, turtle): `{ code }`.
export function codeResetTarget(task, action) {
  const { stage } = stageForAction(task, action)
  const starter = starterStageOf(task)
  if (action === 'complete') return { code: task.completeCode ?? '' }
  if (action === 'starter') return { code: starter?.code ?? task.starterCode ?? '' }
  return { code: stage?.code ?? starter?.code ?? task.starterCode ?? '' }
}

// Shared by the code-string modules: a complete stage's code, else the legacy completeCode.
export function codeHasComplete(task) {
  return !!(getCompleteStage(task)?.stage?.code ?? task?.completeCode)
}

// ── Storage ──────────────────────────────────────────────────────────────────

function pickPresent(source, keys) {
  const picked = {}
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) picked[key] = source[key]
  }
  return picked
}

/**
 * A storage adapter for modules whose work lives in one record per task
 * (`headstart_{lessonId}_{taskId}_{anonymousId}`) and one per personal sandbox.
 *
 * - `workKey`   the record field holding the work (`code`, `state`, `fs`, `desktop`).
 * - `taskMeta`  extra fields a task record may carry, in record order (e.g. `output`,
 *               `runStatus`, `arcadeDesign`); each is written only when `meta` has it, so a
 *               caller that passes no meta writes exactly `{ [workKey]: work }`.
 * - `sandboxMeta` the same for the personal-sandbox record.
 *
 * `fromTaskRecord` / `fromSandboxRecord` return `{ work, meta }` (meta holds only the fields the
 * record actually had), or null when there is no record.
 */
export function recordStorage({ workKey, taskMeta = [], sandboxMeta = [] }) {
  const toRecord = (metaKeys) => (work, meta) => ({
    [workKey]: work,
    ...pickPresent(meta, metaKeys),
  })
  const fromRecord = (metaKeys) => (record) => {
    if (record == null || typeof record !== 'object') return null
    return { work: record[workKey], meta: pickPresent(record, metaKeys) }
  }
  return {
    layout: 'record',
    workKey,
    toTaskRecord: toRecord(taskMeta),
    fromTaskRecord: fromRecord(taskMeta),
    toSandboxRecord: toRecord(sandboxMeta),
    fromSandboxRecord: fromRecord(sandboxMeta),
  }
}

/**
 * A storage adapter for modules that store one record per file
 * (`headstart_{lessonId}_{taskId}_{filename}_{anonymousId}` → `{ content }`). The record hooks
 * map a single file's content; `saveWork` / `readWork` in createStudentPersistence.js walk the
 * files.
 */
export function perFileStorage() {
  const toRecord = (content) => ({ content })
  const fromRecord = (record) => {
    if (record == null || typeof record !== 'object') return null
    return { work: record.content, meta: {} }
  }
  return {
    layout: 'perFile',
    workKey: 'content',
    toTaskRecord: toRecord,
    fromTaskRecord: fromRecord,
    toSandboxRecord: toRecord,
    fromSandboxRecord: fromRecord,
  }
}

// ── Wire ─────────────────────────────────────────────────────────────────────

// teacherLive is a Firebase update() merge, so every payload names every extra explicitly —
// null when the module has none — or a previous module's value would linger.
export const NO_LIVE_EXTRAS = Object.freeze({ arcadeDesign: null, turtleResult: null })

export function noLiveExtras() {
  return { ...NO_LIVE_EXTRAS }
}

function parseJson(code) {
  if (typeof code !== 'string' || !code) return null
  try {
    return JSON.parse(code)
  } catch {
    return null
  }
}

// The work already is the `currentCode` string (python, turtle, arcade, electronics).
export function codeStringWire(overrides = {}) {
  return {
    sandboxChannel: 'code',
    toCode: (work) => work,
    fromCode: (code) => code,
    liveExtras: noLiveExtras,
    submission: (work) => work,
    ...overrides,
  }
}

// The work travels as a JSON string in `currentCode` / `sandboxCode` (scratch, filesystem,
// desktop). Callers keep their own null handling (e.g. `JSON.stringify(state ?? {})`).
export function jsonWire(overrides = {}) {
  return {
    sandboxChannel: 'code',
    toCode: (work) => JSON.stringify(work),
    fromCode: parseJson,
    liveExtras: noLiveExtras,
    submission: (work) => work,
    ...overrides,
  }
}

// ── Checking + work slot (plan steps 4.3–4.4) ──────────────────────────────────

// The check context for a code-string module: the run extras ({ status, variables, turtle }
// after a run, { status } for idle feedback) plus the code. Mirrors the old
// buildCodeCheckContext in src/app/codeCheckContext.js key for key.
export function codeCheckContext(code, extras = {}) {
  return { ...extras, code }
}

// Work slots whose value already is the storage/wire work (everything except Arcade, whose
// value also carries its design).
export function identityStored(value) {
  return { work: value, meta: {} }
}

export function identityFromStored(stored, fallback) {
  return stored?.work ?? fallback
}

// The task starter code: a starter stage's code, else the legacy starterCode.
export function starterCodeOf(task) {
  return starterStageOf(task)?.code ?? task?.starterCode ?? ''
}

// The complete code: a complete-role stage's code, else the legacy completeCode.
export function completeCodeOf(task) {
  return getCompleteStage(task)?.stage?.code ?? task?.completeCode ?? ''
}

/**
 * The work slot shared by the plain code-string modules (python, turtle): the value is the code
 * string itself. `kind: 'code'` — see WORK_SLOT_KINDS in ./defineModule.js.
 */
export function codeWorkSlot(overrides = {}) {
  return {
    kind: 'code',
    starter: starterCodeOf,
    stage: (task, stageIndex) => task?.codeStages?.[stageIndex]?.code ?? '',
    complete: completeCodeOf,
    sandbox: (lesson) => lesson?.sandboxStarter ?? '',
    fromResetTarget: (target) => target.code,
    empty: () => '',
    normalise: (value) => value,
    stored: identityStored,
    fromStored: identityFromStored,
    taskReset: true,
    teacherSandboxReset: false,
    remoteResetPersists: false,
    ...overrides,
  }
}

/**
 * The hooks a field-declared work slot (`starterField` / `sandboxField` / `stageField`, e.g.
 * filesystem and desktop) gets from defineModule: every source reads the named field, falling
 * back to `empty`. `completeField` is the module's top-level complete field and `workKey` its
 * storage work key (the field a remote-reset target carries the work in).
 */
export function fieldWorkSlotHooks(workSlot, { completeField, workKey }) {
  const { starterField, sandboxField, stageField, empty } = workSlot
  return {
    starter: (task) => task?.[starterField] ?? empty(task),
    stage: (task, stageIndex) => task?.codeStages?.[stageIndex]?.[stageField] ?? empty(task),
    complete: (task) => task?.[completeField] ?? empty(task),
    sandbox: (lesson) => lesson?.[sandboxField] ?? empty(),
    fromResetTarget: (target) => target[workKey],
    stored: identityStored,
    fromStored: identityFromStored,
  }
}

// The work travels as a `{ filename: content }` map on the files channel (html).
export function filesWire(overrides = {}) {
  const toFilesMap = (files) => Object.fromEntries((files ?? []).map((f) => [f.name, f.content]))
  return {
    sandboxChannel: 'files',
    // html never uses the code channel for its work.
    toCode: () => null,
    fromCode: () => null,
    toFilesMap,
    liveExtras: noLiveExtras,
    submission: toFilesMap,
    ...overrides,
  }
}
