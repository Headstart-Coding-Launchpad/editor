// Characterization: the student's personal sandbox (enter / edit / leave, storage keys
// with and without lessonModule.id) and teacher sandbox pushes, per module type.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actAsync,
  actSync,
  makeSession,
  mockModuleRun,
  personalSandboxFileKey,
  personalSandboxKey,
  renderStudentCodeState,
  storedKeys,
  taskKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeDesign,
  arcadeLesson,
  circuitJson,
  desktopLesson,
  electronicsLesson,
  filesystemLesson,
  fsWith,
  htmlFile,
  htmlLesson,
  normalisedArcadeDesign,
  normalisedDesktopWith,
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

const MODULE = { id: 'm1', type: 'python', title: 'Module 1' }

describe.each([
  ['without lessonModule.id', null],
  ['with lessonModule.id', 'm1'],
])('personal sandbox — python %s', (label, moduleId) => {
  const lesson = () => pythonLesson(moduleId ? { lessonModule: { ...MODULE, id: moduleId } } : {})
  const key = () => personalSandboxKey({ moduleId })

  it('enter loads sandboxStarter and reports the sandbox to the session', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.inPersonalSandbox).toBe(true)
    expect(h.result.current.code).toBe('# sandbox starter')
    expect(h.writers.writeStudentPersonalSandbox).toHaveBeenCalledWith(ANON, true)
  })

  it('edits save {code} under the sandbox key, never the task key', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleCodeChange('print("sandbox")'))
    expect(storedKeys()).toEqual([key()])
    expect(localStorage.getItem(key())).toBe('{"code":"print(\\"sandbox\\")"}')
  })

  it('leave snapshots the sandbox, reports it, and reloads the task', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleCodeChange('print("sandbox")'))
    localStorage.removeItem(key())
    actSync(() => h.result.current.handleLeavePersonalSandbox())
    expect(localStorage.getItem(key())).toBe('{"code":"print(\\"sandbox\\")"}')
    expect(h.writers.writeStudentPersonalSandbox).toHaveBeenLastCalledWith(ANON, false)
    expect(h.result.current.inPersonalSandbox).toBe(false)
    expect(h.result.current.code).toBe('print("start")')
  })

  it('re-entering restores the saved sandbox code', () => {
    writeStored(key(), { code: 'print("kept")' })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.code).toBe('print("kept")')
  })

  it('a run in the sandbox is free play and saves to the sandbox key', async () => {
    mockModuleRun('python', (cb) => {
      cb.onOutput('hi\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: '# sandbox starter',
      output: 'hi\n',
      status: 'success',
      checkPassed: undefined,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(storedKeys()).toEqual([key()])
    expect(JSON.parse(localStorage.getItem(key()))).toEqual({ code: '# sandbox starter' })
  })

  it('Reset in the sandbox restores sandboxStarter', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleCodeChange('print("sandbox")'))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe('# sandbox starter')
  })

  it('leaving the lesson phase exits the sandbox silently with a snapshot', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleCodeChange('print("sandbox")'))
    localStorage.clear()
    h.update({ phase: 'ended' })
    expect(h.result.current.inPersonalSandbox).toBe(false)
    expect(JSON.parse(localStorage.getItem(key()))).toEqual({ code: 'print("sandbox")' })
    expect(h.writers.writeStudentPersonalSandbox).toHaveBeenLastCalledWith(ANON, false)
  })
})

