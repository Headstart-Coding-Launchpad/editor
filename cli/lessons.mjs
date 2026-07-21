import { db } from './firebase.mjs'
import { validateLessonForMcp } from './validate.mjs'
import { parseYamlLesson } from './yaml-converter.mjs'
import { auditLessonTopics, validateTopicStage } from '../src/shared/topicAudit.js'
import { buildLessonFork, makeForkLessonId } from '../src/shared/lessonForks.js'
import { LEVEL_COLLECTION, migrateLessonLevel } from '../src/shared/lessonLevels.js'
import { getClass } from './classes.mjs'

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
  const migrated = migrateLessonLevel(lesson)
  const { valid, errors, warnings } = validateLessonForMcp(migrated.lesson)
  if (!valid) return { success: false, valid, errors, warnings }
  const topicValidation = validateTopicStage(migrated.lesson, await fetchTopicLibrary(), migrated.lesson.stage ?? 'published')
  if (!topicValidation.valid) {
    return {
      success: false,
      valid: false,
      errors: topicValidation.errors,
      warnings: [...warnings, ...topicValidation.warnings],
      topicAudit: topicValidation.audit,
    }
  }
  if (migrated.level) {
    await db.collection(LEVEL_COLLECTION).doc(migrated.level.id).set(migrated.level, { merge: true })
  }
  await db.collection('lessons').doc(migrated.lesson.id).set(migrated.lesson)
  const snap = await db.collection('lessons').doc(migrated.lesson.id).get()
  const published = snap.exists ? summarize(snap.id, snap.data()) : null
  return {
    success: true,
    valid,
    id: migrated.lesson.id,
    warnings: [...warnings, ...topicValidation.warnings],
    level: migrated.level ?? null,
    published,
  }
}

async function clearLessonChildCollection(lessonId, collectionName) {
  const snap = await db.collection('lessons').doc(lessonId).collection(collectionName).get()
  await Promise.all(snap.docs.map(doc => doc.ref.delete()))
  return snap.size
}

async function clearLessonRunData(lessonId) {
  const [reportsDeleted, feedbackDeleted] = await Promise.all([
    clearLessonChildCollection(lessonId, 'sessionReports'),
    clearLessonChildCollection(lessonId, 'feedback'),
  ])
  return { reportsDeleted, feedbackDeleted }
}

export async function listLessons() {
  const snap = await db.collection('lessons').get()
  return snap.docs
    .map(doc => {
      const d = doc.data()
      const taskCount = (d.tasks ?? []).reduce(
        (acc, t) => acc + (t.type === 'group' ? (t.subtasks?.length ?? 0) : 1), 0
      )
      return {
        id: doc.id,
        title: d.title ?? '',
        type: d.type ?? '',
        level: d.level ?? null,
        levelId: d.levelId ?? null,
        fork: d.fork ? {
          sourceLessonId: d.fork.sourceLessonId,
          classId: d.fork.classId,
          className: d.fork.className ?? '',
        } : null,
        taskCount,
      }
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

export async function forkLesson(sourceLessonId, classId, { publish = true, includeLesson = false } = {}) {
  const source = await getLesson(sourceLessonId)
  const cls = await getClass(classId)
  const fork = buildLessonFork(source, cls)
  if (!publish) {
    return { success: true, published: false, id: fork.id, sourceLessonId, classId: cls.id, lesson: fork }
  }
  const result = await publishLesson(fork)
  if (!result.success) return result
  const cleared = await clearLessonRunData(fork.id)
  return {
    ...result,
    forkId: fork.id,
    sourceLessonId,
    classId: cls.id,
    cleared,
    lesson: includeLesson ? fork : undefined,
  }
}

export async function listLessonForks(sourceLessonId) {
  const snap = await db.collection('lessons').get()
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(lesson => lesson.fork?.sourceLessonId === sourceLessonId)
    .sort((a, b) => String(a.fork?.className ?? a.title ?? a.id).localeCompare(String(b.fork?.className ?? b.title ?? b.id)))
    .map(lesson => ({
      ...summarize(lesson.id, lesson),
      sourceLessonId: lesson.fork.sourceLessonId,
      classId: lesson.fork.classId,
      className: lesson.fork.className ?? '',
    }))
}

export async function getLessonLineage(id) {
  const lesson = await getLesson(id)
  if (!lesson.fork?.sourceLessonId) {
    const forks = await listLessonForks(id)
    return {
      id,
      title: lesson.title ?? '',
      kind: 'stock',
      forkCount: forks.length,
      forks,
    }
  }
  return {
    id,
    title: lesson.title ?? '',
    kind: 'fork',
    expectedId: makeForkLessonId(lesson.fork.sourceLessonId, lesson.fork.classId),
    fork: lesson.fork,
  }
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

export async function publishYamlLesson(yamlText, includeLesson = false) {
  const lesson = parseYamlLesson(yamlText)
  const result = await publishLesson(lesson)
  if (includeLesson && result.success) result.lesson = lesson
  return result
}

