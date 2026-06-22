import { db } from './firebase.mjs'
import { validateLessonForMcp } from './validate.mjs'
import { parseYamlLesson } from './yaml-converter.mjs'
import { auditLessonTopics, validateTopicStage } from '../src/shared/topicAudit.js'

export { validateLessonForMcp as validateLesson }

function flattenTasks(tasks) {
  const result = []
  for (const item of tasks) {
    if (item.type === 'group') {
      for (const sub of item.subtasks ?? []) result.push(sub)
    } else {
      result.push(item)
    }
  }
  return result
}

function buildSkeletonTaskList(tasks) {
  const result = []
  let flatIndex = 0
  for (const item of tasks) {
    if (item.type === 'group') {
      for (const sub of item.subtasks ?? []) {
        flatIndex++
        result.push({
          flatIndex,
          title: sub.title ?? '',
          taskType: sub.taskType ?? null,
          estimatedMinutes: sub.estimatedMinutes ?? null,
          group: item.title ?? null,
        })
      }
    } else {
      flatIndex++
      result.push({
        flatIndex,
        title: item.title ?? '',
        taskType: item.taskType ?? null,
        estimatedMinutes: item.estimatedMinutes ?? null,
        group: null,
      })
    }
  }
  return result
}

function findTaskByFlatIndex(tasks, flatIndex) {
  let count = 0
  for (let outerIdx = 0; outerIdx < tasks.length; outerIdx++) {
    const item = tasks[outerIdx]
    if (item.type === 'group') {
      for (let innerIdx = 0; innerIdx < (item.subtasks?.length ?? 0); innerIdx++) {
        count++
        if (count === flatIndex) return { outerIdx, innerIdx }
      }
    } else {
      count++
      if (count === flatIndex) return { outerIdx, innerIdx: null }
    }
  }
  return null
}

function replaceTaskAtFlatIndex(tasks, flatIndex, newTask) {
  const loc = findTaskByFlatIndex(tasks, flatIndex)
  if (!loc) return null
  return tasks.map((item, i) => {
    if (i !== loc.outerIdx) return item
    if (loc.innerIdx === null) return newTask
    return {
      ...item,
      subtasks: item.subtasks.map((sub, j) => (j === loc.innerIdx ? newTask : sub)),
    }
  })
}

function appendTaskToList(tasks, task, groupTitle) {
  if (!groupTitle) return [...tasks, task]
  let found = false
  const updated = tasks.map(item => {
    if (item.type === 'group' && item.title === groupTitle) {
      found = true
      return { ...item, subtasks: [...(item.subtasks ?? []), task] }
    }
    return item
  })
  if (!found) updated.push({ type: 'group', title: groupTitle, subtasks: [task] })
  return updated
}

function summarize(id, lesson) {
  const tasks = lesson.tasks ?? []
  return { id, title: lesson.title ?? '', type: lesson.type ?? '', flatTaskCount: flattenTasks(tasks).length }
}

