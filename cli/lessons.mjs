import { db } from './firebase.mjs'
import { validateLessonForMcp } from './validate.mjs'
import { parseYamlLesson } from './yaml-converter.mjs'

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

async function publishLesson(lesson) {
  const { valid, errors, warnings } = validateLessonForMcp(lesson)
  if (!valid) return { success: false, valid, errors, warnings }
  await db.collection('lessons').doc(lesson.id).set(lesson)
  const snap = await db.collection('lessons').doc(lesson.id).get()
  const published = snap.exists ? summarize(snap.id, snap.data()) : null
  return { success: true, valid, id: lesson.id, warnings, published }
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
