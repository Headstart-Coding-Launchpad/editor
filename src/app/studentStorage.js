export const studentTaskStorageKey = (lessonId, taskId, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${anonymousId}`

export const studentFileStorageKey = (lessonId, taskId, filename, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anonymousId}`

// Personal sandbox uses a fixed "personalsandbox" pseudo-task-id so the key format stays consistent
const PERSONAL_SANDBOX_KEY = 'personalsandbox'

export const personalSandboxStorageKey = (lessonId, anonymousId, moduleId = null) =>
  studentTaskStorageKey(lessonId, moduleId ? `module_${moduleId}_sandbox` : PERSONAL_SANDBOX_KEY, anonymousId)

export const personalSandboxFileStorageKey = (lessonId, filename, anonymousId, moduleId = null) =>
  studentFileStorageKey(lessonId, moduleId ? `module_${moduleId}_sandbox` : PERSONAL_SANDBOX_KEY, filename, anonymousId)

export function loadSavedCode(lessonId, taskId, anonymousId) {
  const raw = localStorage.getItem(studentTaskStorageKey(lessonId, taskId, anonymousId))
  return raw ? JSON.parse(raw) : null
}

export function saveCode(lessonId, taskId, anonymousId, data) {
  localStorage.setItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify(data))
}

export function loadSavedFile(lessonId, taskId, filename, anonymousId) {
  const raw = localStorage.getItem(studentFileStorageKey(lessonId, taskId, filename, anonymousId))
  return raw ? JSON.parse(raw).content : null
}

export function saveFile(lessonId, taskId, filename, anonymousId, content) {
  localStorage.setItem(studentFileStorageKey(lessonId, taskId, filename, anonymousId), JSON.stringify({ content }))
}

export function loadPersonalSandboxCode(lessonId, anonymousId, moduleId = null) {
  const raw = localStorage.getItem(personalSandboxStorageKey(lessonId, anonymousId, moduleId))
  return raw ? JSON.parse(raw) : null
}

export function savePersonalSandboxCode(lessonId, anonymousId, data, moduleId = null) {
  localStorage.setItem(personalSandboxStorageKey(lessonId, anonymousId, moduleId), JSON.stringify(data))
}

export function loadPersonalSandboxFile(lessonId, filename, anonymousId, moduleId = null) {
  const raw = localStorage.getItem(personalSandboxFileStorageKey(lessonId, filename, anonymousId, moduleId))
  return raw ? JSON.parse(raw).content : null
}

export function savePersonalSandboxFile(lessonId, filename, anonymousId, content, moduleId = null) {
  localStorage.setItem(personalSandboxFileStorageKey(lessonId, filename, anonymousId, moduleId), JSON.stringify({ content }))
}

export function loadPersonalSandboxFs(lessonId, anonymousId, moduleId = null) {
  const raw = localStorage.getItem(personalSandboxStorageKey(lessonId, anonymousId, moduleId))
  if (!raw) return null
  const parsed = JSON.parse(raw)
  return parsed.fs ?? null
}

export function savePersonalSandboxFs(lessonId, anonymousId, fs, moduleId = null) {
  localStorage.setItem(personalSandboxStorageKey(lessonId, anonymousId, moduleId), JSON.stringify({ fs }))
}

export function loadSavedFs(lessonId, taskId, anonymousId) {
  const raw = localStorage.getItem(studentTaskStorageKey(lessonId, taskId, anonymousId))
  if (!raw) return null
  const parsed = JSON.parse(raw)
  return parsed.fs ?? null
}

export function saveFsState(lessonId, taskId, anonymousId, fs) {
  localStorage.setItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify({ fs }))
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

const ephemeralGet = key => {
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
  loadSavedFs: (lessonId, taskId, anonymousId) =>
    ephemeralGet(studentTaskStorageKey(lessonId, taskId, anonymousId))?.fs ?? null,
  saveFsState: (lessonId, taskId, anonymousId, fs) =>
    ephemeralSet(studentTaskStorageKey(lessonId, taskId, anonymousId), { fs }),
}
