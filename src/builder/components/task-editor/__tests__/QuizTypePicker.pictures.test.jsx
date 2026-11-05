import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizTypePicker } from '../ActivityPickers'

// Leaving multiple choice turns picture options into words for good, so the Builder asks first
// (an inline confirm, never a browser dialog). A quiz with no pictures switches straight away.

const url = (name) => `https://firebasestorage.googleapis.com/v0/b/x/o/${name}.png`
const pictureQuiz = {
  id: 1,
  title: 'Pick the fox',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', image: url('a'), alt: 'A red circle' },
    { id: 'b', emoji: '🦊', alt: 'A fox' },
  ],
  check: { type: 'answer_equals', value: 'b' },
}
const wordQuiz = {
  ...pictureQuiz,
  options: [
    { id: 'a', text: 'Cat' },
    { id: 'b', text: 'Fox' },
  ],
}

const pollButton = (container) => container.querySelector('[data-activity="quiz_poll"]')

describe('QuizTypePicker: leaving multiple choice with pictures', () => {
  it('asks before converting; keeping multiple choice changes nothing', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { container } = render(<QuizTypePicker task={pictureQuiz} onSelect={onSelect} />)

    await user.click(pollButton(container))
    expect(onSelect).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()
    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(/turns the pictures into their captions/i)
    expect(warning.textContent).toMatch(/cannot be undone/i)

    await user.click(within(warning).getByRole('button', { name: /keep multiple choice/i }))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    confirmSpy.mockRestore()
  })

  it('converts only when the author continues', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(<QuizTypePicker task={pictureQuiz} onSelect={onSelect} />)
    await user.click(pollButton(container))
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /^continue/i }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].id).toBe('quiz_poll')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a word-only quiz, or re-choosing multiple choice, switches with no question', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container, rerender } = render(<QuizTypePicker task={wordQuiz} onSelect={onSelect} />)
    await user.click(pollButton(container))
    expect(onSelect).toHaveBeenCalledTimes(1)
    rerender(<QuizTypePicker task={pictureQuiz} onSelect={onSelect} />)
    await user.click(container.querySelector('[data-activity="quiz_multiple_choice"]'))
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the question is dropped when another task is shown', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container, rerender } = render(
      <QuizTypePicker task={pictureQuiz} onSelect={onSelect} />
    )
    await user.click(pollButton(container))
    expect(screen.getByRole('alert')).toBeTruthy()
    rerender(<QuizTypePicker task={{ ...pictureQuiz, id: 2 }} onSelect={onSelect} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
