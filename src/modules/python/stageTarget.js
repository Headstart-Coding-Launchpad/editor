// A task's stageTarget (the Python Stage's target drawing, src/shared/stage/): its code is run
// once in the Pyodide worker — when the task opens and Python is ready, or on the first Run —
// and the commands are cached by code for the rest of the page's life. The ghost overlay, the
// diff view and the stage_matches_target check all read the cached commands.
import { useEffect, useState } from 'react'
import { isPythonRunning, renderStage } from './pyodide.js'

// code → { result } once drawn ({ status, commands, error }), or { promise } while drawing.
const cache = new Map()
const listeners = new Set()

export function stageTargetCode(task) {
  const code = task?.stageTarget?.code
  return typeof code === 'string' && code.trim() ? code : null
}

// Whether the ghost starts shown (stageTarget.ghost, default true).
export function stageTargetGhostOn(task) {
  return task?.stageTarget?.ghost !== false
}

export function getCachedStageTarget(code) {
  return code ? (cache.get(code)?.result ?? null) : null
}

function notify() {
  for (const listener of listeners) listener()
}

/**
 * The target's drawing for `code`: the cached result, or a render (shared by every caller
 * while it runs). Resolves null when it couldn't be drawn now (Python busy or stopped); a later
 * call tries again. `render` is for tests.
 */
export function loadStageTarget(code, render = renderStage) {
  if (!code) return Promise.resolve(null)
  const entry = cache.get(code)
  if (entry?.result) return Promise.resolve(entry.result)
  if (entry?.promise) return entry.promise
  const promise = Promise.resolve(render(code))
    .catch(() => null)
    .then((result) => {
      if (result) cache.set(code, { result })
      else cache.delete(code)
      notify()
      return result
    })
  cache.set(code, { promise })
  return promise
}

export function clearStageTargetCache() {
  cache.clear()
  notify()
}

/**
 * The task's target drawing for the workspace (null until drawn, or without a stageTarget).
 * Asks for it once Python is ready and idle (`ready`), so the ghost can show before the first
 * Run.
 */
export function useStageTarget(task, { ready = false } = {}) {
  const code = stageTargetCode(task)
  const [, setVersion] = useState(0)
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1)
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])
  useEffect(() => {
    if (!code || !ready || getCachedStageTarget(code) || isPythonRunning()) return
    loadStageTarget(code)
  }, [code, ready])
  return getCachedStageTarget(code)
}
