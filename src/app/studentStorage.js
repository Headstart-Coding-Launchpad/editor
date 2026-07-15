export const studentTaskStorageKey = (lessonId, taskId, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${anonymousId}`

export const studentFileStorageKey = (lessonId, taskId, filename, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anonymousId}`

// Personal sandbox uses a fixed "personalsandbox" pseudo-task-id so the key format stays consistent
const PERSONAL_SANDBOX_KEY = 'personalsandbox'

export const personalSandboxStorageKey = (lessonId, anonymousId) =>
  studentTaskStorageKey(lessonId, PERSONAL_SANDBOX_KEY, anonymousId)

export const personalSandboxFileStorageKey = (lessonId, filename, anonymousId) =>
  studentFileStorageKey(lessonId, PERSONAL_SANDBOX_KEY, filename, anonymousId)

function safeParse(key, raw) {
  try {
    return JSON.parse(raw)
  } catch {
    console.warn('studentStorage: corrupt entry removed:', key)
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    return null
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn('studentStorage: setItem failed (quota?):', key, e)
  }
}

export function loadSavedCode(lessonId, taskId, anonymousId) {
  const key = studentTaskStorageKey(lessonId, taskId, anonymousId)
  const raw = localStorage.getItem(key)
  return raw ? safeParse(key, raw) : null
}

export function saveCode(lessonId, taskId, anonymousId, data) {
  safeSetItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify(data))
}

export function loadSavedFile(lessonId, taskId, filename, anonymousId) {
  const key = studentFileStorageKey(lessonId, taskId, filename, anonymousId)
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = safeParse(key, raw)
  return parsed?.content ?? null
}

export function saveFile(lessonId, taskId, filename, anonymousId, content) {
  safeSetItem(studentFileStorageKey(lessonId, taskId, filename, anonymousId), JSON.stringify({ content }))
}

export function loadPersonalSandboxCode(lessonId, anonymousId) {
  const key = personalSandboxStorageKey(lessonId, anonymousId)
  const raw = localStorage.getItem(key)
  return raw ? safeParse(key, raw) : null
}

export function savePersonalSandboxCode(lessonId, anonymousId, data) {
  safeSetItem(personalSandboxStorageKey(lessonId, anonymousId), JSON.stringify(data))
}

export function loadPersonalSandboxFile(lessonId, filename, anonymousId) {
  const key = personalSandboxFileStorageKey(lessonId, filename, anonymousId)
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = safeParse(key, raw)
  return parsed?.content ?? null
}

export function savePersonalSandboxFile(lessonId, filename, anonymousId, content) {
  safeSetItem(personalSandboxFileStorageKey(lessonId, filename, anonymousId), JSON.stringify({ content }))
}

export function loadPersonalSandboxFs(lessonId, anonymousId) {
  const key = personalSandboxStorageKey(lessonId, anonymousId)
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = safeParse(key, raw)
  return parsed?.fs ?? null
}

export function savePersonalSandboxFs(lessonId, anonymousId, fs) {
  safeSetItem(personalSandboxStorageKey(lessonId, anonymousId), JSON.stringify({ fs }))
}

export function loadSavedFs(lessonId, taskId, anonymousId) {
  const key = studentTaskStorageKey(lessonId, taskId, anonymousId)
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = safeParse(key, raw)
  return parsed?.fs ?? null
}

export function saveFsState(lessonId, taskId, anonymousId, fs) {
  safeSetItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify({ fs }))
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
