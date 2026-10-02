import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actAsync,
  fileKey,
  makeSession,
  readStored,
  renderStudentCodeState,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import { ACTIVITY_ANSWER_DEBOUNCE_MS, ACTIVITY_CONTINUOUS_THROTTLE_MS } from '../useActivityState'
import binary from '../../../activities/binary/definition.js'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

// useActivityState is exercised through useStudentCodeState (which owns it), so these tests
// cover the real composition: session writers, check feedback and teacher-live publishing.

const MAKE_NUMBER = {
  id: 2,
  title: 'Make 5',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}
const TO_DECIMAL = {
  id: 3,
  title: 'To decimal',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'to_decimal',
  bits: 4,
  items: [{ id: 'a', value: '0110' }],
}
const UNKNOWN = { id: 4, title: 'Hologram', taskType: 'activity', activityType: 'hologram' }
const LESSON = {
  id: 'lesson-1',
  title: 'Activities',
  type: 'python',
  tasks: [{ id: 1, title: 'Code', starterCode: 'print(1)' }, MAKE_NUMBER, TO_DECIMAL, UNKNOWN],
}
const STATE_FILE = '__activity_state__'

const bitsState = (bits) => ({ v: 1, items: { a: { bits, carries: '' } } })
const answerState = (answer) => ({ v: 1, items: { a: { answer } } })

function render(options = {}) {
  return renderStudentCodeState({ lesson: LESSON, currentTaskId: 2, ...options })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useActivityState: load and persist', () => {
  it('starts from the initial state and persists every change to the aux file', () => {
    const { result } = render()
    expect(result.current.activity.definition.id).toBe('binary')
    expect(result.current.activity.state).toEqual(binary.initialState(MAKE_NUMBER))

    act(() => result.current.activity.onChange(bitsState('0100')))
    expect(result.current.activity.state).toEqual(bitsState('0100'))
    expect(readStored(fileKey(2, STATE_FILE))).toEqual({
      content: JSON.stringify(bitsState('0100')),
    })
  })

  it('restores the saved aux file on load', () => {
    writeStored(fileKey(2, STATE_FILE), { content: JSON.stringify(bitsState('0101')) })
    const { result } = render()
    expect(result.current.activity.state).toEqual(bitsState('0101'))
  })

  it('falls back to the initial state for a corrupt save', () => {
    writeStored(fileKey(2, STATE_FILE), { content: '{nope' })
    const { result } = render()
    expect(result.current.activity.state).toEqual(binary.initialState(MAKE_NUMBER))
  })

  it('loads the new task state synchronously when the task changes', () => {
    writeStored(fileKey(3, STATE_FILE), { content: JSON.stringify(answerState('6')) })
    const { result, update } = render()
    update({ currentTaskId: 3 })
    expect(result.current.activity.task.id).toBe(3)
    expect(result.current.activity.state).toEqual(answerState('6'))
  })

  it('keeps presentation saves in memory, not localStorage', () => {
    const { result } = render({ teacherPresentation: true })
    act(() => result.current.activity.onChange(bitsState('0001')))
    expect(readStored(fileKey(2, STATE_FILE))).toBeNull()
    expect(result.current.activity.readSavedState(MAKE_NUMBER)).toEqual(bitsState('0001'))
  })

  it('reports no activity on a code task', () => {
    const { result } = render({ currentTaskId: 1 })
    expect(result.current.activity.definition).toBeNull()
    expect(result.current.activity.state).toBeNull()
  })
})

