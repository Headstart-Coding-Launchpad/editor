// Characterization: teacher remote reset actions (starter / complete / stage_N /
// reveal_stage_N), the student's Reset button, Show stage and Show complete code — the
// resulting editor state and exactly what is (and is not) persisted, per module type.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

let pushedAt = 0
function remoteReset(h, action) {
  pushedAt += 1
  h.updateStudent({ remoteResetPushedAt: pushedAt, remoteResetAction: action })
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Remote reset ──────────────────────────────────────────────────────────────

describe.each([
  ['python', pythonLesson],
  ['turtle', turtleLesson],
])('remote reset — %s', (type, lesson) => {
  it.each([
    ['starter', 'print("start")'],
    // 'complete' uses task.completeCode, NOT the complete-role code stage.
    ['complete', 'print("hi")'],
    ['stage_0', '# stage 0'],
    ['stage_1', 'print("hi")  # complete stage'],
    ['stage_9', 'print("start")'],
  ])('%s → code %j, not persisted', (action, expected) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('edited'))
    remoteReset(h, action)
    expect(h.result.current.code).toBe(expected)
    expect(h.result.current.output).toBe('')
    expect(h.result.current.runStatus).toBe(null)
    // The saved record is left as it was until the next edit / snapshot.
    expect(JSON.parse(localStorage.getItem(taskKey('t1'))).code).toBe('edited')
  })

  it('reveal_stage_N on a support stage records a teacher reveal without touching code', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    remoteReset(h, 'reveal_stage_0')
    expect(h.result.current.code).toBe('print("start")')
    expect(h.writers.recordSupportStageReveal).toHaveBeenCalledWith(ANON, 't1', 0, {
      source: 'teacher',
      stageLabel: 'Support A',
      attemptNumber: 0,
    })
    expect(h.result.current.activeSupportStageIndex).toBe(0)
    expect(h.result.current.supportStageReveals[0]).toMatchObject({
      taskId: 't1',
      stageIndex: 0,
      stageLabel: 'Support A',
      source: 'teacher',
      attemptNumber: 0,
    })
  })

  it('reveal_stage_N on the complete stage shows the complete preview', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    remoteReset(h, 'reveal_stage_1')
    expect(h.result.current.completePreviewShown).toBe(true)
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()
    expect(h.result.current.code).toBe('print("start")')
  })

  it('is ignored outside lesson/solo phases', () => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1', phase: 'sandbox' })
    remoteReset(h, 'complete')
    expect(h.result.current.code).toBe('')
  })
})

describe('remote reset — arcade', () => {
  it.each([
    ['starter', 'player = 1', 'starter'],
    ['complete', 'player = 2', 'complete'],
    ['stage_0', '# arcade stage 0', 'stage0'],
  ])('%s → code + design, persisted with the design', (action, code, design) => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    remoteReset(h, action)
    expect(h.result.current.code).toBe(code)
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign(design))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code,
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign(design),
    })
    expect(h.writers.writeStudentArcadeDesign).not.toHaveBeenCalled()
  })

  it('writes the reset design to Firebase while watched', () => {
    const h = renderStudentCodeState({
      lesson: arcadeLesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    remoteReset(h, 'complete')
    expect(h.writers.writeStudentArcadeDesign).toHaveBeenCalledWith(
      ANON,
      normalisedArcadeDesign('complete')
    )
  })
})

describe('remote reset — electronics', () => {
  it.each([
    ['starter', 'starter'],
    ['complete', 'complete'],
    ['stage_0', 'stage0'],
  ])('%s → serialized circuit, not persisted', (action, id) => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(circuitJson('edited')))
    remoteReset(h, action)
    expect(h.result.current.code).toBe(circuitJson(id))
    expect(JSON.parse(localStorage.getItem(taskKey('t1'))).code).toBe(circuitJson('edited'))
  })
})

describe('remote reset — html', () => {
  it.each([
    ['starter', ['<p>start</p>', 'p {}']],
    ['complete', ['<h1>done</h1>', 'h1 {}']],
    ['stage_0', ['<p>stage 0</p>', '/* stage 0 */']],
  ])('%s → files, not persisted', (action, contents) => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileTabChange('style.css'))
    remoteReset(h, action)
    expect(h.result.current.files.map((f) => f.content)).toEqual(contents)
    expect(h.result.current.activeFile).toBe('index.html')
    expect(h.result.current.iframeSrc).toBe(null)
    expect(storedKeys()).toEqual([])
  })
})

