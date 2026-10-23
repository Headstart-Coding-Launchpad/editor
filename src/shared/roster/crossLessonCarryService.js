// Cross-lesson carry: Firebase reads and writes (pure helpers in ./crossLessonCarry.js).
// The tutor's client fills each matched student's carry inbox from the class roster
// (teacher/admin only); a student only ever reads their own inbox entry.
import { get, ref, remove, set, update } from 'firebase/database'
import { db } from '../firebase'
import { getSavedSlotWork, getSavedWork } from './rosterService'
import {
  buildCarryInboxEntry,
  carryInboxPath,
  carryStatusPath,
  makeCarryStatus,
  readCarryInboxEntry,
} from './crossLessonCarry'

// Tutor: looks up one matched student's saved work for a carry task (a collectCarryInboxRequests
// entry) and writes the inbox (when found) and then the status the student is waiting on.
// Returns the status written.
export async function fillCarryInbox(lessonId, classId, request, by = null) {
  const { anonymousId, rosterId, taskId, kind, sourceLessonId, sourceTaskId, slotId } = request
  const meta = { sourceLessonId, sourceTaskId, rosterId, by }
  let status
  try {
    // An activity carry slot (kind 'activity_slot') is read from its fixed work id.
    const work = slotId
      ? await getSavedSlotWork(classId, rosterId, slotId)
      : await getSavedWork(classId, rosterId, sourceLessonId, sourceTaskId)
    const built = buildCarryInboxEntry(work, { kind, sourceLessonId, sourceTaskId })
    if (built.entry) {
      // The payload first, so a student who sees 'found' can always read it.
      await set(ref(db, carryInboxPath(lessonId, anonymousId, taskId)), {
        ...built.entry,
        writtenAt: Date.now(),
      })
      status = makeCarryStatus('found', meta)
    } else {
      status = makeCarryStatus('none', {
        ...meta,
        reason: built.error === 'too_large' ? 'too_large' : 'not_saved',
      })
    }
  } catch (err) {
    console.warn('Cross-lesson carry lookup failed', err)
    status = makeCarryStatus('none', { ...meta, reason: 'error' })
  }
  await set(ref(db, carryStatusPath(lessonId, anonymousId, taskId)), status)
  return status
}

// Tutor: "Use the starter" — `updates` from carryStarterUpdates (relative to the session).
export async function applyCarryStarter(lessonId, updates) {
  if (!lessonId || !updates || !Object.keys(updates).length) return
  await update(ref(db, `sessions/${lessonId}`), updates)
}

// Tutor: the inbox lives outside the session node (so its payloads aren't pushed to every
// client), so session resets clear it separately.
export async function clearCarryInbox(lessonId) {
  if (!lessonId) return
  try {
    await remove(ref(db, carryInboxPath(lessonId)))
  } catch {
    // Non-fatal: worst case an inbox outlives its session until the next createSession.
  }
}

// Student: their own inbox entry's work ({ kind, code | files | scratchState }) or null.
export async function readCarryInbox(lessonId, anonymousId, taskId, kind) {
  const snap = await get(ref(db, carryInboxPath(lessonId, anonymousId, taskId)))
  return snap.exists() ? readCarryInboxEntry(snap.val(), kind) : null
}
