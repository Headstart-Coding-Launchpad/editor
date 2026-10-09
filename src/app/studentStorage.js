import { sideQuestStorageTaskId } from '../shared/sideQuests.js'

export const studentTaskStorageKey = (lessonId, taskId, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${anonymousId}`

export const studentFileStorageKey = (lessonId, taskId, filename, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anonymousId}`

// Personal sandbox uses a fixed "personalsandbox" pseudo-task-id so the key format stays consistent
const PERSONAL_SANDBOX_KEY = 'personalsandbox'

export const personalSandboxStorageKey = (lessonId, anonymousId, moduleId = null) =>
  studentTaskStorageKey(
    lessonId,
    moduleId ? `module_${moduleId}_sandbox` : PERSONAL_SANDBOX_KEY,
    anonymousId
  )

const personalSandboxFileStorageKey = (lessonId, filename, anonymousId, moduleId = null) =>
  studentFileStorageKey(
    lessonId,
    moduleId ? `module_${moduleId}_sandbox` : PERSONAL_SANDBOX_KEY,
    filename,
    anonymousId
  )

// Corrupted localStorage (partial write, manual edit) shouldn't crash the reader -
// self-heal by dropping the bad key, matching useIdentity.js's pattern.
function safeParse(key) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function loadSavedCode(lessonId, taskId, anonymousId) {
  return safeParse(studentTaskStorageKey(lessonId, taskId, anonymousId))
}

export function saveCode(lessonId, taskId, anonymousId, data) {
  localStorage.setItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify(data))
}

export function loadSavedFile(lessonId, taskId, filename, anonymousId) {
  return safeParse(studentFileStorageKey(lessonId, taskId, filename, anonymousId))?.content ?? null
}

export function saveFile(lessonId, taskId, filename, anonymousId, content) {
  saveFileRecord(lessonId, taskId, filename, anonymousId, { content })
}

// Raw per-file records (the `{ content }` object itself), for the module storage adapters
// (src/modules/moduleContract.js perFileStorage) used by createStudentPersistence's
// saveWork / readWork. Task records need no extra pair: loadSavedCode / saveCode are raw.
export function loadSavedFileRecord(lessonId, taskId, filename, anonymousId) {
  return safeParse(studentFileStorageKey(lessonId, taskId, filename, anonymousId))
}

export function saveFileRecord(lessonId, taskId, filename, anonymousId, record) {
  localStorage.setItem(
    studentFileStorageKey(lessonId, taskId, filename, anonymousId),
    JSON.stringify(record)
  )
}

export function loadPersonalSandboxCode(lessonId, anonymousId, moduleId = null) {
  return safeParse(personalSandboxStorageKey(lessonId, anonymousId, moduleId))
}

export function savePersonalSandboxCode(lessonId, anonymousId, data, moduleId = null) {
  localStorage.setItem(
    personalSandboxStorageKey(lessonId, anonymousId, moduleId),
    JSON.stringify(data)
  )
}

export function loadPersonalSandboxFile(lessonId, filename, anonymousId, moduleId = null) {
  return (
    safeParse(personalSandboxFileStorageKey(lessonId, filename, anonymousId, moduleId))?.content ??
    null
  )
}

export function savePersonalSandboxFile(lessonId, filename, anonymousId, content, moduleId = null) {
  savePersonalSandboxFileRecord(lessonId, filename, anonymousId, { content }, moduleId)
}

// Raw personal-sandbox per-file records (see loadSavedFileRecord).
export function loadPersonalSandboxFileRecord(lessonId, filename, anonymousId, moduleId = null) {
  return safeParse(personalSandboxFileStorageKey(lessonId, filename, anonymousId, moduleId))
}

export function savePersonalSandboxFileRecord(
  lessonId,
  filename,
  anonymousId,
  record,
  moduleId = null
) {
  localStorage.setItem(
    personalSandboxFileStorageKey(lessonId, filename, anonymousId, moduleId),
    JSON.stringify(record)
  )
}

export function loadPersonalSandboxFs(lessonId, anonymousId, moduleId = null) {
  return safeParse(personalSandboxStorageKey(lessonId, anonymousId, moduleId))?.fs ?? null
}

export function savePersonalSandboxFs(lessonId, anonymousId, fs, moduleId = null) {
  localStorage.setItem(
    personalSandboxStorageKey(lessonId, anonymousId, moduleId),
    JSON.stringify({ fs })
  )
}

export function loadSavedFs(lessonId, taskId, anonymousId) {
  return safeParse(studentTaskStorageKey(lessonId, taskId, anonymousId))?.fs ?? null
}

export function saveFsState(lessonId, taskId, anonymousId, fs) {
  localStorage.setItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify({ fs }))
}

export function loadPersonalSandboxDesktop(lessonId, anonymousId, moduleId = null) {
  return safeParse(personalSandboxStorageKey(lessonId, anonymousId, moduleId))?.desktop ?? null
}

