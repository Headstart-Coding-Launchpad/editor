import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ActivityHost, { ActivityView } from '../ActivityHost.jsx'
import { getActivityDefinition, getTaskActivity, isLegacyQuizTask } from '../registry.pure.js'
import { getTaskActivityUi } from '../registry.js'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  LEGACY_QUIZ_TASKS,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  OPEN_SHORT_ANSWER_TASK,
  PYTHON_CODE_ARRANGE_TASK,
  SHORT_ANSWER_TASK,
} from '../../test/fixtures/legacyActivityTasks'
import { buildQuizSubmission, getQuizSuggestion } from '../quiz/quizActivity.js'

// Plan steps 2.2 / 2.3b: each legacy quiz sub-type is an activity. These tests cover what the
// definitions add on top of the Phase 0 characterisation suites (which pin submissions, item
// progress, reports and print byte-for-byte): stored formats, grading parity with the old
// handleQuizSelect rules, and how the hosted quiz UI reports answers.

const QUIZ_IDS = {
  multiple_choice: 'quiz_multiple_choice',
  match: 'quiz_match',
  fill_blank_drag: 'quiz_fill_blank',
  fill_blank_type: 'quiz_fill_blank',
  short_answer: 'quiz_short_answer',
  short_answer_open: 'quiz_short_answer',
  confidence: 'quiz_confidence',
}

describe('quiz activity definitions', () => {
  it.each(Object.entries(LEGACY_QUIZ_TASKS))('resolves the %s fixture', (key, task) => {
    expect(getTaskActivity(task).id).toBe(QUIZ_IDS[key])
    expect(isLegacyQuizTask(task)).toBe(true)
  })

  it('does not treat code_arrange or code tasks as quizzes', () => {
    expect(isLegacyQuizTask(PYTHON_CODE_ARRANGE_TASK)).toBe(false)
    expect(isLegacyQuizTask({ starterCode: 'print(1)' })).toBe(false)
  })

  it('keeps the currentAnswer string formats exactly', () => {
    const cases = [
      [MULTIPLE_CHOICE_TASK, 'b', 'b'],
      [MATCH_TASK, '{"p1":"p2","p2":"p1"}', { p1: 'p2', p2: 'p1' }],
      [FILL_BLANK_DRAG_TASK, '{"b1":"d1"}', { b1: 'd1' }],
      [FILL_BLANK_TYPE_TASK, '{"t1":"loop"}', { t1: 'loop' }],
      [SHORT_ANSWER_TASK, 'It shows {text}', 'It shows {text}'],
      [CONFIDENCE_TASK, '4', '4'],
    ]
    for (const [task, raw, state] of cases) {
      const activity = getTaskActivity(task)
      expect(activity.deserialize(raw, task)).toEqual(state)
      expect(activity.serialize(state)).toBe(raw)
    }
  })

  it('reads stored answers tolerantly', () => {
    expect(getTaskActivity(MULTIPLE_CHOICE_TASK).deserialize('z', MULTIPLE_CHOICE_TASK)).toBe('')
    expect(getTaskActivity(MATCH_TASK).deserialize(['p1'], MATCH_TASK)).toEqual({})
    expect(getTaskActivity(MATCH_TASK).deserialize({ p1: 'p1' }, MATCH_TASK)).toEqual({ p1: 'p1' })
    expect(getTaskActivity(CONFIDENCE_TASK).deserialize('9', CONFIDENCE_TASK)).toBe('')
  })

  it('grades like the old handleQuizSelect rules', () => {
    const grade = (task, answer) => getTaskActivity(task).grade(task, answer)
    expect(grade(MULTIPLE_CHOICE_TASK, 'a')).toEqual({ passed: true, suggestion: '' })
    expect(grade(MULTIPLE_CHOICE_TASK, 'b')).toEqual({
      passed: false,
      suggestion: getQuizSuggestion(MULTIPLE_CHOICE_TASK, 'b'),
    })
    expect(grade(MATCH_TASK, { p1: 'p1', p2: 'p2', p3: 'p3' }).passed).toBe(true)
    expect(grade(MATCH_TASK, { p1: 'p2', p2: 'p1', p3: 'p3' })).toEqual({
      passed: false,
      suggestion: 'Check each pair again.',
    })
    expect(grade(FILL_BLANK_DRAG_TASK, { b1: 'b1', b2: 'b2' }).passed).toBe(true)
    expect(grade(FILL_BLANK_DRAG_TASK, { b1: 'b1', b2: 'd1' }).passed).toBe(false)
    expect(grade(FILL_BLANK_TYPE_TASK, { t1: ' LOOP ' }).passed).toBe(true)
    expect(grade(SHORT_ANSWER_TASK, 'It shows text').passed).toBe(true)
    expect(grade(SHORT_ANSWER_TASK, 'It prints')).toEqual({
      passed: false,
      suggestion: 'Mention what print shows.',
    })
    expect(grade(OPEN_SHORT_ANSWER_TASK, 'Loops').passed).toBe(true)
    expect(grade(OPEN_SHORT_ANSWER_TASK, '   ').passed).toBe(false)
    expect(grade(CONFIDENCE_TASK, '2')).toEqual({ passed: true, suggestion: '' })
  })

  it('marks which quizzes are graded, auto-completing, editable and never marked', () => {
    const summary = Object.fromEntries(
      Object.entries(LEGACY_QUIZ_TASKS).map(([key, task]) => {
        const activity = getTaskActivity(task)
        return [key, [activity.isGraded(task), activity.completion, activity.teacherEditable]]
      })
    )
    expect(summary).toEqual({
      multiple_choice: [true, 'on_submit', false],
      match: [true, 'auto', true],
      fill_blank_drag: [true, 'auto', true],
      fill_blank_type: [true, 'auto', true],
      short_answer: [true, 'on_submit', false],
      short_answer_open: [false, 'on_submit', false],
      confidence: [false, 'none', false],
    })
  })

  it('builds attempt submissions with the shared quiz helper', () => {
    for (const task of Object.values(LEGACY_QUIZ_TASKS)) {
      const activity = getTaskActivity(task)
      const state = activity.solutionState?.(task) ?? activity.initialState(task)
      expect(activity.buildSubmission(task, state)).toEqual(buildQuizSubmission(task, state))
    }
  })

  it('shows quizzes blank on the teacher panel (often projected)', () => {
    for (const quizType of ['multiple_choice', 'match', 'fill_blank']) {
      expect(getActivityDefinition(`quiz_${quizType}`).previewState).toBe('initial')
    }
  })
})

