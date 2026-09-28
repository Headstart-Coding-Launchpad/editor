// The code modules on the generic work slot (plan step 4.4): python, turtle, arcade (whose value
// is `{ code, arcadeDesign }`) and electronics (the serialised circuit) keep their work in the
// same `{ moduleType, taskId, value }` slot as filesystem and desktop, Run dispatches on
// `capabilities.run`, and the runtime branch lives in runWithRuntime. The Phase 0
// characterisation suites pin the bytes; these tests cover what the migration adds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockHtmlPreview,
  mockModuleRun,
  renderStudentCodeState,
  studentSourcedTeacherLive,
  taskKey,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeDesign,
  arcadeLesson,
  circuitJson,
  circuitWith,
  desktopLesson,
  electronicsLesson,
  filesystemLesson,
  fsWith,
  htmlFile,
  htmlLesson,
  normalisedArcadeDesign,
  pythonLesson,
  scratchLesson,
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

// StudentView's task change: save, reset, then the new task id.
function goToTask(h, taskId) {
  actSync(() => h.result.current.saveCurrentWork())
  actSync(() => h.result.current.resetForTaskChange())
  h.update({ currentTaskId: taskId })
}

const payloads = (h) => h.writers.updateTeacherLive.mock.calls.map(([payload]) => payload)

const composedCodeLesson = () => ({
  id: 'lesson-1',
  type: 'composed',
  title: 'composed code lesson',
  tasks: [
    { id: 'c1', title: 'Python', moduleType: 'python', starterCode: 'x = 1' },
    {
      id: 'c2',
      title: 'Arcade',
      moduleType: 'arcade',
      starterCode: 'player = 1',
      arcadeDesign: arcadeDesign('game'),
    },
    {
      id: 'c3',
      title: 'Electronics',
      moduleType: 'electronics',
      starterCircuit: circuitWith('board'),
    },
    { id: 'c4', title: 'Python again', moduleType: 'python', starterCode: 'y = 2' },
  ],
})

describe('code work slot — composed lesson python → arcade → electronics → python', () => {
  it('never publishes a leftover code, design or file map', () => {
    const h = renderStudentCodeState({
      lesson: composedCodeLesson(),
      currentTaskId: 'c1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    actSync(() => h.result.current.handleCodeChange('x = 99'))
    expect(h.result.current.work).toEqual({ moduleType: 'python', taskId: 'c1', value: 'x = 99' })

    // The first publish for a new task can run before its load effect: it then carries the
    // module's empty default. Before plan step 4.4 it carried the previous module's code.
    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'c2')
    const arcadePayloads = payloads(h).filter((p) => p.taskId === 'c2')
    expect(arcadePayloads.length).toBeGreaterThan(0)
    for (const payload of arcadePayloads) {
      expect(payload.lessonType).toBe('arcade')
      expect(['', 'player = 1']).toContain(payload.code)
      expect(payload.files).toEqual({})
    }
    expect(arcadePayloads.at(-1)).toMatchObject({
      code: 'player = 1',
      arcadeDesign: normalisedArcadeDesign('game'),
    })
    expect(h.result.current.code).toBe('player = 1')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('game'))
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('edited')))

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'c3')
    const circuitPayloads = payloads(h).filter((p) => p.taskId === 'c3')
    expect(circuitPayloads.length).toBeGreaterThan(0)
    for (const payload of circuitPayloads) {
      expect(payload.lessonType).toBe('electronics')
      expect(['', circuitJson('board')]).toContain(payload.code)
      // teacherLive is an update() merge: the arcade design must be sent as an explicit null.
      expect(payload).toHaveProperty('arcadeDesign', null)
      expect(payload).toHaveProperty('turtleResult', null)
    }
    expect(circuitPayloads.at(-1).code).toBe(circuitJson('board'))
    // The arcade alias no longer exposes the other module's design.
    expect(h.result.current.arcadeDesign).toBe(null)

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'c4')
    const pythonPayloads = payloads(h).filter((p) => p.taskId === 'c4')
    for (const payload of pythonPayloads) {
      expect(payload.lessonType).toBe('python')
      expect(['', 'y = 2']).toContain(payload.code)
      expect(payload.arcadeDesign).toBe(null)
    }
    expect(pythonPayloads.at(-1).code).toBe('y = 2')
    expect(h.result.current.code).toBe('y = 2')

    // Each task kept its own record, in its own shape.
    expect(JSON.parse(localStorage.getItem(taskKey('c1')))).toEqual({
      code: 'x = 99',
      output: '',
      runStatus: null,
    })
    expect(JSON.parse(localStorage.getItem(taskKey('c2')))).toEqual({
      code: 'player = 1',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('edited'),
    })
    expect(JSON.parse(localStorage.getItem(taskKey('c3')))).toEqual({ code: circuitJson('board') })
  })

  it('watch-start and the share snapshot use the current module’s work', () => {
    const h = renderStudentCodeState({ lesson: composedCodeLesson(), currentTaskId: 'c2' })
    actSync(() => h.result.current.handleCodeChange('player = 5'))
    goToTask(h, 'c3')
    h.updateSession({ activeStudentView: ANON })
    expect(h.writers.writeStudentCode.mock.calls).toEqual([[ANON, circuitJson('board')]])
    expect(h.result.current.buildShareSnapshot()).toMatchObject({
      lessonType: 'electronics',
      taskId: 'c3',
      code: circuitJson('board'),
      arcadeDesign: null,
      files: {},
    })
  })

  it('an information task in between clears the code, and the next task loads afresh', () => {
    const lesson = composedCodeLesson()
    lesson.tasks.splice(1, 0, { id: 'i1', title: 'Read me', taskType: 'information' })
    const h = renderStudentCodeState({ lesson, currentTaskId: 'c1' })
    actSync(() => h.result.current.handleCodeChange('x = 7'))
    goToTask(h, 'i1')
    expect(h.result.current.code).toBe('')
    expect(h.result.current.work.moduleType).toBe(null)
    goToTask(h, 'c2')
    expect(h.result.current.code).toBe('player = 1')
  })
})

