// The student's check-feedback hint and "Want a hint?" offer, mirrored onto their student node
// for the teacher (writeStudentHintState; src/app/studentHints.js), and the error line of a
// crashed run (writeStudentRun's errorText).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  mockModuleRun,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import { htmlLesson, pythonLesson } from '../../../test/fixtures/studentCodeStateLessons'
import { getLessonModule } from '../../../modules/registry'

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
})

function printing(text) {
  return (callbacks) => {
    callbacks.onOutput(`${text}\n`, 'stdout')
    return { status: 'success' }
  }
}

function lastHintWrite(h) {
  return h.writers.writeStudentHintState.mock.calls.at(-1)?.[1]
}

describe('student hint mirroring', () => {
  it('writes the failed-check hint and the support offer, then clears both on a pass', async () => {
    const run = mockModuleRun('python', printing('nope'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())

    expect(h.writers.writeStudentHintState).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({
        studentHint: {
          text: 'Print hi',
          source: 'check',
          failStreak: 1,
          taskId: 't1',
          at: expect.any(Number),
        },
      })
    )
    expect(
      h.writers.writeStudentHintState.mock.calls.map(([, state]) => state.hintOffer).filter(Boolean)
    ).toContainEqual({
      kind: 'support',
      stageIndex: 0,
      label: 'Support A',
      taskId: 't1',
      at: expect.any(Number),
    })

    run.mockImplementation(async (_code, _task, callbacks) => printing('hi')(callbacks))
    await actAsync(() => h.result.current.handleRun())
    expect(lastHintWrite(h)).toEqual(
      expect.objectContaining({ studentHint: null, hintOffer: null })
    )
  })

  it('counts the fail streak across repeated failed runs', async () => {
    mockModuleRun('python', printing('nope'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    await actAsync(() => h.result.current.handleRun())
    const streaks = h.writers.writeStudentHintState.mock.calls
      .map(([, state]) => state.studentHint?.failStreak)
      .filter(Boolean)
    expect(streaks.at(-1)).toBe(2)
  })

  it('marks a teacher fail-override hint as theirs', async () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    h.updateStudent({
      checkOverridePushedAt: 100,
      checkOverridePassed: false,
      checkOverrideHint: 'Check line 2',
    })
    await actAsync(() => Promise.resolve())
    expect(lastHintWrite(h)?.studentHint).toMatchObject({
      text: 'Check line 2',
      source: 'override',
    })
  })

  it.each(['sandbox', 'solo'])('writes nothing in the %s phase', async (phase) => {
    mockModuleRun('python', printing('nope'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', phase })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentHintState).not.toHaveBeenCalled()
  })

  it('writes nothing from the teacher presentation', async () => {
    mockModuleRun('python', printing('nope'))
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
    })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentHintState).not.toHaveBeenCalled()
  })
})

describe('run error line', () => {
  it("sends a crashed run's error line with its status", async () => {
    mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('start\n', 'stdout')
      callbacks.onOutput("Line 1: NameError: name 'x' is not defined\n", 'stderr')
      return { status: 'error' }
    })
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({
        status: 'error',
        errorText: "Line 1: NameError: name 'x' is not defined",
      })
    )
  })

  it('html: a runtime error reported after the run was written corrects it to error', async () => {
    let resolveText
    const runtime = getLessonModule('html').runtime
    vi.spyOn(runtime, 'buildPreviewSrc').mockReturnValue('blob:late')
    vi.spyOn(runtime, 'waitForPreviewText').mockReturnValue(
      new Promise((resolve) => {
        resolveText = resolve
      })
    )
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    await act(async () => resolveText(''))
    expect(h.writers.writeStudentRun).toHaveBeenLastCalledWith(
      ANON,
      expect.objectContaining({ status: 'success' })
    )
    act(() =>
      h.result.current.handleHtmlRuntimeError('blob:late', {
        message: 'ReferenceError: foo is not defined',
      })
    )
    expect(h.writers.writeStudentRun).toHaveBeenLastCalledWith(ANON, {
      status: 'error',
      errorText: 'ReferenceError: foo is not defined',
    })
    // Only once per run.
    const calls = h.writers.writeStudentRun.mock.calls.length
    act(() => h.result.current.handleHtmlRuntimeError('blob:late', { message: 'again' }))
    expect(h.writers.writeStudentRun.mock.calls.length).toBe(calls)
  })

  it('html: an error reported before the result is written as an error run', async () => {
    let resolveText
    const runtime = getLessonModule('html').runtime
    vi.spyOn(runtime, 'buildPreviewSrc').mockReturnValue('blob:early')
    vi.spyOn(runtime, 'waitForPreviewText').mockReturnValue(
      new Promise((resolve) => {
        resolveText = resolve
      })
    )
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    act(() => h.result.current.handleHtmlRuntimeError('blob:early', { message: 'TypeError: x' }))
    await act(async () => resolveText(''))
    expect(h.writers.writeStudentRun).toHaveBeenLastCalledWith(
      ANON,
      expect.objectContaining({ status: 'error', errorText: 'TypeError: x' })
    )
  })

  it('sends no error line for a clean run', async () => {
    mockModuleRun('python', printing('nope'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({ status: 'success', errorText: undefined })
    )
  })
})
