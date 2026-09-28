// Characterization: where work is persisted — saveCurrentWork snapshots per module,
// the in-memory (ephemeral) store used by teacher presentation and builder preview,
// composed lessons using the per-task effective module type, and the storage readers'
// handling of corrupt values.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  LESSON_ID,
  actAsync,
  actSync,
  mockModuleRun,
  makeSession,
  personalSandboxKey,
  renderStudentCodeState,
  storedKeys,
  studentSourcedTeacherLive,
  taskKey,
  fileKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeLesson,
  circuitJson,
  composedLesson,
  desktopLesson,
  electronicsLesson,
  filesystemLesson,
  fsWith,
  htmlLesson,
  normalisedArcadeDesign,
  normalisedDesktopWith,
  pythonLesson,
  scratchBlocks,
  scratchLesson,
} from '../../../test/fixtures/studentCodeStateLessons'
import {
  loadPersonalSandboxDesktop,
  loadSavedCode,
  loadSavedDesktop,
  loadSavedFs,
} from '../../studentStorage'

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

// ── saveCurrentWork (called by StudentView before a task change) ──────────────

describe('saveCurrentWork', () => {
  it('python: {code, output, runStatus}', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.saveCurrentWork())
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      '{"code":"print(\\"start\\")","output":"","runStatus":null}'
    )
  })

  it('arcade: adds the design', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.saveCurrentWork())
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 1',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
  })

  it('electronics: {code} only', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.saveCurrentWork())
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('starter') })
    )
  })

  it('html: one {content} record per file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.saveCurrentWork())
    expect(storedKeys()).toEqual([fileKey('t1', 'index.html'), fileKey('t1', 'style.css')])
  })

  it('filesystem / desktop: {fs} / {desktop}', () => {
    const f = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => f.result.current.saveCurrentWork())
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({ fs: fsWith('start.txt') })
    localStorage.clear()
    const d = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    actSync(() => d.result.current.saveCurrentWork())
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      desktop: normalisedDesktopWith('start.txt'),
    })
  })

  it('scratch saves nothing (blocks are saved on every change)', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.saveCurrentWork())
    expect(storedKeys()).toEqual([])
  })

  it('skips quiz / information tasks and the personal sandbox', () => {
    const lesson = pythonLesson()
    lesson.tasks.push({ id: 'q1', title: 'Quiz', taskType: 'quiz', quizType: 'multiple_choice' })
    const q = renderStudentCodeState({ lesson, currentTaskId: 'q1' })
    actSync(() => q.result.current.saveCurrentWork())
    expect(storedKeys()).toEqual([])

    const s = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => s.result.current.handleEnterPersonalSandbox())
    actSync(() => s.result.current.saveCurrentWork())
    expect(storedKeys()).toEqual([])
  })
})

// ── Presentation / preview in-memory persistence ─────────────────────────────

describe.each([
  ['teacher presentation', { teacherPresentation: true }],
  ['builder preview', { previewMode: true }],
])('in-memory persistence — %s', (label, mode) => {
  it('code edits go to the in-memory store, never localStorage', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...mode })
    actSync(() => h.result.current.handleCodeChange('print("mem")'))
    expect(storedKeys()).toEqual([])
    expect(h.result.current.readSavedTaskCode('t1')).toEqual({
      code: 'print("mem")',
      output: '',
      runStatus: null,
    })
    expect(loadSavedCode(LESSON_ID, 't1', ANON)).toBe(null)
  })

  it('carry-through reads the in-memory store', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...mode })
    actSync(() => h.result.current.handleCodeChange('print("mem")'))
    actSync(() => h.result.current.saveCurrentWork())
    h.update({ currentTaskId: 't2' })
    expect(h.result.current.code).toBe('print("mem")')
    expect(storedKeys()).toEqual([])
  })

  it('ignores real localStorage saves when loading', () => {
    writeStored(taskKey('t1'), { fs: fsWith('real.txt') })
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1', ...mode })
    expect(h.result.current.fsState).toEqual(fsWith('start.txt'))
  })

  it('filesystem / desktop / html / scratch saves stay in memory', () => {
    const f = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1', ...mode })
    actSync(() => f.result.current.handleFsChange(fsWith('mem.txt')))
    expect(f.result.current.readSavedTaskFs('t1')).toEqual(fsWith('mem.txt'))
    f.unmount()

    const d = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1', ...mode })
    actSync(() => d.result.current.handleDesktopChange(normalisedDesktopWith('mem.txt')))
    expect(d.result.current.readSavedTaskDesktop('t1')).toEqual(normalisedDesktopWith('mem.txt'))
    d.unmount()

    const html = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1', ...mode })
    actSync(() => html.result.current.handleFileChange('index.html', '<p>mem</p>'))
    expect(html.result.current.readSavedTaskFile('t1', 'index.html')).toBe('<p>mem</p>')
    html.unmount()

    const s = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1', ...mode })
    actSync(() => s.result.current.handleScratchChange(scratchBlocks('mem')))
    expect(s.result.current.readSavedTaskCode('t1')).toEqual({ state: scratchBlocks('mem') })

    expect(storedKeys()).toEqual([])
  })

  it('the in-memory store is cleared when a new presentation/preview mounts', () => {
    const first = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...mode })
    actSync(() => first.result.current.handleCodeChange('print("old")'))
    first.unmount()
    const second = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...mode })
    expect(second.result.current.readSavedTaskCode('t1')).toBe(null)
  })

  it('filesystem changes write no run to Firebase in presentation (lesson phase only)', () => {
    const h = renderStudentCodeState({
      lesson: filesystemLesson(),
      currentTaskId: 't1',
      ...mode,
    })
    actSync(() => h.result.current.handleFsChange(fsWith('start.txt', 'done.txt')))
    if (mode.teacherPresentation) {
      expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    } else {
      // Builder preview is not teacherPresentation: the lesson-phase write still happens.
      expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    }
  })
})