// Intentional differences from the pre-4.4 behaviour: leftovers from an earlier module in a
// composed lesson no longer travel with the current module's work.
describe('code work slot — leftovers the migration stops publishing', () => {
  const htmlThen = (next) => ({
    id: 'lesson-1',
    type: 'composed',
    title: 'composed',
    tasks: [
      {
        id: 'h1',
        title: 'Web',
        moduleType: 'html',
        entryFile: 'index.html',
        starterFiles: [htmlFile('<p>web</p>')],
      },
      next,
    ],
  })

  // Before: python's payload carried `files` from filesRef, i.e. the earlier HTML task's files.
  it('a python task after an HTML task publishes no HTML files', () => {
    const h = renderStudentCodeState({
      lesson: htmlThen({ id: 'p1', title: 'Py', moduleType: 'python', starterCode: 'x = 1' }),
      currentTaskId: 'h1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive({ taskId: 'h1' }) }),
    })
    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'p1')
    const pythonPayloads = payloads(h).filter((p) => p.taskId === 'p1')
    expect(pythonPayloads.length).toBeGreaterThan(0)
    for (const payload of pythonPayloads) {
      expect(payload.lessonType).toBe('python')
      expect(payload.files).toEqual({})
    }
    expect(pythonPayloads.at(-1).code).toBe('x = 1')
  })

  // Before: only electronics cleared the HTML file state on load, so a filesystem task after
  // an HTML task kept publishing (and sharing) the HTML task's active file.
  it('a state module (filesystem) clears the HTML file state on load, as electronics did', () => {
    const h = renderStudentCodeState({
      lesson: htmlThen({
        id: 'f1',
        title: 'Files',
        moduleType: 'filesystem',
        starterFs: fsWith('a.txt'),
      }),
      currentTaskId: 'h1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive({ taskId: 'h1' }) }),
    })
    expect(h.result.current.activeFile).toBe('index.html')
    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'f1')
    expect(h.result.current.files).toEqual([])
    expect(h.result.current.activeFile).toBe('')
    expect(payloads(h).at(-1)).toMatchObject({
      lessonType: 'filesystem',
      activeFile: '',
      files: {},
    })
    expect(h.result.current.buildShareSnapshot().activeFile).toBe('')
  })
})

// ── Run dispatch by capabilities.run ─────────────────────────────────────────

