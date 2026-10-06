// Characterization: Run / Run tests / Submit / Arcade run / Scratch check → exact
// writeStudentRun payloads, logAttempt submissions and saved records, per module type.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  fileKey,
  makeSession,
  mockHtmlPreview,
  mockModuleRun,
  renderStudentCodeState,
  taskKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeLesson,
  circuitJson,
  desktopLesson,
  electronicsLesson,
  filesystemLesson,
  htmlLesson,
  normalisedArcadeDesign,
  pythonLesson,
  scratchBlocks,
  scratchLesson,
  turtleLesson,
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

const printing =
  (text, status = 'success', extra = {}) =>
  (callbacks) => {
    callbacks.onOutput(text, 'stdout')
    return { status, ...extra }
  }

describe.each([
  ['python', pythonLesson],
  ['turtle', turtleLesson],
])('handleRun — %s', (type, lesson) => {
  it('passing run: writeStudentRun, logAttempt and saved record', async () => {
    mockModuleRun(type, printing('hi\n'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())

    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("start")',
      output: 'hi\n',
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'print("start")',
      passed: true,
      suggestion: '',
      teacherAssisted: false,
      error: false,
    })
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      '{"code":"print(\\"start\\")","output":"hi\\n","runStatus":"success"}'
    )
    expect(h.result.current.output).toBe('hi\n')
    expect(h.result.current.runStatus).toBe('success')
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.result.current.running).toBe(false)
  })

  it('failing run: checkPassed false with the check hint as suggestion', async () => {
    mockModuleRun(type, printing('nope\n'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("start")',
      output: 'nope\n',
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'print("start")',
      passed: false,
      suggestion: 'Print hi',
      teacherAssisted: false,
      error: false,
    })
    expect(h.result.current.checkSuggestion).toBe('Print hi')
  })

  it('runtime error: the attempt carries the error name read from the output', async () => {
    mockModuleRun(type, (callbacks) => {
      callbacks.onOutput("Line 1: NameError: name 'x' is not defined\n", 'stderr', 1)
      return { status: 'error' }
    })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      't1',
      expect.objectContaining({ passed: false, error: 'NameError' })
    )
  })

  it('runtime error without a readable name: the attempt carries error: true', async () => {
    mockModuleRun(type, printing('something broke\n', 'error'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      't1',
      expect.objectContaining({ error: true })
    )
  })

  it('runtime error: completion fails even if output would match', async () => {
    mockModuleRun(type, printing('hi\n', 'error'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("start")',
      output: 'hi\n',
      status: 'error',
      checkPassed: false,
      errorText: 'hi',
    })
  })

  it('task without a check: writes a run but logs no attempt', async () => {
    mockModuleRun(type, printing('x\n'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't3' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: '# t3 starter',
      output: 'x\n',
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('solo: saves locally but writes no run and logs no attempt', async () => {
    mockModuleRun(type, printing('hi\n'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1', phase: 'solo' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'print("start")',
      output: 'hi\n',
      runStatus: 'success',
    })
  })

  it('teacher sandbox phase is free play: checkPassed undefined, no attempt', async () => {
    mockModuleRun(type, printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ sandboxCode: 'print("hi")', sandboxCodePushedAt: 1 }),
    })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("hi")',
      output: 'hi\n',
      status: 'success',
      checkPassed: undefined,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('stopped run: no save, no run write, no attempt', async () => {
    mockModuleRun(type, printing('partial\n', 'stopped'))
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
    expect(h.result.current.output).toBe('partial\n')
    expect(h.result.current.runStatus).toBe(null)
  })

  it('while watched: clears then mirrors input state around the run', async () => {
    mockModuleRun(type, printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    h.writers.writeStudentInputState.mockClear()
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentInputState.mock.calls).toEqual([
      [ANON, { prompt: null, value: '', output: '' }],
      [ANON, { prompt: null, value: '' }],
    ])
    expect(h.writers.writeStudentOutput).toHaveBeenCalledWith(ANON, 'hi\n')
  })
})

describe('handleRun — input()', () => {
  it('echoes the submitted line into the output and hands it to the runtime', async () => {
    let release
    const answered = new Promise((resolve) => {
      release = resolve
    })
    mockModuleRun('python', async (callbacks) => {
      callbacks.onOutput('Name? ', 'stdout')
      callbacks.onInputRequired('Name? ')
      await answered
      callbacks.onOutput('Hi Sam\n', 'stdout')
      return { status: 'success' }
    })
    const { provideInput } = await import('../../../modules/python/pyodide')
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't3' })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    expect(h.result.current.inputPrompt).toBe('Name? ')
    actSync(() => h.result.current.handleInputSubmit('Sam'))
    expect(provideInput).toHaveBeenCalledWith('Sam')
    release()
    await act(async () => {
      await runPromise
    })
    expect(h.result.current.inputPrompt).toBe(null)
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: '# t3 starter',
      output: 'Name? Sam\nHi Sam\n',
      status: 'success',
      checkPassed: false,
    })
  })
})

