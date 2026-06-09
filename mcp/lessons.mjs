import { z } from 'zod'
import { db } from './firebase.mjs'

const VALID_TYPES = ['python', 'html', 'scratch', 'filesystem']

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

function normalizeChecksLocal(check) {
  if (!check) return []
  return Array.isArray(check) ? check : [check]
}

export function validateLessonForMcp(lesson) {
  const errors = []
  const warnings = []

  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    return { valid: false, errors: ['lesson must be a JSON object'], warnings: [] }
  }

  const { id, type, title, description, tasks } = lesson

  if (!id || !String(id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9-]+$/.test(id)) errors.push('id must be a lowercase slug (letters, digits, hyphens only)')

  if (!type) errors.push('type is required')
  else if (!VALID_TYPES.includes(type)) errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`)

  if (!title || !String(title).trim()) errors.push('title is required')
  if (!description || !String(description).trim()) errors.push('description is required')

  if (!tasks || !Array.isArray(tasks)) {
    errors.push('tasks is required and must be an array')
    return { valid: false, errors, warnings }
  }
  if (tasks.length === 0) errors.push('tasks must contain at least one task or group')

  tasks.forEach((item, i) => {
    if (item.type === 'group') {
      if (!item.title) errors.push(`Group ${i + 1} is missing a title`)
      if (!item.subtasks || item.subtasks.length === 0) {
        errors.push(`Group "${item.title || (i + 1)}" has no subtasks`)
      }
    }
  })

  const flat = flattenTasksLocal(tasks)
  flat.forEach((task, i) => {
    const n = i + 1

    if (!task.title) errors.push(`Task ${n} is missing a title`)

    if (task.estimatedMinutes != null && (!Number.isInteger(Number(task.estimatedMinutes)) || Number(task.estimatedMinutes) <= 0)) {
      errors.push(`Task ${n} estimated time must be a positive whole number of minutes`)
    }

    if (task.taskType === 'information' && task.informationType !== 'introduction' && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }

    if (task.taskType === 'quiz') {
      const quizType = task.quizType ?? 'multiple_choice'
      if (quizType === 'multiple_choice') {
        if (!task.options || task.options.length < 2) errors.push(`Task ${n} is a quiz but has fewer than 2 options`)
        if (task.options?.some(o => !o.text?.trim())) errors.push(`Task ${n} is a quiz but has an empty option text`)
        if (task.check?.type !== 'answer_equals' || !task.check.value) errors.push(`Task ${n} is a quiz but no correct answer has been selected`)
      } else if (quizType === 'match') {
        if (!task.pairs || task.pairs.length < 2) errors.push(`Task ${n} is a match quiz but has fewer than 2 pairs`)
        if (task.pairs?.some(p => !p.prompt?.trim() || !p.answer?.trim())) errors.push(`Task ${n} is a match quiz but has an empty prompt or answer`)
      } else if (quizType === 'fill_blank') {
        if (!task.text?.includes('___')) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blanks in the text`)
        if (!task.blanks || task.blanks.length === 0) errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blank answers`)
        if (task.blanks?.some(b => !b.answer?.trim())) errors.push(`Task ${n} is a fill-in-the-blank quiz but has an empty answer`)
      } else if (quizType === 'short_answer') {
        if (task.check != null && (!task.check.type?.startsWith('answer_') || !task.check.value?.trim())) {
          errors.push(`Task ${n} is a short-answer quiz with a check enabled but no check value`)
        }
      }
    } else if (task.taskType !== 'information' && type === 'html') {
      if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
      else {
        const names = task.starterFiles.map(f => f.name)
        if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
        if (!task.starterFiles.some(f => f.type === 'html' || f.name?.endsWith('.html'))) {
          errors.push(`Task ${n} has no HTML file to use as entry point`)
        }
      }
    } else if (task.taskType !== 'information' && type === 'filesystem') {
      if (task.codeStages?.length > 0) {
        task.codeStages.forEach((stage, si) => {
          if (!stage.label?.trim()) errors.push(`Task ${n} stage ${si + 1} is missing a label`)
          if (!stage.fs || typeof stage.fs !== 'object') errors.push(`Task ${n} stage ${si + 1} has no filesystem state`)
        })
      }
      if (task.check) {
        const checks = normalizeChecksLocal(task.check)
        if (checks.some(c => c.type?.startsWith('fs_') && !c.path?.trim())) {
          errors.push(`Task ${n} has a filesystem check but no path`)
        }
        if (checks.some(c => c.type === 'fs_content_contains' && !c.value?.trim())) {
          errors.push(`Task ${n} has a file content check but no expected value`)
        }
        if (checks.some(c => c.type === 'fs_file_in_dir' && !c.dir?.trim())) {
          errors.push(`Task ${n} has a file-in-dir check but no parent folder`)
        }
      }
    } else if (task.taskType !== 'information' && task.taskType !== 'quiz' && type === 'scratch') {
      // Scratch toolbox XML validation is skipped: Node.js has no DOMParser. Builder preview catches toolbox XML errors.
      if (task.check?.type === 'sprite_property') {
        if (!task.check.property) errors.push(`Task ${n} sprite check is missing a property`)
        if (!task.check.operator) errors.push(`Task ${n} sprite check is missing an operator`)
        if (task.check.value == null || task.check.value === '') errors.push(`Task ${n} sprite check is missing a value`)
      }
      if (task.check?.type === 'block_used' && !task.check.opcode) {
        errors.push(`Task ${n} block-used check is missing a block opcode`)
      }
    }

    if (!task.taskType) {
      const hasStarter = type === 'python' ? !!task.starterCode
        : type === 'scratch' ? !!task.starterBlocks
        : type === 'filesystem' ? !!task.starterFs
        : task.starterFiles?.some(f => f.content?.trim())
      if (!hasStarter && type !== 'filesystem') {
        warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
      }
    }
  })

  return { valid: errors.length === 0, errors, warnings }
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
}
