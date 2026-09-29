// Characterization: task content loading (starter / own saved / carry-through) for
// every module type. Pins current behaviour ahead of the module-registry refactor —
// see docs/architecture/modular-activities-plan.md step 0.2.
import { describe, expect, it, vi } from 'vitest'
import {
  ANON,
  renderStudentCodeState,
  taskKey,
  fileKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import {
  arcadeLesson,
  circuitJson,
  desktopLesson,
  electronicsLesson,
  EMPTY_ARCADE_DESIGN,
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

const LESSONS = { python: pythonLesson, turtle: turtleLesson }

describe.each(['python', 'turtle'])('useStudentCodeState load — %s', (type) => {
  const lesson = () => LESSONS[type]()

  it('loads the task starter code when nothing is saved', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe('print("start")')
    expect(h.result.current.files).toEqual([])
  })

  it('ignores the task’s own saved code in a live lesson (phase "lesson")', () => {
    writeStored(taskKey('t1'), { code: 'print("mine")', output: '', runStatus: null })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe('print("start")')
  })

  it('restores the task’s own saved code in solo', () => {
    writeStored(taskKey('t1'), { code: 'print("mine")', output: 'x', runStatus: 'success' })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1', phase: 'solo' })
    expect(h.result.current.code).toBe('print("mine")')
    // Output/run status are not restored from the saved record.
    expect(h.result.current.output).toBe('')
    expect(h.result.current.runStatus).toBe(null)
  })

  it('carries code from carryCodeFrom’s saved record', () => {
    writeStored(taskKey('t1'), { code: 'print("carried")' })
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe('print("carried")')
    expect(h.writers.recordStudentCarryFallback).not.toHaveBeenCalled()
  })

  it('falls back to the starter when the carry source has no saved code', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe('# t2 starter')
  })

  it('walks the carry chain and records a carry fallback', () => {
    const l = lesson()
    l.tasks[2] = { ...l.tasks[2], carryCodeFrom: 't2' }
    writeStored(taskKey('t1'), { code: 'print("from t1")' })
    const h = renderStudentCodeState({ lesson: l, currentTaskId: 't3' })
    expect(h.result.current.code).toBe('print("from t1")')
    expect(h.writers.recordStudentCarryFallback).toHaveBeenCalledTimes(1)
    expect(h.writers.recordStudentCarryFallback).toHaveBeenCalledWith(ANON, 't3', {
      taskId: 't3',
      field: 'carryCodeFrom',
      requestedSourceTaskId: 't2',
      resolvedSourceTaskId: 't1',
      skippedSourceTaskIds: ['t2'],
    })
  })

  it('does not record a carry fallback in solo', () => {
    const l = lesson()
    l.tasks[2] = { ...l.tasks[2], carryCodeFrom: 't2' }
    writeStored(taskKey('t1'), { code: 'print("from t1")' })
    const solo = renderStudentCodeState({ lesson: l, currentTaskId: 't3', phase: 'solo' })
    expect(solo.result.current.code).toBe('print("from t1")')
    expect(solo.writers.recordStudentCarryFallback).not.toHaveBeenCalled()
  })

  it('does not load content outside lesson/solo phases', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1', phase: 'waiting' })
    expect(h.result.current.code).toBe('')
  })

  it('reloads content when currentTaskId changes', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    h.update({ currentTaskId: 't3' })
    expect(h.result.current.code).toBe('# t3 starter')
  })
})

describe('useStudentCodeState load — arcade', () => {
  it('loads starter code and the starter arcade design', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe('player = 1')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('starter'))
  })

  it('restores the saved design even in a live lesson, while code stays the starter', () => {
    writeStored(taskKey('t1'), { code: 'player = 9', arcadeDesign: normalisedArcadeDesign('mine') })
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe('player = 1')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('mine'))
  })

  it('restores saved code and design in solo', () => {
    writeStored(taskKey('t1'), { code: 'player = 9', arcadeDesign: normalisedArcadeDesign('mine') })
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      phase: 'solo',
    })
    expect(h.result.current.code).toBe('player = 9')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('mine'))
  })

  it('carries code (not the design) from carryCodeFrom', () => {
    writeStored(taskKey('t1'), { code: 'player = 5', arcadeDesign: normalisedArcadeDesign('mine') })
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe('player = 5')
    expect(h.result.current.arcadeDesign).toEqual(EMPTY_ARCADE_DESIGN)
  })
})

