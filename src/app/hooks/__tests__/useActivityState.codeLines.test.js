import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANON, actAsync, renderStudentCodeState } from '../../../test/studentCodeStateHarness'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

// Click-the-line quiz (retryClearsCheck): after a wrong Check, Try again and a new pick are a
// draft again, so the tutor (who reads lastRunStatus / checkPassed) stops seeing a verdict on it.
const QUIZ = {
  id: 2,
  title: 'Which line is wrong?',
  taskType: 'quiz',
  quizType: 'code_lines',
  code: 'a = 1\nprint(a +)\nprint(a)',
  correctLines: [2],
}
const LESSON = {
  id: 'lesson-1',
  title: 'Lines',
  type: 'python',
  tasks: [{ id: 1, title: 'Code', starterCode: 'print(1)' }, QUIZ],
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('useActivityState: click-the-line Try again', () => {
  it('a wrong Check is submitted; the next change clears the run status and check for the tutor', async () => {
    const { result, writers } = renderStudentCodeState({ lesson: LESSON, currentTaskId: 2 })
    act(() => result.current.activity.onChange('3'))
    await actAsync(() => result.current.activity.onSubmit('3'))
    expect(result.current.runStatus).toBe('submitted')
    expect(writers.writeStudentRun).toHaveBeenLastCalledWith(ANON, {
      answer: '3',
      status: 'submitted',
      checkPassed: false,
    })
    act(() => result.current.activity.onChange(''))
    expect(result.current.runStatus).toBeNull()
    expect(result.current.checkAttempted).toBe(false)
    expect(writers.writeStudentRun).toHaveBeenLastCalledWith(ANON, {
      answer: '',
      status: null,
      checkPassed: null,
    })
    // Only the first change after a Check clears it: later picks are ordinary answer writes.
    act(() => result.current.activity.onChange('1'))
    expect(writers.writeStudentRun).toHaveBeenCalledTimes(2)
  })
})
