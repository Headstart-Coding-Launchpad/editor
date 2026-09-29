// Characterization: editor change handlers → exact localStorage records and RTDB
// writer calls, per module type. Code types only mirror to Firebase while the teacher
// is watching (activeStudentView); filesystem/desktop write a run on every change.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actSync,
  fileKey,
  makeSession,
  renderStudentCodeState,
  storedKeys,
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
  vi.useRealTimers()
})

const watched = () => makeSession({ activeStudentView: ANON })

function clearWriters(h) {
  Object.values(h.writers).forEach((fn) => fn.mockClear())
}

describe.each([
  ['python', pythonLesson],
  ['turtle', turtleLesson],
])('handleCodeChange — %s', (type, lesson) => {
  it('saves {code, output, runStatus} and does not write to Firebase when unwatched', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('print("x")'))
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      '{"code":"print(\\"x\\")","output":"","runStatus":null}'
    )
    expect(h.result.current.code).toBe('print("x")')
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.updateTeacherLive).not.toHaveBeenCalled()
  })

  it('mirrors the code with writeStudentCode while watched', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1', session: watched() })
    clearWriters(h)
    actSync(() => h.result.current.handleCodeChange('print("x")'))
    expect(h.writers.writeStudentCode).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentCode).toHaveBeenCalledWith(ANON, 'print("x")')
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })

  it('does not mirror when a different student is watched', () => {
    const h = renderStudentCodeState({
      lesson: lesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: 'someone-else' }),
    })
    actSync(() => h.result.current.handleCodeChange('print("x")'))
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
  })
})

describe('handleCodeChange — arcade / electronics', () => {
  it('arcade saves the current design alongside the code', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('player = 3'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 3',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
    expect(Object.keys(JSON.parse(localStorage.getItem(taskKey('t1'))))).toEqual([
      'code',
      'output',
      'runStatus',
      'arcadeDesign',
    ])
  })

  it('electronics saves {code, output, runStatus} and mirrors while watched', () => {
    const h = renderStudentCodeState({
      lesson: electronicsLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleCodeChange(circuitJson('edited')))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: circuitJson('edited'),
      output: '',
      runStatus: null,
    })
    expect(h.writers.writeStudentCode).toHaveBeenCalledWith(ANON, circuitJson('edited'))
  })
})

describe('handleArcadeDesignChange', () => {
  it('saves the cloned design with the current code; no Firebase write when unwatched', () => {
    vi.useFakeTimers()
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('drawn')))
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('drawn'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 1',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('drawn'),
    })
    actSync(() => vi.advanceTimersByTime(1000))
    expect(h.writers.writeStudentArcadeDesign).not.toHaveBeenCalled()
  })

  it('debounces writeStudentArcadeDesign by 600ms while watched', () => {
    vi.useFakeTimers()
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('a')))
    actSync(() => vi.advanceTimersByTime(300))
    actSync(() => h.result.current.handleArcadeDesignChange(arcadeDesign('b')))
    actSync(() => vi.advanceTimersByTime(599))
    expect(h.writers.writeStudentArcadeDesign).not.toHaveBeenCalled()
    actSync(() => vi.advanceTimersByTime(1))
    expect(h.writers.writeStudentArcadeDesign).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentArcadeDesign).toHaveBeenCalledWith(
      ANON,
      normalisedArcadeDesign('b')
    )
  })
})

describe('handleFileChange — html', () => {
  it('saves only the changed file as {content}; no Firebase write when unwatched', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileChange('index.html', '<h1>x</h1>'))
    expect(localStorage.getItem(fileKey('t1', 'index.html'))).toBe('{"content":"<h1>x</h1>"}')
    expect(storedKeys()).toEqual([fileKey('t1', 'index.html')])
    expect(h.result.current.files.map((f) => f.content)).toEqual(['<h1>x</h1>', 'p {}'])
    expect(h.writers.writeStudentFiles).not.toHaveBeenCalled()
  })

  it('writes the whole raw-named file map while watched', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleFileChange('style.css', 'h1 { color: red }'))
    expect(h.writers.writeStudentFiles).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentFiles).toHaveBeenCalledWith(ANON, {
      'index.html': '<p>start</p>',
      'style.css': 'h1 { color: red }',
    })
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('handleFileTabChange writes the interaction while watched', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleFileTabChange('style.css'))
    expect(h.result.current.activeFile).toBe('style.css')
    expect(h.writers.writeStudentInteraction).toHaveBeenCalledWith(ANON, {
      selection: null,
      activeFile: 'style.css',
    })
  })
})

