import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import QuizTask from '../QuizTask'

const MULTIPLE_CHOICE_TASK = {
  title: 'Pick one',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Arrays' },
    { id: 'b', text: 'Loops' },
  ],
}

const IMAGE_QUESTION_TASK = {
  ...MULTIPLE_CHOICE_TASK,
  title: 'Image question',
  explainer: 'What does this show?\n\n![diagram](diagram.png)',
}

const MATCH_TASK = {
  title: 'Match parts',
  taskType: 'quiz',
  quizType: 'match',
  pairs: [
    { id: 'cpu', prompt: 'CPU', answer: 'Processes instructions' },
    { id: 'ram', prompt: 'RAM', answer: 'Temporary memory' },
  ],
}

const FILL_DRAG_TASK = {
  title: 'Fill drag',
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'drag',
  text: 'A ___ repeats code.',
  blanks: [
    { id: 'loop', answer: 'loop' },
  ],
  distractors: [
    { id: 'd1', text: 'variable' },
  ],
}

const FILL_TYPE_TASK = {
  title: 'Fill type',
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'type',
  text: 'Use ___ to print text.',
  blanks: [
    { id: 'print', answer: 'print' },
  ],
}

function closestOutlinedElement(text) {
  let element = screen.getByText(text)
  while (element && !element.style?.borderColor) {
    element = element.parentElement
  }
  return element
}

function closestElementWithFontSize(text) {
  let element = screen.getByText(text)
  while (element && !element.style?.fontSize) {
    element = element.parentElement
  }
  return element
}

describe('QuizTask multiple choice', () => {
  it('renders each answer as a radio option and publishes a selection', async () => {
    const user = userEvent.setup()
    const onSelectAnswer = vi.fn()

    render(<QuizTask task={MULTIPLE_CHOICE_TASK} onSelectAnswer={onSelectAnswer} />)

    const arrays = screen.getByRole('radio', { name: /arrays/i })
    const loops = screen.getByRole('radio', { name: /loops/i })
    expect(arrays).toHaveAttribute('aria-checked', 'false')
    expect(loops).toHaveAttribute('aria-checked', 'false')

    await user.click(loops)

    expect(onSelectAnswer).toHaveBeenCalledWith('b')
  })

  it('highlights the selected answer without enlarging its grid cell', () => {
    render(<QuizTask task={MULTIPLE_CHOICE_TASK} selectedAnswer="b" />)

    const arrays = screen.getByRole('radio', { name: /arrays/i })
    const loops = screen.getByRole('radio', { name: /loops/i })

    expect(loops).toHaveAttribute('aria-checked', 'true')
    expect(loops.style.boxShadow).toContain('inset')
    expect(loops.style.transform).toBe('')
    expect(loops.style.fontSize).toBe(arrays.style.fontSize)
  })

  it('keeps question images compact and renders larger quiz question text', () => {
    render(<QuizTask task={IMAGE_QUESTION_TASK} showQuestion />)

    const image = screen.getByRole('img', { name: /diagram/i })
    const questionPanel = screen.getByText('Question').parentElement
    const questionTextWrap = closestElementWithFontSize(/what does this show/i)

    expect(image.style.maxHeight).toBe('min(240px, 32vh)')
    expect(questionPanel.style.maxHeight).toBe('min(360px, 48vh)')
    expect(questionTextWrap.style.fontSize).toBe('17.25px')
  })
})

describe('QuizTask drag-and-drop feedback', () => {
  it('shows a red outline immediately when a match tile is in the wrong slot', () => {
    render(<QuizTask task={MATCH_TASK} selectedAnswer={{ cpu: 'ram' }} />)

    const wrongSlot = closestOutlinedElement('Temporary memory')

    expect(wrongSlot).toHaveStyle({ borderColor: '#dc2626' })
  })

  it('shows a green outline immediately when a match tile is in the correct slot', () => {
    render(<QuizTask task={MATCH_TASK} selectedAnswer={{ cpu: 'cpu' }} />)

    const correctSlot = closestOutlinedElement('Processes instructions')

    expect(correctSlot).toHaveStyle({ borderColor: '#16a34a' })
  })

  it('shows red and green outlines immediately for fill-blank drag answers', () => {
    const { rerender } = render(<QuizTask task={FILL_DRAG_TASK} selectedAnswer={{ loop: 'd1' }} />)

    expect(closestOutlinedElement('variable')).toHaveStyle({ borderColor: '#dc2626' })

    rerender(<QuizTask task={FILL_DRAG_TASK} selectedAnswer={{ loop: 'loop' }} />)

    expect(closestOutlinedElement('loop')).toHaveStyle({ borderColor: '#16a34a' })
  })

  it('shows red and green outlines immediately for typed fill-blank answers', () => {
    const { rerender } = render(<QuizTask task={FILL_TYPE_TASK} selectedAnswer={{ print: 'prin' }} />)

    expect(screen.getByPlaceholderText('...')).toHaveStyle({ borderColor: '#dc2626' })

    rerender(<QuizTask task={FILL_TYPE_TASK} selectedAnswer={{ print: 'PRINT' }} />)

    expect(screen.getByPlaceholderText('...')).toHaveStyle({ borderColor: '#16a34a' })
  })
})
