import { flattenTasks } from '../shared/taskUtils'
import { loadSavedCode } from './studentStorage'

export function isPythonCodeTask(task) {
  return task?.taskType !== 'information' && task?.taskType !== 'quiz'
}

export function getSavedPythonTasks({ lesson, anonymousId, readSavedCode = loadSavedCode }) {
  if (lesson?.type !== 'python' || !anonymousId) return []

  return flattenTasks(lesson.tasks)
    .filter(isPythonCodeTask)
    .map(task => {
      const saved = readSavedCode(lesson.id, task.id, anonymousId)
      if (!saved || typeof saved.code !== 'string') return null
      return { id: task.id, title: task.title, code: saved.code }
    })
    .filter(Boolean)
}
