import { addDoc, collection } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'

/** One write on Finish: lessons/{lessonId}/timingRuns/{autoId}. Returns the new doc id. */
export async function saveTimingRunDoc(payload) {
  const ref = await addDoc(
    collection(firestore, 'lessons', payload.lessonId, 'timingRuns'),
    payload
  )
  return ref.id
}
