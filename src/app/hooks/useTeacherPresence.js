import { useEffect, useRef } from 'react'
import { onDisconnect, ref, remove, serverTimestamp, set } from 'firebase/database'
import { db } from '../../shared/firebase'

/**
 * Marks this tutor tab present on an open session (sessions/{lessonId}/teacherPresence/{tabId})
 * while connected. Firebase removes the mark and stamps teacherLeftAt when the tab drops, so a
 * session a crashed tab left behind can be recognised as stale (src/shared/staleSessions.js).
 */
export function useTeacherPresence(lessonId, { open, connected, sessionKey }) {
  const tabIdRef = useRef(null)
  if (!tabIdRef.current) tabIdRef.current = `tab${Math.random().toString(36).slice(2, 10)}`

  useEffect(() => {
    if (!lessonId || !open || connected !== true) return undefined
    const markRef = ref(db, `sessions/${lessonId}/teacherPresence/${tabIdRef.current}`)
    const leftRef = ref(db, `sessions/${lessonId}/teacherLeftAt`)
    const markDisconnect = onDisconnect(markRef)
    const leftDisconnect = onDisconnect(leftRef)
    markDisconnect.remove().catch(() => {})
    leftDisconnect.set(serverTimestamp()).catch(() => {})
    set(markRef, true).catch(() => {})
    return () => {
      markDisconnect.cancel().catch(() => {})
      leftDisconnect.cancel().catch(() => {})
      remove(markRef).catch(() => {})
    }
    // sessionKey (createdAt): createSession replaces the whole node, mark included, so re-mark.
  }, [lessonId, open, connected, sessionKey])
}
