import { db } from './firebase.mjs'

function normalizeSubmittedAt(value) {
  if (typeof value === 'number') return value
  if (value?.toMillis) return value.toMillis()
  if (value?.seconds) return value.seconds * 1000
  return value ?? null
}

function matchesTaskId(item, taskId) {
  if (taskId == null || taskId === '') return true
  return String(item.taskId ?? '') === String(taskId)
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
}

function normalizeFeedbackDoc(doc, source, lessonId = null) {
  const data = doc.data()
  const submittedAt = normalizeSubmittedAt(data.submittedAt)
  return {
    id: doc.id,
    source,
    lessonId: data.lessonId ?? lessonId,
    lessonTitle: data.lessonTitle ?? null,
    taskId: data.taskId ?? null,
    taskTitle: data.taskTitle ?? null,
    teacherEmail: data.teacherEmail ?? '',
    text: data.text ?? '',
    submittedAt,
  }
}

export async function listPlatformFeedback({ lessonId = null, taskId = null } = {}) {
  const snap = await db.collection('platformFeedback').get()
  const items = snap.docs
    .map(doc => normalizeFeedbackDoc(doc, 'platform'))
    .filter(item => (lessonId ? item.lessonId === lessonId : true))
    .filter(item => matchesTaskId(item, taskId))
  return sortNewestFirst(items)
}

export async function listLessonFeedback(lessonId, { taskId = null } = {}) {
  if (!lessonId) throw new Error('lessonId is required')
  const snap = await db.collection('lessons').doc(lessonId).collection('feedback').get()
  const items = snap.docs
    .map(doc => normalizeFeedbackDoc(doc, 'lesson', lessonId))
    .filter(item => matchesTaskId(item, taskId))
  return sortNewestFirst(items)
}

export async function listAllLessonFeedback({ lessonId = null, taskId = null } = {}) {
  const snap = await db.collectionGroup('feedback').get()
  const items = snap.docs
    .map(doc => {
      const parentLessonId = doc.ref.parent.parent?.id ?? null
      return normalizeFeedbackDoc(doc, 'lesson', parentLessonId)
    })
    .filter(item => (lessonId ? item.lessonId === lessonId : true))
    .filter(item => matchesTaskId(item, taskId))
  return sortNewestFirst(items)
}

export async function listAllFeedback({ lessonId = null, taskId = null } = {}) {
  const [platform, lesson] = await Promise.all([
    listPlatformFeedback({ lessonId, taskId }),
    lessonId ? listLessonFeedback(lessonId, { taskId }) : listAllLessonFeedback({ taskId }),
  ])
  return sortNewestFirst([...platform, ...lesson])
}
