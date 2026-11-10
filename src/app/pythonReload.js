/**
 * The "Python fell asleep" Reload (deep review 2026-11-10, R3). A reload is the only cure after a
 * mid-class deploy (only the new page knows the new worker file), but in a live lesson a reload
 * normally starts the task from its starter (selectPythonTaskCode restores the own save in solo
 * only). So the Reload button leaves a short-lived note: "this lesson's task <id> was reloaded
 * from the prompt", and the next load of that task restores the student's own save once.
 *
 * localStorage `headstart_reload_resume`: { lessonId, taskId, at, consumedAt? }. Good for
 * RESUME_MAX_AGE_MS (the page and lesson load well inside it) and used once: the first matching
 * read marks it consumed, a read within RESUME_CONSUMED_GRACE_MS of that still matches (a dev
 * StrictMode double load), and after that, or once stale, it is removed.
 */

export const RELOAD_RESUME_KEY = 'headstart_reload_resume'
export const RESUME_MAX_AGE_MS = 2 * 60 * 1000
export const RESUME_CONSUMED_GRACE_MS = 1000

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

/**
 * True when this task of this lesson was reloaded from the prompt a moment ago, once (see above).
 * A read for another lesson or task leaves the note alone; a stale one is removed.
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
    removeNote()
    return false
  }
  if (note.lessonId !== String(lessonId) || note.taskId !== String(taskId)) return false
  if (note.consumedAt == null) {
    try {
      localStorage.setItem(RELOAD_RESUME_KEY, JSON.stringify({ ...note, consumedAt: now }))
    } catch {
      removeNote()
    }
    return true
  }
  if (now - Number(note.consumedAt) <= RESUME_CONSUMED_GRACE_MS) return true
  removeNote()
  return false
}

export function reloadPage() {
  window.location.reload()
}
