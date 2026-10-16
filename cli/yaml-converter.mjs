import yaml from 'js-yaml'
import {
  activityIdForYamlType,
  legacyTaskTypeForYamlType,
  usesYamlAnswerShorthand,
  yamlTypeForActivityTask,
  yamlTypeForLegacyTaskType,
} from '../src/activities/registry.pure.js'

/**
 * Parse YAML lesson text and return a full lesson JSON object.
 *
 * Differences from plain JSON:
 * - Task `id` fields are auto-assigned sequentially (starting at 1).
 * - `type: information` / `type: quiz` on a task maps to `taskType`.
 * - `type: <activity>` (any activity's `yaml.type`, e.g. `type: binary`) maps to
 *   `taskType: activity` + `activityType: <id>`; export writes the shorthand back.
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

export function parseYamlTopicLibrary(yamlText) {
  const raw = yaml.load(yamlText)
  return topicListFromRaw(raw)
}

export function lessonToYamlText(lesson) {
  return yaml.dump(lessonToYamlObject(lesson), {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  })
}

export function lessonToYamlObject(lesson) {
  return {
    ...lesson,
    tasks: (lesson.tasks ?? []).map((item) => {
      if (item.type !== 'group') return taskToYamlObject(item)
      return {
        group: item.title,
        groupId: item.id,
        ...(item.moduleId ? { moduleId: item.moduleId } : {}),
        ...(item.moduleType ? { moduleType: item.moduleType } : {}),
        ...(item.sandbox ? { sandbox: item.sandbox } : {}),
        tasks: (item.subtasks ?? []).map(taskToYamlObject),
      }
    }),
  }
}

export function topicToYamlText(topic) {
  return yaml.dump(topicToYamlObject(topic), {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  })
}

export function topicLibraryToYamlText(input) {
  return yaml.dump(
    { topics: topicListFromRaw(input).map(topicToYamlObject) },
    {
      lineWidth: 100,
      noRefs: true,
      sortKeys: false,
      quotingType: '"',
    }
  )
}

export function topicToYamlObject(topic) {
  const out = { ...topic }
  for (const field of ['types', 'aliases', 'related']) {
    if (Array.isArray(out[field]) && out[field].length === 0) delete out[field]
  }
  for (const field of ['category', 'summary', 'description', 'syntax']) {
    if (out[field] == null || out[field] === '') delete out[field]
  }
  return out
}

function topicListFromRaw(raw) {
  if (!raw) throw new Error('YAML must contain a topic object, a topic array, or a topics array')
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw.topics)) return raw.topics
  if (raw.id || raw.title) return [raw]
  throw new Error('YAML must contain a topic object, a topic array, or a topics array')
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
      const subtasks = (rawItem.tasks ?? []).map((t) => convertTask(t, ++taskCounter, lessonType))
      result.push({
        id: groupId,
        type: 'group',
        title: rawItem.group,
        ...(rawItem.moduleId ? { moduleId: rawItem.moduleId } : {}),
        ...(rawItem.moduleType ? { moduleType: rawItem.moduleType } : {}),
        ...(rawItem.sandbox ? { sandbox: rawItem.sandbox } : {}),
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

// The `answer:` shorthand names the correct option's id (`answer: b`). Authors often write the
// option's text instead, which could never be marked right, so text that matches exactly one
// option (ignoring case and surrounding spaces) becomes that option's id. Anything else is kept
// as written, and validation reports an answer that is not an option id.
export function answerOptionId(answer, options) {
  const value = String(answer)
  if (!Array.isArray(options)) return value
  if (options.some((option) => option?.id === value)) return value
  const wanted = value.trim().toLowerCase()
  const byId = options.filter(
    (option) => typeof option?.id === 'string' && option.id.trim().toLowerCase() === wanted
  )
  if (byId.length === 1) return byId[0].id
  const byText = options.filter(
    (option) =>
      typeof option?.text === 'string' &&
      typeof option.id === 'string' &&
      option.text.trim().toLowerCase() === wanted
  )
  return byText.length === 1 ? byText[0].id : value
}

function convertTask(raw, id, lessonType) {
  const { type, checks, answer, group: _g, tasks: _t, ...rest } = raw
  const task = { id, ...rest }
  for (const field of ['intentLastChangedAt', 'taskLastChangedAt']) {
    if (task[field] instanceof Date) task[field] = task[field].toISOString()
  }

  if (type === 'information') {
    task.taskType = 'information'
  } else if (legacyTaskTypeForYamlType(type)) {
    // Legacy activity task types keep their own YAML type (`type: quiz`, `type: code_arrange`).
    task.taskType = legacyTaskTypeForYamlType(type)
  } else if (type === 'draft') {
    task.taskType = 'draft'
  } else if (type !== lessonType && activityIdForYamlType(type)) {
    // Activity shorthand: `type: binary` → taskType activity + activityType binary.
    task.taskType = 'activity'
    task.activityType = activityIdForYamlType(type)
  }
  // type === lessonType or undefined → code task, no taskType added

  // `answer: a` shorthand for multiple_choice quizzes
  if (answer != null && task.check == null) {
    task.check = { type: 'answer_equals', value: answerOptionId(answer, task.options) }
  }

  // `checks:` (plural) → `check:` normalisation
  if (checks != null && task.check == null) {
    task.check = Array.isArray(checks) && checks.length === 1 ? checks[0] : checks
  }

  return task
}

function taskToYamlObject(task) {
  let out = { ...task }
  delete out.id

  if (out.carryCodeFrom === null) delete out.carryCodeFrom
  if (out.carryBlocksFrom === null) delete out.carryBlocksFrom
  if (out.carryFsFrom === null) delete out.carryFsFrom

  if (out.taskType === 'information') {
    out.type = 'information'
    delete out.taskType
  } else if (yamlTypeForLegacyTaskType(out.taskType)) {
    out.type = yamlTypeForLegacyTaskType(out.taskType)
    delete out.taskType
  } else if (out.taskType === 'draft') {
    out.type = 'draft'
    delete out.taskType
  } else if (yamlTypeForActivityTask(out)) {
    // Known activities export as the `type: <activity>` shorthand; an unknown activityType
    // keeps its explicit taskType + activityType.
    const { taskType: _taskType, activityType: _activityType, title, ...fields } = out
    const shorthand = yamlTypeForActivityTask(out)
    out = { ...(title !== undefined ? { title } : {}), type: shorthand, ...fields }
  }

  if (usesYamlAnswerShorthand(task)) {
    out.answer = out.check.value
    delete out.check
  }

  if (Array.isArray(out.check)) {
    out.checks = out.check
    delete out.check
  }

  return out
}
