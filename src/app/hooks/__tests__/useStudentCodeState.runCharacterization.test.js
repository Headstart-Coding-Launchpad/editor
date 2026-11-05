// Characterization of a pressed Run through the whole hook (handleRun -> runWithRuntime), written
// before the judge/record split (request 131 design, phase 0). Each snapshot is the ORDERED list
// of every session writer the Run called (across all writers, by call order) plus the screen
// state it left. runWithRuntime.characterization.test.js pins the inner effect log; this file
// pins what handleRun adds around it: the reset before the run, typing stats, the Emoji Artist
// signal, the hint mirror, presentation / free play / solo / predict lock / Go Live, already
// solved. A refactor of the Run must leave every snapshot unchanged.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockModuleRun,
  renderStudentCodeState,
  studentSourcedTeacherLive,
} from '../../../test/studentCodeStateHarness'
import { pythonLesson, turtleLesson } from '../../../test/fixtures/studentCodeStateLessons'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

// typingStats.noteRun is called on every Run (a no-op unless typing stats are on); it is wrapped
// so each call joins the ordered log as `typingStats.noteRun`.
const typingNotes = vi.hoisted(() => ({ fn: null }))
vi.mock('../useStudentTypingStats', async (importOriginal) => {
  const actual = await importOriginal()
  const { useMemo } = await import('react')
  return {
    ...actual,
    useStudentTypingStats: (args) => {
      const real = actual.useStudentTypingStats(args)
      return useMemo(
        () => ({
          ...real,
          noteRun: (...noteArgs) => {
            typingNotes.fn?.(...noteArgs)
            return real.noteRun(...noteArgs)
          },
        }),
        [real]
      )
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

const replacer = (key, value) => {
  if (value === undefined) return '<undefined>'
  if (key === 'runId' && typeof value === 'string') return '<runId>'
  if ((key === 'at' || key === 'lastRunAt' || key === 'sentAt') && typeof value === 'number')
    return '<time>'
  return value
}

function clearWriters(h) {
  if (!h.writers['typingStats.noteRun']) h.writers['typingStats.noteRun'] = vi.fn()
  typingNotes.fn = h.writers['typingStats.noteRun']
  for (const fn of Object.values(h.writers)) fn.mockClear()
}

// Every writer call since the last clear, in call order.
function writerLog(h) {
  const calls = []
  for (const [name, fn] of Object.entries(h.writers)) {
    fn.mock.calls.forEach((args, i) => calls.push([fn.mock.invocationCallOrder[i], name, args]))
  }
  return calls
    .sort((a, b) => a[0] - b[0])
    .map(([, name, args]) => `${name} ${JSON.stringify(args, replacer)}`)
    .join('\n')
}

function screen(h) {
  const c = h.result.current
  return JSON.stringify(
    {
      running: c.running,
      output: c.output,
      runStatus: c.runStatus,
      errorLine: c.errorLine,
      inputPrompt: c.inputPrompt,
      checkPassed: c.checkPassed,
      checkAttempted: c.checkAttempted,
      checkSuggestion: c.checkSuggestion,
      checkFailCount: c.checkFailCount,
      stageResult: c.stageResult,
      turtleResult: c.turtleResult,
      predictRunLock: c.predictRunLock,
    },
    replacer,
    2
  )
}

const printing =
  (text, status = 'success', extra = {}) =>
  (callbacks) => {
    callbacks.onOutput(text, status === 'error' ? 'stderr' : 'stdout', 1)
    return { status, ...extra }
  }

async function pressRun(h, runOptions) {
  clearWriters(h)
  await actAsync(() => h.result.current.handleRun(runOptions))
  return { writes: writerLog(h), screen: screen(h) }
}

describe('handleRun characterization (python)', () => {
  it('passing Run', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('failing Run', async () => {
    mockModuleRun('python', printing('nope\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "nope\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": false,
        "checkAttempted": true,
        "checkSuggestion": "Print hi",
        "checkFailCount": 1,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"nope\\n","status":"success","checkPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":false,"suggestion":"Print hi","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":{"text":"Print hi","source":"check","failStreak":1,"taskId":"t1","at":"<time>"},"hintOffer":{"kind":"support","stageIndex":0,"label":"Support A","taskId":"t1","at":"<time>"}}]",
      }
    `)
  })

  it('error Run', async () => {
    mockModuleRun('python', printing("NameError: name 'x' is not defined\n", 'error'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "NameError: name 'x' is not defined\\n",
        "runStatus": "error",
        "errorLine": 1,
        "inputPrompt": null,
        "checkPassed": false,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 1,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"NameError: name 'x' is not defined\\n","status":"error","checkPassed":false,"errorText":"NameError: name 'x' is not defined"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":false,"suggestion":"","teacherAssisted":false,"error":"NameError"}]
      writeStudentHintState ["stu-1",{"studentHint":null,"hintOffer":{"kind":"support","stageIndex":0,"label":"Support A","taskId":"t1","at":"<time>"}}]",
      }
    `)
  })

  it('a Run resets the last Run on screen before it runs', async () => {
    mockModuleRun('python', printing("NameError: name 'x' is not defined\n", 'error'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await pressRun(h)
    let release
    const held = new Promise((resolve) => {
      release = resolve
    })
    mockModuleRun('python', async (callbacks) => {
      await held
      callbacks.onOutput('hi\n', 'stdout')
      return { status: 'success' }
    })
    clearWriters(h)
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    const during = { writes: writerLog(h), screen: screen(h) }
    release()
    await act(async () => {
      await runPromise
    })
    expect(during).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": true,
        "output": "",
        "runStatus": null,
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": false,
        "checkAttempted": false,
        "checkSuggestion": "",
        "checkFailCount": 1,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]",
      }
    `)
  })

  it('already-solved Run (a pass, then a failing Run)', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    await pressRun(h)
    mockModuleRun('python', printing('nope\n'))
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "nope\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"nope\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]",
      }
    `)
  })

  it('free play (teacher sandbox phase)', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ sandboxCode: 'print("hi")', sandboxCodePushedAt: 1 }),
    })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": false,
        "checkAttempted": false,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"hi\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":"<undefined>","errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      recordSandboxRunSignal ["stu-1","session",{"error":false,"submissionHash":"17whddb"}]",
      }
    `)
  })

  it('teacher presentation', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
    })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]",
      }
    `)
  })

  it('solo', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', phase: 'solo' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]",
      }
    `)
  })

  it('watched by the tutor', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":""}]
      writeStudentOutput ["stu-1","hi\\n"]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('the Go Live source', async () => {
    mockModuleRun('python', printing('hi\n'))
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      updateTeacherLive [{"active":true,"source":"student","sourceStudentId":"stu-1","sourceStudentName":"Sam","taskId":"t1","lessonType":"python","code":"print(\\"start\\")","arcadeDesign":null,"turtleResult":null,"inspector":null,"variablesPanel":null,"stage":null,"files":{},"activeFile":"","output":"hi\\n","runStatus":null,"checkPassed":false,"checkAttempted":false,"checkSuggestion":"","selection":null,"activity":null}]
      updateTeacherLive [{"active":true,"source":"student","sourceStudentId":"stu-1","sourceStudentName":"Sam","taskId":"t1","lessonType":"python","code":"print(\\"start\\")","arcadeDesign":null,"turtleResult":null,"inspector":null,"variablesPanel":null,"stage":null,"files":{},"activeFile":"","output":"hi\\n","runStatus":"success","checkPassed":true,"checkAttempted":true,"checkSuggestion":"","selection":null,"activity":null}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]
      updateTeacherLive [{"active":true,"source":"student","sourceStudentId":"stu-1","sourceStudentName":"Sam","taskId":"t1","lessonType":"python","code":"print(\\"start\\")","arcadeDesign":null,"turtleResult":null,"inspector":null,"variablesPanel":null,"stage":null,"files":{},"activeFile":"","output":"hi\\n","runStatus":"success","checkPassed":true,"checkAttempted":true,"checkSuggestion":"","selection":null,"activity":null}]",
      }
    `)
  })

  it('predict lock: handleRun still runs (the lock is the workspace Run button)', async () => {
    mockModuleRun('python', printing('hi\n'))
    const lesson = pythonLesson()
    lesson.tasks[0] = {
      ...lesson.tasks[0],
      showVariables: { mode: 'predict', predict: [{ name: 'x', answer: '3' }] },
    }
    const h = renderStudentCodeState({ lesson, currentTaskId: 't1' })
    const before = screen(h)
    expect(JSON.parse(before).predictRunLock).not.toBe(null)
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentVariables ["stu-1",{"taskId":"t1","status":"success","at":"end","snapshots":[],"index":0,"peekLine":null,"peekReached":false,"changed":[],"changedItems":{},"ran":true,"predictions":null,"results":null}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('Emoji Artist: a Run of new emoji code reports the signal', async () => {
    mockModuleRun('python', printing('hi \u{1F600}\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('print("hi \u{1F600}")'))
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi 😀\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"hi 😀\\")"}]
      recordEmojiRunSignal ["stu-1",{"context":"task","taskId":"t1"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi 😀\\")","output":"hi 😀\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi 😀\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi 😀\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('typing stats: the first Run on a copyCode task records the copy distance', async () => {
    mockModuleRun('python', printing('hi\n'))
    const lesson = pythonLesson()
    lesson.tasks[0] = { ...lesson.tasks[0], copyCode: 'print("hi")' }
    const h = renderStudentCodeState({
      lesson,
      currentTaskId: 't1',
      session: makeSession({ state: 'active' }),
    })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"print(\\"hi\\")","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('a Python Stage drawing', async () => {
    const stage = { commands: [{ type: 'circle', x: 200, y: 200, r: 50, colour: '#ff0000' }] }
    mockModuleRun('python', printing('hi\n', 'success', { stage }))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": {
          "commands": [
            {
              "type": "circle",
              "x": 200,
              "y": 200,
              "r": 50,
              "colour": "#ff0000"
            }
          ]
        },
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",{"commands":[{"type":"circle","x":200,"y":200,"r":50,"colour":"#ff0000"}]}]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('a Run with input() answered by the student', async () => {
    let release
    const answered = new Promise((resolve) => {
      release = resolve
    })
    mockModuleRun('python', async (callbacks) => {
      callbacks.onOutput('Name? ', 'stdout')
      callbacks.onInputRequired('Name? ')
      await answered
      callbacks.onOutput('hi Sam\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    clearWriters(h)
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    actSync(() => h.result.current.handleInputSubmit('Sam'))
    release()
    await act(async () => {
      await runPromise
    })
    expect({ writes: writerLog(h), screen: screen(h) }).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "Name? Sam\\nhi Sam\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentInputState ["stu-1",{"prompt":"Name? ","value":"","output":"Name? "}]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"Name? Sam\\nhi Sam\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })

  it('a scrub release Run that misses', async () => {
    mockModuleRun('python', printing('nope\n'))
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    expect(await pressRun(h, { source: 'scrub' })).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "nope\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": false,
        "checkAttempted": true,
        "checkSuggestion": "Print hi",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": null,
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"nope\\n","status":"success","checkPassed":false,"scrubPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":false,"suggestion":"Print hi","teacherAssisted":false,"error":false,"source":"scrub"}]
      writeStudentHintState ["stu-1",{"studentHint":{"text":"Print hi","source":"check","failStreak":0,"taskId":"t1","at":"<time>"}}]",
      }
    `)
  })
})

describe('handleRun characterization (turtle)', () => {
  it('passing Run', async () => {
    const turtle = { state: { x: 0, y: 0, heading: 0 }, commands: [] }
    mockModuleRun('turtle', printing('hi\n', 'success', { turtle }))
    const h = renderStudentCodeState({ lesson: turtleLesson(), currentTaskId: 't1' })
    expect(await pressRun(h)).toMatchInlineSnapshot(`
      {
        "screen": "{
        "running": false,
        "output": "hi\\n",
        "runStatus": "success",
        "errorLine": null,
        "inputPrompt": null,
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "",
        "checkFailCount": 0,
        "stageResult": null,
        "turtleResult": {
          "state": {
            "x": 0,
            "y": 0,
            "heading": 0
          },
          "commands": [],
          "runId": "<runId>"
        },
        "predictRunLock": null
      }",
        "writes": "typingStats.noteRun [{"copyCode":"<undefined>","work":"print(\\"start\\")"}]
      writeStudentRun ["stu-1",{"code":"print(\\"start\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentTurtleResult ["stu-1",{"state":{"x":0,"y":0,"heading":0},"commands":[]}]
      writeStudentTaskRun ["stu-1","t1","print(\\"start\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"start\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      writeStudentHintState ["stu-1",{"studentHint":null}]",
      }
    `)
  })
})
