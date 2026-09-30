import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BadgeSummaryTask, {
  EMOJI_STAGGER_MS,
  STICKER_STAGGER_MS,
  TUMBLE_MS,
} from '../BadgeSummaryTask'
import { resetFirstViews } from '../../../../shared/motion'
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
  beforeEach(() => resetFirstViews())

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
    expect(mine.querySelector('.sv-sticker--tumble')).not.toBeNull()
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

  describe('entrance', () => {
    const studentProps = { task, lesson, decisions, students, viewerId: 'alex', variant: 'student' }
    const teacherProps = { task, lesson, decisions, students, variant: 'teacher' }
    const withPersistence = (who) => ({
      ...decisions,
      [who]: {
        ...decisions[who],
        persistence: { status: 'awarded', source: 'rule', decidedAt: 300 },
      },
    })
    const wallItems = () =>
      within(screen.getByRole('list', { name: 'Class coding moments' })).getAllByRole('listitem')
    const myStickers = () =>
      within(screen.getByRole('list', { name: 'My coding moments' })).getAllByRole('listitem')
    const delay = (el, name = '--badge-summary-delay') => el.style.getPropertyValue(name)

    it("tumbles a student's stickers in, then drops the class wall in once they've landed", () => {
      render(<BadgeSummaryTask {...studentProps} />)
      const stickers = myStickers()
      expect(stickers[0]).toHaveClass('motion-tumble-in', 'sv-sticker--tumble')
      expect(delay(stickers[0], '--sv-sticker-delay')).toBe('0ms')
      expect(delay(stickers[1], '--sv-sticker-delay')).toBe(`${STICKER_STAGGER_MS}ms`)

      const landed = STICKER_STAGGER_MS + TUMBLE_MS
      const heading = screen.getByRole('heading', { name: 'The whole class' })
      expect(heading).toHaveClass('motion-drop-in', 'badge-summary__heading--drop')
      expect(delay(heading)).toBe(`${landed}ms`)
      const rows = wallItems()
      expect(rows[0]).toHaveClass('motion-drop-in', 'badge-summary__row--drop')
      expect(delay(rows[0])).toBe(`${landed}ms`)
      expect(delay(rows[1])).toBe(`${landed + 70}ms`)
    })

    it('drops the wall in straight away for a student with no moments', () => {
      render(<BadgeSummaryTask {...studentProps} viewerId="jo" />)
      expect(delay(wallItems()[0])).toBe('0ms')
    })

    it("tumbles the wall's emoji in on the teacher view, then drops the rows in", () => {
      render(<BadgeSummaryTask {...teacherProps} />)
      const rows = wallItems()
      expect(rows[0]).toHaveClass('badge-summary__row--tumble')
      expect(rows[0].querySelector('.badge-summary__emoji')).toHaveClass('motion-tumble-in')
      expect(delay(rows[0], '--badge-summary-emoji-delay')).toBe('0ms')
      expect(delay(rows[1], '--badge-summary-emoji-delay')).toBe(`${EMOJI_STAGGER_MS}ms`)
      const landed = EMOJI_STAGGER_MS + TUMBLE_MS
      expect(delay(rows[0])).toBe(`${landed}ms`)
      expect(delay(rows[1])).toBe(`${landed + 70}ms`)
    })

    it('does the same on the presentation window', () => {
      render(<BadgeSummaryTask {...teacherProps} variant="presentation" />)
      expect(wallItems()[0]).toHaveClass('badge-summary__row--tumble')
    })

    it('shows everything still on a revisit', () => {
      render(<BadgeSummaryTask {...studentProps} />)
      cleanup()
      render(<BadgeSummaryTask {...studentProps} />)
      expect(document.querySelector('.motion-tumble-in, .motion-drop-in')).toBeNull()
      for (const sticker of myStickers()) expect(sticker.className).toBe('sv-sticker')
      for (const row of wallItems()) expect(row.className).toBe('badge-summary__row')
      cleanup()

      render(<BadgeSummaryTask {...teacherProps} />)
      cleanup()
      render(<BadgeSummaryTask {...teacherProps} />)
      expect(document.querySelector('.badge-summary__row--tumble, .motion-tumble-in')).toBeNull()
    })

    it("drops a row that arrives later in plainly, and leaves the others' delays alone", () => {
      const { rerender } = render(<BadgeSummaryTask {...teacherProps} />)
      const before = wallItems().map((row) => delay(row))
      rerender(<BadgeSummaryTask {...teacherProps} decisions={withPersistence('sam')} />)
      const rows = wallItems()
      expect(rows).toHaveLength(3)
      const late = rows.find((row) => row.textContent.includes('Persistence'))
      expect(late.className).toBe('badge-summary__row motion-drop-in')
      expect(delay(late)).toBe('')
      expect(late.querySelector('.motion-tumble-in')).toBeNull()
      expect(rows.filter((row) => row !== late).map((row) => delay(row))).toEqual(before)
    })

    it("drops a student's later sticker and row in plainly, on a revisit too", () => {
      render(<BadgeSummaryTask {...studentProps} />)
      cleanup()
      const { rerender } = render(<BadgeSummaryTask {...studentProps} />)
      rerender(<BadgeSummaryTask {...studentProps} decisions={withPersistence('alex')} />)
      const sticker = myStickers().find((item) => item.textContent.includes('Persistence'))
      expect(sticker).toHaveClass('motion-drop-in')
      expect(sticker).not.toHaveClass('motion-tumble-in')
      const row = wallItems().find((item) => item.textContent.includes('Persistence'))
      expect(row.className).toBe('badge-summary__row motion-drop-in')
    })

    it("drops a student's moments in when their first arrives after the entrance", () => {
      const { rerender } = render(<BadgeSummaryTask {...studentProps} viewerId="jo" />)
      rerender(
        <BadgeSummaryTask {...studentProps} viewerId="jo" decisions={withPersistence('jo')} />
      )
      const section = screen.getByRole('region', { name: 'Your coding moments' })
      expect(section).toHaveClass('motion-drop-in')
      expect(myStickers()[0]).not.toHaveClass('motion-tumble-in')
      const heading = screen.getByRole('heading', { name: 'The whole class' })
      expect(heading).toHaveClass('motion-drop-in')
      expect(heading).not.toHaveClass('badge-summary__heading--drop')
    })
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
