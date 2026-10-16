// Live scrubbing: checks when a scrub ends (P6-20, scrub.checkOnRelease) and previews of
// programs with input() replaying the last Run's answers (P6-21).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  mockModuleRun,
  renderStudentCodeState,
} from '../../../test/studentCodeStateHarness'
import { pythonLesson } from '../../../test/fixtures/studentCodeStateLessons'

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

const DRAW = 'from stage import *\ntext("hi", "navy", y=200)'
const ASK = 'from stage import *\nname = input("Who? ")\ntext(name, "navy", y=200)'

function scrubLesson(starterCode, scrub = { enabled: true }) {
  return pythonLesson({
    tasks: [
      {
        id: 't1',
        title: 'Slide it',
        starterCode,
        scrub,
        check: { type: 'output_contains', value: 'hi', hint: 'Print hi' },
      },
    ],
  })
}

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

// A runtime that asks one question per input() in `answers`' place and prints what it got.
function asking(questions = 1) {
  return async (callbacks) => {
    const { provideInput } = await import('../../../modules/python/pyodide')
    const got = []
    for (let i = 0; i < questions; i += 1) {
      const answered = new Promise((resolve) => {
        provideInput.mockImplementationOnce((value) => resolve(value))
      })
      callbacks.onInputRequired('Who? ')
      got.push(await answered)
    }
    callbacks.onOutput(`hi ${got.join(' ')}\n`, 'stdout')
    return { status: 'success' }
  }
}

describe('checks when a scrub ends (P6-20)', () => {
  it('a scrub Run is a Run whose attempt is marked source: scrub', async () => {
    mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('hi\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: scrubLesson(DRAW), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun({ source: 'scrub' }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: DRAW,
      passed: true,
      suggestion: '',
      teacherAssisted: false,
      error: false,
      source: 'scrub',
    })
  })

  it('a finished scrub runs the checks once, through handleRun', async () => {
    const run = mockModuleRun('python', (callbacks) => {
      callbacks.onOutput('hi\n', 'stdout')
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: scrubLesson(DRAW), currentTaskId: 't1' })
    actSync(() => h.result.current.handleScrubCommit({ kind: 'number' }))
    expect(run).not.toHaveBeenCalled()
    await wait(250)
    await act(async () => {})
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      't1',
      expect.objectContaining({ passed: true, source: 'scrub' })
    )
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(1)
  })

  it('does nothing with checkOnRelease: false, or for a program that does not preview', async () => {
    const run = mockModuleRun('python', () => ({ status: 'success' }))
    const off = renderStudentCodeState({
      lesson: scrubLesson(DRAW, { enabled: true, checkOnRelease: false }),
      currentTaskId: 't1',
    })
    actSync(() => off.result.current.handleScrubCommit({ kind: 'number' }))
    const plain = renderStudentCodeState({
      lesson: scrubLesson('print(200)'),
      currentTaskId: 't1',
    })
    actSync(() => plain.result.current.handleScrubCommit({ kind: 'number' }))
    await wait(250)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('previews of programs with input() (P6-21)', () => {
  it('asks for a Run and answers before the first Run', () => {
    const h = renderStudentCodeState({ lesson: scrubLesson(ASK), currentTaskId: 't1' })
    expect(h.result.current.scrubPreview(ASK)).toBe('press-run-answers')
    expect(h.result.current.scrubPreview('print(1)')).toBe('press-run')
  })

  it("replays the last Run's answers, and shows which", async () => {
    let release
    mockModuleRun('python', async (callbacks) => {
      callbacks.onInputRequired('Who? ')
      await new Promise((resolve) => {
        release = resolve
      })
      return { status: 'success' }
    })
    const h = renderStudentCodeState({ lesson: scrubLesson(ASK), currentTaskId: 't1' })
    let runPromise
    act(() => {
      runPromise = h.result.current.handleRun()
    })
    await act(async () => {})
    actSync(() => h.result.current.handleInputSubmit('Ada'))
    release()
    await act(async () => {
      await runPromise
    })

    const { provideInput } = await import('../../../modules/python/pyodide')
    provideInput.mockClear()
    mockModuleRun('python', (callbacks) => {
      callbacks.onInputRequired('Who? ')
      callbacks.onOutput('drawn\n', 'stdout')
      return { status: 'success' }
    })
    let status
    actSync(() => {
      status = h.result.current.scrubPreview(ASK.replace('200', '150'))
    })
    expect(status).toBe('preview')
    await wait(300)
    await act(async () => {})
    expect(provideInput).toHaveBeenCalledWith('Ada')
    expect(h.result.current.scrubReplayAnswers).toEqual(['Ada'])
    // A preview never logs an attempt beyond the Run's own.
    expect(h.writers.logAttempt).toHaveBeenCalledTimes(1)
  })

  it('says so when a preview asks for more answers than the last Run gave', async () => {
    mockModuleRun('python', () => ({ status: 'success' }))
    const h = renderStudentCodeState({ lesson: scrubLesson(ASK), currentTaskId: 't1' })
    // A Run that asked nothing: no answers to replay.
    await actAsync(() => h.result.current.handleRun())
    mockModuleRun('python', (callbacks) => {
      callbacks.onInputRequired('Who? ')
      return { status: 'stopped' }
    })
    const notify = vi.fn()
    actSync(() => h.result.current.scrubPreview(ASK.replace('200', '150'), null, { notify }))
    await wait(300)
    await act(async () => {})
    expect(notify).toHaveBeenCalledWith('press-run-answers')
    expect(h.result.current.scrubPreview(ASK)).toBe('press-run-answers')
    expect(h.result.current.scrubReplayAnswers).toBeNull()
  })

  it("a scrub's checks answer input() from the last Run", async () => {
    const run = mockModuleRun('python', asking(1))
    const h = renderStudentCodeState({ lesson: scrubLesson(ASK), currentTaskId: 't1' })
    await actAsync(() => h.result.current.handleRun({ source: 'scrub', inputAnswers: ['Ada'] }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(h.result.current.inputPrompt).toBeNull()
    expect(h.result.current.output).toContain('hi Ada')
  })
})
