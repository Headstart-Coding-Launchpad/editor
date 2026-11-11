import { useState, useEffect } from 'react'
import { fetchLessonById } from '../../shared/lessonService'
import { flattenTasks } from '../../shared/taskUtils'

/**
 * Loads a lesson via lessonService (or uses lessonProp directly for builder preview).
 * Returns { lesson, lessonLoading, loadFailed (the fetch threw: not a missing lesson), firstTaskId }.
 */
export function useLessonLoader(lessonId, lessonProp = null, initialTaskId = null) {
  const [lesson, setLesson] = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [firstTaskId, setFirstTaskId] = useState(initialTaskId)

  useEffect(() => {
    setLoadFailed(false)
    if (lessonProp != null) {
      setLesson(lessonProp)
      setFirstTaskId(initialTaskId ?? flattenTasks(lessonProp.tasks)[0]?.id ?? 1)
      setLessonLoading(false)
      return
    }
    let cancelled = false
    setLesson(null)
    setLessonLoading(true)
    fetchLessonById(lessonId)
      .then((loadedLesson) => {
        if (cancelled) return
        if (loadedLesson) setLesson(loadedLesson)
        setLessonLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadFailed(true)
        setLessonLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [lessonId, lessonProp, initialTaskId])

  return { lesson, lessonLoading, loadFailed, firstTaskId }
}
