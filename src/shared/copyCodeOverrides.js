// A tutor's own "Type this out" text for a task (the Copy code panel), for the whole class or
// one student. Stored under the session: `copyCodeOverrides/{taskId}` (class) and
// `students/{id}/copyCodeOverrides/{taskId}` (that student, which wins). The lesson's own
// `task.copyCode` is never changed; a session ending drops both.

/** The text a student sees for a task: their own override, else the class one, else the lesson's. */
export function effectiveCopyCode(task, classOverrides, studentOverrides) {
  const id = task?.id
  if (id == null) return task?.copyCode
  const own = studentOverrides?.[id]
  if (typeof own === 'string') return own
  const shared = classOverrides?.[id]
  if (typeof shared === 'string') return shared
  return task.copyCode
}

/** The lesson with each task's `copyCode` replaced where a tutor override applies. */
export function applyCopyCodeOverrides(lesson, classOverrides, studentOverrides) {
  if (!lesson || (!classOverrides && !studentOverrides)) return lesson
  const patch = (task) => {
    if (task?.type === 'group' && Array.isArray(task.subtasks)) {
      return { ...task, subtasks: task.subtasks.map(patch) }
    }
    const text = effectiveCopyCode(task, classOverrides, studentOverrides)
    return text === task?.copyCode ? task : { ...task, copyCode: text }
  }
  return { ...lesson, tasks: (lesson.tasks ?? []).map(patch) }
}
