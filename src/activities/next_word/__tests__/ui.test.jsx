import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextWordStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { countControls } from '../../../test/countControls.js'

// UI tests for the Next Word StudentView with local state (src/test/activityUiHarness.jsx).
// Math.random is pinned to 0, so the sampled word is always the most likely one and the first
// starting word is the busiest one. Reduced motion is switched on so a press lands at once (the
// spin is timers; jsdom can't prove the look of it: check that in a real browser). Fake timers
// run the 600ms hold on the landed chip: `settle()` lets it go.

const SENTENCES = 'The cat sat on the mat. The cat ran.'
// the -> cat 2, mat 1; cat -> ran 1, sat 1; ran -> the end

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'next_word',
  guesses: 2,
  panels: ['stats'],
  texts: [{ title: 'Pirate', emoji: 'P', body: 'Arr matey the sea the sea the ship' }],
}

function renderView(options = {}) {
  const task = options.task ?? TASK
  return renderActivityUi(NextWordStudentView, {
    initialState: definition.initialState(task),
    ...options,
    task,
  })
}

const write = (text = SENTENCES) =>
  fireEvent.change(screen.getByLabelText(/Write some sentences/), { target: { value: text } })
const press = (name) => fireEvent.click(screen.getByRole('button', { name }))
// A chip while the guess is pending: just the word (no numbers).
const chip = (word) => screen.getByRole('button', { name: word })
// Lets the held landed chip go (fake timers).
const settle = () => act(() => vi.advanceTimersByTime(700))
// A saved state with the student's sentences already written and `sentence` started.
const ready = (sentence) => ({ ...definition.initialState(TASK), own: SENTENCES, sentence })

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.matchMedia
})