describe('remote reset — scratch', () => {
  it.each([
    ['starter', 'starter', null],
    ['complete', 'complete', null],
    ['stage_0', 'stage0', 0],
  ])('%s → pushed external blocks (stage index %j), not persisted', (action, label, index) => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    remoteReset(h, action)
    expect(h.result.current.scratchExternalState).toEqual(scratchBlocks(label))
    expect(h.result.current.scratchActiveStageIndex).toBe(index)
    expect(storedKeys()).toEqual([])
  })

  it('reveal_stage_0 records a teacher reveal for scratch too', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    remoteReset(h, 'reveal_stage_0')
    expect(h.writers.recordSupportStageReveal).toHaveBeenCalledWith(ANON, 't1', 0, {
      source: 'teacher',
      stageLabel: 'Support A',
      attemptNumber: 0,
    })
  })
})

describe('remote reset — filesystem / desktop', () => {
  it.each([
    ['starter', fsWith('start.txt')],
    ['complete', fsWith('start.txt', 'done.txt')],
    ['stage_0', fsWith('stage0.txt')],
  ])('filesystem %s → fs, not persisted', (action, fs) => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    remoteReset(h, action)
    expect(h.result.current.fsState).toEqual(fs)
    expect(storedKeys()).toEqual([])
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
  })

  it.each([
    ['starter', normalisedDesktopWith('start.txt')],
    ['complete', normalisedDesktopWith('start.txt', 'done.txt')],
    ['stage_0', normalisedDesktopWith('stage0.txt')],
  ])('desktop %s → normalised desktop, not persisted', (action, desktop) => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    remoteReset(h, action)
    expect(h.result.current.desktopState).toEqual(desktop)
    expect(storedKeys()).toEqual([])
  })

  it('reveal_stage_0 is a no-op for filesystem (not a support-stage module)', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    remoteReset(h, 'reveal_stage_0')
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()
    expect(h.result.current.fsState).toEqual(fsWith('start.txt'))
  })
})

// ── Reset button (handleResetCode) ────────────────────────────────────────────

describe('handleResetCode', () => {
  it('does nothing when the student cancels the confirm', () => {
    window.confirm.mockReturnValue(false)
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('edited'))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe('edited')
  })

  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
  ])('%s: restores starter code without persisting', (type, lesson) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('edited'))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe('print("start")')
    expect(JSON.parse(localStorage.getItem(taskKey('t1'))).code).toBe('edited')
  })

  it('python in a teacher sandbox resets to the session sandbox code', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      phase: 'sandbox',
      session: makeSession({ sandboxCode: 'print("sent")', sandboxCodePushedAt: 1 }),
    })
    actSync(() => h.result.current.handleCodeChange('edited'))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe('print("sent")')
  })

  it('arcade: resets the design through handleArcadeDesignChange, saving the PRE-reset code', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('player = 42'))
    actSync(() => h.result.current.handleArcadeDesignChange({ sprites: [], maps: [] }))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe('player = 1')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('starter'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 42',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('starter'),
    })
  })

  it('html: restores starter files and entry file without persisting', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileChange('index.html', '<p>edited</p>'))
    actSync(() => h.result.current.handleFileTabChange('style.css'))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.files).toEqual([
      htmlFile('<p>start</p>'),
      htmlFile('p {}', 'style.css', 'css'),
    ])
    expect(h.result.current.activeFile).toBe('index.html')
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'index.html')))).toEqual({
      content: '<p>edited</p>',
    })
  })

  it('scratch: pushes the starter blocks as external state', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.scratchExternalState).toEqual(scratchBlocks('starter'))
    expect(h.result.current.scratchActiveStageIndex).toBe(null)
    expect(storedKeys()).toEqual([])
  })

  it('electronics: restores and persists {code} only', () => {
    const h = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange(circuitJson('edited')))
    actSync(() => h.result.current.handleResetCode())
    expect(h.result.current.code).toBe(circuitJson('starter'))
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('starter') })
    )
  })

  it.each([
    ['filesystem', filesystemLesson, 'fsState', fsWith('start.txt', 'x.txt')],
    ['desktop', desktopLesson, 'desktopState', normalisedDesktopWith('x.txt')],
  ])(
    '%s: outside the personal sandbox the Reset button does nothing',
    (type, lesson, key, edited) => {
      const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
      actSync(() =>
        type === 'filesystem'
          ? h.result.current.handleFsChange(edited)
          : h.result.current.handleDesktopChange(edited)
      )
      actSync(() => h.result.current.handleResetCode())
      expect(h.result.current[key]).toEqual(edited)
    }
  )
})

// ── Show stage / Show complete ────────────────────────────────────────────────

