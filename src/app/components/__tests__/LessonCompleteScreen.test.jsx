import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LessonCompleteScreen from '../LessonCompleteScreen'
import { MOTION_MS, resetFirstViews } from '../../../shared/motion'

describe('LessonCompleteScreen', () => {
  it('shows the lesson title in the completion message', () => {
    render(<LessonCompleteScreen lessonTitle="Intro to Python" />)
    expect(screen.getByText(/Well done finishing Intro to Python/i)).toBeInTheDocument()
  })

  it('offers to replay the lesson when onReplayLesson is provided', () => {
    const onReplayLesson = vi.fn()
    render(<LessonCompleteScreen onReplayLesson={onReplayLesson} />)

    fireEvent.click(screen.getByRole('button', { name: 'Go through the lesson again' }))
    expect(onReplayLesson).toHaveBeenCalledOnce()
  })

  it('does not show the solo challenge or playground buttons when neither is available', () => {
    render(<LessonCompleteScreen onReplayLesson={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: /Try the Solo Challenge/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Playground/i })).not.toBeInTheDocument()
  })

  it('offers the linked solo challenge when one exists', () => {
    const onTrySoloChallenge = vi.fn()
    render(
      <LessonCompleteScreen
        soloCompanion={{ id: 'py-intro-solo', title: 'Python Challenge' }}
        onTrySoloChallenge={onTrySoloChallenge}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try the Solo Challenge' }))
    expect(onTrySoloChallenge).toHaveBeenCalledOnce()
  })

  it('does not offer the solo challenge without a matching handler', () => {
    render(
      <LessonCompleteScreen soloCompanion={{ id: 'py-intro-solo', title: 'Python Challenge' }} />
    )
    expect(
      screen.queryByRole('button', { name: /Try the Solo Challenge/i })
    ).not.toBeInTheDocument()
  })

  it('offers the playground when one is available for the lesson type', () => {
    const onOpenPlayground = vi.fn()
    render(<LessonCompleteScreen onOpenPlayground={onOpenPlayground} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Playground' }))
    expect(onOpenPlayground).toHaveBeenCalledOnce()
  })
})

// Fun moment (option C, Ryan 16 Nov): finishing a lesson is a party. The title bounces in letter
// by letter, three stars pop in, and confetti shoots from both bottom corners, once, in about
// 1.5s; then it is a still picture. The three choices stay, Open Playground the big one.
describe('LessonCompleteScreen celebration', () => {
  beforeEach(() => resetFirstViews())

  function renderComplete(props = {}) {
    return render(
      <LessonCompleteScreen
        lessonId="loops"
        lessonTitle="Loops and Lists"
        onReplayLesson={vi.fn()}
        soloCompanion={{ id: 'loops-solo', title: 'Loops Solo' }}
        onTrySoloChallenge={vi.fn()}
        onOpenPlayground={vi.fn()}
        {...props}
      />
    )
  }

  it('celebrates the first time: bouncing title and confetti from both corners', () => {
    const { container } = renderComplete()
    const screenEl = container.querySelector('.lesson-complete')
    expect(screenEl).toHaveClass('lesson-complete--celebrate')

    // The title still reads as one heading for screen readers and tests.
    expect(screen.getByRole('heading', { name: 'Lesson complete!' })).toBeInTheDocument()
    expect(screen.getByText('Lesson complete!')).toBeInTheDocument()
    const letters = container.querySelectorAll('.lesson-complete__letter')
    // One bouncing letter per character (the space between the words is a plain gap).
    expect(letters.length).toBe('Lessoncomplete!'.length)

    // The calm layout (Ryan, 23 Nov): the coding-moment stickers are the reward, so the three
    // stars over the title are gone.
    expect(screen.queryByTestId('lesson-complete-star')).not.toBeInTheDocument()

    const confetti = container.querySelectorAll('.lesson-complete__confetti')
    const fromLeft = [...confetti].filter((c) => c.dataset.corner === 'left')
    const fromRight = [...confetti].filter((c) => c.dataset.corner === 'right')
    expect(fromLeft.length).toBeGreaterThan(5)
    expect(fromRight.length).toBe(fromLeft.length)
    expect(container.querySelectorAll('.lesson-complete__popper')).toHaveLength(2)

    // Decoration is hidden from assistive tech.
    expect(container.querySelector('.lesson-complete__party')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })

  it('plays once per lesson on this screen; coming back shows the still picture', () => {
    const first = renderComplete()
    first.unmount()
    const { container } = renderComplete()
    const screenEl = container.querySelector('.lesson-complete')
    expect(screenEl).not.toHaveClass('lesson-complete--celebrate')
    expect(container.querySelectorAll('.lesson-complete__confetti').length).toBeGreaterThan(0)
  })

  it('stays short: the whole party is about 1.5s', () => {
    expect(MOTION_MS.celebrate).toBeGreaterThanOrEqual(1200)
    expect(MOTION_MS.celebrate).toBeLessThanOrEqual(1600)
  })

  it('is a still picture under reduced motion', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\/\* Lesson complete[\s\S]*?\n\}/
    )
    expect(reduced, 'a reduced-motion block for the lesson-complete party').not.toBeNull()
    expect(reduced[0]).toMatch(/\.lesson-complete--celebrate[\s\S]*animation: none/)
  })
})