async function fetchTopicLibrary() {
  const snap = await db.collection('topicLibrary').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function publishLesson(lesson) {
  const { valid, errors, warnings } = validateLessonForMcp(lesson)
  if (!valid) return { success: false, valid, errors, warnings }
  const topicValidation = validateTopicStage(lesson, await fetchTopicLibrary(), lesson.stage ?? 'published')
  if (!topicValidation.valid) {
    return {
      success: false,
      valid: false,
      errors: topicValidation.errors,
      warnings: [...warnings, ...topicValidation.warnings],
      topicAudit: topicValidation.audit,
    }
  }
  await db.collection('lessons').doc(lesson.id).set(lesson)
  const snap = await db.collection('lessons').doc(lesson.id).get()
  const published = snap.exists ? summarize(snap.id, snap.data()) : null
  return {
    success: true,
    valid,
    id: lesson.id,
    warnings: [...warnings, ...topicValidation.warnings],
    published,
  }
}

export async function listLessons() {
  const snap = await db.collection('lessons').get()
  return snap.docs
    .map(doc => {
      const d = doc.data()
      const taskCount = (d.tasks ?? []).reduce(
        (acc, t) => acc + (t.type === 'group' ? (t.subtasks?.length ?? 0) : 1), 0
      )
      return { id: doc.id, title: d.title ?? '', type: d.type ?? '', taskCount }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getLesson(id) {
  const snap = await db.collection('lessons').doc(id).get()
  if (!snap.exists) throw new Error(`Lesson '${id}' not found`)
  return { id: snap.id, ...snap.data() }
}

export async function getLessonSkeleton(id) {
  const snap = await db.collection('lessons').doc(id).get()
  if (!snap.exists) throw new Error(`Lesson '${id}' not found`)
  const data = snap.data()
  const { tasks, ...meta } = data
  return {
    id: snap.id,
    ...meta,
    taskCount: flattenTasks(tasks ?? []).length,
    tasks: buildSkeletonTaskList(tasks ?? []),
  }
}

export async function getTask(lessonId, taskIndex) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const tasks = snap.data().tasks ?? []
  const loc = findTaskByFlatIndex(tasks, taskIndex)
  if (!loc) throw new Error(`Task index ${taskIndex} is out of range (lesson has ${flattenTasks(tasks).length} tasks)`)
  const task = loc.innerIdx === null
    ? tasks[loc.outerIdx]
    : tasks[loc.outerIdx].subtasks[loc.innerIdx]
  return { lessonId, taskIndex, task }
}

export async function upsertTask(lessonId, taskIndex, task) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const lesson = { id: snap.id, ...snap.data() }
  const updatedTasks = replaceTaskAtFlatIndex(lesson.tasks ?? [], taskIndex, task)
  if (!updatedTasks) {
    throw new Error(`Task index ${taskIndex} is out of range (lesson has ${flattenTasks(lesson.tasks ?? []).length} tasks)`)
  }
  const updatedLesson = { ...lesson, tasks: updatedTasks }
  const { errors, warnings } = validateLessonForMcp(updatedLesson)
  if (errors.length > 0) return { success: false, errors, warnings }
  await db.collection('lessons').doc(lessonId).set(updatedLesson)
  return { success: true, lessonId, taskIndex, warnings }
}

export async function appendTask(lessonId, task, groupTitle) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const lesson = { id: snap.id, ...snap.data() }
  const updatedTasks = appendTaskToList(lesson.tasks ?? [], task, groupTitle)
  const updatedLesson = { ...lesson, tasks: updatedTasks }
  const { errors, warnings } = validateLessonForMcp(updatedLesson)
  if (errors.length > 0) return { success: false, errors, warnings }
  await db.collection('lessons').doc(lessonId).set(updatedLesson)
  return { success: true, lessonId, taskIndex: flattenTasks(updatedTasks).length, warnings }
}

export async function upsertLesson(lesson) {
  return publishLesson(lesson)
}

export async function deleteLesson(id) {
  const snap = await db.collection('lessons').doc(id).get()
  if (!snap.exists) throw new Error(`Lesson '${id}' not found`)
  await db.collection('lessons').doc(id).delete()
  return { success: true, id }
}

const VALID_STAGES = ['ideas', 'details', 'review', 'approved', 'published']

export async function setLessonStage(id, stage) {
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`Invalid stage '${stage}'. Must be one of: ${VALID_STAGES.join(', ')}`)
  }
  const snap = await db.collection('lessons').doc(id).get()
  if (!snap.exists) throw new Error(`Lesson '${id}' not found`)
  const lesson = { id: snap.id, ...snap.data() }
  const previous = lesson.stage ?? 'published'
  const topicValidation = validateTopicStage(lesson, await fetchTopicLibrary(), stage)
  if (!topicValidation.valid) throw new Error(topicValidation.errors.join('; '))
  await db.collection('lessons').doc(id).update({ stage })
  return {
    success: true,
    id,
    previousStage: previous,
    stage,
    warnings: topicValidation.warnings,
    topicAudit: topicValidation.audit,
  }
}

