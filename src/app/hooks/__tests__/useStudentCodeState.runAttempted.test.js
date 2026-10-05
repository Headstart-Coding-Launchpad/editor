// run_attempted (demo tasks: "press Run and watch") through the student hook's run paths:
// runWithRuntime (python, turtle, electronics), handleWorkspaceRun (Arcade's Run game) and the
// HTML preview. Scratch judges it inside ScratchWorkspace (see
// src/modules/scratch/__tests__/runAttempted.test.js).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  mockHtmlPreview,
  mockModuleRun,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeLesson,
  electronicsLesson,
  htmlLesson,
  pythonLesson,
  turtleLesson,
} from '../../../test/fixtures/studentCodeStateLessons'
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

// The fixture lesson with task t1's completion check replaced.
function withCheck(lessonFactory, check) {
  const lesson = lessonFactory()
  return { ...lesson, tasks: lesson.tasks.map((t, i) => (i === 0 ? { ...t, check } : t)) }
}

const RUN_ATTEMPTED = { type: 'run_attempted' }
const REQUIRE_SUCCESS = { type: 'run_attempted', requireSuccess: true }

function lastAttempt(h) {
  return h.writers.logAttempt.mock.calls.at(-1)?.[2]
}

async function runOnce(h) {
  await actAsync(() => h.result.current.handleRun())
}

describe('run_attempted — runtime modules (runWithRuntime)', () => {
  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
    ['electronics', electronicsLesson],
  ])('%s: a successful run passes', async (type, lesson) => {
    mockModuleRun(type, () => ({ status: 'success' }))
    const h = renderStudentCodeState({
      lesson: withCheck(lesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    await runOnce(h)
    expect(lastAttempt(h)).toMatchObject({ passed: true })
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({ checkPassed: true })
    )
  })

  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
    ['electronics', electronicsLesson],
  ])('%s: an erroring run still passes by default', async (type, lesson) => {
    mockModuleRun(type, (callbacks) => {
      callbacks.onOutput('NameError: name "x" is not defined\n', 'stderr')
      return { status: 'error' }
    })
    const h = renderStudentCodeState({
      lesson: withCheck(lesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    await runOnce(h)
    expect(h.result.current.runStatus).toBe('error')
    expect(lastAttempt(h)).toMatchObject({ passed: true })
  })

  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
    ['electronics', electronicsLesson],
  ])('%s: requireSuccess fails an erroring run and passes a clean one', async (type, lesson) => {
    const run = mockModuleRun(type, () => ({ status: 'error' }))
    const h = renderStudentCodeState({
      lesson: withCheck(lesson, REQUIRE_SUCCESS),
      currentTaskId: 't1',
    })
    await runOnce(h)
    expect(lastAttempt(h)).toMatchObject({ passed: false })
    run.mockImplementation(async () => ({ status: 'success' }))
    await runOnce(h)
    expect(lastAttempt(h)).toMatchObject({ passed: true })
  })

  it('python: mixed with another check, an erroring run still fails (the error gate is unchanged)', async () => {
    mockModuleRun('python', () => ({ status: 'error' }))
    const h = renderStudentCodeState({
      lesson: withCheck(pythonLesson, [RUN_ATTEMPTED, { type: 'code_contains', value: 'print' }]),
      currentTaskId: 't1',
    })
    await runOnce(h)
    expect(lastAttempt(h)).toMatchObject({ passed: false })
  })

  it('python: an output check still fails an erroring run', async () => {
    mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('hi\n', 'stdout')
      return { status: 'error' }
    })
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await runOnce(h)
    expect(lastAttempt(h)).toMatchObject({ passed: false })
  })

  it('python in a teacher sandbox (free play) is never scored', async () => {
    mockModuleRun('python', () => ({ status: 'success' }))
    const h = renderStudentCodeState({
      lesson: withCheck(pythonLesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
      phase: 'sandbox',
    })
    await runOnce(h)
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })
})

