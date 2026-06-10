import yaml from 'js-yaml'

/**
 * Parse YAML lesson text and return a full lesson JSON object.
 *
 * Differences from plain JSON:
 * - Task `id` fields are auto-assigned sequentially (starting at 1).
 * - `type: information` / `type: quiz` on a task maps to `taskType`.
 * - `type: <lesson-type>` on a task is treated as a code task and ignored.
 * - `answer: <option-id>` on a multiple_choice quiz becomes `check: { type: answer_equals, value }`.
 * - `checks:` (plural array) is an alias for the `check:` field.
 * - Groups use `group: "Title"` + `tasks:` instead of JSON's `{ type: group, ... }`.
 * - Group IDs are stable. Use `groupId:` to set one explicitly, or the converter
 *   derives one from the lesson ID and group title.
 *
 * All other fields are passed through unchanged.
 */
export function parseYamlLesson(yamlText) {
  const raw = yaml.load(yamlText)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('YAML must be a single mapping object at the top level')
  }
  return convertLesson(raw)
}

function convertLesson(raw) {
  const { tasks: rawTasks, ...envelope } = raw
  const tasks = convertTaskList(rawTasks ?? [], envelope.type ?? '', envelope.id ?? '')
  return { ...envelope, tasks }
}

function convertTaskList(rawTasks, lessonType, lessonId) {
  let taskCounter = 0
  const groupIdCounts = new Map()
  const result = []

  for (const rawItem of rawTasks) {
    if (typeof rawItem.group === 'string') {
      const groupId = makeGroupId(rawItem, lessonId, groupIdCounts)
      const subtasks = (rawItem.tasks ?? []).map(t => convertTask(t, ++taskCounter, lessonType))
      result.push({
        id: groupId,
        type: 'group',
        title: rawItem.group,
        subtasks,
      })
    } else {
      result.push(convertTask(rawItem, ++taskCounter, lessonType))
    }
  }

  return result
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeGroupId(rawItem, lessonId, groupIdCounts) {
  const explicitId = rawItem.groupId ?? rawItem.id
  const base = explicitId
    ? slugify(explicitId)
    : ['g', slugify(lessonId), slugify(rawItem.group)].filter(Boolean).join('-')

  const safeBase = base || 'g-group'
  const count = groupIdCounts.get(safeBase) ?? 0
  groupIdCounts.set(safeBase, count + 1)
  return count === 0 ? safeBase : `${safeBase}-${count + 1}`
}

function convertTask(raw, id, lessonType) {
  const { type, checks, answer, group: _g, tasks: _t, ...rest } = raw
  const task = { id, ...rest }

  if (type === 'information') {
    task.taskType = 'information'
  } else if (type === 'quiz') {
    task.taskType = 'quiz'
  }
  // type === lessonType or undefined → code task, no taskType added

  // `answer: a` shorthand for multiple_choice quizzes
  if (answer != null && task.check == null) {
    task.check = { type: 'answer_equals', value: String(answer) }
  }

  // `checks:` (plural) → `check:` normalisation
  if (checks != null && task.check == null) {
    task.check = Array.isArray(checks) && checks.length === 1 ? checks[0] : checks
  }

  return task
}
