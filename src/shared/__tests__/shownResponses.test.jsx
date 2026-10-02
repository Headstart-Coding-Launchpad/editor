import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildShownResponsesByTask,
  canShowResponses,
  defaultShowName,
  findShownResponse,
  getShownResponses,
  normalizeShownText,
} from '../shownResponses'
import { buildSessionReport, anonymizeSessionReport } from '../lessonReport'
import { validateQuizTask } from '../../activities/legacyValidation'
import QuizTask from '../../app/components/QuizTask'
import { PollTaskClassContext } from '../../app/components/quiz/PollTaskClassContext'
import StudentCard from '../../app/components/StudentCard'

const task = {
  id: 3,
  title: 'Show and tell',
  taskType: 'quiz',
  quizType: 'short_answer',
  explainer: 'What have you made since last lesson?',
  showResponses: 'teacher_picks',
}

const session = {
  state: 'active',
  currentTaskId: 3,
  students: {
    'anon-a': { displayName: 'Ada', currentAnswer: 'A maze game' },
    'anon-b': { displayName: 'Ben', currentAnswer: 'A song' },
  },
  shownResponses: {
    r2: { taskId: '3', anonymousId: 'anon-b', text: 'A song', showName: true, shownAt: 20 },
    r1: { taskId: '3', anonymousId: 'anon-a', text: 'A maze game', showName: false, shownAt: 10 },
    r3: {
      taskId: '3',
      anonymousId: 'anon-c',
      text: 'Hidden one',
      showName: false,
      shownAt: 5,
      hiddenAt: 8,
    },
    r4: { taskId: '9', anonymousId: 'anon-a', text: 'Other task', showName: false, shownAt: 1 },
  },
}

describe('shownResponses helpers', () => {
  it('only allows open short answers that opt in', () => {
    expect(canShowResponses(task)).toBe(true)
    expect(canShowResponses({ ...task, showResponses: undefined })).toBe(false)
    expect(canShowResponses({ ...task, check: { type: 'answer_contains', value: 'x' } })).toBe(
      false
    )
    expect(canShowResponses({ ...task, quizType: 'poll' })).toBe(false)
  })

  it('anonymises by default', () => {
    expect(defaultShowName(task)).toBe(false)
    expect(defaultShowName({ ...task, anonymiseResponses: false })).toBe(true)
  })

  it('trims and caps the stored text', () => {
    expect(normalizeShownText('  hi  ')).toBe('hi')
    expect(normalizeShownText('x'.repeat(2000))).toHaveLength(1000)
    expect(normalizeShownText(null)).toBe('')
  })

  it('lists the answers on screen for a task in the order shown, names only when on', () => {
    const shown = getShownResponses(session, 3)
    expect(shown.map((r) => r.text)).toEqual(['A maze game', 'A song'])
    expect(shown.map((r) => r.name)).toEqual([null, 'Ben'])
    expect(getShownResponses(session, '9').map((r) => r.text)).toEqual(['Other task'])
  })

  it('finds a student entry whether shown or hidden', () => {
    expect(findShownResponse(session, 3, 'anon-c')?.responseId).toBe('r3')
    expect(findShownResponse(session, 3, 'anon-z')).toBeNull()
  })

  it('groups every shown answer by task for the report', () => {
    const byTask = buildShownResponsesByTask(session, (id) => `Label ${id}`)
    expect(byTask['3'].map((r) => r.text)).toEqual(['Hidden one', 'A maze game', 'A song'])
    expect(byTask['3'][0]).toMatchObject({ studentLabel: 'Label anon-c', hiddenAt: 8 })
  })
})

describe('validation', () => {
  const run = (overrides) => {
    const errors = []
    validateQuizTask({ ...task, ...overrides }, { n: 1, errors })
    return errors
  }

  it('accepts an open short answer with showResponses', () => {
    expect(run({})).toEqual([])
    expect(run({ anonymiseResponses: false })).toEqual([])
  })

  it('rejects an unknown mode, a graded task and a non-boolean anonymiseResponses', () => {
    expect(run({ showResponses: 'all' })[0]).toMatch(/not teacher_picks/)
    expect(run({ check: { type: 'answer_contains', value: 'x' } })[0]).toMatch(/only open answers/)
    expect(run({ anonymiseResponses: 'yes' })[0]).toMatch(/anonymiseResponses/)
  })
})

