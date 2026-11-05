// Request 131: tick a typed Python Stage task without pressing Run. The typed redraw has already
// run the student's code; when its own result passes the task's checks, the task ticks and the
// pass is recorded through the SAME judge (judgeRun) and records (recordRun) a pressed Run uses,
// with the attempt marked source 'live'. A miss does nothing at all. A pressed Run always wins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockModuleRun,
  readStored,
  renderStudentCodeState,
  studentSourcedTeacherLive,
  taskKey,
} from '../../../test/studentCodeStateHarness'
import { fsWith, pythonLesson, turtleLesson } from '../../../test/fixtures/studentCodeStateLessons'
import { applySharedWorkspaceCopy } from '../../sharedWorkspacePayload'
import { applyPeerEdit } from '../../../shared/peerHelp'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const WRONG = 'from stage import *\nprint("ho")'
const RIGHT = 'from stage import *\nprint("hi")'
const RIGHT_TOO = 'from stage import *\nprint("hi")\n# done'
const ALSO_WRONG = 'from stage import *\nprint("hm")'
const STAGE = { commands: [{ type: 'text', text: 'hi', x: 0, y: 0, colour: 'navy' }] }

const CHECK = { type: 'output_contains', value: 'hi', hint: 'Print hi' }

// A typed Stage task: typed edits redraw (scrub on, runOnOpen off so only the test's runs happen).
function stageTask(id, extra = {}) {
  return {
    id,
    title: `Draw ${id}`,
    starterCode: WRONG,
    scrub: { enabled: true },
    runOnOpen: false,
    check: CHECK,
    ...extra,
  }
}

function liveLesson(taskExtra = {}, lessonExtra = {}) {
  return pythonLesson({
    tasks: [stageTask('t1', taskExtra), stageTask('t2')],
    ...lessonExtra,
  })
}

// The program prints what its print() says; the drawing is STAGE.
const output = (code) =>
  code.includes('print("hi') ? 'hi\n' : code.includes('"hm"') ? 'hm\n' : 'ho\n'
function runsTheCode() {
  return mockModuleRun('python', (callbacks, code) => {
    callbacks.onOutput(output(code), 'stdout')
    return { status: 'success', stage: STAGE }
  })
}

// Like runsTheCode, but the first run waits for release() before finishing.
function firstRunWaits() {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let calls = 0
  const run = mockModuleRun('python', async (callbacks, code) => {
    calls += 1
    if (calls === 1) await gate
    callbacks.onOutput(output(code), 'stdout')
    return { status: 'success', stage: STAGE }
  })
  return { run, release: () => release() }
}

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

// The student's own typing in the editor (PythonEditor's onChange): the only edits that may tick.
const EDITOR = { origin: 'editor' }

async function typeAndPause(h, code) {
  actSync(() => h.result.current.handleCodeChange(code, EDITOR))
  await wait(700)
  await act(async () => {})
}

// Every record a Run makes (and so a live pass must make, or a miss must not).
const RECORD_WRITERS = [
  'writeStudentRun',
  'writeStudentStageResult',
  'writeStudentTaskRun',
  'logAttempt',
  'updateTeacherLive',
  'recordEmojiRunSignal',
]
function expectNoRecords(h) {
  for (const name of RECORD_WRITERS) expect(h.writers[name], name).not.toHaveBeenCalled()
}

