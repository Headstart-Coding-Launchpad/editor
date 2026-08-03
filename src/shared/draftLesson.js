const TASK_TYPES = new Set(['information', 'quiz', 'code_arrange'])
const QUIZ_TYPES = new Set(['multiple_choice', 'match', 'fill_blank', 'short_answer', 'confidence'])

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function requireArrayOfObjects(value, label, errors) {
  if (value != null && (!Array.isArray(value) || value.some(item => !isObject(item)))) {
    errors.push(`${label} must be an array of objects when provided`)
  }
}

function validateTaskShape(task, label, draft, errors) {
  if (!isObject(task)) {
    errors.push(`${label} must be an object`)
    return
  }
  if (typeof task.title !== 'string' || !task.title.trim()) errors.push(`${label} is missing a title`)
  if (task.taskType != null && !TASK_TYPES.has(task.taskType)) {
    errors.push(`${label} taskType must be information or quiz when provided`)
  }
  if (draft && (typeof task.intent !== 'string' || !task.intent.trim())) errors.push(`${label} intent must be a non-empty Markdown string while lesson draft is enabled`)
  if (!draft && task.intent != null && typeof task.intent !== 'string') errors.push(`${label} intent must be a Markdown string when provided`)
  if (task.quizType != null && !QUIZ_TYPES.has(task.quizType)) errors.push(`${label} has an invalid quiz type`)
  for (const field of ['options', 'pairs', 'blanks', 'lines', 'distractors', 'starterFiles', 'completeFiles', 'codeStages', 'tests', 'feedbackChecks']) {
    requireArrayOfObjects(task[field], `${label} ${field}`, errors)
  }
  if (task.check != null && !isObject(task.check) && !(Array.isArray(task.check) && task.check.every(isObject))) {
    errors.push(`${label} check must be an object or an array of objects when provided`)
  }
  for (const field of ['explainer', 'starterCode', 'completeCode', 'toolbox']) {
    if (task[field] != null && typeof task[field] !== 'string') errors.push(`${label} ${field} must be a string when provided`)
  }
  for (const field of ['starterFs', 'completeFs', 'starterCircuit', 'completeCircuit']) {
    if (task[field] != null && !isObject(task[field])) errors.push(`${label} ${field} must be an object when provided`)
  }
}

/** Basic schema checks that must hold even for incomplete draft lessons. */
export function validateDraftLessonStructure(lesson, errors) {
  if (lesson.draft != null && typeof lesson.draft !== 'boolean') errors.push('draft must be a boolean when provided')
  if (lesson.version != null && (!Number.isInteger(lesson.version) || lesson.version < 0)) errors.push('version must be a non-negative integer when provided')
  if (!Array.isArray(lesson.tasks)) return
  lesson.tasks.forEach((item, index) => {
    const label = `Task ${index + 1}`
    if (!isObject(item)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (item.type === 'group') {
      if (typeof item.title !== 'string' || !item.title.trim()) errors.push(`Group ${index + 1} is missing a title`)
      if (!Array.isArray(item.subtasks)) errors.push(`Group ${index + 1} subtasks must be an array`)
      else item.subtasks.forEach((task, subIndex) => validateTaskShape(task, `Task ${index + 1}.${subIndex + 1}`, lesson.draft === true, errors))
      return
    }
    if (item.type != null) errors.push(`${label} has an invalid task-type value`)
    validateTaskShape(item, label, lesson.draft === true, errors)
  })
}
