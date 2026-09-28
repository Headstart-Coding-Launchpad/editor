// Characterization: what reaches the teacher — watch-start publishes when
// activeStudentView flips to this student, teacher-edit apply, the Go Live
// teacherLive payload (including its explicit nulls), and the share snapshot.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  STUDENT_NAME,
  actAsync,
  actSync,
  fileKey,
  makeSession,
  mockModuleRun,
  renderStudentCodeState,
  studentSourcedTeacherLive,
  taskKey,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeDesign,
  arcadeLesson,
  circuitJson,
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
  vi.useRealTimers()
})

function startWatching(h) {
  Object.values(h.writers).forEach((fn) => fn.mockClear())
  h.updateSession({ activeStudentView: ANON })
}

// ── Watch start ───────────────────────────────────────────────────────────────

describe('watch start (activeStudentView flips to this student)', () => {
  it.each([
    ['python', pythonLesson, 'edited'],
    ['turtle', turtleLesson, 'edited'],
    ['arcade', arcadeLesson, 'edited'],
    ['electronics', electronicsLesson, circuitJson('edited')],
  ])('%s: publishes code, output, input state and interaction', (type, lesson, code) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(code))
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    startWatching(h)
    expect(h.writers.writeStudentCode.mock.calls).toEqual([[ANON, code]])
    expect(h.writers.writeStudentOutput.mock.calls).toEqual([[ANON, '']])
    expect(h.writers.writeStudentInputState.mock.calls).toEqual([
      [ANON, { prompt: null, value: '' }],
    ])
    expect(h.writers.writeStudentInteraction.mock.calls).toEqual([
      [ANON, { selection: null, activeFile: undefined }],
    ])
    // Watch start does not re-send an arcade design or turtle result.
    expect(h.writers.writeStudentArcadeDesign).not.toHaveBeenCalled()
    expect(h.writers.writeStudentTurtleResult).not.toHaveBeenCalled()
    expect(h.writers.writeStudentFiles).not.toHaveBeenCalled()
  })

  it('html: publishes the raw-named file map and the active file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleEditorSelection({ from: 0, to: 3 }, 'index.html'))
    startWatching(h)
    expect(h.writers.writeStudentFiles.mock.calls).toEqual([
      [ANON, { 'index.html': '<p>start</p>', 'style.css': 'p {}' }],
    ])
    expect(h.writers.writeStudentInteraction.mock.calls).toEqual([
      [ANON, { selection: { from: 0, to: 3, file: 'index.html' }, activeFile: 'index.html' }],
    ])
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    expect(h.writers.writeStudentOutput).not.toHaveBeenCalled()
  })

  it('scratch: publishes the saved workspace state from localStorage', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('edited')))
    startWatching(h)
    expect(h.writers.writeStudentCode.mock.calls).toEqual([
      [ANON, JSON.stringify(scratchBlocks('edited'))],
    ])
  })

  it('scratch with nothing saved publishes no code', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    startWatching(h)
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    expect(h.writers.writeStudentInteraction).toHaveBeenCalledTimes(1)
  })

  it('filesystem / desktop: publish the JSON state as code', () => {
    const fs = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    startWatching(fs)
    expect(fs.writers.writeStudentCode.mock.calls).toEqual([
      [ANON, JSON.stringify(fsWith('start.txt'))],
    ])

    const desktop = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    startWatching(desktop)
    expect(desktop.writers.writeStudentCode.mock.calls).toEqual([
      [ANON, JSON.stringify(normalisedDesktopWith('start.txt'))],
    ])
  })

  it('code_arrange tasks also publish the current slot placement', () => {
    const lesson = pythonLesson()
    lesson.tasks[0] = { ...lesson.tasks[0], taskType: 'code_arrange' }
    const h = renderStudentCodeState({ lesson, currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeArrangeSlotsChange({ s1: 'tile-a' }))
    startWatching(h)
    expect(h.writers.writeStudentCodeArrangeSlots.mock.calls).toEqual([[ANON, { s1: 'tile-a' }]])
  })

  it.each([
    ['viewing an earlier task', { viewingTaskId: 't3' }],
    ['in solo', { phase: 'solo' }],
    ['in teacher presentation', { teacherPresentation: true }],
  ])('publishes nothing when %s', (label, props) => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1', ...props })
    startWatching(h)
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    expect(h.writers.writeStudentInteraction).not.toHaveBeenCalled()
  })

  it('also publishes in the teacher sandbox phase', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ sandboxCode: 'print("s")', sandboxCodePushedAt: 1 }),
    })
    startWatching(h)
    expect(h.writers.writeStudentCode.mock.calls).toEqual([[ANON, 'print("s")']])
  })

  // Known bug (plan step 1.5): watch start reads scratch state straight from
  // localStorage, bypassing the in-memory store used in builder preview.
  it.fails('known bug: scratch watch start in preview reads the in-memory store', () => {
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      previewMode: true,
    })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('preview')))
    startWatching(h)
    expect(h.writers.writeStudentCode).toHaveBeenCalledWith(
      ANON,
      JSON.stringify(scratchBlocks('preview'))
    )
  })
})

