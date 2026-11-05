import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import QuizTask from '../QuizTask'
import {
  ChoiceCardSummary,
  QuizActivityStudentView,
} from '../../../activities/quiz/QuizActivityViews'
import { QuizOptionsBuilder } from '../../../activities/quiz_multiple_choice/ui.jsx'

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], loading: false, error: null }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], loading: false, error: null }),
}))

// Platform request 128: picture answer options in a multiple-choice quiz. The Fun moment: the
// child looks at four pictures, taps the one their prediction says the code will draw, and it
// is chosen (and submitted) exactly as a word answer is today.

const png = (name) =>
  `https://firebasestorage.googleapis.com/v0/b/x/o/lessons%2Fl1%2Fassets%2F${name}.png`

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
    const fox = screen.getByRole('radio', { name: 'Fox: A fox' })
    expect(within(fox).getByRole('img', { name: 'A fox' })).toHaveTextContent('🦊')
    expect(within(fox).getByText('Fox')).toBeInTheDocument()
    const owl = screen.getByRole('radio', { name: 'Owl: An owl' })
    expect(owl.querySelector('img')).toHaveAttribute('alt', 'An owl')
  })

  it('picture cards keep the picture uncropped (object-fit contain) and 120px tall at full size', () => {
    render(<QuizTask task={PICTURE_TASK} />)
    const radio = screen.getAllByRole('radio')[0]
    expect(radio.querySelector('img').style.objectFit).toBe('contain')
    expect(radio.style.minHeight).toBe('calc(var(--quiz-option-scale, 1) * 120px)')
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
      explainer:
        'Which code drew this?\n\n![Red circle in the middle](https://example.com/stage.png)',
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

describe('picture options: the Builder editor (pictures are authored in YAML for now)', () => {
  it('shows each picture read-only and keeps image and alt when the options change', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<QuizOptionsBuilder task={PICTURE_TASK} onUpdate={onUpdate} />)
    expect(screen.getByTestId('quiz-option-picture-a').querySelector('img')).toHaveAttribute(
      'src',
      PICTURE_TASK.options[0].image
    )
    expect(screen.getByLabelText('Option A alt text')).toHaveValue(
      'Red circle above a blue background'
    )

    await user.click(screen.getAllByTitle('Remove option')[1])
    const next = onUpdate.mock.calls.at(-1)[0]
    expect(next.options).toEqual([
      PICTURE_TASK.options[0],
      { ...PICTURE_TASK.options[2], id: 'b' },
      { ...PICTURE_TASK.options[3], id: 'c' },
    ])
  })
})

describe('picture options: the tutor view', () => {
  it('ChoiceCardSummary shows a thumbnail of the chosen picture with its id and alt', () => {
    const { container } = render(<ChoiceCardSummary task={PICTURE_TASK} raw="a" />)
    const thumb = container.querySelector('img')
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
    const { container } = render(<ChoiceCardSummary task={task} raw="a" />)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('🦊')
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
    expect(note.querySelector('img')).toHaveAttribute('src', PICTURE_TASK.options[1].image)
    expect(note).toHaveTextContent('Only a blue background')
  })
})

describe('picture options: runtime safety (data that skipped validation)', () => {
  it('renders an image only from an https URL, lazily and with no referrer', () => {
    render(<QuizTask task={PICTURE_TASK} />)
    const img = screen.getAllByRole('radio')[0].querySelector('img')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('a non-https image falls back to the emoji, else to the alt text in words', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', image: 'javascript:alert(1)', emoji: '🦊', alt: 'A fox' },
        { id: 'b', image: 'http://x.test/owl.png', alt: 'An owl' },
        { id: 'c', image: 'data:image/png;base64,AAAA', alt: 'A cat' },
      ],
    }
    const { container } = render(<QuizTask task={task} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('radio', { name: 'A fox' })).toHaveTextContent('🦊')
    expect(screen.getByRole('radio', { name: 'An owl' })).toHaveTextContent('An owl')
    expect(screen.getByRole('radio', { name: 'A cat' })).toHaveTextContent('A cat')
  })

  it('a picture that fails to load shows its emoji, else its alt text, never an empty box', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', image: png('gone'), alt: 'A red circle' },
        { id: 'b', image: png('gone-too'), alt: 'A blue square' },
      ],
    }
    render(<QuizTask task={task} />)
    const card = screen.getByRole('radio', { name: 'A red circle' })
    fireEvent.error(card.querySelector('img'))
    expect(card.querySelector('img')).toBeNull()
    expect(card).toHaveTextContent('A red circle')
  })
})

