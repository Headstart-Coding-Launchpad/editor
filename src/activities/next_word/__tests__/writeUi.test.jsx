import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextWordStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { countControls } from '../../../test/countControls.js'
import { activeModel, gradeTask, lookBackOf, validateNextWordTask, whyWord } from '../next_word.js'

// Write mode (mode: write): Go writes a card word by word. Math.random is pinned to 0 (the
// likeliest word each time) and reduced motion is on so Go lands at once.

const BODY = 'The cat sat on the mat. The cat sat on the mat.'
const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'next_word',
  mode: 'write',
  passAt: 2,
  panels: ['stats', 'silly', 'voices', 'lookback'],
  texts: [
    { title: 'Cats', emoji: 'C', body: BODY },
    { title: 'Dogs', emoji: 'D', body: 'A dog ran home. A dog ran home.' },
  ],
}

function renderView(options = {}) {
  const task = options.task ?? TASK
  return renderActivityUi(NextWordStudentView, {
    initialState: definition.initialState(task),
    ...options,
    task,
  })
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  vi.restoreAllMocks()
  delete window.matchMedia
})

const go = () => fireEvent.click(screen.getByTestId('next_word-go'))

describe('Next Word write mode', () => {
  it('has at most 5 controls on the default screen', () => {
    const { container } = renderView()
    expect(countControls(container)).toBeLessThanOrEqual(5)
    expect(screen.getByLabelText(/My writing/)).toBeTruthy()
  })

  it('starts at look-back 2', () => {
    expect(lookBackOf(TASK, definition.initialState(TASK))).toBe(2)
  })

  it('Go writes a card, flags a copy, and Keep stores it', () => {
    renderView()
    go()
    expect(screen.getByTestId('next_word-sentence').textContent).toMatch(/the cat sat on the mat\./)
    expect(screen.getByTestId('next_word-copied').textContent).toMatch(/Copied word for word/)
    fireEvent.click(screen.getByTestId('next_word-keep'))
    expect(screen.getByTestId('next_word-kept')).toBeTruthy()
    expect(screen.getByTestId('next_word-cards').textContent).toMatch(/1 of 2/)
    expect(screen.queryByTestId('next_word-keep')).toBeNull()
  })

  it('shows Copied word for word when the pack is one sentence, and kept cards render in the card style', () => {
    const task = {
      ...TASK,
      card: 'headline',
      texts: [{ title: 'One', emoji: 'O', body: 'The cat sat on the mat.' }],
    }
    renderView({ task })
    go()
    expect(screen.getByTestId('next_word-sentence').textContent).toMatch(/the cat sat on the mat\./)
    expect(screen.getByTestId('next_word-copied').textContent).toMatch(/Copied word for word/)
    fireEvent.click(screen.getByTestId('next_word-keep'))
    const kept = screen.getByTestId('next_word-keptcard')
    expect(kept.className).toMatch(/act-nw-minicard--headline/)
    expect(kept.textContent).toMatch(/📰/)
    expect(kept.textContent).toMatch(/the cat sat on the mat\./)
    expect(kept.textContent).toMatch(/copied/)
  })

  it('tapping a written word says why', () => {
    renderView()
    go()
    fireEvent.click(screen.getByRole('button', { name: 'on' }))
    expect(screen.getByTestId('next_word-why').textContent).toMatch(
      /after “the cat sat”|after “cat sat”/
    )
    expect(screen.getByTestId('next_word-why').textContent).toMatch(/on: \d+ of \d+ times?/)
  })

  it('what the child writes is added to the pack', () => {
    const task = { ...TASK, texts: [{ title: 'Cats', body: BODY }] }
    const state = { ...definition.initialState(task), own: 'The cat flew away.' }
    const model = activeModel(task, state)
    expect(model.successors.get('cat').has('flew')).toBe(true)
    expect(model.successors.get('cat').has('sat')).toBe(true)
  })

  it('the tutor sees the sentence, the badge and the kept cards read-only', () => {
    renderView({
      readOnly: true,
      initialState: {
        ...definition.initialState(TASK),
        sentence: 'the cat sat on the mat.',
        finished: true,
        copied: true,
        cards: [{ text: 'the cat sat on the mat.', copied: true, lookBack: 2 }],
      },
    })
    expect(screen.getByTestId('next_word-copied')).toBeTruthy()
    expect(screen.getByTestId('next_word-cards').textContent).toMatch(/the cat sat on the mat/)
    expect(screen.queryByTestId('next_word-go')).toBeNull()
  })
})

describe('Next Word write mode: logic', () => {
  it('passes after passAt kept cards and summarises them', () => {
    const card = { text: 'a b c', copied: false, lookBack: 2 }
    const state = { ...definition.initialState(TASK), cards: [card, { ...card, copied: true }] }
    expect(gradeTask(TASK, state).done).toBe(true)
    expect(definition.grade(TASK, state).passed).toBe(true)
    expect(definition.summarize(TASK, state).text).toMatch(/2 of 2 cards kept · looked back/)
    expect(definition.summarize(TASK, state).text).toMatch(/latest: “a b c”/)
  })

  it('explains the first word and a word it never saw', () => {
    const task = { ...TASK, texts: [{ title: 'Cats', body: BODY }] }
    const model = activeModel(task, definition.initialState(task))
    expect(whyWord(model, 'the cat', 0).first).toBe(true)
    expect(whyWord(model, 'the cat sat', 2, 2).count).toBe(2)
  })

  it('validates the new fields', () => {
    const errors = validateNextWordTask(
      { ...TASK, mode: 'x', maxWords: 2, card: 'z', passAt: 11 },
      1
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        'Task 1: mode must be one of guess, write.',
        'Task 1: maxWords must be a whole number from 3 to 40.',
        'Task 1: card must be one of headline, post, commentary.',
        'Task 1: passAt must be a whole number from 1 to 10.',
      ])
    )
    expect(validateNextWordTask(TASK, 1)).toEqual([])
    const long = { ...TASK, texts: [{ title: 'T', body: 'word '.repeat(1100) }] }
    expect(validateNextWordTask(long, 1)).toEqual([])
    expect(validateNextWordTask({ ...long, mode: undefined }, 1).join()).toMatch(/longer than 4000/)
  })
})