export async function getLessonTopicAudit(id) {
  const lesson = await getLesson(id)
  const audit = auditLessonTopics(lesson, await fetchTopicLibrary())
  return {
    lessonId: id,
    lessonTitle: lesson.title ?? '',
    stage: lesson.stage ?? 'published',
    references: audit.references,
    existing: audit.existing,
    missing: audit.missing,
    proposals: lesson.topicProposals ?? [],
    unusedProposals: audit.unusedProposals,
  }
}

export async function getLessonReviewNotes(id) {
  const snap = await db.collection('lessons').doc(id).get()
  if (!snap.exists) throw new Error(`Lesson '${id}' not found`)
  const tasks = snap.data().tasks ?? []
  const flat = flattenTasks(tasks)
  return flat
    .filter(t => t.reviewNote)
    .map(t => ({
      taskId: t.id,
      title: t.title ?? '',
      taskType: t.taskType ?? null,
      reviewNote: t.reviewNote,
    }))
}

export async function setTaskReviewNote(lessonId, taskId, reviewNote) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const lesson = { id: snap.id, ...snap.data() }
  const flat = flattenTasks(lesson.tasks ?? [])
  const target = flat.find(t => String(t.id) === String(taskId))
  if (!target) throw new Error(`Task '${taskId}' not found in lesson '${lessonId}'`)
  const updated = { ...target, reviewNote: { ...(target.reviewNote ?? {}), ...reviewNote } }
  const updatedTasks = replaceTaskAtFlatIndex(
    lesson.tasks,
    flat.findIndex(t => String(t.id) === String(taskId)) + 1,
    updated,
  )
  if (!updatedTasks) throw new Error(`Could not locate task '${taskId}'`)
  await db.collection('lessons').doc(lessonId).set({ ...lesson, tasks: updatedTasks })
  return { success: true, lessonId, taskId, reviewNote: updated.reviewNote }
}

export function yamlToLesson(yamlText) {
  const lesson = parseYamlLesson(yamlText)
  const { valid, errors, warnings } = validateLessonForMcp(lesson)
  return { lesson, valid, errors, warnings }
}

// ── Lesson Drafts (CLI) ───────────────────────────────────────────────────────

export async function listDrafts() {
  const snap = await db.collection('lessonDrafts').orderBy('updatedAt', 'desc').get()
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      title: data.title ?? '',
      type: data.type ?? '',
      level: data.level ?? null,
      stage: data.stage ?? '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
    }
  })
}

export async function getDraft(id) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  return { id: snap.id, ...snap.data() }
}

export async function upsertDraftDoc(id, fields) {
  const ref = db.collection('lessonDrafts').doc(id)
  const existing = await ref.get()
  const base = existing.exists ? existing.data() : {}
  await ref.set({
    ...base,
    ...fields,
    id,
    updatedAt: new Date(),
    _meta: {
      ...(base._meta ?? {}),
      ...(fields._meta ?? {}),
      createdAt: base._meta?.createdAt ?? new Date(),
      updatedAt: new Date(),
    },
  })
  const saved = await ref.get()
  return { success: true, id, stage: saved.data().stage }
}

export async function updateDraftContext(id, context) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  await db.collection('lessonDrafts').doc(id).update({ context, updatedAt: new Date() })
  return { success: true, id }
}

const STAGE_ORDER = ['ideas', 'details', 'review']

export async function submitDraft(id) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  const current = snap.data().stage ?? 'ideas'
  const idx = STAGE_ORDER.indexOf(current)
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) {
    throw new Error(`Draft is already at stage '${current}' — cannot advance further via submit. Use approve to move to approved.`)
  }
  const next = STAGE_ORDER[idx + 1]
  await db.collection('lessonDrafts').doc(id).update({ stage: next, updatedAt: new Date() })
  return { success: true, id, previousStage: current, stage: next }
}

export async function requestChanges(id) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  await db.collection('lessonDrafts').doc(id).update({ stage: 'details', updatedAt: new Date() })
  return { success: true, id, stage: 'details' }
}

export async function approveDraft(id, reviewerEmail) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  const now = new Date()
  await db.collection('lessonDrafts').doc(id).update({
    stage: 'approved',
    updatedAt: now,
    '_meta.reviewedBy': reviewerEmail ?? '',
    '_meta.reviewedAt': now,
  })
  return { success: true, id, stage: 'approved' }
}