describe('picture options: mixed options and more than four', () => {
  it('an option with no picture is a normal text card (no empty picture box), code readable', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', emoji: '🦊', alt: 'A fox' },
        { id: 'b', text: '`print("hi")`' },
      ],
    }
    render(<QuizTask task={task} />)
    const words = screen.getAllByRole('radio')[1]
    expect(words.querySelector('[data-picture-box]')).toBeNull()
    expect(within(words).getByText('print("hi")').tagName).toBe('CODE')
    expect(screen.getAllByRole('radio')[0].querySelector('[data-picture-box]')).not.toBeNull()
  })

  it('shows every option in the grid when a lesson has more than four (no data loss)', () => {
    const E = { id: 'e', emoji: '⭐', alt: 'A star' }
    render(<QuizTask task={{ ...PICTURE_TASK, options: [...PICTURE_TASK.options, E] }} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('radio', { name: 'A star' })).toBeInTheDocument()
  })
})

describe('picture options: screen readers', () => {
  it('names a captioned card by caption and alt, as plain text', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', emoji: '🦊', alt: 'A fox sitting in snow', text: '**Fox**' },
        { id: 'b', image: png('owl'), alt: 'An owl', text: 'Owl' },
      ],
    }
    render(<QuizTask task={task} />)
    expect(screen.getByRole('radio', { name: 'Fox: A fox sitting in snow' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Owl: An owl' })).toBeInTheDocument()
  })

  it('the tutor thumbnail is not announced twice beside its label', () => {
    const { container } = render(<ChoiceCardSummary task={PICTURE_TASK} raw="a" />)
    const thumb = container.querySelector('img')
    expect(thumb).toHaveAttribute('alt', '')
    expect(screen.getByText('Red circle above a blue background')).toBeInTheDocument()
  })
})

describe('picture options: the Builder edits alt text and can remove a picture', () => {
  it('edits the alt text of a picture option', () => {
    const onUpdate = vi.fn()
    render(<QuizOptionsBuilder task={PICTURE_TASK} onUpdate={onUpdate} />)
    const alt = screen.getByLabelText('Option A alt text')
    fireEvent.change(alt, { target: { value: 'A red ball' } })
    expect(onUpdate.mock.calls.at(-1)[0].options[0]).toEqual({
      ...PICTURE_TASK.options[0],
      alt: 'A red ball',
    })
  })

  it('flags a missing alt text inline', () => {
    const task = {
      ...PICTURE_TASK,
      options: [{ ...PICTURE_TASK.options[0], alt: '' }, PICTURE_TASK.options[1]],
    }
    render(<QuizOptionsBuilder task={task} onUpdate={vi.fn()} />)
    expect(screen.getByTestId('quiz-option-picture-a')).toHaveTextContent(
      'Add alt text: say what the picture shows'
    )
  })

  it('removes a picture, keeping the option', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<QuizOptionsBuilder task={PICTURE_TASK} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'Remove picture from option B' }))
    expect(onUpdate.mock.calls.at(-1)[0].options[1]).toEqual({ id: 'b', text: '' })
  })

  it('does not add a fifth option to a picture quiz, and says why', () => {
    render(<QuizOptionsBuilder task={PICTURE_TASK} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add option/i })).toBeDisabled()
    expect(screen.getByText(/picture quizzes take 2 to 4 options/i)).toBeInTheDocument()
  })

  it('still adds options to a picture quiz with fewer than four', () => {
    render(
      <QuizOptionsBuilder
        task={{ ...PICTURE_TASK, options: PICTURE_TASK.options.slice(0, 3) }}
        onUpdate={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /add option/i })).toBeEnabled()
  })
})

// Round 2 of the review.
const WORD_ONLY = {
  id: 5,
  title: 'Old word quiz',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 42 },
    { id: 'b', text: '' },
    { id: 'c', text: '   ' },
  ],
  check: { type: 'answer_equals', value: 'a' },
}

describe('word-only quizzes are unchanged (characterization)', () => {
  it('the quiz and the poll draw numeric and blank option text as before', () => {
    const { unmount } = render(<QuizTask task={WORD_ONLY} showQuestion />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios[0]).toHaveTextContent('42')
    unmount()
    render(<QuizTask task={{ ...WORD_ONLY, quizType: 'poll', check: null }} showQuestion />)
    expect(screen.getAllByRole('radio')[0]).toHaveTextContent('42')
  })

  it('the revealed correct answer note still reads a numeric option', () => {
    render(
      <QuizActivityStudentView
        task={WORD_ONLY}
        state="b"
        readOnly
        teacher
        result={{ submitted: true, passed: false }}
      />
    )
    expect(screen.getByText(/Correct answer:/).closest('div')).toHaveTextContent('42')
  })

  it('ChoiceCardSummary: String() of numeric text, "Selected answer" for blank', () => {
    const { unmount } = render(<ChoiceCardSummary task={WORD_ONLY} raw="a" />)
    expect(screen.getByText('42')).toBeInTheDocument()
    unmount()
    render(<ChoiceCardSummary task={WORD_ONLY} raw="b" />)
    expect(screen.getByText('Selected answer')).toBeInTheDocument()
  })

  it('ChoiceCardSummary on a multi-select poll reads word options as before', () => {
    const poll = { ...WORD_ONLY, quizType: 'poll', multiple: true, check: null }
    const { container } = render(<ChoiceCardSummary task={poll} raw='["a","b"]' />)
    expect(container).toHaveTextContent('42')
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('picture with no alt text: never an empty name or a "?"', () => {
  it('an emoji with no alt is named by the caption, else the option id', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', emoji: '🦊', text: 'Fox' },
        { id: 'b', emoji: '🐢' },
      ],
    }
    render(<QuizTask task={task} />)
    expect(screen.getByRole('img', { name: 'Fox' })).toHaveTextContent('🦊')
    expect(screen.getByRole('img', { name: 'b' })).toHaveTextContent('🐢')
  })

  it('a broken image with no alt shows the caption, else the id, in words', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', image: png('gone'), text: 'Owl' },
        { id: 'b', image: png('gone-too') },
      ],
    }
    render(<QuizTask task={task} />)
    for (const img of document.querySelectorAll('[role=radio] img')) fireEvent.error(img)
    const words = [...document.querySelectorAll('[data-quiz-picture="words"]')]
    expect(words.map((el) => el.textContent)).toEqual(['Owl', 'b'])
    expect(document.body).not.toHaveTextContent('?')
  })
})

