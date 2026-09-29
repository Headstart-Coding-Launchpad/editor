// The teacher's sandbox work in TeacherView, read through the module definitions (plan step
// 4.6) instead of a branch per lesson type.
//
// TeacherView keeps one work value per `capabilities.sandboxState` kind ('code', 'blocks',
// 'fs', 'desktop', 'files'), each in the module's stored-work form: the value the `storage` /
// `wire` hooks take (a code string, the Scratch project, a filesystem tree, a desktop state, or
// html's files array). The kinds stay separate so a composed lesson switching sandbox module
// finds each module's own work again, as the old per-kind React states did.
//
// The work travels over Realtime Database on the module's `wire.sandboxChannel`: 'code' writes
// `sandboxCode` (`wire.toCode`, read back with `wire.fromCode`), 'files' writes `sandboxFiles`
// (a filename → content map). The strings are byte-identical to the old per-type branches;
// `src/app/__tests__/teacherSandboxWork.test.js` compares them against verbatim copies.
import { getModuleDefinitions } from '../modules/definitions.js'
import { cloneFiles, decodeSessionFiles } from '../shared/workspaceData'
import { decodeFileKey } from '../shared/fileKeys'
import { getStarterStage } from '../shared/taskStages'

// A lesson type without a definition (none today) was handled by the old chains' final
// `else`: html's files.
const FALLBACK_KIND = 'files'

/** The TeacherView state slot the module's sandbox work lives in. */
export function sandboxWorkKind(definition) {
  return definition?.capabilities.sandboxState ?? FALLBACK_KIND
}

/** Whether the module's sandbox work is a files array on the `sandboxFiles` channel. */
export function onSandboxFilesChannel(definition) {
  return (definition?.wire.sandboxChannel ?? FALLBACK_KIND) === 'files'
}

/**
 * Every kind's work before anything has loaded: each module's `workSlot.empty()` in stored form
 * ('' for code, null for Scratch, the default tree, the default desktop, no files). The first
 * module of a kind decides it; they all agree.
 */
export function initialSandboxWorkByKind() {
  const byKind = {}
  for (const definition of getModuleDefinitions()) {
    const kind = sandboxWorkKind(definition)
    if (Object.hasOwn(byKind, kind)) continue
    const { workSlot } = definition
    byKind[kind] = workSlot.stored(workSlot.empty()).work
  }
  return byKind
}

/**
 * The module's configured teacher sandbox starter (`lifecycle.sandboxStarter`) as stored work.
 * A files module's starter is `{ files, entryFile }`; its work is the files.
 */
export function sandboxStarterWork(definition, lesson, task) {
  const configured = definition.lifecycle.sandboxStarter(lesson, task)
  return onSandboxFilesChannel(definition) ? (configured?.files ?? []) : configured
}

/**
 * The displayed task's Starter-tab work (TeacherView's loadCurrentTaskContent) as stored work:
 * `workSlot.teacherStarter` (the slot's `starter`, except electronics, whose tab has always
 * shown `starterCircuit` rather than a starter stage's circuit), normalised (desktop). A type
 * without a definition keeps the old chains' final `else`: the starter stage's files, else the
 * task's `starterFiles`.
 */
export function taskStarterWork(definition, task) {
  const workSlot = definition?.workSlot
  if (!workSlot) return getStarterStage(task)?.stage?.files ?? task?.starterFiles ?? []
  return workSlot.stored(workSlot.normalise(workSlot.teacherStarter(task))).work
}

/**
 * Whether a candidate work value counts when restoring (draft, then session, then starter): any
 * non-null value, except that an empty files array falls through to the next source.
 */
export function hasSandboxWork(definition, work) {
  if (onSandboxFilesChannel(definition)) return (work?.length ?? 0) > 0
  return work != null
}

/**
 * A detached copy for TeacherView's sandbox draft (kept across staging, going live and leaving).
 * Code strings are immutable; structured work is deep-copied; files are copied per file.
 */
export function cloneSandboxWork(definition, work) {
  if (onSandboxFilesChannel(definition)) return cloneFiles(work ?? [])
  if (work != null && typeof work === 'object') return JSON.parse(JSON.stringify(work))
  return work
}

/**
 * Work as the teacher's workspace expects it when restored (entering, reloading, resetting):
 * `workSlot.normalise` (desktop's normaliseDesktop; identity for every other module), and files
 * copied so an edit never touches the lesson or the draft.
 */
export function restoreSandboxWork(definition, work) {
  if (onSandboxFilesChannel(definition)) return cloneFiles(work ?? [])
  return definition?.workSlot ? definition.workSlot.normalise(work) : work
}

/**
 * The work in the live session, or null when there is none: `sandboxFiles` decoded on the files
 * channel, else `wire.fromCode(sandboxCode)`. Only while the session is in the sandbox state.
 */
export function readSessionSandboxWork(definition, session) {
  if (session?.state !== 'sandbox') return null
  if (onSandboxFilesChannel(definition)) {
    return decodeSessionFiles(session.sandboxFiles, decodeFileKey)
  }
  if (session.sandboxCode == null) return null
  return definition.wire.fromCode(session.sandboxCode)
}

/**
 * The `sandboxCode` string for code-channel work (`wire.toCode`). A structured module with no
 * work (Scratch before any block) sends '{}', as it always has.
 */
export function sandboxCodeFor(definition, work) {
  const isCodeString = definition.capabilities.sandboxState === 'code'
  return definition.wire.toCode(work == null && !isCodeString ? {} : work)
}

/**
 * The fields `enterSandbox` takes for the work: `{ code }` on the code channel, `{ files }` on
 * the files channel.
 */
export function sandboxWireFields(definition, work) {
  return onSandboxFilesChannel(definition)
    ? { files: work }
    : { code: sandboxCodeFor(definition, work) }
}
