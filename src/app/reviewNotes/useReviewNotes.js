import { useEffect, useState } from 'react'
import { subscribeReviewNotes } from './reviewNotesService'

/** One task's review notes, live, while `enabled` (admin preview only). */
export function useReviewNotes(lessonId, taskId, enabled) {
  const [notes, setNotes] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !lessonId || taskId == null) {
      setNotes([])
      return undefined
    }
    // Clear first so the last task's notes never show while this task's first snapshot loads.
    setNotes([])
    setError(null)
    return subscribeReviewNotes(
      lessonId,
      taskId,
      (next) => {
        setNotes(next)
        setError(null)
      },
      (err) => setError(err?.message ?? String(err))
    )
  }, [lessonId, taskId, enabled])

  return { notes, error }
}