describe('handleRun — turtle result sync', () => {
  it('writes the raw turtle result after the run and keeps it in state', async () => {
    const turtle = { state: { x: 1.23456, y: 2, heading: 90 }, commands: [{ type: 'forward' }] }
    mockModuleRun('turtle', printing('hi\n', 'success', { turtle }))
    const h = renderStudentCodeState({ lesson: turtleLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentTurtleResult).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentTurtleResult).toHaveBeenCalledWith(ANON, turtle)
    expect(h.result.current.turtleResult).toEqual(turtle)
  })

  it('python never writes a turtle result', async () => {
    mockModuleRun('python', printing('hi\n', 'success', { turtle: { state: {} } }))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentTurtleResult).not.toHaveBeenCalled()
  })
})

describe('handleRun — electronics', () => {
  it('writes the run with the circuit as code; no check means checkPassed false', async () => {
    mockModuleRun('electronics', () => ({ status: 'success' }))
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: circuitJson('starter'),
      output: '',
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: circuitJson('starter'),
      output: '',
      runStatus: 'success',
    })
  })

  it('adopts result.updatedCode as the new circuit', async () => {
    mockModuleRun('electronics', () => ({ status: 'success', updatedCode: circuitJson('run') }))
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.result.current.code).toBe(circuitJson('run'))
    expect(h.writers.writeStudentRun.mock.calls[0][1].code).toBe(circuitJson('run'))
  })

  it('a stopped electronics run still saves {code, output}', async () => {
    mockModuleRun('electronics', () => ({ status: 'stopped' }))
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('starter'), output: '' })
    )
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })
})

describe('handleRunTests — python', () => {
  const withTests = () => {
    const l = pythonLesson()
    l.tasks[0] = {
      ...l.tasks[0],
      check: undefined,
      tests: [
        { id: 'a', name: 'Says hi', check: { type: 'output_contains', value: 'hi' } },
        { id: 'b', check: { type: 'output_contains', value: 'bye' } },
      ],
    }
    return l
  }

  it('writes the aggregate run and logs failed test names (no teacherAssisted key)', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({ lesson: withTests(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRunTests())
    expect(h.result.current.testResults).toEqual([
      { id: 'a', name: 'Says hi', passed: true, output: 'hi\n', status: 'success' },
      { id: 'b', name: 'Test 2', passed: false, output: 'hi\n', status: 'success' },
    ])
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("start")',
      output: 'hi\n',
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'print("start")',
      passed: false,
      suggestion: 'Test 2',
      error: false,
    })
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'print("start")',
      output: 'hi\n',
      runStatus: 'success',
    })
  })

  it('handleRun on a task with tests never passes and logs nothing', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({ lesson: withTests(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'print("start")',
      output: 'hi\n',
      status: 'success',
      checkPassed: undefined,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })
})

