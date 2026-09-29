import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudentCodeState } from '../useStudentCodeState'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  OPEN_SHORT_ANSWER_TASK,
  PYTHON_CODE_ARRANGE_TASK,
  SHORT_ANSWER_TASK,
} from '../../../test/fixtures/legacyActivityTasks'

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// the student-side side effects of answering a quiz, a teacher's "Edit answers" push
// (teacherAnswerEdit), and code_arrange tile placements (handleCodeArrangeSlotsChange),
// exercised through the real hook with every session writer replaced by a vi.fn.
//
// Plan step 2.3b moved quizzes onto the activity host: answers now go through
// cs.activity (useActivityState) instead of handleQuizSelect. The quiz UI calls
// onChange(answer) for an in-progress change (was handleQuizSelect(answer, null)) and
// onSubmit(answer, { passedOverride }) for a final answer (was handleQuizSelect(answer,
// passedOverride)); the answer shown is cs.activity.state (was cs.selectedAnswer). The
// writer payloads below are unchanged. Deliberate behaviour changes are marked
// "Deliberately changed in 2.3b". Step 2.3 removed student Go Live publishing on quiz tasks
// (see the broadcast describe block below).

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [] }),
}))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  runPython: vi.fn(),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  isPyodideReady: () => true,
}))

const ME = { anonymousId: 'anon-1', displayName: 'Ada' }

const LESSON = {
  id: 'legacy-activities',
  title: 'Legacy activities',
  type: 'python',
  tasks: [
    MULTIPLE_CHOICE_TASK,
    MATCH_TASK,
    FILL_BLANK_DRAG_TASK,
    SHORT_ANSWER_TASK,
    OPEN_SHORT_ANSWER_TASK,
    CONFIDENCE_TASK,
    PYTHON_CODE_ARRANGE_TASK,
  ],
}

const WRITER_NAMES = [
  'writeStudentRun',
  'logAttempt',
  'writeStudentAnswer',
  'writeStudentCode',
  'writeStudentArcadeDesign',
  'writeStudentTurtleResult',
  'writeStudentSpriteState',
  'writeStudentCursor',
  'writeStudentBlockDrag',
  'writeStudentCodeArrangeSlots',
  'writeStudentFiles',
  'writeStudentOutput',
  'writeStudentInputState',
  'writeStudentInteraction',
  'recordStudentCarryFallback',
  'recordSupportStageReveal',
  'writeStudentPersonalSandbox',
  'writeStudentPresence',
  'registerPresence',
  'removeStudent',
  'updateTeacherLive',
  'setTeacherLive',
  'setTeacherLiveReference',
  'removeTeacherHighlight',
  'clearTeacherAnswerEdit',
  'clearRemoteRun',
]

function makeWriters() {
  return Object.fromEntries(WRITER_NAMES.map((name) => [name, vi.fn(() => Promise.resolve())]))
}

function makeSession({ me = {}, ...rest } = {}) {
  return {
    state: 'active',
    currentTaskId: 1,
    students: { [ME.anonymousId]: { displayName: ME.displayName, ...me } },
    ...rest,
  }
}

function renderCodeState(initial = {}) {
  const writers = makeWriters()
  const baseProps = {
    lessonId: LESSON.id,
    lesson: LESSON,
    currentTaskId: 1,
    viewingTaskId: null,
    phase: 'lesson',
    effectiveIdentity: ME,
    identity: ME,
    session: makeSession(),
    connected: true,
    teacherPresentation: false,
    previewMode: false,
    ...writers,
    ...initial,
  }
  const hook = renderHook((props) => useStudentCodeState(props), { initialProps: baseProps })
  return {
    ...hook,
    writers,
    props: baseProps,
    rerenderWith: (overrides) => {
      Object.assign(baseProps, overrides)
      hook.rerender({ ...baseProps })
    },
  }
}

async function submitAnswer(result, answer, passedOverride) {
  await act(async () => {
    await result.current.activity.onSubmit(answer, { passedOverride })
  })
}

function changeAnswer(result, answer) {
  act(() => result.current.activity.onChange(answer))
}

function localStorageValues() {
  const values = []
  for (let i = 0; i < window.localStorage.length; i++) {
    values.push(window.localStorage.getItem(window.localStorage.key(i)))
  }
  return values
}