describe('the verdict is in words for screen readers', () => {
  it('after submit the chosen and the right card say so in text, not only colour', () => {
    render(
      <QuizActivityStudentView
        task={PICTURE_TASK}
        state="a"
        readOnly
        teacher
        result={{ submitted: true, passed: false }}
      />
    )
    const chosen = screen.getByRole('radio', { name: 'Red circle above a blue background' })
    expect(chosen).toHaveAccessibleDescription('Your answer, incorrect')
    const right = screen.getByRole('radio', { name: 'Only a blue background' })
    expect(right).toHaveAccessibleDescription('Correct answer')
    const other = screen.getByRole('radio', { name: 'A purple circle' })
    expect(other).not.toHaveAccessibleDescription()
  })

  it('two copies of one task (a tutor watching many students) each describe their own card', () => {
    render(
      <>
        <QuizTask task={PICTURE_TASK} selectedAnswer="a" submitted checkPassed={false} />
        <QuizActivityStudentView
          task={PICTURE_TASK}
          state="a"
          readOnly
          teacher
          result={{ submitted: true, passed: false }}
        />
      </>
    )
    const ids = [...document.querySelectorAll('[role=radio][aria-describedby]')].map((el) =>
      el.getAttribute('aria-describedby')
    )
    expect(new Set(ids).size).toBe(ids.length)
    // Both students chose a: each window's card reads its own verdict.
    const red = screen.getAllByRole('radio', { name: 'Red circle above a blue background' })
    expect(red[0]).toHaveAccessibleDescription('Your answer')
    expect(red[1]).toHaveAccessibleDescription('Your answer, incorrect')
  })

  it('the "Correct answer" note shows alt text or an id literally, never as Markdown', () => {
    const task = {
      ...PICTURE_TASK,
      options: [
        { id: 'a', emoji: '🦊', alt: 'A fox' },
        { id: 'b', emoji: '🐍', alt: 'Snake *not* a rope' },
      ],
    }
    render(
      <QuizActivityStudentView
        task={task}
        state="a"
        readOnly
        teacher
        result={{ submitted: true, passed: false }}
      />
    )
    const note = screen.getByText(/Correct answer:/).closest('div')
    expect(note).toHaveTextContent('Snake *not* a rope')
    expect(note.querySelector('em')).toBeNull()
  })

  it("a submitted answer with no reveal is described as the student's answer", () => {
    render(<QuizTask task={PICTURE_TASK} selectedAnswer="c" submitted checkPassed={false} />)
    expect(screen.getByRole('radio', { name: 'A purple circle' })).toHaveAccessibleDescription(
      'Your answer'
    )
  })
})

describe('picture layout: one column with hysteresis, and cards that shrink', () => {
  it('goes to one column under 480px and back to two only above 520px', () => {
    let width = 700
    let callback = null
    const original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(cb) {
        callback = cb
      }
      observe() {}
      disconnect() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return width
      },
    })
    try {
      render(<QuizTask task={PICTURE_TASK} />)
      const grid = screen.getByRole('radiogroup')
      const resize = (next) => {
        width = next
        callback([])
      }
      expect(grid).not.toHaveAttribute('data-picture-narrow')
      resize(479)
      expect(grid).toHaveAttribute('data-picture-narrow')
      resize(500)
      expect(grid).toHaveAttribute('data-picture-narrow')
      resize(521)
      expect(grid).not.toHaveAttribute('data-picture-narrow')
      resize(500)
      expect(grid).not.toHaveAttribute('data-picture-narrow')
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptor)
      globalThis.ResizeObserver = original
    }
  })

  it('the card and picture minimum heights follow the shrink scale', () => {
    render(<QuizTask task={PICTURE_TASK} />)
    const card = screen.getAllByRole('radio')[0]
    expect(card.style.minHeight).toContain('var(--quiz-option-scale')
    expect(card.style.minHeight).toContain('120px')
    expect(card.querySelector('[data-picture-box]').parentElement.style.minHeight).toContain(
      'var(--quiz-option-scale'
    )
  })
})