describe('Fun moment: typing the right code ticks the task without Run', () => {
  it('ticks after the typed redraw, with one run of the program and no Run', async () => {
    const run = runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    const running = []
    await typeAndPause(h, RIGHT)
    running.push(h.result.current.running)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.result.current.checkAttempted).toBe(true)
    expect(h.result.current.checkSuggestion).toBe('')
    expect(h.result.current.runStatus).toBe('success')
    expect(running).toEqual([false])
    // The redraw's run is the only run: the program never runs a second time.
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.result.current.output).toContain('hi')
    expect(h.result.current.stageResult).toEqual(STAGE)
  })

  it('records the pass once, as the Run of that code would, with the attempt marked live', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: RIGHT,
      output: 'hi\n',
      status: 'success',
      checkPassed: true,
      errorText: undefined,
    })
    expect(h.writers.writeStudentStageResult).toHaveBeenCalledWith(ANON, STAGE)
    expect(h.writers.writeStudentTaskRun).toHaveBeenCalledWith(ANON, 't1', RIGHT)
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: RIGHT,
      passed: true,
      suggestion: '',
      teacherAssisted: false,
      error: false,
      source: 'live',
    })
  })

  it('makes the same records as a pressed Run of the same code, except the source', async () => {
    runsTheCode()
    const live = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(live, RIGHT)
    const liveSaved = readStored(taskKey('t1'))
    live.unmount()

    localStorage.clear()
    runsTheCode()
    const pressed = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => pressed.result.current.handleCodeChange(RIGHT))
    await actAsync(() => pressed.result.current.handleRun())
    // The typed redraw after the Run finds the task solved: nothing more.
    await wait(700)
    await act(async () => {})
    const pressedSaved = readStored(taskKey('t1'))

    for (const name of ['writeStudentRun', 'writeStudentStageResult', 'writeStudentTaskRun']) {
      expect(live.writers[name].mock.calls, name).toEqual(pressed.writers[name].mock.calls)
    }
    const [liveAttempt] = live.writers.logAttempt.mock.calls
    const [pressedAttempt] = pressed.writers.logAttempt.mock.calls
    expect(live.writers.logAttempt).toHaveBeenCalledTimes(1)
    expect(pressed.writers.logAttempt).toHaveBeenCalledTimes(1)
    expect(liveAttempt).toEqual([
      pressedAttempt[0],
      pressedAttempt[1],
      { ...pressedAttempt[2], source: 'live' },
    ])
    // The saved run record (the per-task final code and output) is the same.
    expect(liveSaved).toEqual(pressedSaved)
    // Both show the tick the same way.
    expect(live.result.current.checkPassed).toBe(pressed.result.current.checkPassed)
  })

  it('publishes the pass to Go Live when this student is the source, as a Run does', async () => {
    runsTheCode()
    const h = renderStudentCodeState({
      lesson: liveLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive({ taskId: 't1' }) }),
    })
    h.writers.updateTeacherLive.mockClear()
    await typeAndPause(h, RIGHT)
    expect(h.writers.updateTeacherLive).toHaveBeenCalledWith(
      expect.objectContaining({ checkPassed: true, runStatus: 'success' })
    )
  })

  it('leaves out what only a pressed Run does (Emoji Artist)', async () => {
    runsTheCode()
    const emoji = 'from stage import *\nprint("hi 😀")'
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, emoji)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.recordEmojiRunSignal).not.toHaveBeenCalled()
    // A pressed Run of the same code does report it.
    const pressed = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => pressed.result.current.handleCodeChange(emoji))
    await actAsync(() => pressed.result.current.handleRun())
    expect(pressed.writers.recordEmojiRunSignal).toHaveBeenCalled()
  })
})

describe('a miss does nothing', () => {
  it('shows and writes nothing for wrong code', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    // (Opening the task syncs an empty hint state once.)
    h.writers.writeStudentHintState.mockClear()
    await typeAndPause(h, ALSO_WRONG)
    expect(h.result.current.output).toContain('hm')
    expect(h.result.current.checkPassed).toBe(false)
    expect(h.result.current.checkAttempted).toBe(false)
    expect(h.result.current.checkSuggestion).toBe('')
    expect(h.result.current.checkFailCount).toBe(0)
    expect(h.result.current.runStatus).toBeNull()
    expectNoRecords(h)
    expect(h.writers.writeStudentHintState).not.toHaveBeenCalled()
  })

  it('a later pressed Run of wrong code shows the failure as today', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, ALSO_WRONG)
    await actAsync(() => h.result.current.handleRun())
    expect(h.result.current.checkAttempted).toBe(true)
    expect(h.result.current.checkPassed).toBe(false)
    expect(h.result.current.checkSuggestion).toBe('Print hi')
  })
})

