import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('button', { name: 'Go Through the Lesson Again' }))
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

  it('celebrates the first time: bouncing title, three stars and confetti from both corners', () => {
    const { container } = renderComplete()
    const screenEl = container.querySelector('.lesson-complete')
    expect(screenEl).toHaveClass('lesson-complete--celebrate')

    // The title still reads as one heading for screen readers and tests.
    expect(screen.getByRole('heading', { name: 'Lesson complete!' })).toBeInTheDocument()
    expect(screen.getByText('Lesson complete!')).toBeInTheDocument()
    const letters = container.querySelectorAll('.lesson-complete__letter')
    expect(letters.length).toBe('Lesson complete!'.length)

    const stars = screen.getAllByTestId('lesson-complete-star')
    expect(stars).toHaveLength(3)
    expect(stars[1]).toHaveClass('lesson-complete__star--big')

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

  it('keeps the three choices in a gapped row with Open Playground as the big primary', () => {
    const { container } = renderComplete()
    const row = container.querySelector('.lesson-complete__actions')
    const buttons = [...row.querySelectorAll('button')].map((b) => b.textContent)
    expect(buttons).toEqual([
      'Go Through the Lesson Again',
      'Try the Solo Challenge',
      'Open Playground',
    ])
    const playground = screen.getByRole('button', { name: 'Open Playground' })
    expect(playground).toHaveClass('btn-primary', 'lesson-complete__primary')
    // The choices are clickable at once: they never wait for the party to finish.
    expect(row.className).not.toMatch(/motion-/)
  })

  it('plays once per lesson on this screen; coming back shows the still picture', () => {
    const first = renderComplete()
    first.unmount()
    const { container } = renderComplete()
    const screenEl = container.querySelector('.lesson-complete')
    expect(screenEl).not.toHaveClass('lesson-complete--celebrate')
    expect(screen.getAllByTestId('lesson-complete-star')).toHaveLength(3)
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
