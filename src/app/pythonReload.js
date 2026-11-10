/**
 * The "Python fell asleep" Reload (deep review 2026-11-10, R3). A reload is the only cure after a
 * mid-class deploy (only the new page knows the new worker file), but in a live lesson a reload
 * normally starts the task from its starter (selectPythonTaskCode restores the own save in solo
 * only). So the Reload button leaves a short-lived note: "this lesson's task <id> was reloaded
 * from the prompt", and loading that task again restores the student's own save.
 *
 * localStorage `headstart_reload_resume`: { lessonId, taskId, at, usedAt? }. Good for
 * RESUME_MAX_AGE_MS (the page and lesson load well inside it), for every load of that task in
 * that time (a slow lesson fetch, a dev StrictMode double load or a later re-load all still get
 * the own code). It is used up when it expires or once the student, having had it, loads another
 * task (moving on, then back, starts as a live lesson normally does). A load of another task
 * before it was used (the page's first task, then the class's) leaves it alone.
 */

export const RELOAD_RESUME_KEY = 'headstart_reload_resume'
export const RESUME_MAX_AGE_MS = 2 * 60 * 1000

function removeNote() {
  try {
    localStorage.removeItem(RELOAD_RESUME_KEY)
  } catch {
    // ignore
  }
}

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

/** True when this task of this lesson was reloaded from the prompt a moment ago (see above). */
export function isReloadResume(lessonId, taskId, now = Date.now()) {
  let note = null
  try {
    note = JSON.parse(localStorage.getItem(RELOAD_RESUME_KEY) ?? 'null')
  } catch {
    note = null
  }
  if (!note) return false
  if (!(now - Number(note.at) >= 0 && now - Number(note.at) <= RESUME_MAX_AGE_MS)) {
    removeNote()
    return false
  }
  if (note.lessonId !== String(lessonId) || note.taskId !== String(taskId)) {
    // Had it, and moved on: used up.
    if (note.usedAt != null) removeNote()
    return false
  }
  if (note.usedAt == null) {
    try {
      localStorage.setItem(RELOAD_RESUME_KEY, JSON.stringify({ ...note, usedAt: now }))
    } catch {
      // Not marked: it still expires on time.
    }
  }
  return true
}

export function reloadPage() {
  window.location.reload()
}
