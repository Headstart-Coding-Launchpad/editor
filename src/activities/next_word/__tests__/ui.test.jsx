import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextWordStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Next Word StudentView with local state (src/test/activityUiHarness.jsx).
// Math.random is pinned to 0, so the sampled word is always the most likely one and the first
// starting word is the busiest one. Reduced motion is switched on so a press lands at once (the
// spin is timers; jsdom can't prove the look of it: check that in a real browser).

const SENTENCES = 'The cat sat on the mat. The cat ran.'
// the -> cat 2, mat 1; cat -> sat 1, ran 1

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
const chip = (word) => screen.getByRole('button', { name: new RegExp(`^${word}:`) })

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  window.matchMedia = vi.fn(() => ({ matches: true }))
})
afterEach(() => {
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
    expect(state()).toMatchObject({ sentence: 'the cat', guesses: 1, right: 1, pending: '' })
    expect(screen.getByTestId('next_word-moment')).toHaveTextContent(
      'You guessed it! It picked “cat”'
    )
  })

  it('counts a wrong guess too, and says what it picked', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    fireEvent.click(chip('mat'))
    press('Next word')
    expect(state()).toMatchObject({ guesses: 1, right: 0 })
    expect(screen.getByTestId('next_word-moment')).toHaveTextContent(
      'Not this time. It picked “cat”, you guessed “mat”.'
    )
  })

  it('passes when the core is done, then bonus guesses are optional', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    for (let i = 0; i < 2; i++) {
      // The most likely word is always picked, so guessing the first (biggest) chip is right.
      const first = screen
        .getAllByRole('button')
        .find((button) => /: \d+ of \d+ times?$/.test(button.getAttribute('aria-label') ?? ''))
      fireEvent.click(first)
      press('Next word')
    }
    expect(state().guesses).toBe(2)
    expect(definition.grade(TASK, state()).passed).toBe(true)
    expect(screen.getByTestId('round-bonus')).toBeInTheDocument()
    const words = state().sentence.split(' ').length
    // (the sentence may have hit a dead end, where the button says Start a sentence)
    press(/^(Next word|Start a sentence)$/)
    expect(state().sentence.split(' ').length).toBe(words + 1)
    expect(state().guesses).toBe(2)
  })

  it('Start again clears the sentence but keeps the guesses made', () => {
    const { state } = renderView()
    write()
    press('Start a sentence')
    fireEvent.click(chip('cat'))
    press('Next word')
    press('Start again')
    expect(state()).toMatchObject({ sentence: '', guesses: 1, right: 1, last: null })
  })
})

describe('Next Word UI: panels', () => {
  it('shows the stats for the last word by default, and nothing else extra', () => {
    renderView({ task: { ...TASK, panels: undefined } })
    write()
    press('Start a sentence')
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
    expect(state().sentence).toBe('the')
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
