import { findTaskById, flattenTasks } from './taskUtils.js'

export const LESSON_MODULE_TYPES = [
  'python',
  'arcade',
  'html',
  'scratch',
  'filesystem',
  'electronics',
]

export function isComposedLesson(lesson) {
  return lesson?.type === 'composed'
}

function isCodeTask(task) {
  return task?.taskType !== 'information' && task?.taskType !== 'quiz'
}

export function getLessonModules(lesson) {
  if (!isComposedLesson(lesson)) return []
  const modules = new Map()

  // Preserve authored module instances. Older composed drafts use this shape
  // with task.moduleId, and two instances may legitimately share a type.
  for (const module of lesson?.modules ?? []) {
    if (!module?.id || !LESSON_MODULE_TYPES.includes(module.type)) continue
    modules.set(module.id, { ...module, title: module.title ?? module.id })
  }

  for (const task of flattenTasks(lesson?.tasks ?? [])) {
    const type = getTaskModuleType(lesson, task)
    if (!type || !isCodeTask(task)) continue
    const id = task.moduleId ?? type
    if (!modules.has(id)) modules.set(id, { id, type, title: id })
  }
  return [...modules.values()]
}

export function getTaskModuleType(lesson, taskOrId) {
  if (!lesson) return null
  if (!isComposedLesson(lesson)) return lesson.type ?? null
  const task = typeof taskOrId === 'object' ? taskOrId : findTaskById(lesson?.tasks, taskOrId)
  if (LESSON_MODULE_TYPES.includes(task?.moduleType)) return task.moduleType
  // Compatibility for the earlier task.moduleId / lesson.modules draft shape.
  const legacyModule = (lesson?.modules ?? []).find((module) => module.id === task?.moduleId)
  return legacyModule?.type ?? null
}

export function getTaskModuleId(lesson, taskOrId) {
  if (!isComposedLesson(lesson)) return lesson?.type ?? null
  const task = typeof taskOrId === 'object' ? taskOrId : findTaskById(lesson?.tasks, taskOrId)
  if (!task || !isCodeTask(task)) return null
  return task.moduleId ?? getTaskModuleType(lesson, task)
}

export function findLessonModuleForTask(lesson, taskOrId) {
  const moduleId = getTaskModuleId(lesson, taskOrId)
  if (!moduleId) return null
  return getLessonModules(lesson).find((module) => module.id === moduleId) ?? null
}

export function getTaskContext(lesson, taskOrId) {
  const task = typeof taskOrId === 'object' ? taskOrId : findTaskById(lesson?.tasks, taskOrId)
  const lessonModule = findLessonModuleForTask(lesson, task)
  const moduleType = lessonModule?.type ?? getTaskModuleType(lesson, task)
  return { task: task ?? null, lessonModule, moduleType }
}

function firstCodeTask(lesson, moduleId) {
  return (
    flattenTasks(lesson?.tasks ?? []).find(
      (task) => getTaskModuleId(lesson, task) === moduleId && isCodeTask(task)
    ) ?? null
  )
}

function sandboxFields(moduleType, fallbackTask) {
  if (moduleType === 'python' || moduleType === 'arcade')
    return { sandboxStarter: fallbackTask?.starterCode ?? '' }
  if (moduleType === 'html') return { sandboxStarterFiles: fallbackTask?.starterFiles ?? [] }
  if (moduleType === 'scratch') {
    const blocks = fallbackTask?.starterBlocks ?? null
    return { sandboxStarter: blocks == null ? null : JSON.stringify(blocks) }
  }
  if (moduleType === 'filesystem') return { sandboxStarterFs: fallbackTask?.starterFs ?? null }
  if (moduleType === 'electronics')
    return { sandboxStarterCircuit: fallbackTask?.starterCircuit ?? null }
  return {}
}

export function getEffectiveLessonForModule(lesson, moduleId) {
  if (!isComposedLesson(lesson)) return lesson
  const lessonModule = getLessonModules(lesson).find((module) => module.id === moduleId) ?? null
  if (!lessonModule || !LESSON_MODULE_TYPES.includes(lessonModule.type)) return lesson
  const moduleSandbox =
    lessonModule.sandbox && typeof lessonModule.sandbox === 'object' ? lessonModule.sandbox : {}
  return {
    ...lesson,
    type: lessonModule.type,
    composedLesson: lesson,
    lessonModule,
    ...sandboxFields(lessonModule.type, firstCodeTask(lesson, lessonModule.id)),
    ...moduleSandbox,
  }
}

export function getEffectiveLessonForTask(lesson, taskOrId) {
  if (!isComposedLesson(lesson)) return lesson
  return getEffectiveLessonForModule(lesson, getTaskModuleId(lesson, taskOrId))
}

export function getModuleCarrySourceIds(lesson, taskOrId) {
  const { task, lessonModule } = getTaskContext(lesson, taskOrId)
  if (!task || !isComposedLesson(lesson)) return null
  if (!lessonModule) return []
  const tasks = flattenTasks(lesson.tasks ?? [])
  const taskIndex = tasks.findIndex((candidate) => candidate.id === task.id)
  if (taskIndex < 0) return []
  return tasks
    .slice(0, taskIndex)
    .filter(
      (candidate) => getTaskModuleId(lesson, candidate) === lessonModule.id && isCodeTask(candidate)
    )
    .map((candidate) => candidate.id)
}

export function validateComposedStructure(lesson) {
  if (!isComposedLesson(lesson)) return []
  const errors = []
  for (const task of flattenTasks(lesson.tasks ?? [])) {
    if (task?.taskType === 'information' || task?.taskType === 'quiz') continue
    const type = getTaskModuleType(lesson, task)
    if (!type)
      errors.push(
        `Code task "${task?.title || task?.id || 'untitled'}" must select a workspace module`
      )
    else if (!LESSON_MODULE_TYPES.includes(type))
      errors.push(`Code task "${task?.title || task.id}" has an unknown workspace module`)
    const module = task?.moduleId
      ? getLessonModules(lesson).find((candidate) => candidate.id === task.moduleId)
      : null
    if (module && task?.moduleType && module.type !== task.moduleType) {
      errors.push(
        `Code task "${task?.title || task.id}" has a module ID and module type that do not match`
      )
    }
  }
  return errors
}