describe('in-memory persistence — runs', () => {
  it('a presentation run saves in memory and writes nothing to Firebase', async () => {
    mockModuleRun('python', (cb) => {
      cb.onOutput('hi\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
    })
    await actAsync(() => h.result.current.handleRun())
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(storedKeys()).toEqual([])
    expect(h.result.current.readSavedTaskCode('t1')).toEqual({
      code: 'print("start")',
      output: 'hi\n',
      runStatus: 'success',
    })
  })

  // Known bug (plan step 1.5): handleScratchCheck falls back to raw localStorage for
  // the workspace state, so in builder preview the run write has no code.
  it.fails('known bug: scratch check in preview falls back to the in-memory store', () => {
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      previewMode: true,
    })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('preview')))
    actSync(() => h.result.current.handleScratchCheck(false, {}))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(scratchBlocks('preview')),
      status: 'success',
      checkPassed: false,
    })
  })
})

// ── Composed lessons ──────────────────────────────────────────────────────────

describe('composed lesson: python → filesystem → python', () => {
  it('uses the per-task effective module type for load, change, publish and carry', () => {
    const h = renderStudentCodeState({
      lesson: composedLesson(),
      currentTaskId: 'c1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    expect(h.result.current.code).toBe('x = 1')
    actSync(() => h.result.current.handleCodeChange('x = 2'))
    expect(JSON.parse(localStorage.getItem(taskKey('c1')))).toEqual({
      code: 'x = 2',
      output: '',
      runStatus: null,
    })
    expect(h.writers.updateTeacherLive.mock.calls.at(-1)[0]).toMatchObject({
      lessonType: 'python',
      taskId: 'c1',
      code: 'x = 2',
    })

    // StudentView: saveCurrentWork + resetForTaskChange, then the new task id.
    actSync(() => h.result.current.saveCurrentWork())
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 'c2' })
    expect(h.result.current.fsState).toEqual(fsWith('c2.txt'))
    h.writers.writeStudentRun.mockClear()
    actSync(() => h.result.current.handleFsChange(fsWith('c2.txt', 'new.txt')))
    expect(JSON.parse(localStorage.getItem(taskKey('c2')))).toEqual({
      fs: fsWith('c2.txt', 'new.txt'),
    })
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(fsWith('c2.txt', 'new.txt')),
      status: null,
      checkPassed: false,
    })
    expect(h.writers.updateTeacherLive.mock.calls.at(-1)[0]).toMatchObject({
      lessonType: 'filesystem',
      taskId: 'c2',
      code: JSON.stringify(fsWith('c2.txt', 'new.txt')),
      files: {},
    })
    // The python task's record is untouched by the filesystem task.
    expect(JSON.parse(localStorage.getItem(taskKey('c1'))).code).toBe('x = 2')

    actSync(() => h.result.current.saveCurrentWork())
    expect(JSON.parse(localStorage.getItem(taskKey('c2')))).toEqual({
      fs: fsWith('c2.txt', 'new.txt'),
    })
    actSync(() => h.result.current.resetForTaskChange())
    h.update({ currentTaskId: 'c3' })
    expect(h.result.current.code).toBe('x = 2')
    expect(h.result.current.buildShareSnapshot()).toMatchObject({
      lessonType: 'python',
      taskId: 'c3',
      code: 'x = 2',
    })
  })

  it('the personal sandbox of a composed module uses the module sandbox key', () => {
    const h = renderStudentCodeState({ lesson: composedLesson(), currentTaskId: 'c1' })
    actSync(() => h.result.current.handleEnterPersonalSandbox())
    // Effective lesson's sandboxStarter comes from the module's first code task.
    expect(h.result.current.code).toBe('x = 1')
    actSync(() => h.result.current.handleCodeChange('sandbox'))
    expect(storedKeys()).toEqual([personalSandboxKey({ moduleId: 'python' })])
  })
})

// ── Storage readers and corrupt values ────────────────────────────────────────

describe('studentStorage readers with corrupt values', () => {
  it('loadSavedCode / loadSavedFs self-heal: null and the key is removed', () => {
    localStorage.setItem(taskKey('t1'), '{not json')
    expect(loadSavedCode(LESSON_ID, 't1', ANON)).toBe(null)
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
    localStorage.setItem(taskKey('t1'), '{not json')
    expect(loadSavedFs(LESSON_ID, 't1', ANON)).toBe(null)
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
  })

  // Known bug (plan step 1.5): the desktop readers use bare JSON.parse.
  it.fails('known bug: loadSavedDesktop returns null for a corrupt value', () => {
    localStorage.setItem(taskKey('t1'), '{not json')
    expect(loadSavedDesktop(LESSON_ID, 't1', ANON)).toBe(null)
  })

  it.fails('known bug: loadPersonalSandboxDesktop returns null for a corrupt value', () => {
    localStorage.setItem(personalSandboxKey(), '{not json')
    expect(loadPersonalSandboxDesktop(LESSON_ID, ANON)).toBe(null)
  })

  it.fails('known bug: a corrupt desktop save does not break loading the task', () => {
    localStorage.setItem(taskKey('t1'), '{not json')
    // React logs the thrown effect error; keep the expected failure quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('start.txt'))
  })
})
