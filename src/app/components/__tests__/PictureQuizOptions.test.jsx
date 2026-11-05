import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import QuizTask from '../QuizTask'
import { ChoiceCardSummary, QuizActivityStudentView } from '../../../activities/quiz/QuizActivityViews'

// Platform request 128: picture answer options in a multiple-choice quiz. The Fun moment: the
// child looks at four pictures, taps the one their prediction says the code will draw, and it
// is chosen (and submitted) exactly as a word answer is today.

const png = (name) => `https://firebasestorage.googleapis.com/v0/b/x/o/lessons%2Fl1%2Fassets%2F${name}.png`

const PICTURE_TASK = {
  id: 17,
  title: 'Which Is on Top?',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  explainer: '`circle(50, "red")` then `background("blue")`',
  options: [
    { id: 'a', image: png('top-circle'), alt: 'Red circle above a blue background' },
    { id: 'b', image: png('blue-only'), alt: 'Only a blue background' },
    { id: 'c', image: png('purple'), alt: 'A purple circle' },
    { id: 'd', image: png('red-only'), alt: 'Only a red circle' },
  ],
  check: { type: 'answer_equals', value: 'b' },
}

describe('picture answer options (Fun moment)', () => {
  it('shows four picture cards and one tap chooses the picture', async () => {
    const user = userEvent.setup()
    const onSelectAnswer = vi.fn()
    const { rerender } = render(
      <QuizTask task={PICTURE_TASK} showQuestion onSelectAnswer={onSelectAnswer} />
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    PICTURE_TASK.options.forEach((option, index) => {
      const img = radios[index].querySelector('img')
      expect(img).not.toBeNull()
      expect(img).toHaveAttribute('alt', option.alt)
      expect(img).toHaveAttribute('src', option.image)
      // No caption: the alt text names the card for a screen reader.
      expect(radios[index]).toHaveAttribute('aria-label', option.alt)
    })

    const topCircle = screen.getByRole('radio', { name: 'Red circle above a blue background' })
    await user.click(topCircle)
    expect(onSelectAnswer).toHaveBeenCalledWith('a')

    rerender(
      <QuizTask
        task={PICTURE_TASK}
        showQuestion
        selectedAnswer="a"
        submitted
        checkPassed={false}
        onSelectAnswer={onSelectAnswer}
      />
    )
    const chosen = screen.getByRole('radio', { name: 'Red circle above a blue background' })
    expect(chosen).toHaveAttribute('aria-checked', 'true')
    // Selected = a tick badge plus a thick outline, never colour alone.
    expect(within(chosen).getByTestId('quiz-picture-tick')).toHaveTextContent('✓')
    expect(chosen.style.boxShadow).toContain('inset 0 0 0 4px')
    for (const other of screen.getAllByRole('radio').filter((radio) => radio !== chosen)) {
      expect(other).toHaveAttribute('aria-checked', 'false')
      expect(within(other).queryByTestId('quiz-picture-tick')).toBeNull()
    }
  })

  it('chooses a picture from the keyboard (Tab to it, Enter or Space)', async () => {
    const user = userEvent.setup()
    const onSelectAnswer = vi.fn()
    render(<QuizTask task={PICTURE_TASK} onSelectAnswer={onSelectAnswer} />)
    await user.tab()
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Only a blue background' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onSelectAnswer).toHaveBeenLastCalledWith('b')
    await user.keyboard(' ')
    expect(onSelectAnswer).toHaveBeenCalledTimes(2)
  })

  it('lays out 2 or 3 pictures side by side and 4 as a 2x2 grid', () => {
    const { rerender } = render(<QuizTask task={PICTURE_TASK} />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-picture-columns', '2')
    rerender(<QuizTask task={{ ...PICTURE_TASK, options: PICTURE_TASK.options.slice(0, 3) }} />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-picture-columns', '3')
    rerender(<QuizTask task={{ ...PICTURE_TASK, options: PICTURE_TASK.options.slice(0, 2) }} />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-picture-columns', '2')
  })

  it('shows a caption under the picture and names the card by it; emoji pictures work too', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', emoji: '🦊', alt: 'A fox', text: 'Fox' },
        { id: 'b', image: png('owl'), alt: 'An owl', text: 'Owl' },
      ],
    }
    render(<QuizTask task={task} />)
    const fox = screen.getByRole('radio', { name: 'Fox' })
    expect(within(fox).getByRole('img', { name: 'A fox' })).toHaveTextContent('🦊')
    expect(within(fox).getByText('Fox')).toBeInTheDocument()
    const owl = screen.getByRole('radio', { name: 'Owl' })
    expect(owl.querySelector('img')).toHaveAttribute('alt', 'An owl')
  })

  it('picture cards keep the picture uncropped (object-fit contain) and at least 120px tall', () => {
    render(<QuizTask task={PICTURE_TASK} />)
    const radio = screen.getAllByRole('radio')[0]
    expect(radio.querySelector('img').style.objectFit).toBe('contain')
    expect(parseInt(radio.style.minHeight, 10)).toBeGreaterThanOrEqual(120)
  })

  it('a word-only quiz is unchanged (no picture cards)', () => {
    render(
      <QuizTask
        task={{
          ...PICTURE_TASK,
          options: [
            { id: 'a', text: 'Arrays' },
            { id: 'b', text: 'Loops' },
          ],
        }}
      />
    )
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('data-picture-columns')
    expect(screen.getByRole('radio', { name: /arrays/i }).querySelector('img')).toBeNull()
  })

  it('the picture question (a picture in the question, code options) still works', () => {
    const task = {
      title: 'Which code drew this?',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      explainer: 'Which code drew this?\n\n![Red circle in the middle](https://example.com/stage.png)',
      options: [
        { id: 'a', text: '`circle(50, "red")`' },
        { id: 'b', text: '`write("hi")`' },
      ],
      check: { type: 'answer_equals', value: 'a' },
    }
    render(<QuizTask task={task} showQuestion />)
    const picture = screen.getByRole('img', { name: 'Red circle in the middle' })
    expect(picture.style.maxHeight).toBe('min(240px, 32vh)')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('data-picture-columns')
  })
})

describe('picture options: the tutor view', () => {
  it('ChoiceCardSummary shows a thumbnail of the chosen picture with its id and alt', () => {
    render(<ChoiceCardSummary task={PICTURE_TASK} raw="a" />)
    const thumb = screen.getByRole('img', { name: 'Red circle above a blue background' })
    expect(thumb).toHaveAttribute('src', PICTURE_TASK.options[0].image)
    expect(parseInt(thumb.style.width, 10)).toBe(40)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('Red circle above a blue background')).toBeInTheDocument()
  })

  it('ChoiceCardSummary prefers the caption over the alt text', () => {
    const task = {
      ...PICTURE_TASK,
      options: [{ id: 'a', emoji: '🦊', alt: 'A fox', text: 'Fox' }, PICTURE_TASK.options[1]],
    }
    render(<ChoiceCardSummary task={task} raw="a" />)
    expect(screen.getByRole('img', { name: 'A fox' })).toHaveTextContent('🦊')
    expect(screen.getByText('Fox')).toBeInTheDocument()
  })

  it('the student modal shows the grid read-only, the chosen card ticked, and the right picture after submit', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <QuizActivityStudentView
        task={PICTURE_TASK}
        state="a"
        readOnly
        teacher
        onChange={onChange}
        result={{ submitted: true, passed: false }}
      />
    )
    const chosen = screen.getByRole('radio', { name: 'Red circle above a blue background' })
    expect(chosen).toHaveAttribute('aria-checked', 'true')
    expect(within(chosen).getByTestId('quiz-picture-tick')).toHaveTextContent('✗')
    const right = screen.getByRole('radio', { name: 'Only a blue background' })
    expect(within(right).getByTestId('quiz-picture-tick')).toHaveTextContent('✓')
    await user.click(right)
    expect(onChange).not.toHaveBeenCalled()

    const note = screen.getByText(/Correct answer:/).closest('div')
    expect(within(note).getByRole('img', { name: 'Only a blue background' })).toHaveAttribute(
      'src',
      PICTURE_TASK.options[1].image
    )
  })
})
