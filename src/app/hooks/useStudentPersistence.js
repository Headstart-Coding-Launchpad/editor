import {
  saveCode, saveFile, saveFsState,
  savePersonalSandboxCode, savePersonalSandboxFile, savePersonalSandboxFs,
} from '../studentStorage'

/**
 * Handles the conditional "sandbox vs. normal task" branching for all
 * student localStorage saves. Pass inPersonalSandboxRef so each helper
 * reads the live value at call time (avoids stale closures).
 */
export function useStudentPersistence({ lessonId, teacherPresentation, previewMode, inPersonalSandboxRef }) {
  const shouldSkip = teacherPresentation || previewMode

  function savePythonCode(actorId, taskId, data) {
    if (shouldSkip) return
    if (inPersonalSandboxRef.current) {
      savePersonalSandboxCode(lessonId, actorId, { code: data.code })
    } else {
      saveCode(lessonId, taskId, actorId, data)
    }
  }

  function saveHtmlFile(actorId, taskId, filename, content) {
    if (shouldSkip) return
    if (inPersonalSandboxRef.current) {
      savePersonalSandboxFile(lessonId, filename, actorId, content)
    } else {
      saveFile(lessonId, taskId, filename, actorId, content)
    }
  }

  function saveHtmlFiles(actorId, taskId, files) {
    if (shouldSkip) return
    files.forEach(f => saveHtmlFile(actorId, taskId, f.name, f.content))
  }

  function saveScratch(actorId, taskId, workspaceStates) {
    if (shouldSkip) return
    if (inPersonalSandboxRef.current) {
      savePersonalSandboxCode(lessonId, actorId, { state: workspaceStates })
    } else {
      saveCode(lessonId, taskId, actorId, { state: workspaceStates })
    }
  }

  function saveFs(actorId, taskId, newFs) {
    if (shouldSkip) return
    if (inPersonalSandboxRef.current) {
      savePersonalSandboxFs(lessonId, actorId, newFs)
    } else {
      saveFsState(lessonId, taskId, actorId, newFs)
    }
  }

  return { savePythonCode, saveHtmlFile, saveHtmlFiles, saveScratch, saveFs }
}
