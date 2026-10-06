// Live badge signals from the student's code state: complete code shown, sandbox runs, Arcade's
// late game error, and first edits from the Filesystem / Desktop change handlers.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockModuleRun,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeLesson,
  filesystemLesson,
  pythonLesson,
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
})

describe('complete code shown', () => {
  it('records Show complete and the complete preview, per task', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handlePreviewCompleteCode())
    actSync(() => h.result.current.handleShowCompleteCode())
    expect(h.writers.recordCompleteShownSignal.mock.calls).toEqual([
      [ANON, 't1', 'preview'],
      [ANON, 't1', 'show'],
    ])
  })

  it('records a teacher reset to the complete code, and not to the starter', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    h.updateStudent({ remoteResetAction: 'starter', remoteResetPushedAt: 1 })
    expect(h.writers.recordCompleteShownSignal).not.toHaveBeenCalled()
    h.updateStudent({ remoteResetAction: 'complete', remoteResetPushedAt: 2 })
    expect(h.writers.recordCompleteShownSignal).toHaveBeenCalledWith(ANON, 't1', 'teacherReset')
    h.updateStudent({ remoteResetAction: 'stage_1', remoteResetPushedAt: 3 })
    expect(h.writers.recordCompleteShownSignal).toHaveBeenCalledTimes(2)
  })

  it('records nothing from the presentation window or a preview', () => {
    for (const props of [{ teacherPresentation: true }, { previewMode: true }]) {
      const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...props })
      actSync(() => h.result.current.handleShowCompleteCode())
      expect(h.writers.recordCompleteShownSignal).not.toHaveBeenCalled()
    }
  })
})

describe('sandbox runs', () => {
  it('counts a teacher-sandbox run with its error, and logs no attempt', async () => {
    mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('Line 1: NameError: x\n', 'stderr', 1)
      return { status: 'error' }
    })
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ state: 'sandbox' }),
    })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.recordSandboxRunSignal).toHaveBeenCalledWith(
      ANON,
      'session',
      expect.objectContaining({ error: 'NameError', submissionHash: expect.any(String) })
    )
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('does not count a lesson run as a sandbox run', async () => {
    mockModuleRun('python', () => ({ status: 'success' }))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.recordSandboxRunSignal).not.toHaveBeenCalled()
  })
})

describe("Arcade's late game error", () => {
  it('shows the error as the run status and flags the logged attempt', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleArcadeRun('player = 1'))
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
    actSync(() => h.result.current.handleArcadeRunError("Line 2: NameError: name 'y'"))
    expect(h.result.current.runStatus).toBe('error')
    expect(h.writers.writeStudentRun).toHaveBeenLastCalledWith(ANON, {
      status: 'error',
      errorText: "Line 2: NameError: name 'y'",
    })
    expect(h.writers.flagAttemptError).toHaveBeenCalledWith(ANON, 't1', 'NameError')
    expect(h.writers.flagSandboxRunError).not.toHaveBeenCalled()
  })

  it('marks the sandbox run instead while in the teacher sandbox', () => {
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ state: 'sandbox' }),
    })
    actSync(() => h.result.current.handleArcadeRun('player = 1'))
    expect(h.writers.recordSandboxRunSignal).toHaveBeenCalledWith(
      ANON,
      'session',
      expect.objectContaining({ error: false })
    )
    actSync(() => h.result.current.handleArcadeRunError('The game could not start.'))
    expect(h.writers.flagSandboxRunError).toHaveBeenCalledWith(ANON, 'session', true)
    expect(h.writers.flagAttemptError).not.toHaveBeenCalled()
  })
})

describe('first edits outside the code editor', () => {
  it('a Filesystem change is a real edit on the task', () => {
    const lesson = filesystemLesson()
    const h = renderStudentCodeState({ lesson, currentTaskId: 't1' })
    actSync(() => h.result.current.handleFsChange(h.result.current.fsState))
    expect(h.writers.recordFirstEditSignal).toHaveBeenCalledWith(ANON, 't1', expect.any(Number))
  })
})