// ── Teacher edit apply ────────────────────────────────────────────────────────

describe('teacher edit apply (teacherEditAppliedAt)', () => {
  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
  ])('%s: replaces code and persists {code, output, runStatus}', (type, lesson) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    h.updateStudent({ teacherEditAppliedAt: 1, teacherEditApplyCode: 'print("teacher")' })
    expect(h.result.current.code).toBe('print("teacher")')
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      '{"code":"print(\\"teacher\\")","output":"","runStatus":null}'
    )
  })

  it('electronics: replaces the circuit', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    h.updateStudent({ teacherEditAppliedAt: 1, teacherEditApplyCode: circuitJson('teacher') })
    expect(h.result.current.code).toBe(circuitJson('teacher'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: circuitJson('teacher'),
      output: '',
      runStatus: null,
    })
  })

  it('arcade: applies the teacher design when sent', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    h.updateStudent({
      teacherEditAppliedAt: 1,
      teacherEditApplyCode: 'player = 7',
      teacherEditApplyArcadeDesign: arcadeDesign('teacher'),
    })
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('teacher'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 7',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('teacher'),
    })
  })

  it('arcade: keeps the current design when none is sent', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    h.updateStudent({ teacherEditAppliedAt: 1, teacherEditApplyCode: 'player = 7' })
    expect(JSON.parse(localStorage.getItem(taskKey('t1'))).arcadeDesign).toEqual(
      normalisedArcadeDesign('starter')
    )
  })

  it('html: decodes file keys, keeps a still-present active file, persists each file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    h.updateStudent({
      teacherEditAppliedAt: 1,
      teacherEditApplyFiles: { index__dot__html: '<p>teacher</p>', app__dot__js: 'x()' },
    })
    expect(h.result.current.files).toEqual([
      { name: 'index.html', content: '<p>teacher</p>', type: 'html' },
      // decodeSessionFiles types .js as 'javascript'; the sandbox push path says 'js'.
      { name: 'app.js', content: 'x()', type: 'javascript' },
    ])
    expect(h.result.current.activeFile).toBe('index.html')
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'index.html')))).toEqual({
      content: '<p>teacher</p>',
    })
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'app.js')))).toEqual({ content: 'x()' })
  })

  it('html: falls back to the first file when the active one is gone', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileTabChange('style.css'))
    h.updateStudent({
      teacherEditAppliedAt: 1,
      teacherEditApplyFiles: { index__dot__html: '<p>teacher</p>' },
    })
    expect(h.result.current.activeFile).toBe('index.html')
  })

  it('scratch: parses the code into external state and persists {state}', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    h.updateStudent({
      teacherEditAppliedAt: 1,
      teacherEditApplyCode: JSON.stringify(scratchBlocks('teacher')),
    })
    expect(h.result.current.scratchExternalState).toEqual(scratchBlocks('teacher'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      state: scratchBlocks('teacher'),
    })
  })

  it.each([
    ['filesystem', filesystemLesson, 'fsState', fsWith('start.txt')],
    ['desktop', desktopLesson, 'desktopState', normalisedDesktopWith('start.txt')],
  ])('%s: teacher edits are not applied', (type, lesson, key, unchanged) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    h.updateStudent({
      teacherEditAppliedAt: 1,
      teacherEditApplyCode: JSON.stringify(fsWith('teacher.txt')),
    })
    expect(h.result.current[key]).toEqual(unchanged)
    expect(localStorage.getItem(taskKey('t1'))).toBe(null)
  })
})