describe('Next Word UI: own sentences and the button', () => {
  it('cannot start until there are two words to learn from', () => {
    renderView()
    expect(screen.getByRole('button', { name: 'Start a sentence' })).toBeDisabled()
    write('hello')
    expect(screen.getByRole('button', { name: 'Start a sentence' })).toBeDisabled()
    write(SENTENCES)
    expect(screen.getByRole('button', { name: 'Start a sentence' })).toBeEnabled()
  })

  it('learns from the sentences as they are typed', () => {
    const { state } = renderView()
    write()
    expect(state()).toMatchObject({ own: SENTENCES })
    expect(screen.getByText(/9 words learned/)).toBeInTheDocument()
  })

  it('starts a sentence with a word, then offers the words it might pick', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    expect(state().sentence).toBe('the')
    expect(screen.getByTestId('next_word-sentence')).toHaveTextContent('the')
    expect(chip('cat')).toBeInTheDocument()
    expect(chip('mat')).toBeInTheDocument()
    expect(state().guesses).toBe(0)
  })

  it('needs a guess before Next word during the core, then counts it', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    expect(screen.getByRole('button', { name: 'Next word' })).toBeDisabled()
    fireEvent.click(chip('cat'))
    expect(state().pending).toBe('cat')
    press('Next word')
    expect(state()).toMatchObject({
      sentence: 'the cat',
      guesses: 1,
      right: 1,
      history: 'r',
      pending: '',
    })
    expect(screen.getByTestId('next_word-moment')).toHaveTextContent(
      'Yes, “cat” was the likeliest!'
    )
  })

  it('marks the likeliest word right even when the random pick is another word', () => {
    // Math.random 0.99 makes the model pick the rarer “mat”.
    Math.random.mockReturnValue(0.99)
    const { state } = renderView({ initialState: ready('the') })
    fireEvent.click(chip('cat'))
    press('Next word')
    expect(state()).toMatchObject({ sentence: 'the mat', guesses: 1, right: 1 })
    expect(screen.getByTestId('next_word-moment')).toHaveTextContent(
      "Yes, “cat” was the likeliest! It picked “mat” this time — it doesn't always pick the likeliest."
    )
  })

  it('counts a wrong guess too, and says which word was likelier', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    fireEvent.click(chip('mat'))
    press('Next word')
    expect(state()).toMatchObject({ guesses: 1, right: 0, history: 'w' })
    expect(screen.getByTestId('next_word-moment')).toHaveTextContent(
      '“cat” was likelier (2 of 3 times)'
    )
    expect(screen.getByTestId('next_word-moment')).not.toHaveTextContent('this time')
  })

  it('does not give the answer away while a guess is pending', () => {
    renderView({ initialState: ready('the') })
    // One size, no counts, and no stats for the step being guessed.
    expect(chip('cat').getAttribute('aria-label')).toBe('cat')
    expect(chip('cat').style.fontSize).toBe(chip('mat').style.fontSize)
    expect(screen.queryByTestId('next_word-stats')).not.toBeInTheDocument()
    expect(screen.queryByText(/2 of 3 times/)).not.toBeInTheDocument()
  })

  it('reveals the odds for the step on the press, holds the landed chip, then moves on', () => {
    renderView({ initialState: ready('the') })
    fireEvent.click(chip('mat'))
    press('Next word')
    // The landed word (“cat”, the pick) stays on screen with the numbers, and the next press waits.
    const landed = screen.getByRole('button', { name: /^cat: 2 of 3 times/ })
    expect(landed.className).toContain('act-nw-chip--landed')
    expect(screen.getByRole('button', { name: /^mat: 1 of 3 time/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('next_word-stats')).toHaveTextContent('cat: 2 of 3 times')
    expect(screen.getByRole('button', { name: 'Next word' })).toBeDisabled()
    settle()
    // Now the next step's chips replace it, plain again; the numbers shown are the last step's.
    expect(chip('ran')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cat/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('next_word-stats')).toHaveTextContent('Last guess: after “the”')
  })

  it('draws a plain dot, not a tick, for a wrong guess', () => {
    renderView({ initialState: ready('the') })
    fireEvent.click(chip('mat'))
    press('Next word')
    settle()
    fireEvent.click(chip('ran'))
    press('Next word')
    settle()
    const dots = [...screen.getByTestId('round-progress').querySelectorAll('[data-dot]')]
    expect(dots.map((dot) => dot.getAttribute('data-dot'))).toEqual(['wrong', 'right'])
    expect(dots[0].textContent).toBe('')
    expect(dots[1].textContent).toBe('✓')
    expect(screen.getByTestId('round-progress')).toHaveTextContent('2 of 2 done')
  })

  it('finishes the sentence when the model picks the end, then starts a new one', () => {
    const { state } = renderView({ initialState: ready('the cat ran') })
    fireEvent.click(screen.getByRole('button', { name: 'the end' }))
    press('Next word')
    expect(state().sentence).toBe('the cat ran.')
    expect(state().guesses).toBe(1)
    settle()
    expect(screen.getByTestId('next_word-end')).toHaveTextContent('The end! 🎉')
    press('New sentence')
    expect(state().sentence).toBe('the')
    expect(state().guesses).toBe(1)
    expect(screen.queryByTestId('next_word-end')).not.toBeInTheDocument()
  })

  it('passes when the core is done, then shows the odds and makes guesses optional', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    fireEvent.click(chip('cat'))
    press('Next word')
    settle()
    fireEvent.click(chip('ran'))
    press('Next word')
    settle()
    expect(state().guesses).toBe(2)
    expect(definition.grade(TASK, state()).passed).toBe(true)
    expect(screen.getByTestId('round-bonus')).toBeInTheDocument()
    // Bonus: the odds show again (the only thing after “ran” is the end).
    expect(screen.getByRole('button', { name: /^the end: 1 of 1 time/ })).toBeInTheDocument()
    press('Next word')
    expect(state().sentence).toBe('the cat ran.')
    expect(state().guesses).toBe(2)
  })

  it('Start again clears the sentence but keeps the guesses made', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    fireEvent.click(chip('cat'))
    press('Next word')
    settle()
    press('Start again')
    expect(state()).toMatchObject({ sentence: '', guesses: 1, right: 1, last: null })
  })
})