// A runtime whose run waits until stop() is called and then reports 'stopped' (a demo that loops
// forever, e.g. a blinking LED).
function stoppableRun(type) {
  const runtime = getLessonModule(type).runtime
  let stopRun
  vi.spyOn(runtime, 'stop').mockImplementation(() => stopRun?.())
  return vi.spyOn(runtime, 'run').mockImplementation(async (code, task, callbacks) => {
    callbacks.onOutput('blink\n', 'stdout')
    await new Promise((resolve) => {
      stopRun = resolve
    })
    return { status: 'stopped' }
  })
}

async function runThenStop(h) {
  let runPromise
  act(() => {
    runPromise = h.result.current.handleRun()
  })
  await act(async () => {})
  actSync(() => h.result.current.handleStop())
  await act(async () => {
    await runPromise
  })
}

describe('run_attempted — a run the student stops', () => {
  it.each([
    ['python', pythonLesson],
    ['electronics', electronicsLesson],
  ])('%s: a stopped run completes a run_attempted-only task', async (type, lesson) => {
    stoppableRun(type)
    const h = renderStudentCodeState({
      lesson: withCheck(lesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    await runThenStop(h)
    expect(h.result.current.running).toBe(false)
    expect(h.result.current.runStatus).toBe('stopped')
    expect(lastAttempt(h)).toMatchObject({ passed: true })
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({ status: 'stopped', checkPassed: true })
    )
  })

  it('requireSuccess: a stopped run reports nothing, as before', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({
      lesson: withCheck(pythonLesson, REQUIRE_SUCCESS),
      currentTaskId: 't1',
    })
    await runThenStop(h)
    expect(h.result.current.runStatus).toBe(null)
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })

  it('an output check: a stopped run reports nothing, as before', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await runThenStop(h)
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('a stop caused by changing task reports nothing for either task', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({
      lesson: withCheck(pythonLesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 't3' })
    await act(async () => {
      await runPromise
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(h.result.current.output).toBe('')
  })
})

describe('run_attempted — Arcade Run game (handleWorkspaceRun)', () => {
  it('passes on Run game', () => {
    const h = renderStudentCodeState({
      lesson: withCheck(arcadeLesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleWorkspaceRun('player = 1'))
    expect(lastAttempt(h)).toMatchObject({ passed: true })
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(
      ANON,
      expect.objectContaining({ checkPassed: true })
    )
  })

  it('combines with code checks: both must pass', () => {
    const h = renderStudentCodeState({
      lesson: withCheck(arcadeLesson, [RUN_ATTEMPTED, { type: 'code_contains', value: 'jump' }]),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleWorkspaceRun('player = 1'))
    expect(lastAttempt(h)).toMatchObject({ passed: false })
    actSync(() => h.result.current.handleWorkspaceRun('player.jump()'))
    expect(lastAttempt(h)).toMatchObject({ passed: true })
  })

  it('requireSuccess is ignored (Arcade reports no error status at Run game)', () => {
    const h = renderStudentCodeState({
      lesson: withCheck(arcadeLesson, REQUIRE_SUCCESS),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleWorkspaceRun('player = 1'))
    expect(lastAttempt(h)).toMatchObject({ passed: true })
  })
})

describe('run_attempted — HTML Run', () => {
  it('passes once the preview has run', async () => {
    mockHtmlPreview({ src: 'blob:demo', text: '' })
    const h = renderStudentCodeState({
      lesson: withCheck(htmlLesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    await actAsync(() => h.result.current.handleRun())
    await act(async () => {})
    expect(lastAttempt(h)).toMatchObject({ passed: true })
  })
})

describe('run_attempted — never passes without a run', () => {
  it('Submit (no run) fails it', async () => {
    const h = renderStudentCodeState({
      lesson: withCheck(pythonLesson, RUN_ATTEMPTED),
      currentTaskId: 't1',
    })
    await actAsync(() => h.result.current.handleSubmit())
    expect(lastAttempt(h)).toMatchObject({ passed: false })
  })
})