describe('handleShowCodeStage(0)', () => {
  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
  ])('%s: loads and persists the stage code', (type, lesson) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCodeStage(0))
    expect(h.result.current.code).toBe('# stage 0')
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      '{"code":"# stage 0","output":"","runStatus":null}'
    )
    expect(h.result.current.offeredStageIndex).toBe(0)
  })

  it('arcade: persists the stage design too', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCodeStage(0))
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('stage0'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: '# arcade stage 0',
      output: '',
      runStatus: null,
      arcadeDesign: normalisedArcadeDesign('stage0'),
    })
  })

  it('html: persists every stage file', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCodeStage(0))
    expect(storedKeys()).toEqual([fileKey('t1', 'index.html'), fileKey('t1', 'style.css')])
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'style.css')))).toEqual({
      content: '/* stage 0 */',
    })
    expect(h.result.current.activeFile).toBe('index.html')
  })

  it('scratch: pushes and persists the stage blocks', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCodeStage(0))
    expect(h.result.current.scratchExternalState).toEqual(scratchBlocks('stage0'))
    expect(h.result.current.scratchActiveStageIndex).toBe(0)
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      state: scratchBlocks('stage0'),
    })
  })

  it('filesystem / desktop / electronics persist their stage state', () => {
    const fsH = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => fsH.result.current.handleShowCodeStage(0))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({ fs: fsWith('stage0.txt') })
    localStorage.clear()

    const dH = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    actSync(() => dH.result.current.handleShowCodeStage(0))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      desktop: normalisedDesktopWith('stage0.txt'),
    })
    localStorage.clear()

    const eH = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => eH.result.current.handleShowCodeStage(0))
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('stage0') })
    )
  })

  it('ignores an out-of-range stage', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCodeStage(7))
    expect(h.result.current.code).toBe('print("start")')
    expect(storedKeys()).toEqual([])
  })
})

describe('handleShowCompleteCode', () => {
  it.each([
    ['python', pythonLesson],
    ['turtle', turtleLesson],
  ])('%s: prefers the complete-role stage over completeCode and marks passed', (type, lesson) => {
    const h = renderStudentCodeState({ lesson: lesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCompleteCode())
    expect(h.result.current.code).toBe('print("hi")  # complete stage')
    expect(h.result.current.checkPassed).toBe(true)
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'print("hi")  # complete stage',
      output: '',
      runStatus: null,
    })
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('arcade: loads completeCode but saves no design (current behaviour)', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCompleteCode())
    expect(h.result.current.code).toBe('player = 2')
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('starter'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      code: 'player = 2',
      output: '',
      runStatus: null,
    })
  })

  // Known bug (plan step 1.5): arcade show-complete should load and persist
  // completeArcadeDesign, like remote reset 'complete' and handleShowCodeStage do.
  it.fails('known bug: arcade show-complete sets and saves the complete design', () => {
    const h = renderStudentCodeState({ lesson: arcadeLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCompleteCode())
    expect(h.result.current.arcadeDesign).toEqual(normalisedArcadeDesign('complete'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1'))).arcadeDesign).toEqual(
      normalisedArcadeDesign('complete')
    )
  })

  it('html: loads and persists completeFiles', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleShowCompleteCode())
    expect(h.result.current.files.map((f) => f.content)).toEqual(['<h1>done</h1>', 'h1 {}'])
    expect(JSON.parse(localStorage.getItem(fileKey('t1', 'index.html')))).toEqual({
      content: '<h1>done</h1>',
    })
    expect(h.result.current.checkPassed).toBe(true)
  })

  it('scratch / filesystem / desktop / electronics persist their complete state', () => {
    const s = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => s.result.current.handleShowCompleteCode())
    expect(s.result.current.scratchExternalState).toEqual(scratchBlocks('complete'))
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      state: scratchBlocks('complete'),
    })
    localStorage.clear()

    const f = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    actSync(() => f.result.current.handleShowCompleteCode())
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      fs: fsWith('start.txt', 'done.txt'),
    })
    localStorage.clear()

    const d = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    actSync(() => d.result.current.handleShowCompleteCode())
    expect(JSON.parse(localStorage.getItem(taskKey('t1')))).toEqual({
      desktop: normalisedDesktopWith('start.txt', 'done.txt'),
    })
    localStorage.clear()

    const e = renderStudentCodeState({ lesson: electronicsLesson(), currentTaskId: 't1' })
    actSync(() => e.result.current.handleShowCompleteCode())
    expect(localStorage.getItem(taskKey('t1'))).toBe(
      JSON.stringify({ code: circuitJson('complete') })
    )
    expect(e.result.current.checkPassed).toBe(true)
  })
})
