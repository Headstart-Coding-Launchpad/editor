import {
  saveCode,
  saveFile,
  saveFsState,
  saveDesktopState,
  loadSavedCode,
  loadSavedFile,
  loadSavedFs,
  loadSavedDesktop,
  savePersonalSandboxCode,
  savePersonalSandboxFile,
  savePersonalSandboxFs,
  savePersonalSandboxDesktop,
  loadSavedFileRecord,
  saveFileRecord,
  loadPersonalSandboxCode,
  loadPersonalSandboxFileRecord,
  savePersonalSandboxFileRecord,
  ephemeralStorage,
} from '../studentStorage'
import { getModuleDefinition } from '../../modules/definitions.js'

/**
 * Handles the conditional "sandbox vs. normal task" branching for all
 * student localStorage saves. Pass inPersonalSandboxRef so each helper
 * reads the live value at call time (avoids stale closures).
 *
 * In teacher presentation and builder preview, task saves and reads are routed
 * to an in-memory ephemeral store instead of localStorage, so carry-through
 * works while presenting/previewing without polluting real student storage.
 * Personal sandbox saves are skipped entirely in those modes (sandbox reads
 * elsewhere go straight to localStorage, so writing ephemerally would desync).
 *
 * Generic API (module contract v2): saveWork / readWork / saveSandboxWork / readSandboxWork take
 * a module type and the module's work, and map it onto today's record shapes through that
 * module's `storage` adapter (src/modules/moduleContract.js). The per-type named functions
 * below remain for existing callers; both share the same routing.
 */
