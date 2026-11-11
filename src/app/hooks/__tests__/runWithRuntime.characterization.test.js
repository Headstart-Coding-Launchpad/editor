// Characterization of a pressed Run's tail (runWithRuntime), written before the judge/record
// split (request 131 design, phase 0). Every setter, writer, live, feedback and save function in
// ctx is a spy that appends to ONE ordered effect log, so the snapshots pin the exact calls, their
// arguments and their order for each kind of Run. A refactor of runWithRuntime must leave every
// snapshot byte for byte unchanged. Predicates (isWatchedNow, canPublishTeacherLive) and the pure
// payload builder are not logged; requestAnimationFrame never fires (the run's end paints the
// output itself), so the log is deterministic.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runWithRuntime } from '../runWithRuntime'
import { getModuleDefinition } from '../../../modules/definitions'

const ANON = 'stu-1'

beforeEach(() => {
  let rafId = 0
  vi.stubGlobal('requestAnimationFrame', () => {
    rafId += 1
    return rafId
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const checkedTask = (extra = {}) => ({
  id: 't1',
  check: { type: 'output_contains', value: 'hi', hint: 'Print hi' },
  ...extra,
})

// One line per effect: `name [args]`, undefined kept visible (a payload key set to undefined is
// part of the contract), the task shown by id and a Turtle runId (time based) masked.
function serialize(log, task) {
  return log
    .map(
      ([name, ...args]) =>
        `${name} ${JSON.stringify(args, (key, value) => {
          if (value === undefined) return '<undefined>'
          if (task && value === task) return `<task ${task.id}>`
          if (key === 'runId' && typeof value === 'string') return '<runId>'
          return value
        })}`
    )
    .join('\n')
}

/**
 * Builds a fully spied ctx and runs runWithRuntime. `script(callbacks, ctx)` plays the runtime
 * and returns its result. Returns { log, ctx, error } with `log` serialized.
 */
async function run({
  type = 'python',
  task = checkedTask(),
  script = (cb) => {
    cb.onOutput('hi\n', 'stdout')
    return { status: 'success' }
  },
  startCode = 'print("hi")',
  alreadySolved = false,
  phase = 'lesson',
  personal = false,
  teacherPresentation = false,
  watched = false,
  goLive = false,
  runOptions = undefined,
  panelContext = undefined,
  teacherAssisted = false,
  stillOnTask = true,
  writeStudentRun = () => Promise.resolve(),
  writeStudentStageResult = () => undefined,
  buildContext = undefined,
} = {}) {
  const log = []
  const spy =
    (name, impl = () => undefined) =>
    (...args) => {
      log.push([name, ...args])
      return impl(...args)
    }
  const base = getModuleDefinition(type)
  const definition = {
    ...base,
    checking: {
      ...base.checking,
      buildContext: spy('checking.buildContext', buildContext ?? base.checking.buildContext),
    },
  }
  let code = startCode
  const ctx = {
    actor: { anonymousId: ANON },
    task,
    definition,
    runtime: {
      run: async (runCode, runTask, callbacks) => {
        const flags = {}
        if (callbacks.slowMo) flags.slowMo = true
        if (callbacks.freePlay) flags.freePlay = true
        log.push(['runtime.run', runCode, runTask?.id ?? null, flags])
        const result = await script(callbacks, ctx)
        if (!stillOnTask) ctx.refs.currentTaskIdRef.current = 'other'
        return result
      },
      provideInput: spy('runtime.provideInput'),
    },
    startCode,
    currentTaskId: 't1',
    isWatched: watched,
    isWatchedNow: () => watched,
    alreadySolved,
    teacherPresentation,
    readCode: () => code,
    setCode: spy('setCode', (next) => {
      code = next
    }),
    refs: {
      outputRafIdRef: { current: null },
      outputMirrorRef: { current: null },
      inputPromptRef: { current: null },
      inputValueRef: { current: '' },
      submitInputEchoRef: { current: null },
      appendOutputRef: { current: null },
      runEpochRef: { current: 0 },
      runtimeCodeRafIdRef: { current: null },
      pendingRuntimeCodeRef: { current: null },
      lastRuntimeCodeWriteRef: { current: 0 },
      currentTaskIdRef: { current: 't1' },
      phaseRef: { current: phase },
      inPersonalSandboxRef: { current: personal },
      teacherAssistedTaskIdsRef: { current: new Set(teacherAssisted ? ['t1'] : []) },
    },
    setters: {
      setOutput: spy('setOutput'),
      setInputPrompt: spy('setInputPrompt'),
      setErrorLine: spy('setErrorLine'),
      setRunStatus: spy('setRunStatus'),
      setTurtleResult: spy('setTurtleResult'),
      setStageResult: spy('setStageResult'),
      setRunning: spy('setRunning'),
    },
    writers: {
      writeStudentInputState: spy('writeStudentInputState'),
      writeStudentOutput: spy('writeStudentOutput'),
      writeStudentCode: spy('writeStudentCode'),
      writeStudentRun: spy('writeStudentRun', writeStudentRun),
      writeStudentTurtleResult: spy('writeStudentTurtleResult'),
      writeStudentStageResult: spy('writeStudentStageResult', writeStudentStageResult),
      writeStudentTaskRun: spy('writeStudentTaskRun'),
      logAttempt: spy('logAttempt'),
    },
    live: {
      canPublishTeacherLive: () => goLive,
      updateTeacherLive: spy('updateTeacherLive'),
      currentTeacherLivePayload: (extra) => ({ live: 'payload', ...extra }),
      publishTeacherLive: spy('publishTeacherLive'),
    },
    feedback: {
      applyCheckFeedback: spy('applyCheckFeedback'),
      updateTargetedStageOffer: spy('updateTargetedStageOffer'),
      updateSupportStageForAttempt: spy('updateSupportStageForAttempt'),
    },
    saveRunRecord: spy('saveRunRecord'),
    signals: { reportSandboxRun: spy('signals.reportSandboxRun') },
    variablesPanel: {
      receiveRun: spy('variablesPanel.receiveRun', () => panelContext ?? {}),
    },
    runOptions: runOptions
      ? {
          ...runOptions,
          ...(runOptions.onResult ? { onResult: spy('runOptions.onResult') } : {}),
        }
      : undefined,
    onInputAnswer: spy('onInputAnswer'),
    recordCourseRun: spy('recordCourseRun'),
  }
  let error = null
  try {
    await runWithRuntime(ctx)
  } catch (err) {
    error = err
  }
  return { log: serialize(log, task), ctx, error }
}

describe('runWithRuntime characterization: outcomes', () => {
  it('passing Run in a live lesson', async () => {
    const { log } = await run()
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('failing Run carries the check hint', async () => {
    const { log } = await run({
      script: (cb) => {
        cb.onOutput('nope\n', 'stdout')
        return { status: 'success' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["nope\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]},false]
      applyCheckFeedback [false,"Print hi",{"scrub":false,"evaluation":{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]}}]
      updateSupportStageForAttempt [false]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"nope\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"nope\\n","status":"success","checkPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":false,"suggestion":"Print hi","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('error Run: error line, error name, errorText', async () => {
    const { log } = await run({
      script: (cb) => {
        cb.onOutput("Line 1: NameError: name 'x' is not defined\n", 'stderr', 1)
        return { status: 'error' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setErrorLine [1]
      setInputPrompt [null]
      setOutput ["Line 1: NameError: name 'x' is not defined\\n"]
      setRunStatus ["error"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"error","result":{"status":"error"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"error","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},false]
      applyCheckFeedback [false,"",{"scrub":false,"evaluation":{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [false]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"Line 1: NameError: name 'x' is not defined\\n","runStatus":"error"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"Line 1: NameError: name 'x' is not defined\\n","status":"error","checkPassed":false,"errorText":"Line 1: NameError: name 'x' is not defined"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":false,"suggestion":"","teacherAssisted":false,"error":"NameError"}]
      setRunning [false]"
    `)
  })

  it('already-solved Run keeps passed and logs no attempt', async () => {
    const { log } = await run({
      alreadySolved: true,
      script: (cb) => {
        cb.onOutput('nope\n', 'stdout')
        return { status: 'success' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["nope\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"nope\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"nope\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      setRunning [false]"
    `)
  })

  it('task without a check: no feedback check, no attempt', async () => {
    const { log } = await run({ task: { id: 't1' } })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      setRunning [false]"
    `)
  })

  it('a teacher-assisted task logs teacherAssisted: true', async () => {
    const { log } = await run({ teacherAssisted: true })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":true,"error":false}]
      setRunning [false]"
    `)
  })

  it('a task with tests never passes on Run and logs nothing', async () => {
    const { log } = await run({
      task: checkedTask({
        check: undefined,
        tests: [{ id: 'a', check: { type: 'output_contains', value: 'hi' } }],
      }),
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":"<undefined>","errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      setRunning [false]"
    `)
  })

  it('name-tag panel extras reach the check context', async () => {
    const { log } = await run({ panelContext: { variablePredictions: { x: 1 } } })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true,"variablePredictions":{"x":1}}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: where the Run happens', () => {
  it('free play: the teacher sandbox phase', async () => {
    const { log } = await run({ phase: 'sandbox' })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{"freePlay":true}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":null,"status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":"<undefined>","errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      signals.reportSandboxRun [{"error":false,"submission":"print(\\"hi\\")"}]
      setRunning [false]"
    `)
  })

  it('free play: the personal sandbox', async () => {
    const { log } = await run({ personal: true })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{"freePlay":true}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":null,"status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":"<undefined>","errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      signals.reportSandboxRun [{"error":false,"submission":"print(\\"hi\\")"}]
      setRunning [false]"
    `)
  })

  it('teacher presentation', async () => {
    const { log } = await run({ teacherPresentation: true })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      setRunning [false]"
    `)
  })

  it('solo', async () => {
    const { log } = await run({ phase: 'solo' })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      setRunning [false]"
    `)
  })

  it('watched by the tutor (activeStudentView)', async () => {
    const { log } = await run({ watched: true })
    expect(log).toMatchInlineSnapshot(`
      "writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":""}]
      runtime.run ["print(\\"hi\\")","t1",{}]
      writeStudentOutput ["stu-1","hi\\n"]
      setInputPrompt [null]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('the Go Live source', async () => {
    const { log } = await run({ goLive: true })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      updateTeacherLive [{"live":"payload","output":"hi\\n"}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      publishTeacherLive [{"code":"print(\\"hi\\")","output":"hi\\n","runStatus":"success","checkPassed":true,"checkAttempted":true,"checkSuggestion":""}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('solo while watched (isWatched writes the run)', async () => {
    const { log } = await run({ phase: 'solo', watched: true })
    expect(log).toMatchInlineSnapshot(`
      "writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":""}]
      runtime.run ["print(\\"hi\\")","t1",{}]
      writeStudentOutput ["stu-1","hi\\n"]
      setInputPrompt [null]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: run kinds', () => {
  it('scrub release, passing', async () => {
    const { log } = await run({ runOptions: { source: 'scrub' } })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":true,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"scrubPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false,"source":"scrub"}]
      setRunning [false]"
    `)
  })

  it('scrub release, miss', async () => {
    const { log } = await run({
      runOptions: { source: 'scrub' },
      script: (cb) => {
        cb.onOutput('nope\n', 'stdout')
        return { status: 'success' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["nope\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]},false]
      applyCheckFeedback [false,"Print hi",{"scrub":true,"evaluation":{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]}}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"nope\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"nope\\n","status":"success","checkPassed":false,"scrubPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":false,"suggestion":"Print hi","teacherAssisted":false,"error":false,"source":"scrub"}]
      setRunning [false]"
    `)
  })

  it('scrub release on a solved task that now fails', async () => {
    const { log } = await run({
      alreadySolved: true,
      runOptions: { source: 'scrub' },
      script: (cb) => {
        cb.onOutput('nope\n', 'stdout')
        return { status: 'success' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["nope\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"nope\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"nope\\n","status":"success","checkPassed":true,"scrubPassed":false,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      setRunning [false]"
    `)
  })

  it('slow-mo Run hands the result to onResult first', async () => {
    const { log } = await run({ runOptions: { slowMo: true, onResult: true } })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{"slowMo":true}]
      runOptions.onResult [{"status":"success"}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('Python Stage drawing and target reach the context and the writes', async () => {
    const stage = { commands: [{ type: 'circle', x: 200, y: 200, r: 50, colour: '#ff0000' }] }
    const { log } = await run({
      task: checkedTask({ check: { type: 'stage_colour_used', colour: 'red' } }),
      script: () => ({ status: 'success', stage, stageTarget: { commands: [] } }),
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput [""]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [{"commands":[{"type":"circle","x":200,"y":200,"r":50,"colour":"#ff0000"}]}]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success","stage":{"commands":[{"type":"circle","x":200,"y":200,"r":50,"colour":"#ff0000"}]},"stageTarget":{"commands":[]}},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[{"type":"circle","x":200,"y":200,"r":50,"colour":"#ff0000"}],"target":{"commands":[]}},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",{"commands":[{"type":"circle","x":200,"y":200,"r":50,"colour":"#ff0000"}]}]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('Turtle drawing with a course run', async () => {
    const turtle = { state: { x: 0, y: 0, heading: 0 }, commands: [], course: { id: 'c1' } }
    const { log } = await run({
      type: 'turtle',
      script: (cb) => {
        cb.onOutput('hi\n', 'stdout')
        return { status: 'success', turtle }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [{"state":{"x":0,"y":0,"heading":0},"commands":[],"course":{"id":"c1"},"runId":"<runId>"}]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success","turtle":{"state":{"x":0,"y":0,"heading":0},"commands":[],"course":{"id":"c1"}}},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":{"state":{"x":0,"y":0,"heading":0},"commands":[],"course":{"id":"c1"}},"stage":null,"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentTurtleResult ["stu-1",{"state":{"x":0,"y":0,"heading":0},"commands":[],"course":{"id":"c1"}}]
      recordCourseRun [{"id":"c1"}]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('Turtle slow-mo drawing has no runId', async () => {
    const turtle = { state: { x: 0, y: 0, heading: 0 }, commands: [] }
    const { log } = await run({
      type: 'turtle',
      runOptions: { slowMo: true },
      script: () => ({ status: 'success', turtle }),
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{"slowMo":true}]
      setInputPrompt [null]
      setOutput [""]
      setRunStatus ["success"]
      setTurtleResult [{"state":{"x":0,"y":0,"heading":0},"commands":[]}]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success","turtle":{"state":{"x":0,"y":0,"heading":0},"commands":[]}},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":{"state":{"x":0,"y":0,"heading":0},"commands":[]},"stage":null,"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]},false]
      applyCheckFeedback [false,"Print hi",{"scrub":false,"evaluation":{"passed":false,"completionPassed":false,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"Print hi","hintLadder":["Print hi"]}}]
      updateSupportStageForAttempt [false]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"","status":"success","checkPassed":false,"errorText":"<undefined>"}]
      writeStudentTurtleResult ["stu-1",{"state":{"x":0,"y":0,"heading":0},"commands":[]}]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":false,"suggestion":"Print hi","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('Electronics: updatedCode becomes the code', async () => {
    const { log } = await run({
      type: 'electronics',
      task: { id: 't1' },
      startCode: '{"a":1}',
      script: () => ({ status: 'success', updatedCode: '{"a":2}' }),
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["{\\"a\\":1}","t1",{}]
      setInputPrompt [null]
      setOutput [""]
      setRunStatus ["success"]
      setCode ["{\\"a\\":2}"]
      setTurtleResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success","updatedCode":"{\\"a\\":2}"},"code":"{\\"a\\":1}"}]
      checking.buildContext ["{\\"a\\":2}",{"status":"success","variables":{},"turtle":null,"stage":null,"ran":true}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","{\\"a\\":2}",{"output":"","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"{\\"a\\":2}","output":"","status":"success","checkPassed":false,"errorText":"<undefined>"}]
      writeStudentTaskRun ["stu-1","t1","{\\"a\\":2}"]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: input()', () => {
  const asking = (cb, ctx) => {
    cb.onOutput('Name? ', 'stdout')
    cb.onInputRequired('Name? ', { stage: { commands: [{ type: 'background', colour: 'navy' }] } })
    ctx.refs.submitInputEchoRef.current('Sam')
    cb.onOutput('hi Sam\n', 'stdout')
    return { status: 'success' }
  }

  it('typed answer while unwatched', async () => {
    const { log } = await run({ script: asking })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt ["Name? "]
      setStageResult [{"commands":[{"type":"background","colour":"navy"}]}]
      writeStudentStageResult ["stu-1",{"commands":[{"type":"background","colour":"navy"}]}]
      writeStudentInputState ["stu-1",{"prompt":"Name? ","value":"","output":"Name? "}]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      setInputPrompt [null]
      setOutput ["Name? Sam\\nhi Sam\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"Name? Sam\\nhi Sam\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"Name? Sam\\nhi Sam\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('typed answer while watched', async () => {
    const { log } = await run({ script: asking, watched: true })
    expect(log).toMatchInlineSnapshot(`
      "writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":""}]
      runtime.run ["print(\\"hi\\")","t1",{}]
      writeStudentOutput ["stu-1","Name? "]
      setInputPrompt ["Name? "]
      setStageResult [{"commands":[{"type":"background","colour":"navy"}]}]
      writeStudentStageResult ["stu-1",{"commands":[{"type":"background","colour":"navy"}]}]
      writeStudentInputState ["stu-1",{"prompt":"Name? ","value":"","output":"Name? "}]
      writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":"Name? Sam\\n"}]
      setInputPrompt [null]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      setOutput ["Name? Sam\\nhi Sam\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"Name? Sam\\nhi Sam\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"Name? Sam\\nhi Sam\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('a scrub replays the last Run answers', async () => {
    const { log } = await run({
      runOptions: { source: 'scrub', inputAnswers: ['Sam'] },
      script: (cb) => {
        cb.onOutput('Name? ', 'stdout')
        cb.onInputRequired('Name? ')
        cb.onOutput('hi Sam\n', 'stdout')
        return { status: 'success' }
      },
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      onInputAnswer ["Sam"]
      runtime.provideInput ["Sam"]
      setInputPrompt [null]
      setOutput ["Name? Sam\\nhi Sam\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":true,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"Name? Sam\\nhi Sam\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"Name? Sam\\nhi Sam\\n","status":"success","checkPassed":true,"scrubPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false,"source":"scrub"}]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: stopped', () => {
  const stopped = (cb) => {
    cb.onOutput('part\n', 'stdout')
    return { status: 'stopped' }
  }

  it('a stopped Run reports nothing', async () => {
    const { log } = await run({ script: stopped, watched: true, goLive: true })
    expect(log).toMatchInlineSnapshot(`
      "writeStudentInputState ["stu-1",{"prompt":null,"value":"","output":""}]
      runtime.run ["print(\\"hi\\")","t1",{}]
      updateTeacherLive [{"live":"payload","output":"part\\n"}]
      writeStudentOutput ["stu-1","part\\n"]
      setInputPrompt [null]
      writeStudentInputState ["stu-1",{"prompt":null,"value":""}]
      setOutput ["part\\n"]
      updateTeacherLive [{"live":"payload","code":"print(\\"hi\\")","output":"part\\n"}]
      writeStudentCode ["stu-1","print(\\"hi\\")"]
      writeStudentOutput ["stu-1","part\\n"]
      setRunning [false]"
    `)
  })

  it('a stopped Run after leaving the task does not repaint', async () => {
    const { log } = await run({ script: stopped, stillOnTask: false })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setRunning [false]"
    `)
  })

  it('a stopped run_attempted-only Run counts as a finished run', async () => {
    const { log } = await run({
      script: stopped,
      task: checkedTask({ check: { type: 'run_attempted' } }),
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["part\\n"]
      setRunStatus ["stopped"]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"stopped","result":{"status":"stopped"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"stopped","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"part\\n","runStatus":"stopped"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"part\\n","status":"stopped","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      writeStudentTaskRun ["stu-1","t1","print(\\"hi\\")"]
      logAttempt ["stu-1","t1",{"submission":"print(\\"hi\\")","passed":true,"suggestion":"","teacherAssisted":false,"error":false}]
      setRunning [false]"
    `)
  })

  it('a stopped Electronics (liveCode) Run still saves', async () => {
    const { log } = await run({
      type: 'electronics',
      task: { id: 't1' },
      startCode: '{"a":1}',
      script: stopped,
    })
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["{\\"a\\":1}","t1",{}]
      setInputPrompt [null]
      setOutput ["part\\n"]
      saveRunRecord ["t1","{\\"a\\":1}",{"output":"part\\n"}]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: a rejected writeStudentRun', () => {
  it('rejects the Run before the rest of the record, and still ends it (finally)', async () => {
    const { log, error } = await run({
      writeStudentRun: () => Promise.reject(new Error('PERMISSION_DENIED')),
    })
    expect(error?.message).toBe('PERMISSION_DENIED')
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      setRunning [false]"
    `)
  })
})

describe('runWithRuntime characterization: a throw in the Run tail', () => {
  it('a throwing writeStudentStageResult rejects the Run and still ends it once', async () => {
    const { log, error } = await run({
      writeStudentStageResult: () => {
        throw new Error('stage write broke')
      },
    })
    expect(error?.message).toBe('stage write broke')
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      updateTargetedStageOffer ["<task t1>",{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]},true]
      applyCheckFeedback [true,"",{"scrub":false,"evaluation":{"passed":true,"completionPassed":true,"feedbackResults":[],"matchedFeedback":null,"stageOffer":null,"blockingFeedback":null,"nudgeFeedback":null,"suggestion":"","hintLadder":[]}}]
      updateSupportStageForAttempt [true]
      saveRunRecord ["t1","print(\\"hi\\")",{"output":"hi\\n","runStatus":"success"}]
      writeStudentRun ["stu-1",{"code":"print(\\"hi\\")","output":"hi\\n","status":"success","checkPassed":true,"errorText":"<undefined>"}]
      writeStudentStageResult ["stu-1",null]
      setRunning [false]"
    `)
  })

  it('a throwing check rejects the Run before any feedback or record and still ends it', async () => {
    const { log, error } = await run({
      buildContext: () => {
        throw new Error('check broke')
      },
    })
    expect(error?.message).toBe('check broke')
    expect(log).toMatchInlineSnapshot(`
      "runtime.run ["print(\\"hi\\")","t1",{}]
      setInputPrompt [null]
      setOutput ["hi\\n"]
      setRunStatus ["success"]
      setTurtleResult [null]
      setStageResult [null]
      variablesPanel.receiveRun [{"task":"<task t1>","status":"success","result":{"status":"success"},"code":"print(\\"hi\\")"}]
      checking.buildContext ["print(\\"hi\\")",{"status":"success","variables":{},"turtle":null,"stage":{"commands":[],"target":null},"ran":true}]
      setRunning [false]"
    `)
  })
})