export async function markDraftPublished(id) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  await db.collection('lessonDrafts').doc(id).update({ stage: 'published', updatedAt: new Date() })
  return { success: true, id, stage: 'published' }
}

export async function listDraftNotes(id) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  return snap.data().reviewNotes ?? []
}

export async function addDraftNote(id, note) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  const existing = snap.data().reviewNotes ?? []
  const filtered = existing.filter(n => n.sectionId !== note.sectionId)
  await db.collection('lessonDrafts').doc(id).update({
    reviewNotes: [...filtered, { ...note, createdAt: Date.now() }],
    updatedAt: new Date(),
  })
  return { success: true, id, sectionId: note.sectionId }
}

export async function updateDraftNote(id, sectionId, fields) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  const notes = snap.data().reviewNotes ?? []
  const updated = notes.map(n => n.sectionId === sectionId ? { ...n, ...fields } : n)
  await db.collection('lessonDrafts').doc(id).update({ reviewNotes: updated, updatedAt: new Date() })
  return { success: true, id, sectionId }
}

export async function deleteDraftNote(id, sectionId) {
  const snap = await db.collection('lessonDrafts').doc(id).get()
  if (!snap.exists) throw new Error(`Draft '${id}' not found`)
  const notes = (snap.data().reviewNotes ?? []).filter(n => n.sectionId !== sectionId)
  await db.collection('lessonDrafts').doc(id).update({ reviewNotes: notes, updatedAt: new Date() })
  return { success: true, id, sectionId }
}

export async function publishYamlLesson(yamlText, includeLesson = false) {
  const lesson = parseYamlLesson(yamlText)
  const result = await publishLesson(lesson)
  if (includeLesson && result.success) result.lesson = lesson
  return result
}

// ── Draft Entries (CLI) ───────────────────────────────────────────────────────

function makeEntryId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export async function listDraftEntries(draftId) {
  const snap = await db.collection('lessonDrafts').doc(draftId).get()
  if (!snap.exists) throw new Error(`Draft '${draftId}' not found`)
  return (snap.data().entries ?? []).sort((a, b) => a.order - b.order)
}

export async function getDraftEntry(draftId, entryId) {
  const snap = await db.collection('lessonDrafts').doc(draftId).get()
  if (!snap.exists) throw new Error(`Draft '${draftId}' not found`)
  const entry = (snap.data().entries ?? []).find(e => e.id === entryId)
  if (!entry) throw new Error(`Entry '${entryId}' not found in draft '${draftId}'`)
  return entry
}

export async function addDraftEntry(draftId, fields) {
  const ref = db.collection('lessonDrafts').doc(draftId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Draft '${draftId}' not found`)
  const entries = snap.data().entries ?? []
  const entry = { id: makeEntryId(), order: entries.length + 1, ...fields, createdAt: Date.now() }
  await ref.update({ entries: [...entries, entry], updatedAt: new Date() })
  return { success: true, entry }
}

export async function updateDraftEntryById(draftId, entryId, fields) {
  const ref = db.collection('lessonDrafts').doc(draftId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Draft '${draftId}' not found`)
  const entries = snap.data().entries ?? []
  if (!entries.find(e => e.id === entryId)) throw new Error(`Entry '${entryId}' not found`)
  const updated = entries.map(e => e.id === entryId ? { ...e, ...fields } : e)
  await ref.update({ entries: updated, updatedAt: new Date() })
  return { success: true, draftId, entryId }
}

export async function deleteDraftEntryById(draftId, entryId) {
  const ref = db.collection('lessonDrafts').doc(draftId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`Draft '${draftId}' not found`)
  const remaining = (snap.data().entries ?? [])
    .filter(e => e.id !== entryId)
    .map((e, i) => ({ ...e, order: i + 1 }))
  await ref.update({ entries: remaining, updatedAt: new Date() })
  return { success: true, draftId, entryId, remaining: remaining.length }
}