export function createStudentPersistence({
  lessonId,
  teacherPresentation,
  previewMode,
  inPersonalSandboxRef,
  sandboxModuleId = null,
}) {
  const saveSandboxCode = (actorId, data) =>
    sandboxModuleId
      ? savePersonalSandboxCode(lessonId, actorId, data, sandboxModuleId)
      : savePersonalSandboxCode(lessonId, actorId, data)
  const saveSandboxFile = (filename, actorId, content) =>
    sandboxModuleId
      ? savePersonalSandboxFile(lessonId, filename, actorId, content, sandboxModuleId)
      : savePersonalSandboxFile(lessonId, filename, actorId, content)
  const saveSandboxFs = (actorId, fs) =>
    sandboxModuleId
      ? savePersonalSandboxFs(lessonId, actorId, fs, sandboxModuleId)
      : savePersonalSandboxFs(lessonId, actorId, fs)
  const saveSandboxDesktop = (actorId, desktop) =>
    sandboxModuleId
      ? savePersonalSandboxDesktop(lessonId, actorId, desktop, sandboxModuleId)
      : savePersonalSandboxDesktop(lessonId, actorId, desktop)
  const saveSandboxRecord = (actorId, record) =>
    sandboxModuleId
      ? savePersonalSandboxCode(lessonId, actorId, record, sandboxModuleId)
      : savePersonalSandboxCode(lessonId, actorId, record)
  const saveSandboxFileRecord = (filename, actorId, record) =>
    sandboxModuleId
      ? savePersonalSandboxFileRecord(lessonId, filename, actorId, record, sandboxModuleId)
      : savePersonalSandboxFileRecord(lessonId, filename, actorId, record)
  const ephemeral = teacherPresentation || previewMode

  // The one routing rule for every save: personal sandbox (skipped while presenting or
  // previewing), else the in-memory store while presenting or previewing, else localStorage.
  function routeSave({ toSandbox, toEphemeral, toLocalStorage }) {
    if (inPersonalSandboxRef.current) {
      if (ephemeral) return
      toSandbox()
    } else if (ephemeral) {
      toEphemeral()
    } else {
      toLocalStorage()
    }
  }

  function savePythonCode(actorId, taskId, data) {
    routeSave({
      toSandbox: () => saveSandboxCode(actorId, { code: data.code }),
      toEphemeral: () => ephemeralStorage.saveCode(lessonId, taskId, actorId, data),
      toLocalStorage: () => saveCode(lessonId, taskId, actorId, data),
    })
  }

  function saveHtmlFile(actorId, taskId, filename, content) {
    routeSave({
      toSandbox: () => saveSandboxFile(filename, actorId, content),
      toEphemeral: () => ephemeralStorage.saveFile(lessonId, taskId, filename, actorId, content),
      toLocalStorage: () => saveFile(lessonId, taskId, filename, actorId, content),
    })
  }

  function saveHtmlFiles(actorId, taskId, files) {
    files.forEach((f) => saveHtmlFile(actorId, taskId, f.name, f.content))
  }

  function saveScratch(actorId, taskId, workspaceStates) {
    routeSave({
      toSandbox: () => saveSandboxCode(actorId, { state: workspaceStates }),
      toEphemeral: () =>
        ephemeralStorage.saveCode(lessonId, taskId, actorId, { state: workspaceStates }),
      toLocalStorage: () => saveCode(lessonId, taskId, actorId, { state: workspaceStates }),
    })
  }

  function saveFs(actorId, taskId, newFs) {
    routeSave({
      toSandbox: () => saveSandboxFs(actorId, newFs),
      toEphemeral: () => ephemeralStorage.saveFsState(lessonId, taskId, actorId, newFs),
      toLocalStorage: () => saveFsState(lessonId, taskId, actorId, newFs),
    })
  }

  function saveDesktop(actorId, taskId, newDesktop) {
    routeSave({
      toSandbox: () => saveSandboxDesktop(actorId, newDesktop),
      toEphemeral: () => ephemeralStorage.saveDesktopState(lessonId, taskId, actorId, newDesktop),
      toLocalStorage: () => saveDesktopState(lessonId, taskId, actorId, newDesktop),
    })
  }

  // Task-save readers matching the write routing above, so carry-through and
  // own-saved restore see what was written in the current mode.
  function readSavedCode(actorId, taskId) {
    return ephemeral
      ? ephemeralStorage.loadSavedCode(lessonId, taskId, actorId)
      : loadSavedCode(lessonId, taskId, actorId)
  }

  function readSavedFile(actorId, taskId, filename) {
    return ephemeral
      ? ephemeralStorage.loadSavedFile(lessonId, taskId, filename, actorId)
      : loadSavedFile(lessonId, taskId, filename, actorId)
  }

  function readSavedFs(actorId, taskId) {
    return ephemeral
      ? ephemeralStorage.loadSavedFs(lessonId, taskId, actorId)
      : loadSavedFs(lessonId, taskId, actorId)
  }

  function readSavedDesktop(actorId, taskId) {
    return ephemeral
      ? ephemeralStorage.loadSavedDesktop(lessonId, taskId, actorId)
      : loadSavedDesktop(lessonId, taskId, actorId)
  }

  // ── Generic, adapter-driven API ─────────────────────────────────────────────
  // `work` is the module's own value (a code string, Scratch workspace states, an fs tree, a
  // desktop state, or — for per-file modules such as html — an array of `{ name, content }`
  // files). `meta` carries the extra record fields the module's adapter knows (python/turtle
  // `output` / `runStatus`, arcade also `arcadeDesign`); fields not in `meta` are not written.

  function storageFor(type) {
    const storage = getModuleDefinition(type)?.storage
    if (!storage) throw new Error(`No storage adapter for module type "${type}"`)
    return storage
  }

  // Task save, routed like the named savers (personal sandbox → sandbox record).
  function saveWork(type, actorId, taskId, work, meta = {}) {
    const storage = storageFor(type)
    if (storage.layout === 'perFile') {
      for (const file of work ?? []) {
        const taskRecord = storage.toTaskRecord(file.content, meta)
        routeSave({
          toSandbox: () =>
            saveSandboxFileRecord(file.name, actorId, storage.toSandboxRecord(file.content, meta)),
          toEphemeral: () =>
            ephemeralStorage.saveFileRecord(lessonId, taskId, file.name, actorId, taskRecord),
          toLocalStorage: () => saveFileRecord(lessonId, taskId, file.name, actorId, taskRecord),
        })
      }
      return
    }
    const taskRecord = storage.toTaskRecord(work, meta)
    routeSave({
      toSandbox: () => saveSandboxRecord(actorId, storage.toSandboxRecord(work, meta)),
      toEphemeral: () => ephemeralStorage.saveCode(lessonId, taskId, actorId, taskRecord),
      toLocalStorage: () => saveCode(lessonId, taskId, actorId, taskRecord),
    })
  }

  // Task read, from the same store the saves above target. Returns `{ work, meta }` or null.
  // Per-file modules read one file at a time: pass `{ filename }`.
  function readWork(type, actorId, taskId, { filename } = {}) {
    const storage = storageFor(type)
    if (storage.layout === 'perFile') {
      if (filename == null) return null
      const record = ephemeral
        ? ephemeralStorage.loadSavedFileRecord(lessonId, taskId, filename, actorId)
        : loadSavedFileRecord(lessonId, taskId, filename, actorId)
      return storage.fromTaskRecord(record)
    }
    return storage.fromTaskRecord(readSavedCode(actorId, taskId))
  }

  // Personal-sandbox save regardless of inPersonalSandboxRef; skipped while presenting or
  // previewing, like every sandbox save.
  function saveSandboxWork(type, actorId, work, meta = {}) {
    if (ephemeral) return
    const storage = storageFor(type)
    if (storage.layout === 'perFile') {
      for (const file of work ?? []) {
        saveSandboxFileRecord(file.name, actorId, storage.toSandboxRecord(file.content, meta))
      }
      return
    }
    saveSandboxRecord(actorId, storage.toSandboxRecord(work, meta))
  }

  // Personal-sandbox read; always localStorage (see the note above createStudentPersistence).
  function readSandboxWork(type, actorId, { filename } = {}) {
    const storage = storageFor(type)
    const moduleArgs = sandboxModuleId ? [sandboxModuleId] : []
    if (storage.layout === 'perFile') {
      if (filename == null) return null
      return storage.fromSandboxRecord(
        loadPersonalSandboxFileRecord(lessonId, filename, actorId, ...moduleArgs)
      )
    }
    return storage.fromSandboxRecord(loadPersonalSandboxCode(lessonId, actorId, ...moduleArgs))
  }

  return {
    saveWork,
    readWork,
    saveSandboxWork,
    readSandboxWork,
    savePythonCode,
    saveHtmlFile,
    saveHtmlFiles,
    saveScratch,
    saveFs,
    saveDesktop,
    readSavedCode,
    readSavedFile,
    readSavedFs,
    readSavedDesktop,
  }
}
