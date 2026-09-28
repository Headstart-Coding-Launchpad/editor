import { flattenTasks } from '../shared/taskUtils'
import { loadSavedCode } from './studentStorage'
import { getTaskModuleType, isCodeTask } from '../shared/composedLesson'

// Code tasks only: information, quiz and hosted activity tasks have no code to download.
export function isPythonCodeTask(task) {
  return isCodeTask(task)
}

// Shared traversal for both getSavedPythonTasks and getSavedNonPythonTaskCount below:
// find code tasks matching `includeModuleType`, and pair each with its saved code (if any).
function findSavedCodeTasks({ lesson, anonymousId, readSavedCode, includeModuleType }) {
  if (!lesson || !anonymousId) return []

  return flattenTasks(lesson.tasks)
    .filter((task) => isPythonCodeTask(task) && includeModuleType(getTaskModuleType(lesson, task)))
    .map((task) => ({ task, saved: readSavedCode(lesson.id, task.id, anonymousId) }))
}

export function getSavedPythonTasks({ lesson, anonymousId, readSavedCode = loadSavedCode }) {
  return findSavedCodeTasks({
    lesson,
    anonymousId,
    readSavedCode,
    includeModuleType: (type) => type === 'python',
  })
    .filter(({ saved }) => saved && typeof saved.code === 'string')
    .map(({ task, saved }) => ({ id: task.id, title: task.title, code: saved.code }))
}

// Storage-loss warning is shown for every module type (not just Python), since
// all six write to the same `studentTaskStorageKey` format — see
// docs/agents/runtime-model.md. Only Python tasks are downloadable as a
// `.launchpad` file today, so this is counted separately from
// getSavedPythonTasks and surfaced with different copy.
export function getSavedNonPythonTaskCount({ lesson, anonymousId, readSavedCode = loadSavedCode }) {
  return findSavedCodeTasks({
    lesson,
    anonymousId,
    readSavedCode,
    includeModuleType: (type) => !!type && type !== 'python',
  }).filter(({ saved }) => !!saved).length
}
