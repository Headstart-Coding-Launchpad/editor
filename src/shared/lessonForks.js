export const CLASS_COLLECTION = 'classes'

export function slugifyClassId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function makeClassRecord({
  id,
  name,
  archived = false,
  createdAt = Date.now(),
  updatedAt = Date.now(),
}) {
  const safeId = slugifyClassId(id ?? name)
  if (!safeId) throw new Error('Class id is required')
  const title = String(name ?? id ?? '').trim()
  if (!title) throw new Error('Class name is required')
  return {
    id: safeId,
    name: title,
    archived: Boolean(archived),
    createdAt,
    updatedAt,
  }
}

export function makeForkLessonId(sourceLessonId, classId) {
  const source = String(sourceLessonId ?? '').trim()
  const safeClassId = slugifyClassId(classId)
  if (!source) throw new Error('Source lesson id is required')
  if (!safeClassId) throw new Error('Class id is required')
  return `${source}-${safeClassId}`
}

export function makeForkLessonTitle(sourceTitle, className) {
  const title = String(sourceTitle ?? '').trim()
  const name = String(className ?? '').trim()
  if (!title) throw new Error('Source lesson title is required')
  if (!name) throw new Error('Class name is required')
  return `${title} - ${name}`
}

export function flattenLessonTasks(tasks = []) {
  const result = []
  for (const item of tasks) {
    if (item?.type === 'group') {
      for (const subtask of item.subtasks ?? []) result.push(subtask)
    } else if (item) {
      result.push(item)
    }
  }
  return result
}

export function makeForkTaskLinks(tasks = []) {
  return flattenLessonTasks(tasks)
    .filter((task) => task?.id != null)
    .map((task) => ({
      taskId: task.id,
      sourceTaskId: task.id,
      relation: 'copied',
    }))
}

export function buildLessonFork(sourceLesson, classRecord, now = Date.now()) {
  if (!sourceLesson?.id) throw new Error('Source lesson is required')
  if (sourceLesson.fork?.sourceLessonId) {
    throw new Error(
      `Lesson '${sourceLesson.id}' is already a fork; fork from the stock lesson instead`
    )
  }
  const cls = makeClassRecord(classRecord)
  const forkId = makeForkLessonId(sourceLesson.id, cls.id)
  const sourceCopy = JSON.parse(JSON.stringify(sourceLesson))
  const { id: _sourceId, title: _sourceTitle, fork: _sourceFork, ...rest } = sourceCopy

  return {
    ...rest,
    id: forkId,
    title: makeForkLessonTitle(sourceLesson.title, cls.name),
    stage: 'published',
    fork: {
      sourceLessonId: sourceLesson.id,
      sourceLessonTitle: sourceLesson.title ?? sourceLesson.id,
      classId: cls.id,
      className: cls.name,
      createdAt: now,
      updatedAt: now,
      taskLinks: makeForkTaskLinks(sourceLesson.tasks ?? []),
    },
  }
}
