import { useEffect } from 'react'
import { onDisconnect, ref, remove, set } from 'firebase/database'
import { db } from '../../shared/firebase'
import { roomPath } from '../../shared/tutorRoom'
import { normaliseHandle } from '../../shared/sessionKey'

// Keeps the tutor's permanent class link pointed at the lesson they have live: written while the
// session is waiting or active, removed when it ends, the tab closes or the connection drops
// (onDisconnect). Only a tutor with a handle has a room. See src/shared/tutorRoom.js.
export function useTutorRoom({ handle, lessonId, sessionKey, state }) {
  const clean = normaliseHandle(handle)
  const live = state === 'waiting' || state === 'active'
  useEffect(() => {
    if (!clean || !lessonId || !live) return undefined
    const roomRef = ref(db, roomPath(clean))
    const quietly = (promise, what) =>
      Promise.resolve(promise).catch((err) => console.warn(`[room] could not ${what}`, err))
    quietly(onDisconnect(roomRef).remove(), 'arm the disconnect cleanup')
    quietly(
      set(roomRef, { lessonId, sessionKey: sessionKey ?? lessonId, startedAt: Date.now() }),
      'open the room'
    )
    return () => {
      quietly(remove(roomRef), 'close the room')
    }
  }, [clean, lessonId, sessionKey, live])
}