describe('useStudentCodeState load — electronics', () => {
  it('loads the serialized starter circuit', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe(circuitJson('starter'))
  })

  it('restores its own saved circuit even in a live lesson', () => {
    writeStored(taskKey('t1'), { code: circuitJson('mine') })
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    expect(h.result.current.code).toBe(circuitJson('mine'))
  })

  it('carries the circuit from carryCircuitFrom when it has no own save', () => {
    writeStored(taskKey('t1'), { code: circuitJson('carried') })
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe(circuitJson('carried'))
  })

  it('prefers its own save over the carry source', () => {
    writeStored(taskKey('t1'), { code: circuitJson('carried') })
    writeStored(taskKey('t2'), { code: circuitJson('own') })
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe(circuitJson('own'))
  })

  it('falls back to the task starter circuit when the carry source is empty', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't2' })
    expect(h.result.current.code).toBe(circuitJson('t2'))
  })
})

describe('useStudentCodeState load — html', () => {
  it('loads starter files and the entry file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    expect(h.result.current.files).toEqual([
      htmlFile('<p>start</p>'),
      htmlFile('p {}', 'style.css', 'css'),
    ])
    expect(h.result.current.activeFile).toBe('index.html')
  })

  it('ignores own saved files in a live lesson but restores them in solo', () => {
    writeStored(fileKey('t1', 'index.html'), { content: '<p>mine</p>' })
    const live = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    expect(live.result.current.files[0].content).toBe('<p>start</p>')
    const solo = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      phase: 'solo',
    })
    expect(solo.result.current.files).toEqual([
      htmlFile('<p>mine</p>'),
      htmlFile('p {}', 'style.css', 'css'),
    ])
  })

  it('carries per-file from carryCodeFrom, keeping unsaved files at the starter', () => {
    writeStored(fileKey('t1', 'index.html'), { content: '<p>carried</p>' })
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't2' })
    expect(h.result.current.files).toEqual([
      htmlFile('<p>carried</p>'),
      htmlFile('t2 {}', 'style.css', 'css'),
    ])
  })
})

describe('useStudentCodeState load — scratch', () => {
  it('leaves blocks to the workspace: no files, no external state, code untouched', () => {
    writeStored(taskKey('t1'), { state: scratchBlocks('mine') })
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    expect(h.result.current.files).toEqual([])
    expect(h.result.current.activeFile).toBe('')
    expect(h.result.current.scratchExternalState).toBe(null)
    expect(h.result.current.scratchActiveStageIndex).toBe(null)
    expect(h.result.current.code).toBe('')
    // The workspace resolves the initial project itself through this reader.
    expect(h.result.current.readSavedTaskCode('t1')).toEqual({ state: scratchBlocks('mine') })
  })
})

describe('useStudentCodeState load — filesystem', () => {
  it('loads starterFs and starts in startsInDir', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    expect(h.result.current.fsState).toEqual(fsWith('start.txt'))
    expect(h.result.current.fsInteraction).toEqual({ currentDir: '/docs/', openFile: null })
  })

  it('restores its own saved fs even in a live lesson', () => {
    writeStored(taskKey('t1'), { fs: fsWith('mine.txt') })
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    expect(h.result.current.fsState).toEqual(fsWith('mine.txt'))
  })

  it('carries from carryFsFrom and keeps the previous current directory', () => {
    writeStored(taskKey('t1'), { fs: fsWith('carried.txt') })
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    h.update({ currentTaskId: 't2' })
    expect(h.result.current.fsState).toEqual(fsWith('carried.txt'))
    expect(h.result.current.fsInteraction).toEqual({ currentDir: '/docs/', openFile: null })
  })

  it('uses the starter when the carry source has nothing saved', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't2' })
    expect(h.result.current.fsState).toEqual(fsWith('t2.txt'))
    expect(h.result.current.fsInteraction).toEqual({ currentDir: '/', openFile: null })
  })

  it('does not carry when the task has no carryFsFrom', () => {
    writeStored(taskKey('t1'), { fs: fsWith('carried.txt') })
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't3' })
    expect(h.result.current.fsState).toEqual(fsWith('t3.txt'))
  })
})

describe('useStudentCodeState load — desktop', () => {
  it('loads the normalised starterDesktop', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('start.txt'))
    expect(h.result.current.desktopInteraction).toEqual({ currentDir: '/', openFile: null })
  })

  it('restores its own saved desktop even in a live lesson', () => {
    writeStored(taskKey('t1'), { desktop: normalisedDesktopWith('mine.txt') })
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('mine.txt'))
  })

  it('carries from carryDesktopFrom', () => {
    writeStored(taskKey('t1'), { desktop: normalisedDesktopWith('carried.txt') })
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't2' })
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('carried.txt'))
  })

  it('uses the starter when the carry source has nothing saved', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't2' })
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('t2.txt'))
  })
})
