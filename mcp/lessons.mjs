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