describe('useActivityState: live writes', () => {
  it('writes discrete changes debounced, even when no teacher is watching', () => {
    const { result, writers } = render()
    act(() => result.current.activity.onChange(bitsState('0001')))
    act(() => result.current.activity.onChange(bitsState('0101')))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(ACTIVITY_ANSWER_DEBOUNCE_MS))
    expect(writers.writeStudentAnswer).toHaveBeenCalledTimes(1)
    expect(writers.writeStudentAnswer).toHaveBeenCalledWith(ANON, JSON.stringify(bitsState('0101')))
  })

  it('never writes continuous changes while unwatched', () => {
    const { result, writers } = render({ currentTaskId: 3 })
    act(() => result.current.activity.onChange(answerState('1')))
    act(() => result.current.activity.onChange(answerState('12')))
    act(() => vi.advanceTimersByTime(5000))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    // Still saved locally.
    expect(readStored(fileKey(3, STATE_FILE))).toEqual({
      content: JSON.stringify(answerState('12')),
    })
  })

  it('throttles continuous changes while this student is watched', () => {
    const { result, writers } = render({
      currentTaskId: 3,
      session: makeSession({ activeStudentView: ANON }),
    })
    writers.writeStudentAnswer.mockClear()
    act(() => result.current.activity.onChange(answerState('1')))
    act(() => result.current.activity.onChange(answerState('12')))
    act(() => result.current.activity.onChange(answerState('123')))
    expect(writers.writeStudentAnswer).toHaveBeenCalledTimes(1)
    expect(writers.writeStudentAnswer).toHaveBeenLastCalledWith(
      ANON,
      JSON.stringify(answerState('1'))
    )
    act(() => vi.advanceTimersByTime(ACTIVITY_CONTINUOUS_THROTTLE_MS))
    expect(writers.writeStudentAnswer).toHaveBeenCalledTimes(2)
    expect(writers.writeStudentAnswer).toHaveBeenLastCalledWith(
      ANON,
      JSON.stringify(answerState('123'))
    )
  })

  it('flushes the latest state the moment the teacher starts watching', () => {
    const { result, writers, updateSession } = render({ currentTaskId: 3 })
    act(() => result.current.activity.onChange(answerState('42')))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    updateSession({ activeStudentView: ANON })
    expect(writers.writeStudentAnswer).toHaveBeenCalledWith(ANON, JSON.stringify(answerState('42')))
    // The generic code mirror is skipped on activity tasks.
    expect(writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('does not write to the session in solo mode', () => {
    const { result, writers } = render({ phase: 'solo' })
    act(() => result.current.activity.onChange(bitsState('0101')))
    act(() => vi.advanceTimersByTime(1000))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    expect(readStored(fileKey(2, STATE_FILE))).not.toBeNull()
  })

  it('drops a pending write when the task changes', () => {
    const { result, writers, update } = render()
    act(() => result.current.activity.onChange(bitsState('0101')))
    update({ currentTaskId: 1 })
    act(() => vi.advanceTimersByTime(1000))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
  })
})

describe('useActivityState: grading', () => {
  it('marks a wrong answer with the definition hint and logs the attempt', async () => {
    const { result, writers } = render()
    act(() => result.current.activity.onChange(bitsState('0100')))
    const outcome = await actAsync(() => result.current.activity.onSubmit())
    expect(outcome.passed).toBe(false)
    expect(result.current.checkPassed).toBe(false)
    expect(result.current.checkAttempted).toBe(true)
    expect(result.current.checkSuggestion).toMatch(/Your bits make 4, which is too small/)
    expect(result.current.runStatus).toBe('submitted')
    expect(writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      answer: JSON.stringify(bitsState('0100')),
      status: 'submitted',
      checkPassed: false,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith(ANON, 2, {
      submission: bitsState('0100'),
      passed: false,
      suggestion: expect.stringMatching(/too small/),
      changeable: false,
      teacherAssisted: false,
    })
  })

  it('marks a correct answer as passed', async () => {
    const { result, writers } = render()
    act(() => result.current.activity.onChange(bitsState('0101')))
    await actAsync(() => result.current.activity.onSubmit())
    expect(result.current.checkPassed).toBe(true)
    expect(writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      answer: JSON.stringify(bitsState('0101')),
      status: 'submitted',
      checkPassed: true,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      2,
      expect.objectContaining({ passed: true, suggestion: '' })
    )
  })

  it('an unknown activity renders nothing to grade and writes nothing', async () => {
    const { result, writers } = render({ currentTaskId: 4 })
    expect(result.current.activity.definition.id).toBe('unknown')
    expect(result.current.activity.state).toBeNull()
    expect(await actAsync(() => result.current.activity.onSubmit())).toBeNull()
    expect(writers.writeStudentRun).not.toHaveBeenCalled()
    expect(readStored(fileKey(4, STATE_FILE))).toBeNull()
  })
})

describe('useActivityState: teacher controls', () => {
  it('applies a remote reset to the answer (complete) and back (starter)', () => {
    const { result, writers, updateStudent } = render()
    updateStudent({ remoteResetAction: 'complete', remoteResetPushedAt: 1000 })
    expect(result.current.activity.state).toEqual(binary.solutionState(MAKE_NUMBER))
    expect(writers.writeStudentAnswer).toHaveBeenLastCalledWith(
      ANON,
      JSON.stringify(binary.solutionState(MAKE_NUMBER))
    )
    expect(readStored(fileKey(2, STATE_FILE))?.content).toBe(
      JSON.stringify(binary.solutionState(MAKE_NUMBER))
    )

    updateStudent({ remoteResetAction: 'starter', remoteResetPushedAt: 2000 })
    expect(result.current.activity.state).toEqual(binary.initialState(MAKE_NUMBER))
  })

  it('ignores a reset already present when the tab loads (an earlier task or reload)', () => {
    writeStored(fileKey(2, STATE_FILE), { content: JSON.stringify(bitsState('0011')) })
    const { result } = render({
      session: makeSession({ student: { remoteResetAction: 'starter', remoteResetPushedAt: 5 } }),
    })
    expect(result.current.activity.state).toEqual(bitsState('0011'))
  })

  it('applies a teacher answer edit and marks the attempt teacher assisted', async () => {
    const { result, writers, updateStudent } = render()
    const answer = JSON.stringify(bitsState('0101'))
    await act(async () => {
      updateStudent({ teacherAnswerEdit: { answer, passed: true, taskId: 2, at: 77 } })
    })
    expect(result.current.activity.state).toEqual(bitsState('0101'))
    expect(result.current.teacherAnswerNoticeAt).toBe(77)
    expect(writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      answer,
      status: 'submitted',
      checkPassed: true,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith(
      ANON,
      2,
      expect.objectContaining({ passed: true, teacherAssisted: true })
    )
  })

  it('applies an unmarked teacher edit without submitting, and the student superseding it clears it', () => {
    const { result, writers, updateStudent } = render()
    const answer = JSON.stringify(bitsState('0001'))
    updateStudent({ teacherAnswerEdit: { answer, passed: null, taskId: 2, at: 78 } })
    expect(result.current.activity.state).toEqual(bitsState('0001'))
    expect(writers.writeStudentRun).not.toHaveBeenCalled()
    act(() => result.current.activity.onChange(bitsState('0011')))
    expect(writers.clearTeacherAnswerEdit).toHaveBeenCalledWith(ANON)
  })

  it('ignores a teacher edit meant for another task', () => {
    const { result, updateStudent } = render()
    updateStudent({
      teacherAnswerEdit: { answer: JSON.stringify(bitsState('1111')), taskId: 3, at: 79 },
    })
    expect(result.current.activity.state).toEqual(binary.initialState(MAKE_NUMBER))
  })

  it("publishes the teacher's own broadcast of the activity state as teacherLive.answer", () => {
    const { result, writers } = render({
      teacherPresentation: true,
      session: makeSession({ teacherLive: { active: true, source: 'teacher', taskId: 2 } }),
    })
    writers.updateTeacherLive.mockClear()
    act(() => result.current.activity.onChange(bitsState('0101')))
    expect(writers.updateTeacherLive).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'teacher',
        taskId: 2,
        answer: JSON.stringify(bitsState('0101')),
      })
    )
    expect(result.current.currentTeacherLivePayload().answer).toBe(
      JSON.stringify(bitsState('0101'))
    )
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
  })

  it("publishes the new task's activity state when the presenting teacher moves task", () => {
    const { writers, update } = render({
      currentTaskId: 1,
      teacherPresentation: true,
      session: makeSession({ teacherLive: { active: true, source: 'teacher', taskId: 1 } }),
    })
    writers.updateTeacherLive.mockClear()
    update({ currentTaskId: 3 })
    expect(writers.updateTeacherLive).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'teacher',
        taskId: 3,
        answer: JSON.stringify(binary.initialState(TO_DECIMAL)),
      })
    )
  })

  it('never publishes a student broadcast on an activity task', () => {
    const { result, writers } = render({
      session: makeSession({
        teacherLive: { active: true, source: 'student', sourceStudentId: ANON, taskId: 2 },
      }),
    })
    writers.updateTeacherLive.mockClear()
    act(() => result.current.activity.onChange(bitsState('0101')))
    act(() => vi.advanceTimersByTime(1000))
    expect(writers.updateTeacherLive).not.toHaveBeenCalled()
  })
})
