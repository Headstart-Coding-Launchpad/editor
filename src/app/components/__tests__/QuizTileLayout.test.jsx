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
const savedInner = window.innerWidth
afterEach(() => {
  window.innerWidth = savedInner
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

  it('keeps 3 short options in one row in a split layout at 1366 (frame ~760px)', () => {
    window.innerWidth = 1366
    frameWidth(760)
    render(<QuizTask task={quiz(3)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '3')
  })

  it('stacks 3 options in a narrow quiz frame (a tutor window), even on a wide screen', () => {
    window.innerWidth = 1366
    frameWidth(500)
    render(<QuizTask task={quiz(3)} />)
    expect(grid()).toHaveAttribute('data-quiz-cols', '1')
  })

  it('stacks 3 options as bars on a screen under about 900px wide (768 tablet)', () => {
    window.innerWidth = 768
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
    expect(grid().style.getPropertyValue('--quiz-row-max')).toBe('180px')
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
    expect(rule).toContain('minmax(min-content, var(--quiz-row-cap, var(--quiz-row-max, 1fr)))')
  })
})

describe('quiz tiles: the row cap shrinks with the fit (Ryan 24 Nov, tiles C and D clipped)', () => {
  it('sets a row cap that follows --quiz-option-scale, so shrink-to-fit can pull rows in', () => {
    frameWidth(1300)
    render(<QuizTask task={quiz(4)} />)
    const cap = grid().style.getPropertyValue('--quiz-row-cap')
    expect(cap).toContain('180px')
    expect(cap).toContain('var(--quiz-option-scale')
  })
})

describe('quiz tiles: a tall question never squeezes the answers out (Ryan 24 Nov)', () => {
  const heights = (scrollHeight, clientHeight) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => clientHeight,
    })
  }
  afterEach(() => {
    delete HTMLElement.prototype.scrollHeight
    delete HTMLElement.prototype.clientHeight
  })

  it('keeps the frame as tall as the tiles once shrinking is used up, so the pane scrolls', () => {
    frameWidth(1300)
    heights(370, 0)
    render(<QuizTask task={quiz(4)} />)
    expect(grid().parentElement.style.minHeight).toBe('370px')
  })

  it('leaves the frame free to shrink when the tiles fit', () => {
    frameWidth(1300)
    heights(200, 300)
    render(<QuizTask task={quiz(4)} />)
    expect(grid().parentElement.style.minHeight).toBe('0px')
  })
})

describe('quizWordLayout', () => {
  it('has frame hysteresis (620 / 580) so a frame cannot flip back and forth', () => {
    expect(quizWordLayout(3, 600, false).cols).toBe(1)
    expect(quizWordLayout(3, 630, false).cols).toBe(3)
    expect(quizWordLayout(3, 600, true).cols).toBe(3)
    expect(quizWordLayout(3, 570, true).cols).toBe(1)
    // Width unknown (not laid out yet): keep the last answer.
    expect(quizWordLayout(3, 0, true).cols).toBe(3)
    // A screen under 900px stacks whatever the frame.
    expect(quizWordLayout(3, 800, true, false, false).cols).toBe(1)
  })

  it('6 options are 3x2 wide and 2x3 narrow; one option is one tile', () => {
    expect(quizWordLayout(6, 1300, true)).toMatchObject({ cols: 3, rowMax: 180 })
    expect(quizWordLayout(6, 500, false)).toMatchObject({ cols: 2, rowMax: 160 })
    expect(quizWordLayout(1, 1300, true).cols).toBe(1)
  })
})

// The tile, badge and header-dot base styles are CSS classes now (no longer inline), so nothing
// else in index.css may restyle them: only their own rules name them, and the global `button`
// rules (element selectors, lower specificity) never set a minimum size.
describe('moved base styles are not overridden', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }))

  it('only their own rules name .quiz-word-option and .task-dot', () => {
    const named = rules
      .filter((r) => /\.(quiz-word-option(__id)?|task-dot)(?![\w-])/.test(r.selector))
      .map((r) => r.selector)
    expect(named.sort()).toEqual(['.quiz-word-option', '.quiz-word-option__id', '.task-dot'])
  })

  it('no element-only button rule sets a minimum size', () => {
    const elementOnly = rules.filter(
      (r) => /(^|[\s,>])button(?![\w-])/.test(r.selector) && !/[.#[]/.test(r.selector)
    )
    expect(elementOnly.length).toBeGreaterThan(0)
    for (const r of elementOnly) expect(r.body).not.toMatch(/min-(height|width)/)
  })
})
