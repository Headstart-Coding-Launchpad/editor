// code_arrange keeps the shared code slot in step with its tiles: Run and the attempt log read
// the slot, so a complete board must never run (or record) an empty program, and a teacher
// reset must reset the tiles along with the code.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockModuleRun,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import { PYTHON_CODE_ARRANGE_TASK } from '../../../test/fixtures/legacyActivityTasks'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const LESSON = {
  id: 'arrange-lesson',
  title: 'Arrange',
  type: 'python',
  tasks: [PYTHON_CODE_ARRANGE_TASK],
}
const TASK_ID = PYTHON_CODE_ARRANGE_TASK.id
const SOLUTION_SLOTS = { S1: 'S1', L2: 'L2' }
const SOLUTION_CODE = 'for i in range(5):\n    print(i * 2)'

describe('code_arrange Run — never an empty submission under a complete board', () => {
  it('assembles the program from the tiles when the code slot was reset to empty', async () => {
    const run = mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('0\n2\n4\n6\n8\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: LESSON, currentTaskId: TASK_ID })
    // The board reports a complete arrangement, but the slot holds the live starter ('').
    actSync(() => h.result.current.handleCodeArrangeSlotsChange(SOLUTION_SLOTS))
    expect(h.result.current.code).toBe('')

    await actAsync(() => h.result.current.handleRun())

    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toBe(SOLUTION_CODE)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      TASK_ID,
      expect.objectContaining({ submission: SOLUTION_CODE })
    )
    expect(h.result.current.code).toBe(SOLUTION_CODE)
  })

  it('leaves the slot alone while the board is incomplete', async () => {
    const run = mockModuleRun('python', () => ({ status: 'success' }))
    const h = renderStudentCodeState({ lesson: LESSON, currentTaskId: TASK_ID })
    actSync(() => h.result.current.handleCodeArrangeSlotsChange({ S1: 'S1' }))

    await actAsync(() => h.result.current.handleRun())

    expect(run.mock.calls[0][0]).toBe('')
    expect(h.result.current.code).toBe('')
  })
})

describe('code_arrange teacher remote reset', () => {
  it('"Start again" clears the tiles along with the code', () => {
    const h = renderStudentCodeState({ lesson: LESSON, currentTaskId: TASK_ID })
    actSync(() => h.result.current.handleCodeArrangeSlotsChange(SOLUTION_SLOTS))
    actSync(() => h.result.current.handleCodeChange(SOLUTION_CODE))

    h.updateStudent({ remoteResetPushedAt: 11, remoteResetAction: 'starter' })

    expect(h.result.current.code).toBe('')
    expect(h.result.current.codeArrangeReset).toEqual({ slots: {}, taskId: TASK_ID, at: 11 })
  })

  it('"Complete" loads the authored solution tiles', () => {
    const h = renderStudentCodeState({ lesson: LESSON, currentTaskId: TASK_ID })

    h.updateStudent({ remoteResetPushedAt: 12, remoteResetAction: 'complete' })

    expect(h.result.current.codeArrangeReset).toEqual({
      slots: SOLUTION_SLOTS,
      taskId: TASK_ID,
      at: 12,
    })
  })

  it('is cleared once the board acknowledges it', () => {
    const h = renderStudentCodeState({ lesson: LESSON, currentTaskId: TASK_ID })
    h.updateStudent({ remoteResetPushedAt: 13, remoteResetAction: 'starter' })
    actSync(() => h.result.current.acknowledgeCodeArrangeReset(13))
    expect(h.result.current.codeArrangeReset).toBeNull()
  })

  it('never re-applies a reset already on the student record when the tab first sees it', () => {
    const h = renderStudentCodeState({
      lesson: LESSON,
      currentTaskId: TASK_ID,
      session: makeSession({ student: { remoteResetPushedAt: 5, remoteResetAction: 'starter' } }),
    })
    expect(h.result.current.codeArrangeReset).toBeNull()
  })
})