describe('handleRun — html', () => {
  it('builds the preview, then writes run + attempt and saves every file', async () => {
    const { build } = mockHtmlPreview({ src: 'blob:preview-1', text: 'start' })
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun())
    await act(async () => {})

    expect(build).toHaveBeenCalledTimes(1)
    const [state, task, opts] = build.mock.calls[0]
    expect(state).toEqual({
      files: h.result.current.files,
      entryFile: 'index.html',
    })
    expect(task.id).toBe('t1')
    expect(opts).toMatchObject({ assets: [], storageAssets: [] })
    expect(h.result.current.iframeSrc).toBe('blob:preview-1')
    expect(h.result.current.runStatus).toBe('success')

    const filesMap = { 'index.html': '<p>start</p>', 'style.css': 'p {}' }
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      files: filesMap,
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: filesMap,
      passed: false,
      suggestion: 'Add a heading',
      teacherAssisted: false,
      error: false,
    })
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'index.html')))).toEqual({
      content: '<p>start</p>',
    })
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'style.css')))).toEqual({
      content: 'p {}',
    })
    expect(h.result.current.running).toBe(false)
  })
})

describe('handleSubmit', () => {
  it('html: submitted run with files map and code/output undefined', async () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileChange('index.html', '<h1>x</h1>'))
    await actAsync(() => h.result.current.handleSubmit())
    const filesMap = { 'index.html': '<h1>x</h1>', 'style.css': 'p {}' }
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: undefined,
      files: filesMap,
      output: undefined,
      status: 'submitted',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: filesMap,
      passed: true,
      suggestion: '',
    })
    expect(h.result.current.runStatus).toBe('submitted')
  })

  it('python: submitted run with code and empty output; record saved as submitted', async () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('player jump'))
    await actAsync(() => h.result.current.handleSubmit())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'player jump',
      files: undefined,
      output: '',
      status: 'submitted',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'player jump',
      passed: true,
      suggestion: '',
    })
    // Non-HTML submit saves through savePythonCode without the arcade design.
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player jump',
      output: '',
      runStatus: 'submitted',
    })
  })
})

describe('handleArcadeRun', () => {
  it('evaluates code checks only and writes run + attempt (no teacherAssisted)', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleArcadeRun('player.jump()'))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: 'player.jump()',
      output: '',
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'player.jump()',
      passed: true,
      suggestion: '',
    })
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player.jump()',
      output: '',
      runStatus: 'success',
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
  })

  it('failing arcade run carries the hint', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleArcadeRun('player = 1'))
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: 'player = 1',
      passed: false,
      suggestion: 'Make the player jump',
    })
  })
})

describe('handleScratchCheck', () => {
  it('writes the snapshot workspace as code and logs the states as submission', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    const states = scratchBlocks('checked')
    actSync(() => h.result.current.handleScratchCheck(true, { workspaceStates: states }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(states),
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: states,
      passed: true,
      suggestion: '',
    })
  })

  it('falls back to the saved state on failure; no suggestion means no hint (generic banner)', () => {
    writeStored(taskKey('t1'), { state: scratchBlocks('saved') })
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScratchCheck(false, {}))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(scratchBlocks('saved')),
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: scratchBlocks('saved'),
      passed: false,
      // The workspace applies the shared hint rule; an empty suggestion must not fall back to
      // the first check's hint (that check may have passed).
      suggestion: '',
    })
  })

  it('writes code undefined when there is no snapshot and nothing saved', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScratchCheck(false, { suggestion: 'Try moving' }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: undefined,
      status: 'success',
      checkPassed: false,
    })
    expect(h.writers.logAttempt.mock.calls[0][2]).toEqual({
      submission: null,
      passed: false,
      suggestion: 'Try moving',
    })
  })
})

// ── handleRun on runtime-less modules ──────────────────────────────────────────
// arcade/filesystem/desktop have runtime: null. handleRun used to fall through to the HTML
// branch and call mod.runtime.buildPreviewSrc on null, leaving `running` true (fixed in
// plan step 1.5): it is now a no-op for them.
describe('handleRun on runtime-less modules', () => {
  it.each([
    ['arcade', arcadeLesson],
    ['filesystem', filesystemLesson],
    ['desktop', desktopLesson],
  ])('%s handleRun resolves without throwing', async (type, lesson) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    await act(async () => {
      await expect(h.result.current.handleRun()).resolves.toBeUndefined()
    })
    expect(h.result.current.running).toBe(false)
  })
})
