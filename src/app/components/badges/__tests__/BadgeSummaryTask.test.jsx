import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BadgeSummaryTask from '../BadgeSummaryTask'
import InformationTask from '../../InformationTask'

const task = { id: 9, title: '', taskType: 'information', informationType: 'badges' }
const lesson = { id: 'l', type: 'python', title: 'Lesson' }
const decisions = {
  alex: {
    bug_hunter: { status: 'awarded', source: 'rule', decidedAt: 100 },
    keyboard_wizard: { status: 'awarded', source: 'auto', decidedAt: 200 },
  },
  sam: {
    bug_hunter: { status: 'awarded', source: 'rule', decidedAt: 150 },
    persistence: { status: 'revoked', source: 'rule', decidedAt: 90 },
  },
}
const students = {
  alex: { displayName: 'Alex' },
  sam: { displayName: 'Sam' },
  jo: { displayName: 'Jo' },
}

function wallRows() {
  const wall = screen.getByRole('list', { name: 'Class coding moments' })
  return within(wall)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

describe('BadgeSummaryTask', () => {
  it('shows a student their own moments, then the class wall grouped by badge', () => {
    render(
      <BadgeSummaryTask
        task={task}
        lesson={lesson}
        decisions={decisions}
        students={students}
        viewerId="alex"
        variant="student"
      />
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Today's Coding Moments")
    const mine = screen.getByRole('list', { name: 'My coding moments' })
    expect(within(mine).getAllByRole('listitem')).toHaveLength(2)
    expect(mine.querySelector('.sv-sticker--animate')).not.toBeNull()
    expect(wallRows()).toEqual(['🐛Bug HunterAlex, Sam', '⌨️Keyboard WizardAlex'])
    expect(screen.queryByRole('button', { name: /copy class summary/i })).toBeNull()
  })

  it('gives a student with no moments a warm line, not an empty state', () => {
    render(
      <BadgeSummaryTask
        task={task}
        decisions={decisions}
        students={students}
        viewerId="jo"
        variant="student"
      />
    )
    expect(screen.queryByRole('list', { name: 'My coding moments' })).toBeNull()
    expect(
      screen.getByText(/Every coder's moments look different — here's what the class celebrated/)
    ).toBeInTheDocument()
    expect(wallRows()).toHaveLength(2)
  })

  it('never shows a revoked badge', () => {
    render(
      <BadgeSummaryTask
        task={task}
        decisions={decisions}
        students={students}
        viewerId="sam"
        variant="student"
      />
    )
    expect(screen.queryByText('Persistence')).toBeNull()
  })

  it('shows an empty class wall kindly', () => {
    render(<BadgeSummaryTask task={task} decisions={{}} students={students} variant="teacher" />)
    expect(screen.getByText(/Coding moments will appear here/)).toBeInTheDocument()
  })

  it('shows the authored title and explainer', () => {
    render(
      <BadgeSummaryTask
        task={{ ...task, title: 'Well done!', explainer: 'Look what we did.' }}
        decisions={{}}
        variant="teacher"
      />
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Well done!')
    expect(screen.getByText('Look what we did.')).toBeInTheDocument()
  })

  it('shows the presentation window the class wall only', () => {
    render(
      <BadgeSummaryTask
        task={task}
        decisions={decisions}
        students={students}
        variant="presentation"
      />
    )
    expect(screen.queryByRole('list', { name: 'My coding moments' })).toBeNull()
    expect(screen.queryByText(/Every coder's moments/)).toBeNull()
    expect(wallRows()).toHaveLength(2)
  })

  it('shows a preview note with no live session (the Builder)', () => {
    render(<InformationTask task={task} lesson={lesson} />)
    expect(screen.getByText(/In a live session this shows the class/)).toBeInTheDocument()
  })

  it('renders through InformationTask with the badgeWall props', () => {
    render(
      <InformationTask
        task={task}
        lesson={lesson}
        badgeWall={{ decisions, students, variant: 'teacher' }}
      />
    )
    expect(wallRows()).toHaveLength(2)
  })

  describe('teacher Copy class summary', () => {
    let writeText
    beforeEach(() => {
      vi.useFakeTimers()
      writeText = vi.fn(() => Promise.resolve())
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('copies the class wall as plain text grouped by badge', async () => {
      render(
        <BadgeSummaryTask task={task} decisions={decisions} students={students} variant="teacher" />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy class summary/i }))
      })
      expect(writeText).toHaveBeenCalledWith(
        "Today's Coding Moments\n🐛 Bug Hunter: Alex, Sam\n⌨️ Keyboard Wizard: Alex"
      )
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.getByRole('button', { name: /copy class summary/i })).toBeInTheDocument()
    })
  })
})
