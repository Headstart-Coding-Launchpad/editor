// Auto-check on leave: when the teacher moves a live class on, a student who never passed the
// graded task has their current work graded without a run and logged as an `auto: 'leave'`
// attempt (useStudentCodeState autoCheckOnLeave, called by useStudentPhase via StudentView).
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actSync,
  makeSession,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import {
  filesystemLesson,
  fsWith,
  pythonLesson,
  scratchLesson,
} from '../../../test/fixtures/studentCodeStateLessons'

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

const codeCheck = (value, hint) => ({ type: 'code', operator: 'contains', value, hint })

function pythonTask(fields) {
  return pythonLesson({
    tasks: [{ id: 't1', title: 'Task 1', starterCode: 'print("start")', ...fields }],
  })
}

const leaveCalls = (h) =>
  h.writers.logAttempt.mock.calls.filter(([, , payload]) => payload?.auto === 'leave')

function autoCheck(h) {
  actSync(() => h.result.current.autoCheckOnLeave())
}

describe('autoCheckOnLeave', () => {
  it('logs a correct verdict for passing static checks, without running or writing the run', () => {
    const h = renderStudentCodeState({
      lesson: pythonTask({ check: codeCheck('for') }),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleCodeChange('for i in range(3):\n    print(i)'))
    h.writers.writeStudentRun.mockClear()

    autoCheck(h)

    expect(leaveCalls(h)).toEqual([
      [
        ANON,
        't1',
        {
          submission: 'for i in range(3):\n    print(i)',
          passed: false,
          suggestion: '',
          auto: 'leave',
          autoResult: 'passed',
        },
      ],
    ])
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    // The student's own feedback is untouched.
    expect(h.result.current.checkAttempted).toBe(false)
  })

  it('logs an incorrect verdict with the failed check hint', () => {
    const h = renderStudentCodeState({
      lesson: pythonTask({ check: codeCheck('while', 'Use a while loop') }),
      currentTaskId: 't1',
    })
    autoCheck(h)
    expect(leaveCalls(h)).toHaveLength(1)
    expect(leaveCalls(h)[0][2]).toMatchObject({
      submission: 'print("start")',
      autoResult: 'failed',
      suggestion: 'Use a while loop',
    })
  })

  it("logs 'not_run' for a task whose checks need a run", () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    autoCheck(h)
    expect(leaveCalls(h)).toHaveLength(1)
    expect(leaveCalls(h)[0][2]).toMatchObject({ autoResult: 'not_run', suggestion: '' })
  })

  it('logs nothing for a check-less task', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't3' })
    autoCheck(h)
    expect(leaveCalls(h)).toEqual([])
  })

  it('logs nothing when the student already passed (teacher override or a real pass)', () => {
    const overridden = renderStudentCodeState({
      lesson: pythonTask({ check: codeCheck('for') }),
      currentTaskId: 't1',
      session: makeSession({
        student: { checkOverridePassed: true, checkOverridePushedAt: 100 },
      }),
    })
    autoCheck(overridden)
    expect(leaveCalls(overridden)).toEqual([])

    const passed = renderStudentCodeState({
      lesson: pythonTask({ check: codeCheck('for') }),
      currentTaskId: 't1',
      session: makeSession({
        attemptLog: { [ANON]: { t1: { k1: { passed: true, attemptNumber: 1 } } } },
      }),
    })
    autoCheck(passed)
    expect(leaveCalls(passed)).toEqual([])
  })

  it('an earlier leave record does not count as a pass', () => {
    const h = renderStudentCodeState({
      lesson: pythonTask({ check: codeCheck('while') }),
      currentTaskId: 't1',
      session: makeSession({
        attemptLog: {
          [ANON]: { t1: { k1: { passed: true, auto: 'leave', autoResult: 'passed' } } },
        },
      }),
    })
    autoCheck(h)
    expect(leaveCalls(h)).toHaveLength(1)
  })

  it('logs nothing outside a live lesson, in the presentation window or in preview', () => {
    for (const options of [
      { phase: 'solo' },
      { teacherPresentation: true },
      { previewMode: true },
    ]) {
      const h = renderStudentCodeState({
        lesson: pythonTask({ check: codeCheck('for') }),
        currentTaskId: 't1',
        ...options,
      })
      autoCheck(h)
      expect(leaveCalls(h), JSON.stringify(options)).toEqual([])
    }
  })

  it('grades a filesystem task from its current tree', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    autoCheck(h)
    expect(leaveCalls(h).at(-1)[2]).toMatchObject({
      autoResult: 'failed',
      suggestion: 'Create done.txt',
    })

    actSync(() => h.result.current.handleFsChange(fsWith('start.txt', 'done.txt')))
    // A real pass from the change pipeline now stands: the hook sees the passed check.
    h.writers.logAttempt.mockClear()
    autoCheck(h)
    expect(leaveCalls(h)).toEqual([])
  })

  it('grades Scratch block checks from the saved blocks', () => {
    const lesson = scratchLesson({
      tasks: [
        {
          id: 't1',
          title: 'Task 1',
          check: [{ type: 'block_used', opcode: 'looks_sayforsecs', hint: 'Add a say block' }],
        },
      ],
    })
    const h = renderStudentCodeState({ lesson, currentTaskId: 't1' })
    // Nothing reported or saved yet: nothing to grade.
    autoCheck(h)
    expect(leaveCalls(h)).toEqual([])

    actSync(() =>
      h.result.current.handleScratchChange({
        blocks: { blocks: [{ type: 'event_whenflagclicked', x: 0, y: 0 }] },
      })
    )
    autoCheck(h)
    expect(leaveCalls(h).at(-1)[2]).toMatchObject({
      autoResult: 'failed',
      suggestion: 'Add a say block',
    })

    actSync(() =>
      h.result.current.handleScratchChange({
        blocks: { blocks: [{ type: 'looks_sayforsecs', x: 0, y: 0 }] },
      })
    )
    autoCheck(h)
    expect(leaveCalls(h).at(-1)[2]).toMatchObject({ autoResult: 'passed' })
  })

  it("Scratch run-time checks are 'not_run'", () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() =>
      h.result.current.handleScratchChange({ blocks: { blocks: [{ type: 'motion_movesteps' }] } })
    )
    autoCheck(h)
    expect(leaveCalls(h).at(-1)[2]).toMatchObject({ autoResult: 'not_run' })
  })
})
