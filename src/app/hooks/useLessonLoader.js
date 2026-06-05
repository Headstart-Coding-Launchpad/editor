import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { flattenTasks } from '../../shared/taskUtils'

/**
 * Loads a lesson from Firestore (or uses lessonProp directly for builder preview).
 * Returns { lesson, lessonLoading, firstTaskId }.
 */
export function useLessonLoader(lessonId, lessonProp = null, initialTaskId = null) {
  const [lesson, setLesson] = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [firstTaskId, setFirstTaskId] = useState(initialTaskId)

  useEffect(() => {
    if (lessonProp != null) {
      setLesson(lessonProp)
      setFirstTaskId(initialTaskId ?? flattenTasks(lessonProp.tasks)[0]?.id ?? 1)
      setLessonLoading(false)
      return
    }
    setLessonLoading(true)
    getDoc(doc(firestore, 'lessons', lessonId))
      .then(snap => {
        if (snap.exists()) setLesson({ id: snap.id, ...snap.data() })
        setLessonLoading(false)
      })
      .catch(() => setLessonLoading(false))
  }, [lessonId, lessonProp])

  return { lesson, lessonLoading, firstTaskId }
}
