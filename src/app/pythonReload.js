/**
 * The "Python fell asleep" Reload (deep review 2026-11-10, R3). A reload is the only cure after a
 * mid-class deploy (only the new page knows the new worker file), but in a live lesson a reload
 * normally starts the task from its starter (selectPythonTaskCode restores the own save in solo
 * only). So the Reload button leaves a short-lived note: "this lesson's task <id> was reloaded
 * from the prompt", and the next load of that task restores the student's own save once.
 *
 * localStorage `headstart_reload_resume`: { lessonId, taskId, at }. Read for RESUME_MAX_AGE_MS
 * (the page and lesson load well inside it), then ignored and removed.
 */

export const RELOAD_RESUME_KEY = 'headstart_reload_resume'
export const RESUME_MAX_AGE_MS = 2 * 60 * 1000

export function markReloadResume(lessonId, taskId, now = Date.now()) {
  if (lessonId == null || taskId == null) return
  try {
    localStorage.setItem(
      RELOAD_RESUME_KEY,
      JSON.stringify({ lessonId: String(lessonId), taskId: String(taskId), at: now })
    )
  } catch {
    // Storage full or blocked: the reload still happens, the task starts as a live reload does.
  }
}

/**
 * True when this task of this lesson was reloaded from the prompt a moment ago. Not removed on a
 * match (a dev StrictMode double load reads it twice); a stale note is removed.
 */
export function isReloadResume(lessonId, taskId, now = Date.now()) {
  let note = null
  try {
    note = JSON.parse(localStorage.getItem(RELOAD_RESUME_KEY) ?? 'null')
  } catch {
    note = null
  }
  if (!note) return false
  if (!(now - Number(note.at) >= 0 && now - Number(note.at) <= RESUME_MAX_AGE_MS)) {
    try {
      localStorage.removeItem(RELOAD_RESUME_KEY)
    } catch {
      // ignore
    }
    return false
  }
  return note.lessonId === String(lessonId) && note.taskId === String(taskId)
}

export function reloadPage() {
  window.location.reload()
}
