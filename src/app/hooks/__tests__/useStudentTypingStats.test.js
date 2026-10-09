import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudentTypingStats } from '../useStudentTypingStats'

let touchDevice = false
vi.mock('../../../shared/useIsTouchDevice', () => ({
  useIsTouchDevice: () => touchDevice,
}))

const STUDENT = 'anon-1'

function liveSession(extra = {}) {
  return { state: 'active', createdAt: 1, students: { [STUDENT]: { displayName: 'Jo' } }, ...extra }
}

function setup(overrides = {}) {
  const recordStudentTyping = vi.fn(() => Promise.resolve())
  const initialProps = {
    phase: 'lesson',
    identity: { anonymousId: STUDENT },
    session: liveSession(),
    currentTaskId: 1,
    lessonType: 'python',
    writers: { recordStudentTyping },
    ...overrides,
  }
  const hook = renderHook((props) => useStudentTypingStats(props), { initialProps })
  return { ...hook, recordStudentTyping, initialProps }
}

function typeKeys(result, count, { start = 0, step = 200 } = {}) {
  act(() => {
    for (let i = 0; i < count; i++) {
      result.current.reportTyping({ kind: 'insert', chars: 1, at: start + i * step })
    }
  })
}

describe('useStudentTypingStats', () => {
  beforeEach(() => {
    touchDevice = false
  })

  it('never writes per keystroke, only on Run', () => {
    const { result, recordStudentTyping } = setup()
    typeKeys(result, 30)
    expect(recordStudentTyping).not.toHaveBeenCalled()
    act(() => result.current.noteRun({ copyCode: null, work: 'x' }))
    expect(recordStudentTyping).toHaveBeenCalledTimes(1)
    expect(recordStudentTyping).toHaveBeenCalledWith(STUDENT, 1, {
      charsTyped: 30,
      activeTypingMs: 29 * 200,
      corrections: 0,
      longestPauseMs: 200,
      autocompleteAccepts: 0,
    })
  })

  it('records the copy distance at the first Run of a copyCode task', () => {
    const { result, recordStudentTyping } = setup()
    typeKeys(result, 3)
    act(() => result.current.noteRun({ copyCode: 'print(1)', work: 'prnt(1)' }))
    typeKeys(result, 1, { start: 1000 })
    act(() => result.current.noteRun({ copyCode: 'print(1)', work: 'print(1)' }))
    expect(recordStudentTyping.mock.calls.map(([, , record]) => record.copyDistance)).toEqual([
      1, 1,
    ])
  })

  it("sends the previous task's totals when the class moves on", () => {
    const { result, rerender, recordStudentTyping, initialProps } = setup()
    typeKeys(result, 5)
    act(() => result.current.reportTyping({ kind: 'correction', at: 2000 }))
    rerender({ ...initialProps, currentTaskId: 2 })
    expect(recordStudentTyping).toHaveBeenCalledWith(
      STUDENT,
      1,
      expect.objectContaining({ charsTyped: 5, corrections: 1 })
    )
  })

  it('sends nothing when nothing was typed', () => {
    const { result, recordStudentTyping } = setup()
    act(() => result.current.reportTyping({ kind: 'autocomplete' }))
    act(() => result.current.noteRun({ copyCode: 'print(1)', work: '' }))
    expect(recordStudentTyping).not.toHaveBeenCalled()
  })

  it('carries on from the record already stored for the task', () => {
    const { result, recordStudentTyping } = setup({
      session: liveSession({
        students: {
          [STUDENT]: { typingLog: { 1: { charsTyped: 40, activeTypingMs: 9000, corrections: 2 } } },
        },
      }),
    })
    typeKeys(result, 2)
    act(() => result.current.noteRun({}))
    expect(recordStudentTyping).toHaveBeenCalledWith(
      STUDENT,
      1,
      expect.objectContaining({ charsTyped: 42, activeTypingMs: 9200, corrections: 2 })
    )
  })

  it.each([
    ['a touch device', {}, true],
    ['solo study', { phase: 'solo' }, false],
    ['the presentation window', { teacherPresentation: true }, false],
    ['a Builder preview', { previewMode: true }, false],
    ['the personal sandbox', { inPersonalSandbox: true }, false],
    ['a Scratch lesson', { lessonType: 'scratch' }, false],
  ])('records nothing on %s', (_label, overrides, touch) => {
    touchDevice = touch
    const { result, recordStudentTyping } = setup(overrides)
    expect(result.current.enabled).toBe(false)
    typeKeys(result, 10)
    act(() => result.current.noteRun({ copyCode: 'x', work: 'x' }))
    expect(recordStudentTyping).not.toHaveBeenCalled()
  })

  it('records Turtle and HTML lessons', () => {
    expect(setup({ lessonType: 'turtle' }).result.current.enabled).toBe(true)
    expect(setup({ lessonType: 'html' }).result.current.enabled).toBe(true)
  })

  it('never writes after the session ended (the students node is gone)', () => {
    const { result, rerender, recordStudentTyping, initialProps } = setup()
    typeKeys(result, 5)
    rerender({ ...initialProps, session: { state: 'ended', createdAt: 1 } })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(recordStudentTyping).not.toHaveBeenCalled()
  })
})
