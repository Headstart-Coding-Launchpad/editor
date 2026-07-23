import { describe, expect, it, vi } from 'vitest'
import { getSavedPythonTasks, isPythonCodeTask } from '../studentCodeExports'

const lesson = {
  id: 'python-intro',
  type: 'python',
  tasks: [
    { id: 1, title: 'Print hello' },
    { id: 2, title: 'Read this first', taskType: 'information' },
    { id: 3, title: 'Quiz', taskType: 'quiz' },
    { id: 4, title: 'Loop challenge' },
  ],
}

describe('studentCodeExports', () => {
  it('recognises code tasks and excludes information and quiz tasks', () => {
    expect(isPythonCodeTask({ taskType: 'code' })).toBe(true)
    expect(isPythonCodeTask({ taskType: 'information' })).toBe(false)
    expect(isPythonCodeTask({ taskType: 'quiz' })).toBe(false)
  })

  it('collects only Python tasks with browser-saved code', () => {
    const readSavedCode = vi.fn((_lessonId, taskId) => ({
      1: { code: 'print("hello")' },
      4: { code: 'for i in range(3):\n    print(i)' },
    })[taskId] ?? null)

    expect(getSavedPythonTasks({ lesson, anonymousId: 'student-1', readSavedCode })).toEqual([
      { id: 1, title: 'Print hello', code: 'print("hello")' },
      { id: 4, title: 'Loop challenge', code: 'for i in range(3):\n    print(i)' },
    ])
    expect(readSavedCode).toHaveBeenCalledTimes(2)
  })

  it('does not export non-Python lessons or anonymous-less sessions', () => {
    expect(getSavedPythonTasks({ lesson: { ...lesson, type: 'html' }, anonymousId: 'student-1' })).toEqual([])
    expect(getSavedPythonTasks({ lesson, anonymousId: null })).toEqual([])
  })
})