beforeEach(() => {
  vi.useFakeTimers()
  // Quiz answers persist per task since 2.3b, so each test starts from clean storage.
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('quiz in-progress answers (onChange; was handleQuizSelect with passedOverride null)', () => {
  it('keeps the answer and writes the serialized answer once, 300 ms after the last change', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 2 })
    changeAnswer(result, { p1: 'p2' })
    changeAnswer(result, { p1: 'p1' })
    // The state holds the parsed answer, not its serialization.
    expect(result.current.activity.state).toEqual({ p1: 'p1' })

    act(() => vi.advanceTimersByTime(299))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(writers.writeStudentAnswer.mock.calls).toEqual([['anon-1', '{"p1":"p1"}']])

    // In-progress answers are never marked, logged, or run-recorded.
    expect(writers.writeStudentRun).not.toHaveBeenCalled()
    expect(writers.logAttempt).not.toHaveBeenCalled()
    expect(result.current.runStatus).toBeNull()
    expect(result.current.checkAttempted).toBe(false)
  })

  it('writes the in-progress answer whether or not a teacher is watching, but not in presentation or solo', async () => {
    const watched = renderCodeState({
      currentTaskId: 2,
      session: makeSession({ activeStudentView: 'someone-else' }),
    })
    changeAnswer(watched.result, { p1: 'p1' })
    act(() => vi.advanceTimersByTime(300))
    expect(watched.writers.writeStudentAnswer).toHaveBeenCalledTimes(1)

    for (const props of [{ teacherPresentation: true }, { phase: 'solo' }]) {
      const { result, writers } = renderCodeState({ currentTaskId: 2, ...props })
      changeAnswer(result, { p1: 'p1' })
      act(() => vi.advanceTimersByTime(300))
      expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    }
  })

  // Deliberately changed in 2.3b (was: "does nothing without an effective identity", which
  // also pinned selectedAnswer staying ''): the host still shows the change on screen, but
  // nothing is written to the session or saved.
  it('writes and saves nothing without an effective identity', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 2, effectiveIdentity: null })
    changeAnswer(result, { p1: 'p1' })
    act(() => vi.advanceTimersByTime(300))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
    expect(localStorageValues().filter((value) => value.includes('p1'))).toEqual([])
  })
})

