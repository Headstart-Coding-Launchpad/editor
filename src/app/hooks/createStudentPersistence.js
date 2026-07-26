import {
  saveCode, saveFile, saveFsState,
  loadSavedCode, loadSavedFile, loadSavedFs,
  savePersonalSandboxCode, savePersonalSandboxFile, savePersonalSandboxFs,
  ephemeralStorage,
} from '../studentStorage'

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
 */
export function createStudentPersistence({ lessonId, teacherPresentation, previewMode, inPersonalSandboxRef, sandboxModuleId = null }) {
  const saveSandboxCode = (actorId, data) => sandboxModuleId
    ? savePersonalSandboxCode(lessonId, actorId, data, sandboxModuleId)
    : savePersonalSandboxCode(lessonId, actorId, data)
  const saveSandboxFile = (filename, actorId, content) => sandboxModuleId
    ? savePersonalSandboxFile(lessonId, filename, actorId, content, sandboxModuleId)
    : savePersonalSandboxFile(lessonId, filename, actorId, content)
  const saveSandboxFs = (actorId, fs) => sandboxModuleId
    ? savePersonalSandboxFs(lessonId, actorId, fs, sandboxModuleId)
    : savePersonalSandboxFs(lessonId, actorId, fs)
  const ephemeral = teacherPresentation || previewMode

  function savePythonCode(actorId, taskId, data) {
    if (inPersonalSandboxRef.current) {
      if (ephemeral) return
      saveSandboxCode(actorId, { code: data.code })
    } else if (ephemeral) {
      ephemeralStorage.saveCode(lessonId, taskId, actorId, data)
    } else {
      saveCode(lessonId, taskId, actorId, data)
    }
  }

  function saveHtmlFile(actorId, taskId, filename, content) {
    if (inPersonalSandboxRef.current) {
      if (ephemeral) return
      saveSandboxFile(filename, actorId, content)
    } else if (ephemeral) {
      ephemeralStorage.saveFile(lessonId, taskId, filename, actorId, content)
    } else {
      saveFile(lessonId, taskId, filename, actorId, content)
    }
  }

  function saveHtmlFiles(actorId, taskId, files) {
    files.forEach(f => saveHtmlFile(actorId, taskId, f.name, f.content))
  }

  function saveScratch(actorId, taskId, workspaceStates) {
    if (inPersonalSandboxRef.current) {
      if (ephemeral) return
      saveSandboxCode(actorId, { state: workspaceStates })
    } else if (ephemeral) {
      ephemeralStorage.saveCode(lessonId, taskId, actorId, { state: workspaceStates })
    } else {
      saveCode(lessonId, taskId, actorId, { state: workspaceStates })
    }
  }

  function saveFs(actorId, taskId, newFs) {
    if (inPersonalSandboxRef.current) {
      if (ephemeral) return
      saveSandboxFs(actorId, newFs)
    } else if (ephemeral) {
      ephemeralStorage.saveFsState(lessonId, taskId, actorId, newFs)
    } else {
      saveFsState(lessonId, taskId, actorId, newFs)
    }
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

  return {
    savePythonCode, saveHtmlFile, saveHtmlFiles, saveScratch, saveFs,
    readSavedCode, readSavedFile, readSavedFs,
  }
}
