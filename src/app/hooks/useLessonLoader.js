import { useState, useEffect } from 'react'
import { fetchLessonById } from '../../shared/lessonService'
import { flattenTasks } from '../../shared/taskUtils'

/**
 * Loads a lesson via lessonService (or uses lessonProp directly for builder preview).
 * Returns { lesson, lessonLoading, firstTaskId }.
 */
export function useLessonLoader(lessonId, lessonProp = null, initialTaskId = null) {
  const [lesson, setLesson] = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [firstTaskId, setFirstTaskId] = useState(initialTaskId)

  useEffect(() => {
    let cancelled = false
    if (lessonProp != null) {
      setLesson(lessonProp)
      setFirstTaskId(initialTaskId ?? flattenTasks(lessonProp.tasks)[0]?.id ?? 1)
      setLessonLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLesson(null)
    setLessonLoading(true)
    fetchLessonById(lessonId)
      .then((loadedLesson) => {
        if (cancelled) return
        if (loadedLesson) setLesson(loadedLesson)
        setLessonLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLessonLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [lessonId, lessonProp, initialTaskId])

  return { lesson, lessonLoading, firstTaskId }
}