describe('personal sandbox — other module types (no lessonModule.id)', () => {
  it('turtle behaves like python', () => {
    const h = renderStudentCodeState({ lesson: turtleLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleCodeChange('forward(10)'))
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({ code: 'forward(10)' })
  })

  it('arcade: edits keep only {code}; leaving snapshots {code, arcadeDesign}', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.code).toBe('# arcade sandbox')
    expect(h.result.current.arcadeDesign).toBe(null)
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('sb')))
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({
      code: '# arcade sandbox',
    })
    actSync(() => h.result.current.handleLeavePersonalSandbox())
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({
      code: '# arcade sandbox',
      arcadeDesign: normalisedArcadeDesign('sb'),
    })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('sb'))
  })

  it('electronics: enters on the serialized sandbox circuit and saves {code}', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.code).toBe(circuitJson('sandbox'))
    actSync(() => h.result.current.handleCodeChange(circuitJson('sb')))
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({
      code: circuitJson('sb'),
    })
  })

  it('html: enters on sandboxStarterFiles and saves per-file sandbox keys', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.files).toEqual([htmlFile('<p>sandbox</p>')])
    actSync(() => h.result.current.handleFileChange('index.html', '<p>sb</p>'))
    expect(storedKeys()).toEqual([personalSandboxFileKey('index.html')])
    expect(JSON.parse(localStorage.getItem(personalSandboxFileKey('index.html')))).toEqual({
      content: '<p>sb</p>',
    })
    actSync(() => h.result.current.handleLeavePersonalSandbox())
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.files).toEqual([htmlFile('<p>sb</p>')])
  })

  it('html with lessonModule.id uses the module sandbox file key', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson({ lessonModule: { id: 'web', type: 'html' } }),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleFileChange('index.html', '<p>sb</p>'))
    expect(storedKeys()).toEqual(['headstart_lesson-1_module_web_sandbox_index.html_stu-1'])
  })

  it('filesystem: saves {fs} under the sandbox key and writes no run', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.fsState).toEqual(fsWith('sandbox.txt'))
    const next = fsWith('sandbox.txt', 'done.txt')
    actSync(() => h.result.current.handleFsChange(next))
    expect(storedKeys()).toEqual([personalSandboxKey()])
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({ fs: next })
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('filesystem Reset in the sandbox restores sandboxStarterFs', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleFsChange(fsWith('x.txt')))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.fsState).toEqual(fsWith('sandbox.txt'))
  })

  it('desktop: saves {desktop} under the module sandbox key', () => {
    const h = renderStudentCodeState({
      lesson: desktopLesson({ lessonModule: { id: 'd1', type: 'desktop' } }),
      currentTaskId: 't1',
    })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('sandbox.txt'))
    const next = normalisedDesktopWith('sandbox.txt', 'x.txt')
    actSync(() => h.result.current.handleDesktopChange(next))
    expect(storedKeys()).toEqual([personalSandboxKey({ moduleId: 'd1' })])
    expect(JSON.parse(localStorage.getItem(personalSandboxKey({ moduleId: 'd1' })))).toEqual({
      desktop: next,
    })
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })

  it('scratch: edits save {state} under the sandbox key', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('sb')))
    expect(storedKeys()).toEqual([personalSandboxKey()])
    expect(JSON.parse(localStorage.getItem(personalSandboxKey()))).toEqual({
      state: scratchBlocks('sb'),
    })
  })

  it('cannot be entered from teacher presentation', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
    })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    expect(h.result.current.inPersonalSandbox).toBe(false)
    expect(h.writers.writeStudentPersonalSandbox).not.toHaveBeenCalled()
  })

  it('leaving does not touch the task save', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    actSync(() => h.result.current.handleLeavePersonalSandbox())
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
  })
})

describe('teacher sandbox push (useSandboxCodePush through the hook)', () => {
  const pushSession = (sandboxCode, at = 1) => makeSession({ sandboxCode, sandboxCodePushedAt: at })

  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
    ['arcade', arcadeLesson],
  ])(
    '%s: pushed code replaces the editor, and a re-push of the same code re-applies',
    (type, lesson) => {
      const h = renderStudentCodeState({
        lesson: lesson(),
        currentTaskId: 't1',
        phase: 'sandbox',
        session: pushSession('print("pushed")'),
      })
      expect(h.result.current.code).toBe('print("pushed")')
      actSync(() => h.result.current.handleCodeChange('mine'))
      h.updateSession({ sandboxCodePushedAt: 2 })
      expect(h.result.current.code).toBe('print("pushed")')
    }
  )

  it('electronics: pushed circuit JSON goes into code', () => {
    const h = renderStudentCodeState({
      lesson: electronicsLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: pushSession(circuitJson('pushed')),
    })
    expect(h.result.current.code).toBe(circuitJson('pushed'))
  })

  it('filesystem / desktop / scratch parse the pushed JSON', () => {
    const fs = renderStudentCodeState({
      lesson: filesystemLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: pushSession(JSON.stringify(fsWith('pushed.txt'))),
    })
    expect(fs.result.current.fsState).toEqual(fsWith('pushed.txt'))

    const desktop = renderStudentCodeState({
      lesson: desktopLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: pushSession(JSON.stringify({ fs: fsWith('pushed.txt') })),
    })
    expect(desktop.result.current.desktopState).toEqual({
      ...normalisedDesktopWith('pushed.txt'),
      windows: [
        {
          id: 'fileManager-1',
          appId: 'fileManager',
          x: 80,
          y: 60,
          width: 640,
          height: 420,
          minimized: false,
          maximized: false,
          zIndex: 1,
        },
      ],
    })

    const scratch = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: pushSession(JSON.stringify(scratchBlocks('pushed'))),
    })
    expect(scratch.result.current.scratchSandboxProject).toEqual(scratchBlocks('pushed'))
  })

  it('html: decodes pushed sandboxFiles keys', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({
        sandboxFiles: { index__dot__html: '<p>pushed</p>', app__dot__js: 'go()' },
        sandboxFilesUpdatedAt: 1,
      }),
    })
    expect(h.result.current.files).toEqual([
      { name: 'index.html', content: '<p>pushed</p>', type: 'html' },
      { name: 'app.js', content: 'go()', type: 'js' },
    ])
    expect(h.result.current.activeFile).toBe('index.html')
  })

  it('html without pushed files falls back to sandboxStarterFiles', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
    })
    expect(h.result.current.files).toEqual([htmlFile('<p>sandbox</p>')])
  })

  it('pushes are ignored outside the sandbox phase', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: pushSession('print("pushed")'),
    })
    expect(h.result.current.code).toBe('print("start")')
  })
})