describe('races: a pressed Run always wins', () => {
  it('a Run pressed while the redraw is in flight records once, as a Run', async () => {
    const { run, release } = firstRunWaits()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    await wait(600)
    expect(run).toHaveBeenCalledTimes(1)
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    release()
    await act(async () => {
      await runPromise
    })
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(true)
    expect(run).toHaveBeenCalledTimes(2)
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt.mock.calls[0][2].source).toBeUndefined()
  })

  it('a Run right after a live pass sees the task solved and logs no second attempt', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    await actAsync(() => h.result.current.handleRun())
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
  })

  it('code edited after the redraw judged it does not tick', async () => {
    const { release } = firstRunWaits()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    await wait(600)
    actSync(() => h.result.current.handleCodeChange(ALSO_WRONG, EDITOR))
    release()
    await wait(800)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('a task change while the redraw runs ticks neither task', async () => {
    const { release } = firstRunWaits()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    await wait(600)
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 't2' })
    release()
    await wait(50)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('a failed write leaves the tick and warns, with no unhandled rejection', async () => {
    runsTheCode()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.writers.writeStudentRun.mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
    await typeAndPause(h, RIGHT)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(true)
    expect(warn).toHaveBeenCalled()
  })
})

describe('writes are bounded', () => {
  it('many passing redraws make one set of records', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    await typeAndPause(h, RIGHT_TOO)
    await typeAndPause(h, RIGHT)
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentTaskRun).toHaveBeenCalledTimes(1)
  })

  it('no write per keystroke: typing then pausing makes one redraw and one set of records', async () => {
    const run = runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    for (let i = 1; i <= RIGHT.length; i += 1) {
      actSync(() => h.result.current.handleCodeChange(RIGHT.slice(0, i), EDITOR))
    }
    expectNoRecords(h)
    await wait(700)
    await act(async () => {})
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('an already solved task records nothing more', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    await actAsync(() => h.result.current.handleRun())
    await wait(700)
    for (const name of RECORD_WRITERS) h.writers[name].mockClear()
    await typeAndPause(h, RIGHT_TOO)
    expectNoRecords(h)
  })
})

describe('re-arming', () => {
  it('Reset clears the tick, and the next passing redraw ticks again', async () => {
    runsTheCode()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.checkPassed).toBe(false)
    await typeAndPause(h, RIGHT_TOO)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(2)
  })

  it("a tutor's 'not yet' blocks live ticks on that task until the student presses Run", async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.updateStudent({ checkOverridePassed: false, checkOverridePushedAt: 1 })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
    // A pressed Run (of wrong code, so it fails) lifts the block...
    actSync(() => h.result.current.handleCodeChange(ALSO_WRONG, EDITOR))
    await actAsync(() => h.result.current.handleRun())
    expect(h.result.current.checkPassed).toBe(false)
    await wait(700)
    h.writers.writeStudentRun.mockClear()
    h.writers.logAttempt.mockClear()
    // ...and the next passing redraw ticks again.
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      't1',
      expect.objectContaining({ passed: true, source: 'live' })
    )
  })

  it("a tutor's pass leaves nothing to tick", async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.updateStudent({ checkOverridePassed: true, checkOverridePushedAt: 1 })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    expectNoRecords(h)
  })

  it('a task change re-arms: the next task ticks on its own redraw', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 't2' })
    expect(h.result.current.checkPassed).toBe(false)
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.writeStudentTaskRun).toHaveBeenLastCalledWith(ANON, 't2', RIGHT)
  })
})

describe('composed lessons (the effective module type, never lesson.type)', () => {
  const composed = () => ({
    id: 'lesson-1',
    type: 'composed',
    title: 'composed lesson',
    tasks: [
      { id: 'c1', title: 'Files', moduleType: 'filesystem', starterFs: fsWith('c1.txt') },
      { ...stageTask('c2'), moduleType: 'python' },
    ],
  })

  it('a Python Stage task in a composed lesson ticks', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: composed(), currentTaskId: 'c2' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      'c2',
      expect.objectContaining({ passed: true, source: 'live' })
    )
  })

  it('a switch to another module while the redraw runs ticks nothing', async () => {
    const { release } = firstRunWaits()
    const h = renderStudentCodeState({ lesson: composed(), currentTaskId: 'c2' })
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    await wait(600)
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 'c1' })
    release()
    await wait(50)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })
})