describe('handleScratchChange', () => {
  it('saves {state}; no Firebase write when unwatched', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('edited')))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      state: scratchBlocks('edited'),
    })
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('mirrors the serialized workspace with writeStudentCode while watched', () => {
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('edited')))
    expect(h.writers.writeStudentCode).toHaveBeenCalledWith(
      ANON,
      JSON.stringify(scratchBlocks('edited'))
    )
  })

  it('throttles sprite state to one write per 120ms while watched', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    actSync(() => h.result.current.handleScratchSpriteState({ cat: { x: 1 } }, [], 'bg', 'cat'))
    expect(h.writers.writeStudentSpriteState).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentSpriteState).toHaveBeenLastCalledWith(ANON, {
      spriteStates: { cat: { x: 1 } },
      cloneStates: [],
      backdropName: 'bg',
      selectedSpriteId: 'cat',
      updatedAt: 10_000,
    })
    actSync(() => vi.advanceTimersByTime(50))
    actSync(() => h.result.current.handleScratchSpriteState({ cat: { x: 2 } }, [], 'bg'))
    actSync(() => h.result.current.handleScratchSpriteState({ cat: { x: 3 } }, [], 'bg'))
    expect(h.writers.writeStudentSpriteState).toHaveBeenCalledTimes(1)
    actSync(() => vi.advanceTimersByTime(70))
    expect(h.writers.writeStudentSpriteState).toHaveBeenCalledTimes(2)
    // The trailing write carries the payload captured by the call that scheduled it.
    expect(h.writers.writeStudentSpriteState).toHaveBeenLastCalledWith(ANON, {
      spriteStates: { cat: { x: 2 } },
      cloneStates: [],
      backdropName: 'bg',
      selectedSpriteId: null,
      updatedAt: 10_050,
    })
  })
})

describe('handleFsChange — filesystem', () => {
  it('saves {fs} and writes a failing run + attempt on every change', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    const next = fsWith('start.txt', 'other.txt')
    actSync(() => h.result.current.handleFsChange(next))
    expect(localStorage.getItem(taskKey('t1'))).toBe(JSON.stringify({ fs: next }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(next),
      status: 'error',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: next,
      passed: false,
      suggestion: 'Create done.txt',
    })
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
    expect(h.result.current.checkAttempted).toBe(true)
    expect(h.result.current.checkPassed).toBe(false)
  })

  it('writes a passing run when the check passes', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    const next = fsWith('start.txt', 'done.txt')
    actSync(() => h.result.current.handleFsChange(next))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(next),
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: next,
      passed: true,
      suggestion: '',
    })
    expect(h.result.current.checkPassed).toBe(true)
  })

  it('writes status null and no attempt for a task without a check', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't3' })
    const next = fsWith('t3.txt', 'x.txt')
    actSync(() => h.result.current.handleFsChange(next))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(next),
      status: null,
      checkPassed: false,
    })
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('writes nothing to Firebase in solo (saves locally only)', () => {
    const h = renderStudentCodeState({
      lesson: filesystemLesson(),
      currentTaskId: 't1',
      phase: 'solo',
    })
    const next = fsWith('start.txt', 'done.txt')
    actSync(() => h.result.current.handleFsChange(next))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({ fs: next })
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
    expect(h.result.current.checkPassed).toBe(true)
  })

  it('handleFsInteraction also writes a run (fail feedback suppressed locally)', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFsInteraction({ currentDir: '/', openFile: null }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(fsWith('start.txt')),
      status: 'error',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: fsWith('start.txt'),
      passed: false,
      suggestion: 'Create done.txt',
    })
    expect(h.result.current.checkAttempted).toBe(false)
    expect(h.result.current.fsInteraction).toEqual({ currentDir: '/', openFile: null })
  })
})

describe('handleDesktopChange — desktop', () => {
  it('saves {desktop} and writes a run + attempt on every change', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    const next = normalisedDesktopWith('start.txt', 'done.txt')
    actSync(() => h.result.current.handleDesktopChange(next))
    expect(localStorage.getItem(taskKey('t1'))).toBe(JSON.stringify({ desktop: next }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(next),
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: next,
      passed: true,
      suggestion: '',
    })
    expect(h.writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('writes a failing run with the check hint', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    const next = normalisedDesktopWith('start.txt')
    actSync(() => h.result.current.handleDesktopChange(next))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(next),
      status: 'error',
      checkPassed: false,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: next,
      passed: false,
      suggestion: 'Create done.txt',
    })
  })
})

describe('shared per-keystroke mirrors', () => {
  it('handleInputChange mirrors the pending input() text only while watched', () => {
    const unwatched = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => unwatched.result.current.handleInputChange('Sa'))
    expect(unwatched.writers.writeStudentInputState).not.toHaveBeenCalled()

    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleInputChange('Sa'))
    expect(h.writers.writeStudentInputState).toHaveBeenCalledWith(ANON, {
      prompt: null,
      value: 'Sa',
    })
  })

  it('handleEditorSelection writes the selection (with file) while watched', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: watched(),
    })
    clearWriters(h)
    actSync(() => h.result.current.handleEditorSelection({ from: 1, to: 4 }, 'index.html'))
    expect(h.writers.writeStudentInteraction).toHaveBeenCalledWith(ANON, {
      selection: { from: 1, to: 4, file: 'index.html' },
    })
  })

  it('handleCodeArrangeSlotsChange writes slots on every placement, watched or not', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeArrangeSlotsChange({ s1: 'tile-a' }))
    expect(h.writers.writeStudentCodeArrangeSlots).toHaveBeenCalledWith(ANON, { s1: 'tile-a' })
  })
})
