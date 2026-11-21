// Calm screens (21 Nov 2026): word answer tiles never leave an orphan tile on its own row, and
// tiles never stretch to fill the screen. The column count depends on the options frame's width,
// so it is set before the shrink-to-fit step measures.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import QuizTask from '../QuizTask'
import { quizWordLayout } from '../quiz/quizUtils'

const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
function frameWidth(width) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
}
afterEach(() => {
  if (saved) Object.defineProperty(HTMLElement.prototype, 'clientWidth', saved)
  else delete HTMLElement.prototype.clientWidth
})

const WORDS = ['while', 'repeat', 'for', 'loop', 'do', 'until']
function quiz(count, text = (w) => w) {
  return {
    id: 1,
    title: 'Loop quiz',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    question: 'Which keyword starts a counted loop?',
    options: WORDS.slice(0, count).map((w, i) => ({ id: 'abcdef'[i], text: text(w) })),
    check: { type: 'answer_equals', value: 'c' },
  }
}
const grid = () => screen.getByRole('radiogroup')

describe('quiz tiles: no orphan tile', () => {
  it('puts 3 options in one row on a wide frame (1366 screen)', () => {
    frameWidth(1300)
    render(<QuizTask task={quiz(3)} />)
    expect(grid()).toHaveClass('quiz-word-grid')
    expect(grid()).toHaveAttribute('data-quiz-cols', '3')
    expect(grid().style.getPropertyValue('--quiz-row-max')).toBe('320px')
  })

  it('stacks 3 options as bars under about 900px wide (768 tablet)', () => {
    frameWidth(730)
    render(<QuizTask task={quiz(3)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '1')
    expect(grid().style.getPropertyValue('--quiz-row-max')).toBe('110px')
  })

  it('shows 5 options as a single column of bars, even on a wide frame', () => {
    frameWidth(1300)
    render(<QuizTask task={quiz(5)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '1')
    expect(grid().style.getPropertyValue('--quiz-row-max')).toBe('76px')
  })

  it('keeps 2 side by side and 4 as a 2x2 block, capped', () => {
    frameWidth(1300)
    const { unmount } = render(<QuizTask task={quiz(2)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '2')
    unmount()
    render(<QuizTask task={quiz(4)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '2')
    expect(grid().style.getPropertyValue('--quiz-row-max')).toBe('250px')
  })

  it('stacks 3 long answers even on a wide frame', () => {
    frameWidth(1300)
    render(<QuizTask task={quiz(3, (w) => `${w} counter in range(10) with a long answer`)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '1')
  })

  it('never colours a chosen tile red or green for the student', () => {
    frameWidth(1300)
    render(<QuizTask task={quiz(3)} selectedAnswer="a" submitted checkPassed={false} />)
    const chosen = screen.getAllByRole('radio')[0]
    expect(chosen.style.background).not.toMatch(/success|error/)
  })

  it('columns come from CSS, sized by --quiz-cols, and rows stop growing at the cap', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const start = css.indexOf('.quiz-word-grid {')
    expect(start).toBeGreaterThanOrEqual(0)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('repeat(var(--quiz-cols, 2), minmax(0, 1fr))')
    expect(rule).toContain('minmax(min-content, var(--quiz-row-max, 1fr))')
  })
})

describe('quizWordLayout', () => {
  it('has hysteresis around 900px so a frame cannot flip back and forth', () => {
    expect(quizWordLayout(3, 910, false).cols).toBe(1)
    expect(quizWordLayout(3, 930, false).cols).toBe(3)
    expect(quizWordLayout(3, 890, true).cols).toBe(3)
    expect(quizWordLayout(3, 870, true).cols).toBe(1)
    // Width unknown (not laid out yet): keep the last answer.
    expect(quizWordLayout(3, 0, true).cols).toBe(3)
  })

  it('6 options are 3x2 wide and 2x3 narrow; one option is one tile', () => {
    expect(quizWordLayout(6, 1300, true)).toMatchObject({ cols: 3, rowMax: 250 })
    expect(quizWordLayout(6, 700, false)).toMatchObject({ cols: 2, rowMax: 160 })
    expect(quizWordLayout(1, 1300, true).cols).toBe(1)
  })
})