export function savePersonalSandboxDesktop(lessonId, anonymousId, desktop, moduleId = null) {
  localStorage.setItem(
    personalSandboxStorageKey(lessonId, anonymousId, moduleId),
    JSON.stringify({ desktop })
  )
}

export function loadSavedDesktop(lessonId, taskId, anonymousId) {
  return safeParse(studentTaskStorageKey(lessonId, taskId, anonymousId))?.desktop ?? null
}

export function saveDesktopState(lessonId, taskId, anonymousId, desktop) {
  localStorage.setItem(
    studentTaskStorageKey(lessonId, taskId, anonymousId),
    JSON.stringify({ desktop })
  )
}

// ── Side-quests ───────────────────────────────────────────────────────────────
// A side-quest's own work (src/shared/sideQuests.js) under a `{taskId}_sidequest_{n}` pseudo
// task id, so the key format stays the task one and never collides with the task's saved work:
// `{ code }` (python, turtle) or `{ files: [{ name, content }], activeFile }` (html).

export const sideQuestStorageKey = (lessonId, taskId, index, anonymousId) =>
  studentTaskStorageKey(lessonId, sideQuestStorageTaskId(taskId, index), anonymousId)

export function loadSideQuestWork(lessonId, taskId, index, anonymousId) {
  try {
    return safeParse(sideQuestStorageKey(lessonId, taskId, index, anonymousId))
  } catch {
    return null
  }
}

export function saveSideQuestWork(lessonId, taskId, index, anonymousId, record) {
  try {
    localStorage.setItem(
      sideQuestStorageKey(lessonId, taskId, index, anonymousId),
      JSON.stringify(record)
    )
  } catch {
    // Storage full or blocked: the side-quest still works for this visit.
  }
}

// ── Layout tab preference ──────────────────────────────────────────────────────
// A device-level display preference (which compact-layout tab was last active),
// not lesson/task-specific, so the key is unscoped like `headstart_builder_current`.
export const layoutTabStorageKey = (surface) => `headstart_layout_${surface}`

export function loadLayoutTab(surface) {
  return localStorage.getItem(layoutTabStorageKey(surface))
}

export function saveLayoutTab(surface, tabId) {
  localStorage.setItem(layoutTabStorageKey(surface), tabId)
}

// ── Ephemeral (in-memory) storage ─────────────────────────────────────────────
// Backing store for teacher presentation and builder preview: work persists for
// the current page session only, so carry-through behaves like a real student
// session without reading or polluting the browser's localStorage. Values are
// JSON round-tripped to mirror localStorage semantics (no object aliasing).

const ephemeralStore = new Map()

export function clearEphemeralStorage() {
  ephemeralStore.clear()
}

const ephemeralGet = (key) => {
  const raw = ephemeralStore.get(key)
  return raw ? JSON.parse(raw) : null
}

const ephemeralSet = (key, data) => {
  ephemeralStore.set(key, JSON.stringify(data))
}

export const ephemeralStorage = {
  loadSavedCode: (lessonId, taskId, anonymousId) =>
    ephemeralGet(studentTaskStorageKey(lessonId, taskId, anonymousId)),
  saveCode: (lessonId, taskId, anonymousId, data) =>
    ephemeralSet(studentTaskStorageKey(lessonId, taskId, anonymousId), data),
  loadSavedFile: (lessonId, taskId, filename, anonymousId) =>
    ephemeralGet(studentFileStorageKey(lessonId, taskId, filename, anonymousId))?.content ?? null,
  saveFile: (lessonId, taskId, filename, anonymousId, content) =>
    ephemeralSet(studentFileStorageKey(lessonId, taskId, filename, anonymousId), { content }),
  loadSavedFileRecord: (lessonId, taskId, filename, anonymousId) =>
    ephemeralGet(studentFileStorageKey(lessonId, taskId, filename, anonymousId)),
  saveFileRecord: (lessonId, taskId, filename, anonymousId, record) =>
    ephemeralSet(studentFileStorageKey(lessonId, taskId, filename, anonymousId), record),
  loadSavedFs: (lessonId, taskId, anonymousId) =>
    ephemeralGet(studentTaskStorageKey(lessonId, taskId, anonymousId))?.fs ?? null,
  saveFsState: (lessonId, taskId, anonymousId, fs) =>
    ephemeralSet(studentTaskStorageKey(lessonId, taskId, anonymousId), { fs }),
  loadSavedDesktop: (lessonId, taskId, anonymousId) =>
    ephemeralGet(studentTaskStorageKey(lessonId, taskId, anonymousId))?.desktop ?? null,
  saveDesktopState: (lessonId, taskId, anonymousId, desktop) =>
    ephemeralSet(studentTaskStorageKey(lessonId, taskId, anonymousId), { desktop }),
}
