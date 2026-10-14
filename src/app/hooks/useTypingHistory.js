import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TYPING_HISTORY_LOAD_MAX,
  collectTypingEntries,
  lessonKeepsTypingHistory,
  sameTypingSummary,
  summariseTypingHistory,
  typingSessionId,
} from '../../shared/typingHistory'
import { listTyping, saveTyping, setTypingHistoryNodes } from '../../shared/roster/rosterService'

function newestFirst(a, b) {
  return (Number(b.date) || 0) - (Number(a.date) || 0)
}

// Typing history, tutor-mediated (Ryan, 2026-10-14; src/shared/typingHistory.js). While the
// session has a class and the lesson has typing tasks, the tutor's signed-in TeacherView:
// - reads each matched student's saved typing entries once per class and roster entry;
// - saves each new finished typing result of a matched student (from currentAnswer and this
//   session's attemptLog, so results from before the match are saved once they're matched) to
//   classes/{classId}/roster/{rosterId}/typing/{entryId}, the id being the dedupe key;
// - pushes each matched student's last / best / first scores from earlier sessions to
//   sessions/{lessonId}/typingHistory/{anonymousId}, and clears the node of anyone unmatched.
// Unmatched students, or a session with no class, save nothing. Returns { [anonymousId]:
// entries (newest first) } for the StudentModal's "Typing history" list.
export function useTypingHistory({ session, lesson, lessonId, classId, matches, onError }) {
  const keepsHistory = useMemo(() => lessonKeepsTypingHistory(lesson), [lesson])
  const enabled = !!classId && keepsHistory
  // `${classId}/${rosterId}` → entries (this tab's view of the saved list).
  const [entriesByRoster, setEntriesByRoster] = useState({})
  const loadRef = useRef(new Map())
  const savedRef = useRef(new Set())
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const rosterIds = useMemo(
    () => [...new Set(Object.values(matches ?? {}).filter(Boolean))].sort(),
    [matches]
  )

  // Read each matched entry's saved typing once.
  useEffect(() => {
    if (!enabled) return
    for (const rosterId of rosterIds) {
      const key = `${classId}/${rosterId}`
      if (loadRef.current.has(key)) continue
      loadRef.current.set(key, 'loading')
      listTyping(classId, rosterId, { max: TYPING_HISTORY_LOAD_MAX })
        .then((entries) => {
          for (const entry of entries) savedRef.current.add(`${key}/${entry.id}`)
          loadRef.current.set(key, 'loaded')
          setEntriesByRoster((prev) => {
            const ids = new Set(entries.map((entry) => entry.id))
            const local = (prev[key] ?? []).filter((entry) => !ids.has(entry.id))
            return { ...prev, [key]: [...local, ...entries].sort(newestFirst) }
          })
        })
        .catch((err) => {
          loadRef.current.delete(key)
          onErrorRef.current?.(err)
        })
    }
  }, [enabled, classId, rosterIds])

  // Save new finished results of matched students, once each.
  useEffect(() => {
    if (!enabled || !session || !lesson) return
    for (const candidate of collectTypingEntries({ session, lesson, lessonId, matches })) {
      const key = `${classId}/${candidate.rosterId}`
      if (loadRef.current.get(key) !== 'loaded') continue
      const savedKey = `${key}/${candidate.id}`
      if (savedRef.current.has(savedKey)) continue
      savedRef.current.add(savedKey)
      const entry = { id: candidate.id, ...candidate.entry }
      saveTyping(classId, candidate.rosterId, candidate.id, candidate.entry)
        .then(() =>
          setEntriesByRoster((prev) => ({
            ...prev,
            [key]: [entry, ...(prev[key] ?? []).filter((e) => e.id !== entry.id)].sort(newestFirst),
          }))
        )
        .catch((err) => {
          savedRef.current.delete(savedKey)
          onErrorRef.current?.(err)
        })
    }
  }, [enabled, classId, session, lesson, lessonId, matches, entriesByRoster])

  // Push last / best / first from earlier sessions; clear nodes nobody should have.
  const sessionId = typingSessionId(session)
  const pushed = session?.typingHistory
  useEffect(() => {
    if (!lessonId || !session) return
    const updates = {}
    const wanted = new Set()
    if (enabled) {
      for (const [anonymousId, rosterId] of Object.entries(matches ?? {})) {
        const key = `${classId}/${rosterId}`
        if (loadRef.current.get(key) !== 'loaded') {
          // Keep whatever is there until this entry's history has loaded.
          if (pushed?.[anonymousId]) wanted.add(anonymousId)
          continue
        }
        const summary = summariseTypingHistory(entriesByRoster[key], {
          excludeSessionId: sessionId,
        })
        if (summary) wanted.add(anonymousId)
        if (!sameTypingSummary(pushed?.[anonymousId], summary)) {
          updates[anonymousId] = summary ? { ...summary, updatedAt: Date.now() } : null
        }
      }
    }
    for (const anonymousId of Object.keys(pushed ?? {})) {
      if (!wanted.has(anonymousId) && !(anonymousId in updates)) updates[anonymousId] = null
    }
    if (Object.keys(updates).length === 0) return
    setTypingHistoryNodes(lessonId, updates).catch((err) => onErrorRef.current?.(err))
    // `session` is read only for its presence; the node and session id are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, classId, lessonId, matches, entriesByRoster, pushed, sessionId, !!session])

  return useMemo(() => {
    const result = {}
    if (!enabled) return result
    for (const [anonymousId, rosterId] of Object.entries(matches ?? {})) {
      const entries = entriesByRoster[`${classId}/${rosterId}`]
      if (entries?.length) result[anonymousId] = entries
    }
    return result
  }, [enabled, classId, matches, entriesByRoster])
}