// ── teacherLive payload ───────────────────────────────────────────────────────

const basePayload = {
  active: true,
  source: 'student',
  sourceStudentId: ANON,
  sourceStudentName: STUDENT_NAME,
  taskId: 't1',
  arcadeDesign: null,
  turtleResult: null,
  files: {},
  activeFile: '',
  output: '',
  runStatus: null,
  checkPassed: false,
  checkAttempted: false,
  checkSuggestion: '',
  selection: null,
  activity: null,
}

const liveSession = () => makeSession({ teacherLive: studentSourcedTeacherLive() })
const lastPayload = (h) => h.writers.updateTeacherLive.mock.calls.at(-1)[0]

describe('teacherLive payload (this student is the Go Live source)', () => {
  it('python: full payload with explicit null arcadeDesign / turtleResult', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'python',
      code: 'print("start")',
    })
    expect(Object.keys(lastPayload(h))).toEqual([
      'active',
      'source',
      'sourceStudentId',
      'sourceStudentName',
      'taskId',
      'lessonType',
      'code',
      'arcadeDesign',
      'turtleResult',
      'files',
      'activeFile',
      'output',
      'runStatus',
      'checkPassed',
      'checkAttempted',
      'checkSuggestion',
      'selection',
      'activity',
    ])
  })

  it('handleCodeChange publishes immediately with the new code', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    h.writers.updateTeacherLive.mockClear()
    actSync(() => h.result.current.handleCodeChange('edited'))
    expect(h.writers.updateTeacherLive.mock.calls[0][0]).toEqual({
      ...basePayload,
      lessonType: 'python',
      code: 'edited',
    })
  })

  it('arcade: carries the design, turtleResult stays null', () => {
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'arcade',
      code: 'player = 1',
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
  })

  it('turtle: carries the compacted turtle result after a run', async () => {
    const turtle = {
      state: { x: 1.23456, y: 2, heading: 90 },
      commands: [{ type: 'line', x1: 0.04, y1: 0, x2: 10.06, y2: 0 }],
      calls: [{ name: 'forward' }],
    }
    mockModuleRun('turtle', (cb) => {
      cb.onOutput('hi\n', 'stdout')
      return { status: 'success', turtle }
    })
    const h = renderStudentCodeState({
      lesson: turtleLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    await actAsync(() => h.result.current.handleRun())
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'turtle',
      code: 'print("start")',
      output: 'hi\n',
      runStatus: 'success',
      checkPassed: true,
      checkAttempted: true,
      turtleResult: {
        state: { x: 1.2, y: 2, heading: 90 },
        commands: [{ type: 'line', x1: 0, y1: 0, x2: 10.1, y2: 0 }],
      },
    })
  })

  it('html: files map and active file, code empty', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'html',
      code: '',
      files: { 'index.html': '<p>start</p>', 'style.css': 'p {}' },
      activeFile: 'index.html',
    })
  })

  it('scratch: code is the latest serialized workspace, not the generic code state', () => {
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(h)).toEqual({ ...basePayload, lessonType: 'scratch', code: '' })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('live')))
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'scratch',
      code: JSON.stringify(scratchBlocks('live')),
    })
  })

  it('filesystem / desktop: code is the JSON state and files is empty', () => {
    const fs = renderStudentCodeState({
      lesson: filesystemLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(fs)).toEqual({
      ...basePayload,
      lessonType: 'filesystem',
      code: JSON.stringify(fsWith('start.txt')),
    })

    const desktop = renderStudentCodeState({
      lesson: desktopLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(desktop)).toEqual({
      ...basePayload,
      lessonType: 'desktop',
      code: JSON.stringify(normalisedDesktopWith('start.txt')),
    })
  })

  it('electronics: code is the serialized circuit', () => {
    const h = renderStudentCodeState({
      lesson: electronicsLesson(),
      currentTaskId: 't1',
      session: liveSession(),
    })
    expect(lastPayload(h)).toEqual({
      ...basePayload,
      lessonType: 'electronics',
      code: circuitJson('starter'),
    })
  })

  it('publishes nothing when another student is the source', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive({ sourceStudentId: 'x' }) }),
    })
    actSync(() => h.result.current.handleCodeChange('edited'))
    expect(h.writers.updateTeacherLive).not.toHaveBeenCalled()
  })

  it('teacher presentation publishes as the teacher, plus the live reference', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      teacherPresentation: true,
      session: makeSession({ teacherLive: { active: true, source: 'teacher' } }),
    })
    const expected = {
      ...basePayload,
      source: 'teacher',
      sourceStudentId: null,
      sourceStudentName: null,
      lessonType: 'python',
      code: 'print("start")',
    }
    expect(lastPayload(h)).toEqual(expected)
    expect(h.writers.setTeacherLiveReference.mock.calls.at(-1)[0]).toEqual(expected)
    h.unmount()
    expect(h.writers.setTeacherLiveReference.mock.calls.at(-1)).toEqual([null])
  })
})

