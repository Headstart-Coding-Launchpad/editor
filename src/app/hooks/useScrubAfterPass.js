import { useEffect, useRef, useState } from 'react'
import { taskScrubsAfterPass } from '../../shared/scrub/scrubConfig.js'

// The per-task aux file that remembers a `scrub.afterPass` task has been passed, so its scrub
// boxes and #@lock-values values stay open after a reload or Reset Code. Saved like the other
// per-task aux files (`__activity_state__`): localStorage, or the in-memory store while
// presenting or previewing. Its content is `{"at": <ms>}`.
export const SCRUB_OPEN_FILENAME = '__scrub_open__'

/**
 * `scrub.afterPass` (src/shared/scrub/scrubConfig.js): a task's scrub boxes and #@lock-values
 * values stay shut until the task's first pass — by its checks or the tutor's pass — then open
 * for good on this device.
 *
 * Returns `{ held, justOpened, dismissCue }`:
 * - `held`: true while this task's values are shut (the workspaces pass no `scrub` and
 *   freezeValueLocks(getTaskLockSets(task)) to the editor). Always false for a task without
 *   `afterPass`, and in the personal sandbox (scrubbing is off there anyway).
 * - `justOpened`: the task opened during this visit — the "Now make it yours" cue shows until
 *   the student scrubs (`dismissCue`) or leaves the task.
 *
 * Only a pass seen while the task is current counts: `checkPassed` has to be false for the task
 * first, so a pass carried over from the previous task for one render never opens the next one.
 */
export function useScrubAfterPass({
  task,
  taskId,
  checkPassed,
  actorId,
  persistence,
  inPersonalSandbox = false,
}) {
  const afterPass = taskScrubsAfterPass(task)
  const key = afterPass && actorId && taskId != null ? `${actorId}:${taskId}` : null
  const [state, setState] = useState({ key: null, open: false, justOpened: false })
  const armedKeyRef = useRef(null)

  // Load the remembered state when the task (or student) changes.
  let current = state
  if (state.key !== key) {
    current = { key, open: key ? readOpen(persistence, actorId, taskId) : false, justOpened: false }
    setState(current)
  }

  useEffect(() => {
    if (!key || inPersonalSandbox) return
    if (!checkPassed) {
      armedKeyRef.current = key
      return
    }
    if (current.open || armedKeyRef.current !== key) return
    try {
      persistence?.saveHtmlFile?.(
        actorId,
        taskId,
        SCRUB_OPEN_FILENAME,
        JSON.stringify({ at: Date.now() })
      )
    } catch (err) {
      console.warn('Failed to remember the opened values:', err)
    }
    setState({ key, open: true, justOpened: true })
  }, [key, checkPassed, current.open, inPersonalSandbox, persistence, actorId, taskId])

  function dismissCue() {
    setState((prev) => (prev.justOpened ? { ...prev, justOpened: false } : prev))
  }

  return {
    held: !!key && !inPersonalSandbox && !current.open,
    justOpened: !!key && current.justOpened,
    dismissCue,
  }
}

function readOpen(persistence, actorId, taskId) {
  try {
    return !!persistence?.readSavedFile?.(actorId, taskId, SCRUB_OPEN_FILENAME)
  } catch {
    return false
  }
}