describe('hosted quiz UI', () => {
  function renderHost(task, state, extra = {}) {
    const activity = {
      task,
      state,
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      readSavedState: vi.fn(() => null),
    }
    render(<ActivityHost task={task} activity={activity} {...extra} />)
    return activity
  }

  it('renders the quiz itself, with no activity header or frame', () => {
    renderHost(MULTIPLE_CHOICE_TASK, '')
    expect(screen.queryByTestId('activity-host')).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(getTaskActivityUi(MULTIPLE_CHOICE_TASK).ownsLayout).toBe(true)
  })

  it('submits a chosen option as a final answer', () => {
    const activity = renderHost(MULTIPLE_CHOICE_TASK, '')
    fireEvent.click(screen.getAllByRole('radio')[1])
    expect(activity.onSubmit).toHaveBeenCalledWith('b', { passedOverride: undefined })
    expect(activity.onChange).not.toHaveBeenCalled()
  })

  it('shows the saved answer selected', () => {
    renderHost(MULTIPLE_CHOICE_TASK, 'b')
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('reports a confidence rating as a final answer', () => {
    const activity = renderHost(CONFIDENCE_TASK, '')
    fireEvent.click(screen.getByTitle('Confidence level 3'))
    expect(activity.onSubmit).toHaveBeenCalledWith('3', { passedOverride: true })
  })

  it('reports typed gaps as in-progress changes and Submit as the final answer', () => {
    const activity = renderHost(FILL_BLANK_TYPE_TASK, { t1: 'loop' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'loops' } })
    expect(activity.onChange).toHaveBeenCalledWith({ t1: 'loops' })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(activity.onSubmit).toHaveBeenCalledWith({ t1: 'loop' }, { passedOverride: true })
  })

  it('is read-only while reviewing an earlier task', () => {
    const task = MULTIPLE_CHOICE_TASK
    const activity = {
      task: { id: 99 },
      state: '',
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      readSavedState: vi.fn(() => 'c'),
    }
    render(<ActivityHost task={task} activity={activity} reviewing />)
    fireEvent.click(screen.getAllByRole('radio')[0])
    expect(activity.onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByRole('radio')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('shows the teacher the verdict and correct answer once submitted', () => {
    render(
      <ActivityView
        task={MULTIPLE_CHOICE_TASK}
        state="b"
        teacher
        readOnly
        result={{ submitted: true, passed: false }}
      />
    )
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
  })
})
