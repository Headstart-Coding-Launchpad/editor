import { z } from 'zod'
import { db } from './firebase.mjs'
import { validateLessonForMcp } from './validate.mjs'
import { parseYamlLesson } from './yaml-converter.mjs'

export { validateLessonForMcp }

function flattenTasksLocal(tasks) {
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

// --- Task addressing helpers ---

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

function appendTaskToLesson(tasks, task, groupTitle) {
  if (!groupTitle) return [...tasks, task]
  let found = false
  const updated = tasks.map(item => {
    if (item.type === 'group' && item.title === groupTitle) {
      found = true
      return { ...item, subtasks: [...(item.subtasks ?? []), task] }
    }
    return item
  })
  if (!found) {
    // Group doesn't exist — create it
    updated.push({ type: 'group', title: groupTitle, subtasks: [task] })
  }
  return updated
}

// --- Tool registration ---

export function registerLessonTools(server) {
  server.tool(
    'list_lessons',
    'List all lessons currently live in the app (from Firestore). Use to check what is published before creating or updating a lesson.',
    {},
    async () => {
      const snap = await db.collection('lessons').get()
      const items = snap.docs
        .map(doc => {
          const d = doc.data()
          const tasks = d.tasks ?? []
          const taskCount = tasks.reduce((acc, t) => acc + (t.type === 'group' ? (t.subtasks?.length ?? 0) : 1), 0)
          return { id: doc.id, title: d.title ?? '', type: d.type ?? '', taskCount }
        })
        .sort((a, b) => a.title.localeCompare(b.title))
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
    }
  )

  server.tool(
    'get_lesson',
    'Fetch the full lesson JSON for a published lesson from Firestore. Use to inspect or edit an existing lesson before upserting changes.',
    { id: z.string().describe('Lesson ID slug') },
    async ({ id }) => {
      const snap = await db.collection('lessons').doc(id).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Lesson '${id}' not found` }) }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify({ id: snap.id, ...snap.data() }, null, 2) }] }
    }
  )

  server.tool(
    'get_lesson_skeleton',
    'Fetch lesson metadata and a compact task list (titles, flat indices, types) without task bodies. Use this instead of get_lesson when you only need to know what tasks exist, then call get_task for the ones you want to read or edit.',
    { id: z.string().describe('Lesson ID slug') },
    async ({ id }) => {
      const snap = await db.collection('lessons').doc(id).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Lesson '${id}' not found` }) }] }
      }
      const data = snap.data()
      const { tasks, ...meta } = data
      const skeleton = {
        id: snap.id,
        ...meta,
        taskCount: flattenTasksLocal(tasks ?? []).length,
        tasks: buildSkeletonTaskList(tasks ?? []),
      }
      return { content: [{ type: 'text', text: JSON.stringify(skeleton, null, 2) }] }
    }
  )

  server.tool(
    'get_task',
    'Fetch a single task from a lesson by its 1-based flat index (groups are transparent — subtasks are numbered sequentially). Use get_lesson_skeleton first to discover indices.',
    {
      lessonId: z.string().describe('Lesson ID slug'),
      taskIndex: z.number().int().min(1).describe('1-based flat task index'),
    },
    async ({ lessonId, taskIndex }) => {
      const snap = await db.collection('lessons').doc(lessonId).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Lesson '${lessonId}' not found` }) }] }
      }
      const tasks = snap.data().tasks ?? []
      const loc = findTaskByFlatIndex(tasks, taskIndex)
      if (!loc) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Task index ${taskIndex} is out of range (lesson has ${flattenTasksLocal(tasks).length} tasks)` }) }] }
      }
      const task = loc.innerIdx === null
        ? tasks[loc.outerIdx]
        : tasks[loc.outerIdx].subtasks[loc.innerIdx]
      return { content: [{ type: 'text', text: JSON.stringify({ lessonId, taskIndex, task }, null, 2) }] }
    }
  )

  server.tool(
    'upsert_task',
    'Replace a single task in a lesson by its 1-based flat index. Fetches the lesson, swaps the task, validates the full lesson, and writes back. Saves sending the whole lesson JSON when editing one task.',
    {
      lessonId: z.string().describe('Lesson ID slug'),
      taskIndex: z.number().int().min(1).describe('1-based flat task index to replace'),
      task: z.object({}).passthrough().describe('Full task object to write at this index'),
    },
    async ({ lessonId, taskIndex, task }) => {
      const snap = await db.collection('lessons').doc(lessonId).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Lesson '${lessonId}' not found` }) }] }
      }
      const lesson = { id: snap.id, ...snap.data() }
      const updatedTasks = replaceTaskAtFlatIndex(lesson.tasks ?? [], taskIndex, task)
      if (!updatedTasks) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Task index ${taskIndex} is out of range (lesson has ${flattenTasksLocal(lesson.tasks ?? []).length} tasks)` }) }] }
      }
      const updatedLesson = { ...lesson, tasks: updatedTasks }
      const { errors, warnings } = validateLessonForMcp(updatedLesson)
      if (errors.length > 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, errors, warnings }) }] }
      }
      try {
        await db.collection('lessons').doc(lessonId).set(updatedLesson)
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, taskIndex, warnings }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'append_task',
    'Add a new task to the end of a lesson (or to a named group). Fetches the lesson, appends the task, validates, and writes back. If groupTitle is provided the task is added to that group (created if it does not exist).',
    {
      lessonId: z.string().describe('Lesson ID slug'),
      task: z.object({}).passthrough().describe('Full task object to append'),
      groupTitle: z.string().optional().describe('Group title to append into. Omit to append at the top level.'),
    },
    async ({ lessonId, task, groupTitle }) => {
      const snap = await db.collection('lessons').doc(lessonId).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Lesson '${lessonId}' not found` }) }] }
      }
      const lesson = { id: snap.id, ...snap.data() }
      const updatedTasks = appendTaskToLesson(lesson.tasks ?? [], task, groupTitle)
      const updatedLesson = { ...lesson, tasks: updatedTasks }
      const { errors, warnings } = validateLessonForMcp(updatedLesson)
      if (errors.length > 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, errors, warnings }) }] }
      }
      try {
        await db.collection('lessons').doc(lessonId).set(updatedLesson)
        const newFlatIndex = flattenTasksLocal(updatedTasks).length
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, taskIndex: newFlatIndex, warnings }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'validate_lesson',
    'Check a lesson JSON for structural errors before publishing. Always call this before upsert_lesson. Returns {valid, errors[], warnings[]}.',
    { lesson: z.object({}).passthrough().describe('Lesson JSON object to validate') },
    async ({ lesson }) => {
      const result = validateLessonForMcp(lesson)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'upsert_lesson',
    'Publish a finished lesson JSON to the live LaunchPad app (writes to Firestore). This is the final step after authoring and validating locally — validates structure first and returns errors if invalid.',
    { lesson: z.object({}).passthrough().describe('Full lesson JSON object') },
    async ({ lesson }) => {
      const { errors, warnings } = validateLessonForMcp(lesson)
      if (errors.length > 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, errors, warnings }) }] }
      }
      try {
        await db.collection('lessons').doc(lesson.id).set(lesson)
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id: lesson.id, warnings }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'delete_lesson',
    'Permanently delete a lesson from Firestore and the live app by ID. Use with caution — this cannot be undone.',
    { id: z.string().describe('Lesson ID to delete') },
    async ({ id }) => {
      const snap = await db.collection('lessons').doc(id).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Lesson '${id}' not found` }) }] }
      }
      try {
        await db.collection('lessons').doc(id).delete()
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'yaml_to_lesson',
    'Convert a YAML lesson to lesson JSON. Task IDs are auto-assigned, taskType shorthands are expanded, and checks/answer shorthands are normalised. Returns the converted lesson JSON plus validation results. Does not publish to Firestore — use upsert_lesson after reviewing the output. Fetch resource yaml://format for the full YAML format reference.',
    { yaml: z.string().describe('YAML lesson text') },
    async ({ yaml: yamlText }) => {
      try {
        const lesson = parseYamlLesson(yamlText)
        const { valid, errors, warnings } = validateLessonForMcp(lesson)
        return { content: [{ type: 'text', text: JSON.stringify({ lesson, valid, errors, warnings }, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err.message, lesson: null }) }] }
      }
    }
  )
}
