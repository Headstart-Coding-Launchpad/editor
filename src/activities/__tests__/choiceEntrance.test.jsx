import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityView } from '../ActivityHost.jsx'
import { CHOICE_ENTRANCE_MS } from '../ui/choiceEntrance.jsx'
import { resetFirstViews } from '../../shared/motion'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
} from '../../test/fixtures/legacyActivityTasks'

// Answer choices rise in, one after another, on a task's first view only (motion-system.md).

function rising(container) {
  return Array.from(container.querySelectorAll('.motion-rise-in.motion-stagger'))
}

function renderQuiz(task, entranceKey) {
  return render(<ActivityView task={task} state={null} entranceKey={entranceKey} />)
}

describe('answer choice entrance', () => {
  beforeEach(() => resetFirstViews())
  afterEach(() => vi.useRealTimers())

  it('staggers the multiple-choice options on the first view', () => {
    const { container } = renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:1')
    const options = screen.getAllByRole('radio')
    expect(rising(container)).toEqual(options)
    options.forEach((option, index) => {
      expect(option.style.getPropertyValue('--motion-i')).toBe(String(index))
    })
  })

  it('does not replay on a revisit or a remount of the same task', () => {
    const first = renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:1')
    expect(rising(first.container)).toHaveLength(3)
    first.unmount()

    const again = renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:1')
    expect(rising(again.container)).toHaveLength(0)
    screen.getAllByRole('radio').forEach((option) => {
      expect(option).not.toHaveClass('motion-rise-in')
      expect(option.style.getPropertyValue('--motion-i')).toBe('')
    })
  })

  it('plays for a different task after another has been seen', () => {
    renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:1').unmount()
    const { container } = renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:2')
    expect(rising(container)).toHaveLength(3)
  })

  it('never animates without an entrance key (Builder editor preview, StudentModal)', () => {
    const { container } = renderQuiz(MULTIPLE_CHOICE_TASK, null)
    expect(rising(container)).toHaveLength(0)
  })

  it('takes the classes off once the entrance has played', () => {
    vi.useFakeTimers()
    const { container } = renderQuiz(MULTIPLE_CHOICE_TASK, 'lesson-1:1')
    expect(rising(container)).toHaveLength(3)
    act(() => {
      vi.advanceTimersByTime(CHOICE_ENTRANCE_MS)
    })
    expect(rising(container)).toHaveLength(0)
  })

  it('staggers the Match rows and answer tiles', () => {
    const { container } = renderQuiz(MATCH_TASK, 'lesson-1:2')
    const tiles = MATCH_TASK.pairs.map((pair) => screen.getByRole('button', { name: pair.answer }))
    tiles.forEach((tile) => expect(tile).toHaveClass('motion-rise-in', 'motion-stagger'))
    // Three prompt rows and three tiles.
    expect(rising(container)).toHaveLength(6)
  })

  it('staggers the fill-in-the-blank word chips', () => {
    renderQuiz(FILL_BLANK_DRAG_TASK, 'lesson-1:3')
    const chips = ['print', 'input', 'len'].map((word) =>
      screen.getByRole('button', { name: word })
    )
    chips.forEach((chip) => expect(chip).toHaveClass('motion-rise-in', 'motion-stagger'))
    const indexes = chips.map((chip) => chip.style.getPropertyValue('--motion-i')).sort()
    expect(indexes).toEqual(['0', '1', '2'])
  })

  it('staggers the confidence buttons', () => {
    renderQuiz(CONFIDENCE_TASK, 'lesson-1:7')
    for (let level = 1; level <= 10; level += 1) {
      const button = screen.getByTitle(`Confidence level ${level}`)
      expect(button).toHaveClass('motion-rise-in', 'motion-stagger')
      expect(button.style.getPropertyValue('--motion-i')).toBe(String(level - 1))
    }
  })
})