describe('handleRun dispatches on capabilities.run', () => {
  it.each([
    ['python', pythonLesson, 'print("start")'],
    ['turtle', turtleLesson, 'print("start")'],
    ['electronics', electronicsLesson, circuitJson('starter')],
  ])(
    "'runtime' (%s): runs the slot's code through the module runtime",
    async (type, lesson, code) => {
      const run = mockModuleRun(type, () => ({ status: 'success' }))
      const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
      await actAsync(() => h.result.current.handleRun())
      expect(run).toHaveBeenCalledTimes(1)
      expect(run.mock.calls[0][0]).toBe(code)
      expect(run.mock.calls[0][1].id).toBe('t1')
      expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
      expect(h.result.current.running).toBe(false)
    }
  )

  it("'preview' (html): builds the preview, never a runtime run", async () => {
    const { build } = mockHtmlPreview({ src: 'blob:x', text: '' })
    const pythonRun = mockModuleRun('python')
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    await act(async () => {})
    expect(build).toHaveBeenCalledTimes(1)
    expect(pythonRun).not.toHaveBeenCalled()
    expect(h.result.current.iframeSrc).toBe('blob:x')
  })

  it.each([
    ['arcade', arcadeLesson],
    ['scratch', scratchLesson],
    ['filesystem', filesystemLesson],
    ['desktop', desktopLesson],
  ])("'workspace' / 'none' (%s): nothing runs and no run is written", async (type, lesson) => {
    const runs = ['python', 'turtle', 'electronics'].map((t) => mockModuleRun(t))
    const { build } = mockHtmlPreview()
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    const before = h.result.current.output
    await actAsync(() => h.result.current.handleRun())
    for (const run of runs) expect(run).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
    expect(h.result.current.running).toBe(false)
    expect(h.result.current.output).toBe(before)
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })

  it('Arcade reports its own runs through handleWorkspaceRun (alias handleArcadeRun)', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    expect(h.result.current.handleArcadeRun).toBe(h.result.current.handleWorkspaceRun)
    actSync(() => h.result.current.handleWorkspaceRun('player.jump()'))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'player.jump()',
      output: '',
      status: 'success',
      checkPassed: true,
    })
  })

  it('handleWorkspaceRun is a no-op for a module that is not workspace-run', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleWorkspaceRun('print("hi")'))
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
  })
})

// ── runWithRuntime: stopping mid-run ──────────────────────────────────────────

// A runtime whose run prints, then waits until stop() is called and reports 'stopped'.
function stoppableRun(type, beforeWait = () => {}) {
  const runtime = getLessonModule(type).runtime
  let stopRun
  vi.spyOn(runtime, 'stop').mockImplementation(() => stopRun?.())
  return vi.spyOn(runtime, 'run').mockImplementation(async (code, task, callbacks) => {
    callbacks.onOutput('partial\n', 'stdout')
    await beforeWait(callbacks)
    await new Promise((resolve) => {
      stopRun = resolve
    })
    return { status: 'stopped' }
  })
}

describe('runWithRuntime — stop mid-run', () => {
  it('python: Stop ends the run with its output, and writes, saves and logs nothing', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    expect(h.result.current.running).toBe(true)
    actSync(() => h.result.current.handleStop())
    await act(async () => {
      await runPromise
    })
    expect(h.result.current.running).toBe(false)
    expect(h.result.current.output).toBe('partial\n')
    expect(h.result.current.runStatus).toBe(null)
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
  })

  it('python while watched: the stop mirrors the code and output it ended with', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    h.writers.writeStudentCode.mockClear()
    h.writers.writeStudentOutput.mockClear()
    actSync(() => h.result.current.handleStop())
    await act(async () => {
      await runPromise
    })
    expect(h.writers.writeStudentCode.mock.calls).toEqual([[ANON, 'print("start")']])
    expect(h.writers.writeStudentOutput.mock.calls.at(-1)).toEqual([ANON, 'partial\n'])
  })

  it('a stop caused by changing task does not paint the old output onto the new task', async () => {
    stoppableRun('python')
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
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
    expect(h.result.current.code).toBe('# t3 starter')
    expect(h.result.current.output).toBe('')
    expect(h.result.current.running).toBe(false)
  })

  it('electronics: a circuit update mid-run is read back at once and saved when stopped', async () => {
    let readBack
    stoppableRun('electronics', async (callbacks) => {
      callbacks.onCodeUpdate(circuitJson('lit'))
      // The update lands on the next frame; the runtime then reads the circuit back.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      readBack = callbacks.getRuntimeCode()
    })
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(readBack).toBe(circuitJson('lit'))
    actSync(() => h.result.current.handleStop())
    await act(async () => {
      await runPromise
    })
    expect(h.result.current.code).toBe(circuitJson('lit'))
    expect(h.result.current.work.value).toBe(circuitJson('lit'))
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('lit'), output: 'partial\n' })
    )
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })
})

// ── Arcade on the slot ────────────────────────────────────────────────────────

describe('arcade work slot', () => {
  it('a teacher sandbox push replaces the code and keeps the current design', () => {
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ sandboxCode: 'player = 8', sandboxCodePushedAt: 1 }),
    })
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('mine')))
    h.updateSession({ sandboxCode: 'player = 9', sandboxCodePushedAt: 2 })
    expect(h.result.current.code).toBe('player = 9')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('mine'))
  })

  it('a design edit is published once, not again by the publish-on-change effect', () => {
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    h.writers.updateTeacherLive.mockClear()
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('drawn')))
    expect(h.writers.updateTeacherLive).toHaveBeenCalledTimes(1)
    expect(h.writers.updateTeacherLive.mock.calls[0][0]).toMatchObject({
      lessonType: 'arcade',
      code: 'player = 1',
      arcadeDesign: normalisedArcadeDesign('drawn'),
    })
  })
})
