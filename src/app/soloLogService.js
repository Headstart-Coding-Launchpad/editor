import { get, ref, runTransaction, update } from 'firebase/database'
import { db } from '../shared/firebase'
import {
  SOLO_LOG_ROOT,
  applySoloAttempt,
  soloLogName,
  soloLogPath,
  soloLogTaskPath,
} from '../shared/soloLog'

// Solo study log writes (src/shared/soloLog.js). A real solo student writes their own node
// (soloLog/{lessonId}/{anonymousId}) on discrete events only: arriving on the lesson, each checked
// Run, and reaching the completion screen. Each call is best-effort: a failed write never blocks
// the student's work, so callers ignore the returned promise's rejection.

/** First arrival: `startedAt` once, `name` when the identity has a real one, and `lastAt`. */
export async function recordSoloStarted(lessonId, anonymousId, displayName = null) {
  if (!lessonId || !anonymousId) return
  const now = Date.now()
  const name = soloLogName(displayName)
  await runTransaction(ref(db, `${soloLogPath(lessonId, anonymousId)}/startedAt`), (current) =>
    current == null ? now : undefined
  )
  await update(ref(db, soloLogPath(lessonId, anonymousId)), {
    lastAt: now,
    ...(name ? { name } : {}),
  })
}

/** One checked Run on a task (the first attempt, retries until it passes, then nothing more). */
export async function recordSoloAttempt(lessonId, anonymousId, taskId, passed) {
  if (!lessonId || !anonymousId || taskId == null) return
  const now = Date.now()
  await runTransaction(ref(db, soloLogTaskPath(lessonId, anonymousId, taskId)), (current) =>
    applySoloAttempt(current, passed, now)
  )
  await update(ref(db, soloLogPath(lessonId, anonymousId)), { lastAt: now })
}

/** The student reached the lesson's completion screen: `finishedAt` is written once. */
export async function recordSoloFinished(lessonId, anonymousId) {
  if (!lessonId || !anonymousId) return
  const now = Date.now()
  await runTransaction(ref(db, `${soloLogPath(lessonId, anonymousId)}/finishedAt`), (current) =>
    current == null ? now : undefined
  )
  await update(ref(db, soloLogPath(lessonId, anonymousId)), { lastAt: now })
}

/** Tutor/admin read of the whole log: { [lessonId]: { [anonymousId]: entry } }. */
export async function readSoloLog() {
  const snap = await get(ref(db, SOLO_LOG_ROOT))
  return snap.val() ?? {}
}