describe('Next Word UI: panels', () => {
  it('shows the stats for the guessed step by default, and nothing else extra', () => {
    renderView({ task: { ...TASK, panels: undefined } })
    write()
    press('Start a sentence')
    // Not while the first guess is pending...
    expect(screen.queryByTestId('next_word-stats')).not.toBeInTheDocument()
    fireEvent.click(chip('cat'))
    press('Next word')
    // ...but once it is pressed, the numbers for that step are shown.
    expect(screen.getByTestId('next_word-stats')).toHaveTextContent('cat: 2 of 3 times')
    expect(screen.queryByLabelText('How silly should it be?')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Voices' })).not.toBeInTheDocument()
  })

  it('hides the stats when the panel is off', () => {
    renderView({ task: { ...TASK, panels: [] } })
    expect(screen.queryByTestId('next_word-stats')).not.toBeInTheDocument()
  })

  it('has a Sensible to Silly slider labelled in words', () => {
    const { state } = renderView({ task: { ...TASK, panels: ['silly'] } })
    fireEvent.change(screen.getByLabelText('How silly should it be?'), { target: { value: '2' } })
    expect(state().temperature).toBe(2)
    expect(screen.getByTestId('next_word-silly-label')).toHaveTextContent('Super silly')
  })

  it('switches voice, clearing the sentence and learning from the lesson text', () => {
    const { state } = renderView({ task: { ...TASK, panels: ['voices'] } })
    expect(state().voice).toBe('text:0')
    expect(screen.queryByLabelText(/Write some sentences/)).not.toBeInTheDocument()
    press('Start a sentence')
    // The start word is one that begins a sentence in the text (picked at random).
    expect(state().sentence).not.toBe('')
    press(/My writing/)
    expect(state()).toMatchObject({ voice: 'own', sentence: '' })
    expect(screen.getByLabelText(/Write some sentences/)).toBeInTheDocument()
  })
})

describe('Next Word UI: the tutor view', () => {
  it('shows the sentence and the count of words, with no controls', () => {
    renderView({
      readOnly: true,
      initialState: { ...definition.initialState(TASK), ownWords: 9, sentence: 'the' },
    })
    expect(screen.getByTestId('next_word-sentence')).toHaveTextContent('the')
    expect(screen.getByTestId('next_word-own-count')).toHaveTextContent('Wrote 9 words')
    expect(screen.queryByRole('button', { name: 'Start a sentence' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next word' })).not.toBeInTheDocument()
  })
})

describe('look-back panel', () => {
  const LOOK_TASK = { ...TASK, panels: ['stats', 'lookback'], guesses: 5, lookBack: 1 }
  const TEXT = 'the big dog ran. the big dog sat. the big cat ran. a big red ball.'
  const withState = (task, patch = {}) => ({
    ...definition.initialState(task),
    own: TEXT,
    ...patch,
  })

  it('shows a 1 / 2 / 3 switch, and starts on the task value', () => {
    const task = { ...LOOK_TASK, lookBack: 2 }
    renderView({ task, initialState: withState(task) })
    expect(screen.getByRole('radio', { name: 'Look back 2 words' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Look back 1 word' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByRole('radio', { name: 'Look back 3 words' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Look back one word more' })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('next_word-lookback-label')).toHaveTextContent('2 words')
  })

  it('picking an option changes it', () => {
    renderView({ task: LOOK_TASK, initialState: withState(LOOK_TASK) })
    fireEvent.click(screen.getByRole('radio', { name: 'Look back 2 words' }))
    expect(screen.getByTestId('next_word-lookback-label')).toHaveTextContent('2 words')
    fireEvent.click(screen.getByRole('radio', { name: 'Look back 3 words' }))
    expect(screen.getByTestId('next_word-lookback-label')).toHaveTextContent('3 words')
  })

  it('maxLookBack limits the options', () => {
    const task = { ...LOOK_TASK, maxLookBack: 2 }
    renderView({ task, initialState: withState(task) })
    expect(screen.queryByRole('radio', { name: 'Look back 3 words' })).not.toBeInTheDocument()
  })

  it('has no look-back controls without the panel', () => {
    renderView()
    expect(screen.queryByTestId('next_word-lookback')).not.toBeInTheDocument()
  })

  it('the tutor sees the look-back but cannot change it', () => {
    renderView({
      task: LOOK_TASK,
      readOnly: true,
      initialState: withState(LOOK_TASK, { lookBack: 3 }),
    })
    expect(screen.getByTestId('next_word-lookback-label')).toHaveTextContent('3 words')
    expect(screen.getByRole('radio', { name: 'Look back 1 word' })).toBeDisabled()
  })

  it('says in words when it falls back to fewer words', () => {
    renderView({
      task: LOOK_TASK,
      readOnly: true,
      initialState: withState(LOOK_TASK, { lookBack: 3, sentence: 'the big red' }),
    })
    expect(screen.getByTestId('next_word-fallback')).toHaveTextContent(
      'Never saw \u201cthe big red\u201d, using \u201cbig red\u201d.'
    )
  })

  it('shows multi-word contexts in the stats', () => {
    renderView({
      task: LOOK_TASK,
      readOnly: true,
      initialState: withState(LOOK_TASK, { lookBack: 2, sentence: 'the big' }),
    })
    expect(screen.getByTestId('next_word-stats')).toHaveTextContent('After \u201cthe big\u201d')
    expect(screen.getByText(/dog: 2 of 3 times/)).toBeInTheDocument()
    expect(screen.queryByTestId('next_word-fallback')).not.toBeInTheDocument()
  })
})

describe('control budget', () => {
  it('the default screen has at most 5 controls', () => {
    const { container } = renderView({ initialState: ready('the') })
    expect(countControls(container)).toBeLessThanOrEqual(5)
  })

  it('the look-back lesson stays within 5 controls too', () => {
    const task = { ...TASK, panels: ['stats', 'lookback'] }
    const { container } = renderView({ task, initialState: { ...ready('the'), guesses: 1 } })
    expect(countControls(container)).toBeLessThanOrEqual(5)
  })
})