describe('session report', () => {
  const lesson = { id: 'l1', title: 'Lesson', tasks: [task] }

  it('records the answers shown on the task summary, without names', () => {
    const report = buildSessionReport({ session, lesson })
    const summary = report.taskSummary.find((t) => t.taskId === 3)
    expect(summary.shownResponses.map((r) => r.text)).toEqual([
      'Hidden one',
      'A maze game',
      'A song',
    ])
    expect(JSON.stringify(summary.shownResponses)).not.toMatch(/anon-|Ada|Ben/)
  })

  it('leaves shownResponses off when nothing was shown', () => {
    const report = buildSessionReport({ session: { ...session, shownResponses: null }, lesson })
    expect(report.taskSummary[0]).not.toHaveProperty('shownResponses')
  })

  it('relabels shown answers when anonymising', () => {
    const named = anonymizeSessionReport({
      students: [{ anonymousId: 'anon-a', displayName: 'Ada', tasks: [] }],
      taskSummary: [{ taskId: 3, shownResponses: [{ displayName: 'Ada', text: 'A maze game' }] }],
    })
    expect(named.taskSummary[0].shownResponses[0].studentLabel).toBe('Student 1')
  })
})

describe('presentation window', () => {
  function renderQuiz(value, taskOverrides = {}) {
    return render(
      <PollTaskClassContext.Provider value={value}>
        <QuizTask task={{ ...task, ...taskOverrides }} showQuestion onSelectAnswer={() => {}} />
      </PollTaskClassContext.Provider>
    )
  }

  it('shows the picked answers instead of the answer box', () => {
    renderQuiz({ session, anonymousId: null, presentation: true })
    expect(screen.getByText('A maze game')).toBeInTheDocument()
    expect(screen.getByText('— Ben')).toBeInTheDocument()
    expect(screen.queryByText('Hidden one')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Type your answer here…')).not.toBeInTheDocument()
  })

  it('says answers are coming when none are shown yet', () => {
    renderQuiz({ session: { ...session, shownResponses: null }, presentation: true })
    expect(screen.getByText(/will pick some answers/)).toBeInTheDocument()
  })

  it('leaves students and tasks without showResponses unchanged', () => {
    const { unmount } = renderQuiz({ session, anonymousId: 'anon-a', presentation: false })
    expect(screen.getByPlaceholderText('Type your answer here…')).toBeInTheDocument()
    unmount()
    renderQuiz({ session, presentation: true }, { showResponses: undefined })
    expect(screen.getByPlaceholderText('Type your answer here…')).toBeInTheDocument()
  })
})

describe('teacher student card', () => {
  const lesson = { type: 'python', tasks: [task] }
  const student = {
    anonymousId: 'anon-a',
    displayName: 'Ada',
    online: true,
    currentAnswer: 'A maze game',
    lastRunStatus: 'submitted',
  }

  function renderCard(props = {}) {
    const handlers = {
      onShowResponse: vi.fn(),
      onHideResponse: vi.fn(),
      onSetShownResponseName: vi.fn(),
      onExpand: vi.fn(),
    }
    render(
      <StudentCard
        student={student}
        lesson={lesson}
        session={{ ...session, shownResponses: null }}
        {...handlers}
        {...props}
      />
    )
    return handlers
  }

  it('shows an answer anonymously without opening the student', () => {
    const handlers = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /📺 Show/ }))
    expect(handlers.onShowResponse).toHaveBeenCalledWith(3, 'anon-a', 'A maze game', false)
    expect(handlers.onExpand).not.toHaveBeenCalled()
  })

  it('hides a shown answer and toggles its name', () => {
    const handlers = renderCard({ session })
    fireEvent.click(screen.getByRole('button', { name: /On screen/ }))
    expect(handlers.onHideResponse).toHaveBeenCalledWith('r1')
    fireEvent.click(screen.getByRole('button', { name: /Anonymous/ }))
    expect(handlers.onSetShownResponseName).toHaveBeenCalledWith('r1', true)
  })

  it('has no show button on a graded short answer', () => {
    renderCard({
      lesson: { ...lesson, tasks: [{ ...task, check: { type: 'answer_contains', value: 'x' } }] },
    })
    expect(screen.queryByRole('button', { name: /📺/ })).not.toBeInTheDocument()
  })
})
