import { useEffect, useState } from 'react'
import { subscribeReviewNotes } from './reviewNotesService'

/** Every review note on the lesson, live, while `enabled` (admin preview only). */
export function useReviewNotes(lessonId, enabled) {
  const [notes, setNotes] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !lessonId) {
      setNotes([])
      return undefined
    }
    setError(null)
    return subscribeReviewNotes(
      lessonId,
      (next) => {
        setNotes(next)
        setError(null)
      },
      (err) => setError(err?.message ?? String(err))
    )
  }, [lessonId, enabled])

  return { notes, error }
}
