import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ClassPollCard from '../ClassPollCard'
import TeacherPollControl from '../TeacherPollControl'
import ReportPollsSection from '../ReportPollsSection'
import { getActivePoll, tallyPoll } from '../../../../shared/classPolls'

const openPoll = {
  question: 'What next?',
  options: ['Games', 'Art'],
  status: 'open',
  showResults: false,
  createdAt: 1,
}

function sessionWith(poll, students = {}) {
  return { state: 'active', activePollId: 'p1', polls: { p1: poll }, students }
}

describe('TeacherPollControl', () => {
  function renderControl(session, overrides = {}) {
    const props = {
      session,
      onLaunch: vi.fn(() => Promise.resolve('p1')),
      onClosePoll: vi.fn(() => Promise.resolve()),
      onSetShowResults: vi.fn(() => Promise.resolve()),
      onDismiss: vi.fn(() => Promise.resolve()),
      ...overrides,
    }
    render(<TeacherPollControl {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Poll/ }))
    return props
  }

  it('launches a poll from the form', async () => {
    const props = renderControl({ state: 'active', students: {} })
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What next?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Games' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Art' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add option' }))
    expect(screen.getByLabelText('Option 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Launch poll' }))
    await waitFor(() =>
      expect(props.onLaunch).toHaveBeenCalledWith({
        question: 'What next?',
        options: ['Games', 'Art', ''],
        keepPrivate: false,
      })
    )
  })

  it('launches a private poll when "Keep results private" is ticked', async () => {
    const props = renderControl({ state: 'active', students: {} })
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Q?' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Yes' } })
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'No' } })
    fireEvent.click(screen.getByLabelText('Keep results private'))
    fireEvent.click(screen.getByRole('button', { name: 'Launch poll' }))
    await waitFor(() =>
      expect(props.onLaunch).toHaveBeenCalledWith(expect.objectContaining({ keepPrivate: true }))
    )
  })

  it('explains a draft that cannot be launched and does not launch it', () => {
    const props = renderControl({ state: 'active', students: {} })
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Q' } })
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Only' } })
    fireEvent.click(screen.getByRole('button', { name: 'Launch poll' }))
    expect(screen.getByText(/at least 2 options/)).toBeInTheDocument()
    expect(props.onLaunch).not.toHaveBeenCalled()
  })

  it('shows the live tally, who voted and who has not, and the controls', async () => {
    const session = sessionWith(openPoll, {
      a: { displayName: 'Ada', pollResponses: { p1: { choice: 1, answeredAt: 2 } } },
      b: { displayName: 'Ben' },
    })
    const props = renderControl(session)
    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Show results to the class'))
    await waitFor(() => expect(props.onSetShowResults).toHaveBeenCalledWith('p1', true))
    fireEvent.click(screen.getByRole('button', { name: 'Close poll' }))
    await waitFor(() => expect(props.onClosePoll).toHaveBeenCalledWith('p1'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove from screens' }))
    await waitFor(() => expect(props.onDismiss).toHaveBeenCalled())
  })
})

describe('ClassPollCard', () => {
  it('lets a student pick an option and hides results by default', () => {
    const session = sessionWith(openPoll)
    const onAnswer = vi.fn()
    render(
      <ClassPollCard poll={getActivePoll(session)} choice={null} tally={null} onAnswer={onAnswer} />
    )
    fireEvent.click(screen.getByRole('radio', { name: /Art/ }))
    expect(onAnswer).toHaveBeenCalledWith(1)
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
  })

  it('marks the chosen option and can be minimised', () => {
    const session = sessionWith(openPoll)
    render(<ClassPollCard poll={getActivePoll(session)} choice={0} tally={null} />)
    expect(screen.getByRole('radio', { name: /Games/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Minimise the poll' }))
    expect(screen.getByRole('button', { name: 'Open the class poll' })).toBeInTheDocument()
  })

  it('shows results once the teacher shows them', () => {
    const session = sessionWith(
      { ...openPoll, status: 'closed', showResults: true },
      { a: { pollResponses: { p1: { choice: 1, answeredAt: 2 } } } }
    )
    render(
      <ClassPollCard poll={getActivePoll(session)} choice={1} tally={tallyPoll(session, 'p1')} />
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Poll results')).toBeInTheDocument()
    expect(screen.getByText('(your answer)', { exact: false })).toBeInTheDocument()
  })

  it("shows a public poll's results only once the student has voted", () => {
    const session = sessionWith(
      { ...openPoll, showResults: true },
      { a: { pollResponses: { p1: { choice: 0, answeredAt: 2 } } }, b: {} }
    )
    const poll = getActivePoll(session)
    const tally = tallyPoll(session, 'p1')
    const { rerender } = render(<ClassPollCard poll={poll} choice={null} tally={tally} />)
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
    expect(screen.getByText(/Pick one to see how the class voted/)).toBeInTheDocument()
    rerender(<ClassPollCard poll={poll} choice={1} tally={tally} />)
    expect(screen.getByLabelText('Poll results')).toBeInTheDocument()
    // Still open: the student can change their answer.
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('shows the presentation live bars for a public poll', () => {
    const session = sessionWith(
      { ...openPoll, showResults: true },
      { a: { pollResponses: { p1: { choice: 1, answeredAt: 2 } } }, b: {} }
    )
    render(
      <ClassPollCard poll={getActivePoll(session)} tally={tallyPoll(session, 'p1')} presentation />
    )
    expect(screen.getByLabelText('Poll results')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument()
    expect(screen.getByText(/1 · 100%/)).toBeInTheDocument()
  })

  it('shows the presentation the question and answer count, without buttons', () => {
    const session = sessionWith(openPoll, { a: {}, b: {} })
    render(
      <ClassPollCard poll={getActivePoll(session)} tally={tallyPoll(session, 'p1')} presentation />
    )
    expect(screen.getByText('What next?')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 answered')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

describe('ReportPollsSection', () => {
  it('lists each poll with its results and answers', () => {
    render(
      <ReportPollsSection
        report={{
          polls: [
            {
              pollId: 'p1',
              question: 'What next?',
              options: [
                { index: 0, text: 'Games', count: 1 },
                { index: 1, text: 'Art', count: 0 },
              ],
              respondedCount: 1,
              responses: [{ studentLabel: 'Student 1', choice: 0, choiceText: 'Games' }],
              notResponded: ['Student 2'],
            },
          ],
        }}
      />
    )
    expect(screen.getByText('Class polls')).toBeInTheDocument()
    expect(screen.getByText('Student 1: Games')).toBeInTheDocument()
    expect(screen.getByText('Not answered: Student 2')).toBeInTheDocument()
  })

  it('renders nothing for a report without polls', () => {
    const { container } = render(<ReportPollsSection report={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