describe('quiz submissions (onSubmit; was handleQuizSelect with a passedOverride)', () => {
  it('multiple_choice: evaluates task.check, records the run, and logs the attempt with the option suggestion', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 1 })
    await submitAnswer(result, 'b')
    expect(writers.writeStudentRun.mock.calls).toEqual([
      ['anon-1', { answer: 'b', status: 'submitted', checkPassed: false }],
    ])
    expect(writers.logAttempt.mock.calls).toEqual([
      [
        'anon-1',
        1,
        {
          submission: 'b',
          passed: false,
          suggestion: 'input() asks the user a question.',
          teacherAssisted: false,
        },
      ],
    ])
    expect(result.current.activity.state).toBe('b')
    expect(result.current.runStatus).toBe('submitted')
    expect(result.current.checkPassed).toBe(false)
    expect(result.current.checkAttempted).toBe(true)
    // The debounced mirror is only for in-progress answers.
    act(() => vi.advanceTimersByTime(1000))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
  })

  it('match: marks the complete board and logs the per-pair submission', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 2 })
    const answer = { p1: 'p1', p2: 'p2', p3: 'p3' }
    await submitAnswer(result, answer, true)
    expect(writers.writeStudentRun).toHaveBeenCalledWith('anon-1', {
      answer: JSON.stringify(answer),
      status: 'submitted',
      checkPassed: true,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith('anon-1', 2, {
      submission: {
        p1: { prompt: 'print()', value: 'Shows text', expected: 'Shows text', correct: true },
        p2: {
          prompt: 'input()',
          value: 'Asks a question',
          expected: 'Asks a question',
          correct: true,
        },
        p3: { prompt: 'len()', value: 'Counts items', expected: 'Counts items', correct: true },
      },
      passed: true,
      suggestion: '',
      teacherAssisted: false,
    })
    expect(result.current.checkPassed).toBe(true)
  })

  it('fill_blank: a wrong answer suggests the task feedback (empty here)', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 3 })
    await submitAnswer(result, { b1: 'b1', b2: 'd1' }, false)
    expect(writers.logAttempt).toHaveBeenCalledWith('anon-1', 3, {
      submission: {
        b1: { value: 'print', expected: 'print', correct: true },
        b2: { value: 'len', expected: 'input', correct: false },
      },
      passed: false,
      suggestion: '',
      teacherAssisted: false,
    })
  })

  it('short_answer: evaluates the answer_* check and suggests its hint on failure', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 5 })
    await submitAnswer(result, 'It prints')
    expect(writers.logAttempt).toHaveBeenLastCalledWith('anon-1', 5, {
      submission: 'It prints',
      passed: false,
      suggestion: 'Mention what print shows.',
      teacherAssisted: false,
    })
    await submitAnswer(result, 'It shows text')
    expect(writers.writeStudentRun).toHaveBeenLastCalledWith('anon-1', {
      answer: 'It shows text',
      status: 'submitted',
      checkPassed: true,
    })
  })

  it('open short_answer: passes any non-blank answer', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 6 })
    await submitAnswer(result, 'I learned loops')
    expect(writers.logAttempt).toHaveBeenCalledWith('anon-1', 6, {
      submission: 'I learned loops',
      passed: true,
      suggestion: '',
      teacherAssisted: false,
    })
  })

  it('confidence: logs the numeric rating and records the raw string answer', async () => {
    const { result, writers } = renderCodeState({ currentTaskId: 7 })
    await submitAnswer(result, '4', true)
    expect(writers.writeStudentRun).toHaveBeenCalledWith('anon-1', {
      answer: '4',
      status: 'submitted',
      checkPassed: true,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith('anon-1', 7, {
      submission: 4,
      passed: true,
      suggestion: '',
      teacherAssisted: false,
    })
  })

  it('records the run but logs no attempt in sandbox; writes nothing in teacher presentation', async () => {
    const sandbox = renderCodeState({ currentTaskId: 1, phase: 'sandbox' })
    await submitAnswer(sandbox.result, 'a')
    expect(sandbox.writers.writeStudentRun).toHaveBeenCalledTimes(1)
    expect(sandbox.writers.logAttempt).not.toHaveBeenCalled()

    const presenter = renderCodeState({ currentTaskId: 1, teacherPresentation: true })
    await submitAnswer(presenter.result, 'a')
    expect(presenter.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(presenter.writers.logAttempt).not.toHaveBeenCalled()
    expect(presenter.result.current.checkPassed).toBe(true)
  })
})

// Deliberately changed in 2.3b (user decision, plan "Quiz persistence"). Was pinned as
// "never writes quiz answers to localStorage" and "clears the selected answer on task switch
// and does not restore it on return". Quiz answers now persist in the per-task
// `__activity_state__` aux file, in their currentAnswer string format, and come back on reload
// or on returning to the task.
describe('quiz answer persistence', () => {
  const key = (taskId) => `headstart_${LESSON.id}_${taskId}___activity_state___${ME.anonymousId}`

  it('saves every quiz answer to the task aux file in its currentAnswer format', async () => {
    const { result } = renderCodeState({ currentTaskId: 2 })
    changeAnswer(result, { p1: 'p3' })
    expect(JSON.parse(window.localStorage.getItem(key(2)))).toEqual({ content: '{"p1":"p3"}' })
    await submitAnswer(result, { p1: 'p3', p2: 'p2', p3: 'p1' }, false)
    expect(JSON.parse(window.localStorage.getItem(key(2)))).toEqual({
      content: '{"p1":"p3","p2":"p2","p3":"p1"}',
    })

    const mc = renderCodeState({ currentTaskId: 1 })
    await submitAnswer(mc.result, 'b')
    expect(JSON.parse(window.localStorage.getItem(key(1)))).toEqual({ content: 'b' })
  })

  it('restores the answer on returning to the task and after a reload', async () => {
    const { result, rerenderWith, unmount } = renderCodeState({ currentTaskId: 1 })
    await submitAnswer(result, 'b')
    expect(result.current.activity.state).toBe('b')

    rerenderWith({ currentTaskId: 2 })
    expect(result.current.activity.state).toEqual({})
    rerenderWith({ currentTaskId: 1 })
    expect(result.current.activity.state).toBe('b')
    act(() => result.current.resetForTaskChange())
    expect(result.current.activity.state).toBe('b')
    unmount()

    const reloaded = renderCodeState({ currentTaskId: 1 })
    expect(reloaded.result.current.activity.state).toBe('b')
    // Only the answer comes back; the run status and marking start fresh.
    expect(reloaded.result.current.runStatus).toBeNull()
  })

  it('keeps presentation answers in memory only', async () => {
    const { result } = renderCodeState({ currentTaskId: 1, teacherPresentation: true })
    await submitAnswer(result, 'b')
    expect(window.localStorage.getItem(key(1))).toBeNull()
  })
})

describe('teacherAnswerEdit (StudentModal "Edit answers") on the student side', () => {
  const EDIT = {
    answer: '{"p1":"p1","p2":"p2","p3":"p3"}',
    codeArrangeSlots: null,
    passed: true,
    taskId: 2,
    at: 555,
  }

  it('applies a quiz edit as a submission, flagged teacherAssisted, without clearing the edit', async () => {
    const { result, writers } = renderCodeState({
      currentTaskId: 2,
      session: makeSession({ currentTaskId: 2, me: { teacherAnswerEdit: EDIT } }),
    })
    // The effect does not await the submission; logAttempt follows the awaited run write.
    await act(async () => {})
    expect(result.current.activity.state).toEqual({ p1: 'p1', p2: 'p2', p3: 'p3' })
    expect(result.current.teacherAnswerNoticeAt).toBe(555)
    expect(writers.writeStudentRun).toHaveBeenCalledWith('anon-1', {
      answer: EDIT.answer,
      status: 'submitted',
      checkPassed: true,
    })
    expect(writers.logAttempt).toHaveBeenCalledWith(
      'anon-1',
      2,
      expect.objectContaining({ passed: true, teacherAssisted: true })
    )
    expect(writers.clearTeacherAnswerEdit).not.toHaveBeenCalled()
  })

  it('an edit with passed: null is applied as in-progress (debounced mirror, no attempt)', () => {
    const { result, writers } = renderCodeState({
      currentTaskId: 2,
      session: makeSession({ me: { teacherAnswerEdit: { ...EDIT, passed: null } } }),
    })
    expect(result.current.activity.state).toEqual({ p1: 'p1', p2: 'p2', p3: 'p3' })
    act(() => vi.advanceTimersByTime(300))
    expect(writers.writeStudentAnswer).toHaveBeenCalledWith('anon-1', EDIT.answer)
    expect(writers.logAttempt).not.toHaveBeenCalled()
  })

  it("the student's next own change clears the pending edit, and later attempts stay teacherAssisted", async () => {
    const { result, writers } = renderCodeState({
      currentTaskId: 2,
      session: makeSession({ me: { teacherAnswerEdit: EDIT } }),
    })
    writers.logAttempt.mockClear()
    await submitAnswer(result, { p1: 'p2', p2: 'p1', p3: 'p3' }, false)
    expect(writers.clearTeacherAnswerEdit).toHaveBeenCalledWith('anon-1')
    expect(writers.logAttempt).toHaveBeenCalledWith(
      'anon-1',
      2,
      expect.objectContaining({ passed: false, teacherAssisted: true })
    )
  })

  it('ignores an edit for a different task, and waits for the lesson phase', () => {
    const otherTask = renderCodeState({
      currentTaskId: 1,
      session: makeSession({ me: { teacherAnswerEdit: EDIT } }),
    })
    expect(otherTask.result.current.activity.state).toBe('')
    expect(otherTask.writers.writeStudentRun).not.toHaveBeenCalled()

    const waiting = renderCodeState({
      currentTaskId: 2,
      phase: 'waiting',
      session: makeSession({ me: { teacherAnswerEdit: EDIT } }),
    })
    expect(waiting.result.current.teacherAnswerNoticeAt).toBeNull()
    waiting.rerenderWith({ phase: 'lesson' })
    expect(waiting.result.current.teacherAnswerNoticeAt).toBe(555)
  })

  it('hands a code_arrange edit to the workspace as teacherCodeArrangeEdit instead of writing anything', () => {
    const slots = { S1: 'S1', L2: 'L2' }
    const { result, writers } = renderCodeState({
      currentTaskId: 8,
      session: makeSession({
        me: { teacherAnswerEdit: { answer: null, codeArrangeSlots: slots, taskId: 8, at: 777 } },
      }),
    })
    expect(result.current.teacherCodeArrangeEdit).toEqual({ slots, at: 777 })
    expect(result.current.teacherAnswerNoticeAt).toBe(777)
    expect(writers.writeStudentRun).not.toHaveBeenCalled()
    expect(writers.writeStudentCodeArrangeSlots).not.toHaveBeenCalled()
  })
})

describe('code_arrange slot mirror (handleCodeArrangeSlotsChange)', () => {
  it('writes every placement to currentCodeArrangeSlots whether watched or not', () => {
    const { result, writers } = renderCodeState({ currentTaskId: 8 })
    act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1d1' }))
    expect(writers.writeStudentCodeArrangeSlots.mock.calls).toEqual([['anon-1', { S1: 'S1d1' }]])
    expect(writers.clearTeacherAnswerEdit).not.toHaveBeenCalled()
  })

  it('clears a pending teacher edit on a student placement but not on a fromTeacher one', () => {
    const edit = { answer: null, codeArrangeSlots: { S1: 'S1' }, taskId: 99, at: 1 }
    const { result, writers } = renderCodeState({
      currentTaskId: 8,
      session: makeSession({ me: { teacherAnswerEdit: edit } }),
    })
    act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1' }, { fromTeacher: true }))
    expect(writers.clearTeacherAnswerEdit).not.toHaveBeenCalled()
    act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1d1' }))
    expect(writers.clearTeacherAnswerEdit).toHaveBeenCalledWith('anon-1')
  })

  it('does not write in teacher presentation or solo', () => {
    for (const props of [{ teacherPresentation: true }, { phase: 'solo' }]) {
      const { result, writers } = renderCodeState({ currentTaskId: 8, ...props })
      act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1' }))
      expect(writers.writeStudentCodeArrangeSlots).not.toHaveBeenCalled()
    }
  })

  it('flushes the latest slots (and code, not answers) when a teacher starts watching', async () => {
    const { result, writers, rerenderWith } = renderCodeState({ currentTaskId: 8 })
    act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1', L2: 'D1' }))
    writers.writeStudentCodeArrangeSlots.mockClear()

    rerenderWith({ session: makeSession({ activeStudentView: 'anon-1' }) })
    expect(writers.writeStudentCodeArrangeSlots.mock.calls).toEqual([
      ['anon-1', { S1: 'S1', L2: 'D1' }],
    ])
    expect(writers.writeStudentCode).toHaveBeenCalledWith('anon-1', expect.any(String))
  })

  // Deliberately changed in 2.3b (was: "a quiz answer is NOT re-flushed when a teacher starts
  // watching", with the generic code mirror writing the empty quiz code). Quizzes flush like
  // every activity: the latest answer (which may have been restored after a reload) is written
  // once, and no code is mirrored for a quiz task.
  it('flushes the quiz answer (not code) once when a teacher starts watching', async () => {
    const { result, writers, rerenderWith } = renderCodeState({ currentTaskId: 2 })
    changeAnswer(result, { p1: 'p1' })
    act(() => vi.advanceTimersByTime(300))
    writers.writeStudentAnswer.mockClear()
    writers.writeStudentCodeArrangeSlots.mockClear()

    rerenderWith({ session: makeSession({ activeStudentView: 'anon-1' }) })
    expect(writers.writeStudentAnswer.mock.calls).toEqual([['anon-1', '{"p1":"p1"}']])
    expect(writers.writeStudentCodeArrangeSlots).not.toHaveBeenCalled()
    expect(writers.writeStudentCode).not.toHaveBeenCalled()
  })

  it('still flushes the sandbox code when the session sandbox is parked on a quiz task', () => {
    const { writers, rerenderWith } = renderCodeState({ currentTaskId: 2, phase: 'sandbox' })
    rerenderWith({ session: makeSession({ activeStudentView: 'anon-1' }) })
    expect(writers.writeStudentCode).toHaveBeenCalledWith('anon-1', expect.any(String))
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
  })

  it('does not flush an untouched quiz when a teacher starts watching', () => {
    const { writers, rerenderWith } = renderCodeState({ currentTaskId: 2 })
    rerenderWith({ session: makeSession({ activeStudentView: 'anon-1' }) })
    expect(writers.writeStudentAnswer).not.toHaveBeenCalled()
  })
})

describe('student Go Live broadcast of quiz answers and code_arrange slots', () => {
  const LIVE = { active: true, source: 'student', sourceStudentId: 'anon-1', taskId: 1 }

  // Deliberately changed in plan step 2.3 (was: "publishes the serialized answer with the
  // marked result on submit only"). Broadcasting a student's quiz or activity answers to the
  // class was removed; only the teacher's own broadcast is allowed on these tasks. A student
  // broadcast still running from an earlier code task therefore stops publishing here.
  it('never publishes a student broadcast on a quiz task', async () => {
    const { result, writers } = renderCodeState({
      currentTaskId: 1,
      session: makeSession({ teacherLive: LIVE }),
    })
    writers.updateTeacherLive.mockClear()
    changeAnswer(result, 'c')
    await submitAnswer(result, 'b')
    expect(writers.updateTeacherLive).not.toHaveBeenCalled()
    // The answer itself is still recorded as normal.
    expect(writers.writeStudentRun).toHaveBeenCalledWith(
      'anon-1',
      expect.objectContaining({ answer: 'b', status: 'submitted', checkPassed: false })
    )
  })

  it('publishes each code_arrange placement as codeArrangeSlots', () => {
    const { result, writers } = renderCodeState({
      currentTaskId: 8,
      session: makeSession({ teacherLive: { ...LIVE, taskId: 8 } }),
    })
    writers.updateTeacherLive.mockClear()
    act(() => result.current.handleCodeArrangeSlotsChange({ S1: 'S1' }))
    expect(writers.updateTeacherLive).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 8, codeArrangeSlots: { S1: 'S1' } })
    )
  })
})