describe('tasks and places that never tick while typing', () => {
  const cases = [
    ['submit mode', { interactionMode: 'submit' }],
    ['Python tests', { tests: [{ input: '', expected: 'hi' }] }],
    ['input() in setupCode', { setupCode: 'name = input("?")' }],
    ['name tags (showVariables)', { showVariables: { mode: 'view' } }],
    [
      'run counts (line_run_count)',
      {
        check: [
          CHECK,
          { type: 'line_run_count', line: 'print("hi")', operator: 'equals', value: 1 },
        ],
      },
    ],
    ['run_attempted only ("press Run and watch")', { check: { type: 'run_attempted' } }],
    ['run_attempted beside another check', { check: [CHECK, { type: 'run_attempted' }] }],
    [
      'a check type off the allow-list in a feedback check',
      { feedbackChecks: [{ type: 'runs_predicted', hint: 'Count again' }] },
    ],
    [
      'a check carrying nesting keys (check / checks), which no evaluator reads',
      { check: [{ ...CHECK, check: { type: 'output_contains', value: 'hi' } }] },
    ],
    ['a copyCode task (its first Run measures the copy)', { copyCode: RIGHT }],
    [
      'an on-idle (timing) feedback check',
      { feedbackChecks: [{ type: 'output_contains', value: 'zz', show: 'on_idle', hint: 'x' }] },
    ],
    ['Run defaults to slow-mo', { slowMo: { enabled: true } }],
  ]

  it.each(cases)('%s', async (_name, extra) => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(extra), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('input() in the code', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    // A Run first, so the redraw has answers to replay and does run.
    await actAsync(() => h.result.current.handleRun())
    for (const name of RECORD_WRITERS) h.writers[name].mockClear()
    await typeAndPause(h, `${RIGHT}\nname = input("?")`)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it.each([
    ['the presentation window', { teacherPresentation: true }],
    ['the Builder preview', { previewMode: true }],
    ['the session sandbox', { phase: 'sandbox' }],
  ])('%s', async (_name, options) => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1', ...options })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('Turtle (not a Stage module)', async () => {
    mockModuleRun('turtle', (callbacks) => {
      callbacks.onOutput('hi\n', 'stdout')
      return { status: 'success', turtle: { commands: [] } }
    })
    const lesson = turtleLesson({ tasks: [stageTask('t1')] })
    const h = renderStudentCodeState({ lesson, currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('does tick solo, and with slow-mo on its own button', async () => {
    runsTheCode()
    const solo = renderStudentCodeState({
      lesson: liveLesson(),
      currentTaskId: 't1',
      phase: 'solo',
    })
    await typeAndPause(solo, RIGHT)
    expect(solo.result.current.checkPassed).toBe(true)
    const separate = renderStudentCodeState({
      lesson: liveLesson({ slowMo: { enabled: true, separateButton: true } }),
      currentTaskId: 't1',
    })
    await typeAndPause(separate, RIGHT)
    expect(separate.result.current.checkPassed).toBe(true)
  })
})

describe("a tutor's 'not yet' (Mark Fail) holds until the student's own Run", () => {
  const MARK_FAIL = { checkOverridePassed: false, checkOverridePushedAt: 1 }

  it('the checks a scrub runs when it ends do not lift it', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.updateStudent(MARK_FAIL)
    actSync(() => h.result.current.handleCodeChange(ALSO_WRONG, EDITOR))
    await actAsync(() => h.result.current.handleRun({ source: 'scrub' }))
    await wait(700)
    for (const name of RECORD_WRITERS) h.writers[name].mockClear()
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it("the tutor's remote Run does not lift it", async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.updateStudent(MARK_FAIL)
    actSync(() => h.result.current.handleCodeChange(ALSO_WRONG, EDITOR))
    h.updateStudent({ remoteRunPushedAt: 5 })
    expect(h.result.current.remoteRunToken).toBe(5)
    // As useRemoteRunTrigger does: the workspace's Run, then the acknowledgement.
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
      h.result.current.acknowledgeRemoteRun(5)
    })
    await act(async () => {
      await runPromise
    })
    await wait(700)
    for (const name of RECORD_WRITERS) h.writers[name].mockClear()
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('holds on a fresh mount (a reload) with the Mark Fail already stored', async () => {
    runsTheCode()
    const h = renderStudentCodeState({
      lesson: liveLesson(),
      currentTaskId: 't1',
      session: makeSession({ currentTaskId: 't1', student: MARK_FAIL }),
    })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('a new Mark Fail after the student ran holds again', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    h.updateStudent(MARK_FAIL)
    actSync(() => h.result.current.handleCodeChange(ALSO_WRONG, EDITOR))
    await actAsync(() => h.result.current.handleRun())
    h.updateStudent({ checkOverridePassed: false, checkOverridePushedAt: 2 })
    await wait(700)
    for (const name of RECORD_WRITERS) h.writers[name].mockClear()
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })
})

describe("only the student's own typing ticks", () => {
  it('an edit with no origin (the default) redraws but never ticks', async () => {
    const run = runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT))
    await wait(700)
    await act(async () => {})
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it("a peer's accepted edit does not tick", async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    // As StudentView handleAcceptPeerEdit applies it.
    const next = applyPeerEdit(h.result.current.code, [
      { op: 'replace', line: 2, before: 'print("ho")', text: 'print("hi")' },
    ])
    expect(next).toBe(RIGHT)
    actSync(() => h.result.current.handleCodeChange(next))
    await wait(700)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('copied shared work does not tick', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() =>
      applySharedWorkspaceCopy({ code: RIGHT, moduleType: 'python' }, h.result.current)
    )
    await wait(700)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(false)
    expectNoRecords(h)
  })

  it('typing after a no-tick edit still ticks', async () => {
    runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(RIGHT))
    await wait(700)
    await typeAndPause(h, RIGHT_TOO)
    expect(h.result.current.checkPassed).toBe(true)
  })
})

describe('a typed redraw of code already previewed still ticks', () => {
  it('after a scrub preview of the same code (not a typed one)', async () => {
    const run = runsTheCode()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    act(() => {
      h.result.current.scrubPreview(RIGHT)
    })
    await wait(300)
    await act(async () => {})
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.result.current.checkPassed).toBe(false)
    // The scrub's end saves the code as an edit in the editor.
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
  })

  it('after an earlier typed redraw of the same code that did not finish cleanly', async () => {
    let calls = 0
    mockModuleRun('python', (callbacks, code) => {
      calls += 1
      if (calls === 1) return { status: 'error' }
      callbacks.onOutput(output(code), 'stdout')
      return { status: 'success', stage: STAGE }
    })
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(false)
    await typeAndPause(h, RIGHT)
    expect(h.result.current.checkPassed).toBe(true)
  })
})

describe('only a Run that starts invalidates a pending typed pass', () => {
  it('a Run that returns at once (already running, a stale handler) does not', async () => {
    const { release } = firstRunWaits()
    const h = renderStudentCodeState({ lesson: liveLesson(), currentTaskId: 't1' })
    // A real Run of wrong code, held open: this render's handleRun sees running.
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    expect(h.result.current.running).toBe(true)
    const staleRun = h.result.current.handleRun
    release()
    await act(async () => {
      await runPromise
    })
    expect(h.result.current.checkPassed).toBe(false)
    actSync(() => h.result.current.handleCodeChange(RIGHT, EDITOR))
    // A stray press through the stale handler: it returns without running.
    await actAsync(() => staleRun())
    await wait(700)
    await act(async () => {})
    expect(h.result.current.checkPassed).toBe(true)
    expect(h.writers.logAttempt).toHaveBeenLastCalledWith(
      ANON,
      't1',
      expect.objectContaining({ passed: true, source: 'live' })
    )
  })
})
