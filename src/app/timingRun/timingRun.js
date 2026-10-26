// Tutor timing run: pure state functions. A run times each lesson task while it is on screen
// (admin preview only). All functions take `now` (ms) so they are deterministic and testable.
//
// State: { startedAt, lastTick, currentTaskId, userPaused, hidden, pausedMs, otherMs,
//          tasks: { [taskId]: { ms, visits } } }
// Time since `lastTick` is only added when an event arrives (accrue), so the state never
// changes per second; the UI derives live totals with displayTimes().

export function startRun(now, { taskId = null, hidden = false } = {}) {
  const state = {
    startedAt: now,
    lastTick: now,
    currentTaskId: null,
    userPaused: false,
    hidden,
    pausedMs: 0,
    otherMs: 0,
    tasks: {},
  }
  return taskId == null ? state : switchTask(state, taskId, now)
}

export function isTicking(state) {
  return !state.userPaused && !state.hidden
}

/** Adds the time since the last event to the right bucket (task, other, or paused). */
export function accrue(state, now) {
  const delta = Math.max(0, now - state.lastTick)
  if (delta === 0) return { ...state, lastTick: now }
  if (!isTicking(state)) return { ...state, lastTick: now, pausedMs: state.pausedMs + delta }
  const id = state.currentTaskId
  if (id == null || !state.tasks[id]) {
    return { ...state, lastTick: now, otherMs: state.otherMs + delta }
  }
  return {
    ...state,
    lastTick: now,
    tasks: { ...state.tasks, [id]: { ...state.tasks[id], ms: state.tasks[id].ms + delta } },
  }
}

/** Moves to another task (or null for a non-task screen). Revisits add to the same task. */
export function switchTask(state, taskId, now) {
  const next = accrue(state, now)
  if (taskId === next.currentTaskId) return next
  if (taskId == null) return { ...next, currentTaskId: null }
  const prev = next.tasks[taskId] ?? { ms: 0, visits: 0 }
  return {
    ...next,
    currentTaskId: taskId,
    tasks: { ...next.tasks, [taskId]: { ...prev, visits: prev.visits + 1 } },
  }
}

export function setUserPaused(state, paused, now) {
  const next = accrue(state, now)
  return { ...next, userPaused: !!paused }
}

/** Tab hidden / visible. */
export function setHidden(state, hidden, now) {
  const next = accrue(state, now)
  return { ...next, hidden: !!hidden }
}

/** A run read back from localStorage after a reload: the gap counts as paused, and the tutor resumes. */
export function restoreRun(saved, now, { hidden = false } = {}) {
  if (!saved || typeof saved !== 'object' || !saved.tasks || !Number.isFinite(saved.startedAt)) {
    return null
  }
  const gap = Math.max(0, now - (Number.isFinite(saved.lastTick) ? saved.lastTick : now))
  return {
    ...saved,
    lastTick: now,
    pausedMs: (saved.pausedMs ?? 0) + gap,
    userPaused: true,
    hidden,
  }
}

/** Live numbers for the timer bar (does not change the state). */
export function displayTimes(state, now) {
  const live = accrue(state, now)
  const taskMs = live.currentTaskId != null ? (live.tasks[live.currentTaskId]?.ms ?? 0) : 0
  return {
    currentSeconds: Math.floor(taskMs / 1000),
    totalSeconds: Math.floor(totalTaskMs(live) / 1000),
  }
}

function totalTaskMs(state) {
  return Object.values(state.tasks).reduce((sum, t) => sum + t.ms, 0)
}

/**
 * The document saved on Finish. `taskList` is the lesson's flat task order:
 * [{ taskId, title, type, estimatedMinutes }]. Tasks never opened get seconds 0, visits 0.
 */
export function buildRunPayload(state, now, meta) {
  const done = accrue(state, now)
  const { lessonId, lessonTitle, taskList, tutorUid, tutorEmail, appVersion } = meta
  const payload = {
    lessonId,
    lessonTitle: lessonTitle ?? '',
    startedAt: done.startedAt,
    finishedAt: now,
    totalSeconds: Math.round(totalTaskMs(done) / 1000),
    pausedSeconds: Math.round(done.pausedMs / 1000),
    otherSeconds: Math.round(done.otherMs / 1000),
    tutorUid: tutorUid ?? null,
    appVersion: appVersion ?? 'dev',
    tasks: taskList.map((t) => {
      const rec = done.tasks[t.taskId]
      return {
        taskId: t.taskId,
        title: t.title ?? '',
        type: t.type ?? null,
        estimatedMinutes: t.estimatedMinutes ?? null,
        seconds: Math.round((rec?.ms ?? 0) / 1000),
        visits: rec?.visits ?? 0,
      }
    }),
  }
  if (tutorEmail) payload.tutorEmail = tutorEmail
  return payload
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
