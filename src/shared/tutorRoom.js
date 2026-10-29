// A tutor's permanent class link (`/room/<handle>`, #337): students open it once and it takes them
// to whichever lesson that tutor has live. The tutor's own client writes this node while their
// session is waiting or active and removes it when the session ends or the tab goes.
//
//   rooms/{handle} = { lessonId, sessionKey, startedAt }
import { normaliseHandle } from './sessionKey.js'

export const ROOMS_ROOT = 'rooms'

export function roomPath(handle) {
  return `${ROOMS_ROOT}/${normaliseHandle(handle)}`
}

/** RTDB value -> `{ lessonId, sessionKey }` of a live room, or null. */
export function normaliseRoom(value) {
  if (!value || typeof value.lessonId !== 'string' || !value.lessonId) return null
  return {
    lessonId: value.lessonId,
    sessionKey: typeof value.sessionKey === 'string' ? value.sessionKey : value.lessonId,
  }
}

/** Where a student on /room/<handle> goes once the room is live. */
export function roomLessonHash(handle, room) {
  return `/lesson/${room.lessonId}?t=${normaliseHandle(handle)}`
}