// ── Share snapshot ────────────────────────────────────────────────────────────

describe('buildShareSnapshot', () => {
  const NOW = 1_700_000_000_000
  const snapshot = (h) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    return h.result.current.buildShareSnapshot()
  }
  const base = { activeFile: '', output: '', runStatus: null, capturedAt: NOW, arcadeDesign: null }

  it('python: code and empty files', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('shared'))
    expect(snapshot(h)).toEqual({
      ...base,
      lessonType: 'python',
      taskId: 't1',
      code: 'shared',
      files: {},
    })
  })

  it('arcade: includes the design', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    expect(snapshot(h)).toEqual({
      ...base,
      lessonType: 'arcade',
      taskId: 't1',
      code: 'player = 1',
      files: {},
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
  })

  it('turtle / electronics: code only', () => {
    const t = renderStudentCodeState({ lesson: turtleLesson(), currentTaskId: 't1' })
    expect(snapshot(t)).toMatchObject({ lessonType: 'turtle', code: 'print("start")', files: {} })
    const e = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    expect(snapshot(e)).toMatchObject({ lessonType: 'electronics', code: circuitJson('starter') })
  })

  it('html: files map and active file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    expect(snapshot(h)).toEqual({
      ...base,
      lessonType: 'html',
      taskId: 't1',
      code: '',
      files: { 'index.html': '<p>start</p>', 'style.css': 'p {}' },
      activeFile: 'index.html',
    })
  })

  it('scratch: code is the serialized workspace', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('shared')))
    expect(snapshot(h)).toEqual({
      ...base,
      lessonType: 'scratch',
      taskId: 't1',
      code: JSON.stringify(scratchBlocks('shared')),
      files: {},
    })
  })

  it('filesystem: code is the JSON fs', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    expect(snapshot(h)).toEqual({
      ...base,
      lessonType: 'filesystem',
      taskId: 't1',
      code: JSON.stringify(fsWith('start.txt')),
      files: {},
    })
  })

  // Known bug (plan step 1.5): the snapshot builder has no desktop branch, so a
  // shared Desktop workspace carries code '' instead of the desktop state.
  it.fails('known bug: desktop snapshot includes the desktop state', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    expect(snapshot(h).code).toBe(JSON.stringify(normalisedDesktopWith('start.txt')))
  })
})
