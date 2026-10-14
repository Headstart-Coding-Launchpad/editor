import { useEffect, useRef } from 'react'
import { collectCarryInboxRequests } from '../../shared/roster/crossLessonCarry'
import { fillCarryInbox } from '../../shared/roster/crossLessonCarryService'

// Cross-lesson carry, tutor side (Ryan, 2026-10-14): as soon as a joined student is matched to
// the class roster, the tutor's signed-in TeacherView reads their saved work for every task in
// this lesson with `carryCodeFromLesson` / `carryBlocksFromLesson` and writes it to their carry
// inbox, then the status ('found' | 'none') the student's held task is waiting on. Each
// student/task/roster entry is looked up once per tab; a status already in the session (from
// this or another tutor tab, or the tutor's "Use the starter") is never overwritten.
// `matches`: { anonymousId: rosterId } (activeRosterMatches). Needs the session's class.
export function useCarryInboxWriter({ session, lesson, lessonId, classId, matches, by = null }) {
  const startedRef = useRef(new Set())

  useEffect(() => {
    startedRef.current = new Set()
  }, [classId, lessonId, session?.createdAt])

  useEffect(() => {
    if (!classId || !session || !lesson || session.state === 'ended') return
    for (const request of collectCarryInboxRequests({ session, lesson, matches })) {
      if (startedRef.current.has(request.key)) continue
      startedRef.current.add(request.key)
      // No automatic retry (a rules or network failure would retry on every session update):
      // the student stays held, the tutor sees "waiting for carry" and can use the starter.
      fillCarryInbox(lessonId, classId, request, by).catch((err) => {
        console.warn('Could not fill the carry inbox', err)
      })
    }
  }, [classId, session, lesson, lessonId, matches, by])
}
