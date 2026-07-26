import { findTaskById, flattenTasks } from './taskUtils'

export const LESSON_MODULE_TYPES = ['python', 'arcade', 'html', 'scratch', 'filesystem', 'electronics']

export function isComposedLesson(lesson) {
  return lesson?.type === 'composed'
}

export function getLessonModules(lesson) {
  if (!isComposedLesson(lesson)) return []
  const types = new Set()
  for (const task of flattenTasks(lesson?.tasks ?? [])) {
    if (task?.moduleType && LESSON_MODULE_TYPES.includes(task.moduleType)) types.add(task.moduleType)
  }
  // Read previously drafted module records so they remain usable, but new lessons
  // derive this list entirely from code tasks.
  for (const module of lesson?.modules ?? []) {
    if (module?.type && LESSON_MODULE_TYPES.includes(module.type)) types.add(module.type)
  }
  return [...types].map(type => ({ id: type, type, title: type }))
}

export function getTaskModuleType(lesson, taskOrId) {
  if (!lesson) return null
  if (!isComposedLesson(lesson)) return lesson.type ?? null
  const task = typeof taskOrId === 'object' ? taskOrId : findTaskById(lesson?.tasks, taskOrId)
  if (LESSON_MODULE_TYPES.includes(task?.moduleType)) return task.moduleType
  // Compatibility for the earlier task.moduleId / lesson.modules draft shape.
  const legacyModule = (lesson?.modules ?? []).find(module => module.id === task?.moduleId)
  return legacyModule?.type ?? null
}

export function findLessonModuleForTask(lesson, taskOrId) {
  const type = getTaskModuleType(lesson, taskOrId)
  return type ? { id: type, type, title: type } : null
}

export function getTaskContext(lesson, taskOrId) {
  const task = typeof taskOrId === 'object' ? taskOrId : findTaskById(lesson?.tasks, taskOrId)
  const moduleType = getTaskModuleType(lesson, task)
  return { task: task ?? null, lessonModule: moduleType ? { id: moduleType, type: moduleType, title: moduleType } : null, moduleType }
}

function firstCodeTask(lesson, moduleType) {
  return flattenTasks(lesson?.tasks ?? []).find(task =>
    getTaskModuleType(lesson, task) === moduleType && task.taskType !== 'information' && task.taskType !== 'quiz',
  ) ?? null
}

function sandboxFields(moduleType, fallbackTask) {
  if (moduleType === 'python' || moduleType === 'arcade') return { sandboxStarter: fallbackTask?.starterCode ?? '' }
  if (moduleType === 'html') return { sandboxStarterFiles: fallbackTask?.starterFiles ?? [] }
  if (moduleType === 'scratch') {
    const blocks = fallbackTask?.starterBlocks ?? null
    return { sandboxStarter: blocks == null ? null : JSON.stringify(blocks) }
  }
  if (moduleType === 'filesystem') return { sandboxStarterFs: fallbackTask?.starterFs ?? null }
  if (moduleType === 'electronics') return { sandboxStarterCircuit: fallbackTask?.starterCircuit ?? null }
  return {}
}

export function getEffectiveLessonForModule(lesson, moduleType) {
  if (!isComposedLesson(lesson)) return lesson
  if (!LESSON_MODULE_TYPES.includes(moduleType)) return lesson
  const lessonModule = { id: moduleType, type: moduleType, title: moduleType }
  return {
    ...lesson,
    type: moduleType,
    composedLesson: lesson,
    lessonModule,
    ...sandboxFields(moduleType, firstCodeTask(lesson, moduleType)),
  }
}

export function getEffectiveLessonForTask(lesson, taskOrId) {
  if (!isComposedLesson(lesson)) return lesson
  return getEffectiveLessonForModule(lesson, getTaskModuleType(lesson, taskOrId))
}

export function getModuleCarrySourceIds(lesson, taskOrId) {
  const { task, moduleType } = getTaskContext(lesson, taskOrId)
  if (!task || !isComposedLesson(lesson)) return null
  if (!moduleType) return []
  return flattenTasks(lesson.tasks ?? [])
    .filter(candidate => getTaskModuleType(lesson, candidate) === moduleType && candidate.id < task.id && candidate.taskType !== 'information' && candidate.taskType !== 'quiz')
    .map(candidate => candidate.id)
}

export function validateComposedStructure(lesson) {
  if (!isComposedLesson(lesson)) return []
  const errors = []
  for (const task of flattenTasks(lesson.tasks ?? [])) {
    if (task?.taskType === 'information' || task?.taskType === 'quiz') continue
    if (!task?.moduleType) errors.push(`Code task "${task?.title || task?.id || 'untitled'}" must select a workspace module`)
    else if (!LESSON_MODULE_TYPES.includes(task.moduleType)) errors.push(`Code task "${task?.title || task.id}" has an unknown workspace module`)
  }
  return errors
}