const moment = (badgeId, emoji, title) => ({
  badgeId,
  badge: { emoji, title, blurb: `${title} blurb.` },
})
const SIX = [
  moment('bug_hunter', '🐛', 'Bug Hunter'),
  moment('code_builder', '📋', 'Code Builder'),
  moment('code_detective', '🔍', 'Code Detective'),
  moment('challenge_solver', '🔓', 'Challenge Solver'),
  moment('quiz_master', '🎯', 'Quiz Master'),
  moment('code_fixer', '🔧', 'Code Fixer'),
]

// Fun moment (calm lesson complete, sketch OK'd by Ryan 23 Nov): the student finishes the lesson
// and sees their coding moments as a row of round stickers, then one big amber Open Playground
// beside an outlined Solo Challenge, and a quiet link to go through the lesson again. A badge the
// tutor awards while this screen is up drops into the strip live.
describe('LessonCompleteScreen calm layout: coding moments and two choices', () => {
  beforeEach(() => resetFirstViews())

  function renderComplete(props = {}) {
    return render(
      <LessonCompleteScreen
        lessonId="loops"
        lessonTitle="Loops and Lists"
        onReplayLesson={vi.fn()}
        soloCompanion={{ id: 'loops-solo', title: 'Loops Solo' }}
        onTrySoloChallenge={vi.fn()}
        onOpenPlayground={vi.fn()}
        {...props}
      />
    )
  }

  it("shows the student's coding moments as a strip of round stickers with names", () => {
    renderComplete({ moments: SIX })
    expect(screen.getByText('Your coding moments')).toBeInTheDocument()
    const strip = screen.getByRole('list', { name: 'My coding moments' })
    expect(strip).toHaveClass('sv-sticker-strip')
    const stickers = within(strip).getAllByRole('listitem')
    expect(stickers.map((li) => li.textContent)).toEqual([
      '🐛Bug Hunter',
      '📋Code Builder',
      '🔍Code Detective',
      '🔓Challenge Solver',
      '🎯Quiz Master',
      '🔧Code Fixer',
    ])
    // The blurb stays a tooltip: the strip shows names only.
    expect(strip).not.toHaveTextContent('Bug Hunter blurb.')
    expect(stickers[0]).toHaveAttribute('title', 'Bug Hunter blurb.')
  })

  it('shows at most six stickers, the newest, so a fresh award is always seen', () => {
    renderComplete({
      moments: [moment('first_run', '🚀', 'First Run'), ...SIX, moment('helper', '🤝', 'Helper')],
    })
    const stickers = within(screen.getByRole('list', { name: 'My coding moments' })).getAllByRole(
      'listitem'
    )
    expect(stickers).toHaveLength(6)
    expect(stickers.at(-1)).toHaveTextContent('Helper')
    expect(screen.queryByText('First Run')).not.toBeInTheDocument()
  })

  it('hides the strip entirely when the student has no moments', () => {
    const { container } = renderComplete({ moments: [] })
    expect(screen.queryByText('Your coding moments')).not.toBeInTheDocument()
    expect(container.querySelector('.lesson-complete__moments')).toBeNull()
  })

  it('drops in a badge the tutor awards while the screen is up', () => {
    const { rerender } = renderComplete({ moments: SIX.slice(0, 2) })
    rerender(
      <LessonCompleteScreen
        lessonId="loops"
        lessonTitle="Loops and Lists"
        onOpenPlayground={vi.fn()}
        moments={SIX.slice(0, 3)}
      />
    )
    expect(screen.getByRole('list', { name: 'My coding moments' })).toHaveTextContent(
      'Code Detective'
    )
  })

  it('puts the big amber Open Playground beside an outlined Solo Challenge', () => {
    const { container } = renderComplete({ moments: SIX })
    const row = container.querySelector('.lesson-complete__actions')
    expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Open Playground',
      'Try the Solo Challenge',
    ])
    expect(screen.getByRole('button', { name: 'Open Playground' })).toHaveClass(
      'lesson-complete__primary'
    )
    expect(screen.getByRole('button', { name: 'Try the Solo Challenge' })).toHaveClass(
      'lesson-complete__secondary'
    )
    // The choices are clickable at once: they never wait for the party to finish.
    expect(row.className).not.toMatch(/motion-/)
  })

  it('keeps "Go through the lesson again" as a quiet link under the buttons', () => {
    const onReplayLesson = vi.fn()
    const { container } = renderComplete({ onReplayLesson })
    const again = screen.getByRole('button', { name: 'Go through the lesson again' })
    expect(again).toHaveClass('lesson-complete__again')
    expect(container.querySelector('.lesson-complete__actions')).not.toContainElement(again)
    fireEvent.click(again)
    expect(onReplayLesson).toHaveBeenCalledOnce()
  })

  it('reads as four groups in order: title, moments, choices, quiet link', () => {
    const { container } = renderComplete({ moments: SIX })
    const content = container.querySelector('.lesson-complete__content')
    const order = [
      '.lesson-complete__title',
      '.lesson-complete__moments',
      '.lesson-complete__actions',
      '.lesson-complete__again',
    ].map((sel) => content.querySelector(sel))
    order.forEach((el) => expect(el).not.toBeNull())
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })
})
