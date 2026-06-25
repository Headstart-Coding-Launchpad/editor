import { db } from './firebase.mjs'

async function batchArchiveRefs(refs) {
  const BATCH_SIZE = 500
  let archived = 0
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    refs.slice(i, i + BATCH_SIZE).forEach(ref => batch.update(ref, { archived: true }))
    await batch.commit()
    archived += refs.slice(i, i + BATCH_SIZE).length
  }
  return archived
}

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

function matchesScope(item, scope) {
  if (!scope) return true
  if (scope === 'task') return !!item.taskId
  if (scope === 'lesson') return !item.taskId
  return true
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
    archived: data.archived ?? false,
  }
}

export async function listPlatformFeedback({ lessonId = null, taskId = null, scope = null, includeArchived = false } = {}) {
  const snap = await db.collection('platformFeedback').get()
  const items = snap.docs
    .map(doc => normalizeFeedbackDoc(doc, 'platform'))
    .filter(item => includeArchived || !item.archived)
    .filter(item => (lessonId ? item.lessonId === lessonId : true))
    .filter(item => matchesTaskId(item, taskId))
    .filter(item => matchesScope(item, scope))
  return sortNewestFirst(items)
}

export async function listLessonFeedback(lessonId, { taskId = null, scope = null, includeArchived = false } = {}) {
  if (!lessonId) throw new Error('lessonId is required')
  const snap = await db.collection('lessons').doc(lessonId).collection('feedback').get()
  const items = snap.docs
    .map(doc => normalizeFeedbackDoc(doc, 'lesson', lessonId))
    .filter(item => includeArchived || !item.archived)
    .filter(item => matchesTaskId(item, taskId))
    .filter(item => matchesScope(item, scope))
  return sortNewestFirst(items)
}

export async function listAllLessonFeedback({ lessonId = null, taskId = null, scope = null, includeArchived = false } = {}) {
  const snap = await db.collectionGroup('feedback').get()
  const items = snap.docs
    .map(doc => {
      const parentLessonId = doc.ref.parent.parent?.id ?? null
      return normalizeFeedbackDoc(doc, 'lesson', parentLessonId)
    })
    .filter(item => includeArchived || !item.archived)
    .filter(item => (lessonId ? item.lessonId === lessonId : true))
    .filter(item => matchesTaskId(item, taskId))
    .filter(item => matchesScope(item, scope))
  return sortNewestFirst(items)
}

export async function listAllFeedback({ lessonId = null, taskId = null, scope = null, includeArchived = false } = {}) {
  const [platform, lesson] = await Promise.all([
    listPlatformFeedback({ lessonId, taskId, scope, includeArchived }),
    lessonId ? listLessonFeedback(lessonId, { taskId, scope, includeArchived }) : listAllLessonFeedback({ taskId, scope, includeArchived }),
  ])
  return sortNewestFirst([...platform, ...lesson])
}

export async function addLessonFeedback(lessonId, { text, teacherEmail = '', taskId = null, taskTitle = null, lessonTitle = null } = {}) {
  if (!lessonId) throw new Error('lessonId is required')
  if (!text?.trim()) throw new Error('--text is required')
  const ref = await db.collection('lessons').doc(lessonId).collection('feedback').add({
    lessonId,
    lessonTitle: lessonTitle ?? null,
    taskId: taskId ?? null,
    taskTitle: taskTitle ?? null,
    text: text.trim(),
    teacherEmail: teacherEmail ?? '',
    submittedAt: Date.now(),
  })
  return { success: true, id: ref.id, lessonId, source: 'lesson' }
}

export async function addPlatformFeedback({ text, teacherEmail = '', lessonId = null, lessonTitle = null, taskId = null, taskTitle = null } = {}) {
  if (!text?.trim()) throw new Error('--text is required')
  const ref = await db.collection('platformFeedback').add({
    lessonId: lessonId ?? null,
    lessonTitle: lessonTitle ?? null,
    taskId: taskId ?? null,
    taskTitle: taskTitle ?? null,
    text: text.trim(),
    teacherEmail: teacherEmail ?? '',
    submittedAt: Date.now(),
  })
  return { success: true, id: ref.id, source: 'platform' }
}

export async function archiveLessonFeedbackItem(lessonId, feedbackId) {
  if (!lessonId) throw new Error('lessonId is required')
  if (!feedbackId) throw new Error('feedbackId is required')
  const ref = db.collection('lessons').doc(lessonId).collection('feedback').doc(feedbackId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Feedback item "${feedbackId}" not found under lesson "${lessonId}"`)
  await ref.update({ archived: true })
  return { success: true, id: feedbackId, lessonId }
}

export async function archivePlatformFeedbackItem(feedbackId) {
  if (!feedbackId) throw new Error('feedbackId is required')
  const ref = db.collection('platformFeedback').doc(feedbackId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Platform feedback item "${feedbackId}" not found`)
  await ref.update({ archived: true })
  return { success: true, id: feedbackId }
}

export async function clearLessonFeedback(lessonId, { taskId = null, scope = null } = {}) {
  if (!lessonId) throw new Error('lessonId is required')
  const snap = await db.collection('lessons').doc(lessonId).collection('feedback').get()
  const toArchive = snap.docs
    .filter(doc => !doc.data().archived)
    .filter(doc => matchesTaskId(doc.data(), taskId))
    .filter(doc => matchesScope(doc.data(), scope))
  const archived = await batchArchiveRefs(toArchive.map(doc => doc.ref))
  return { success: true, archived, lessonId }
}

export async function clearPlatformFeedback({ lessonId = null, taskId = null, scope = null } = {}) {
  const snap = await db.collection('platformFeedback').get()
  const toArchive = snap.docs
    .filter(doc => !doc.data().archived)
    .filter(doc => (lessonId ? doc.data().lessonId === lessonId : true))
    .filter(doc => matchesTaskId(doc.data(), taskId))
    .filter(doc => matchesScope(doc.data(), scope))
  const archived = await batchArchiveRefs(toArchive.map(doc => doc.ref))
  return { success: true, archived }
}
