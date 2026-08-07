import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import QuizTask from '../QuizTask'
import { fitScratchQuizScale, shrinkToFit } from '../quiz/quizUtils'

const MULTIPLE_CHOICE_TASK = {
  title: 'Pick one',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Arrays' },
    { id: 'b', text: 'Loops' },
  ],
}

const MULTILINE_MULTIPLE_CHOICE_TASK = {
  title: 'Pick output',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: '`sunny\nall week`' },
    { id: 'b', text: '`sunny\\n all week`' },
  ],
}

const SCRATCH_STACK_MULTIPLE_CHOICE_TASK = {
  title: 'Pick the stack',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: '```scratch\nsay [Hello!] for (2) seconds\nsay [Goodbye!] for (2) seconds\n```' },
    { id: 'b', text: '`scratch:say [Hello!] for (2) seconds`' },
  ],
}

const FENCED_CODE_MULTIPLE_CHOICE_TASK = {
  title: 'Pick the print statement',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: '```python\nprint("hi")\n```' },
    { id: 'b', text: '```python\nprint(\'bye\')\n```' },
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

const SHORT_ANSWER_TASK = {
  title: 'Explain it',
  taskType: 'quiz',
  quizType: 'short_answer',
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

  it('keeps question images compact, never caps or shrinks the question panel, and renders larger quiz question text', () => {
    render(<QuizTask task={IMAGE_QUESTION_TASK} showQuestion />)

    const image = screen.getByRole('img', { name: /diagram/i })
    const questionPanel = screen.getByText('Question').parentElement
    const questionTextWrap = closestElementWithFontSize(/what does this show/i)

    expect(image.style.maxHeight).toBe('min(240px, 32vh)')
    expect(questionPanel.style.maxHeight).toBe('')
    expect(questionPanel.style.flexShrink).toBe('0')
    expect(questionTextWrap.style.fontSize).toBe('17.25px')
  })

  it('preserves real and escaped newlines in answer option code', () => {
    const { container } = render(<QuizTask task={MULTILINE_MULTIPLE_CHOICE_TASK} />)
    const codeElements = Array.from(container.querySelectorAll('code'))

    expect(codeElements.map(code => code.textContent)).toEqual(expect.arrayContaining(['sunny\nall week', 'sunny\n all week']))
    expect(codeElements.map(code => code.style.whiteSpace)).toEqual(expect.arrayContaining(['pre-wrap']))
  })

  it('renders fenced Scratch stacks as block content inside an answer option', () => {
    const { container } = render(<QuizTask task={SCRATCH_STACK_MULTIPLE_CHOICE_TASK} />)

    expect(container.querySelector('[data-scratch-stack="true"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-stack="true"] [data-scratch-opcode="looks_sayforsecs"]')).toBeInTheDocument()
    expect(container.querySelector('[data-scratch-quiz-scale="stack"]')).toHaveStyle({ transform: 'scale(1.5)' })
  })

  it('enlarges inline Scratch answer blocks without changing ordinary options', () => {
    const task = {
      ...MULTIPLE_CHOICE_TASK,
      options: [
        { id: 'a', text: '`scratch:say [Hello!] for (2) seconds`' },
        { id: 'b', text: 'Two seconds' },
      ],
    }
    const { container } = render(<QuizTask task={task} />)

    expect(container.querySelector('[data-scratch-quiz-scale="inline"]')).toHaveStyle({
      transform: 'scale(1.5)',
      fontSize: `${13 / 0.82}px`,
    })
  })

  it('reduces the Scratch quiz scale to fit narrower answer cards', () => {
    expect(fitScratchQuizScale({
      preferredScale: 1.5,
      availableWidth: 300,
      availableHeight: 200,
      contentWidth: 400,
      contentHeight: 100,
    })).toBeCloseTo(0.73, 2)
  })

  it('leaves the options scale at 1 when everything already fits', () => {
    const setScale = vi.fn()
    const scale = shrinkToFit({ setScale, isOverflowing: () => false })

    expect(scale).toBe(1)
    expect(setScale).toHaveBeenCalledTimes(1)
    expect(setScale).toHaveBeenCalledWith(1)
  })

  it('steps the options scale down until the content fits', () => {
    const setScale = vi.fn()
    let stillOverflowing = true
    const isOverflowing = vi.fn(() => stillOverflowing)

    const scale = shrinkToFit({
      setScale: value => {
        setScale(value)
        if (value <= 0.9) stillOverflowing = false
      },
      isOverflowing,
      minScale: 0.65,
      step: 0.05,
    })

    expect(scale).toBeCloseTo(0.9, 5)
    expect(setScale).toHaveBeenLastCalledWith(scale)
  })

  it('never shrinks the options past the configured floor', () => {
    const setScale = vi.fn()

    const scale = shrinkToFit({
      setScale,
      isOverflowing: () => true,
      minScale: 0.65,
      step: 0.05,
    })

    expect(scale).toBe(0.65)
    expect(setScale).toHaveBeenLastCalledWith(0.65)
  })

  it('shrinks fenced code-block answers along with the rest of the option when answers overflow', () => {
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 400 })

    try {
      const { container } = render(<QuizTask task={FENCED_CODE_MULTIPLE_CHOICE_TASK} />)
      const codeBlock = container.querySelector('pre')

      expect(parseFloat(codeBlock.style.fontSize)).toBeLessThan(14 * 1.2)
    } finally {
      if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor)
      else delete HTMLElement.prototype.clientHeight
      if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeightDescriptor)
      else delete HTMLElement.prototype.scrollHeight
    }
  })

  it('supports keyboard selection for answer options', async () => {
    const user = userEvent.setup()
    const onSelectAnswer = vi.fn()
    render(<QuizTask task={MULTIPLE_CHOICE_TASK} onSelectAnswer={onSelectAnswer} />)

    const loops = screen.getByRole('radio', { name: /loops/i })
    loops.focus()
    await user.keyboard('{Enter}')

    expect(onSelectAnswer).toHaveBeenCalledWith('b')
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

describe('QuizTask short answer', () => {
  it('preserves submitted answer line breaks in the rendered answer', () => {
    render(<QuizTask task={SHORT_ANSWER_TASK} selectedAnswer={'first line\nsecond line'} submitted />)

    const answer = screen.getByText((_, element) => element?.tagName === 'STRONG' && element.textContent === 'first line\nsecond line')

    expect(answer).toHaveStyle({ whiteSpace: 'pre-wrap' })
  })
})
