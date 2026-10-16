import { validateLessonCore } from '../src/shared/lessonValidation.js'

// CLI lesson validation. The rules and their wording are shared with the Builder
// (src/shared/lessonValidation.js, each module definition's validateTask and the activity
// registry); this file only adds the CLI's own extras. See ADR 0008.

// CLI-only: lessons published from the CLI go straight to the lesson list, whose entry
// screen shows the description.
function requireDescription(lesson, errors) {
  if (!lesson.description || !String(lesson.description).trim()) {
    errors.push('description is required')
  }
}

// CLI-only: two tasks with the same id (often YAML that gives some tasks an `id` and leaves it
// out on others, which are numbered by position, so an explicit `id: 2` clashes with the second
// task). Progress, carry-through and feedback are keyed by task id, so publishing would mix the
// two tasks up. (The Builder only warns: it renumbers ids on export.)
function rejectDuplicateTaskIds({ flat, errors }) {
  const firstById = new Map()
  flat.forEach((task, index) => {
    if (!task || typeof task !== 'object' || task.id == null || task.id === '') return
    const key = String(task.id)
    if (firstById.has(key)) {
      errors.push(
        `Task ${index + 1} has the same id (${key}) as task ${firstById.get(key)} — give every task its own id, or leave out every task id so they are numbered in order`
      )
    } else {
      firstById.set(key, index + 1)
    }
  })
}

export function validateLessonForMcp(lesson) {
  const { errors, warnings } = validateLessonCore(lesson, {
    envelope: requireDescription,
    beforeTasks: rejectDuplicateTaskIds,
  })
  return { valid: errors.length === 0, errors, warnings }
}
