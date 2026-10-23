// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_GUESSES,
  activeModel,
  applyStep,
  candidatesOf,
  gradeTask,
  guessGoalOf,
  initialNextWordState,
  normalizeNextWordState,
  panelsOf,
  sharedState,
  sillyLabel,
  solutionStateFor,
  validateNextWordTask,
  voiceOf,
  voicesOf,
} from '../next_word.js'
import definition from '../definition.js'
import { MAX_TEXT_CHARS } from '../ngram.js'

// Pure logic tests for the Next Word activity. The shared contract (default task validates,
// state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'next_word',
  texts: [{ title: 'Pets', emoji: '🐱', body: 'The cat sat on the mat. The cat ran.' }],
}
const WITH_VOICES = { ...TASK, panels: ['stats', 'voices'] }

describe('validateNextWordTask', () => {
  it('accepts a valid task and the default task', () => {
    expect(validateNextWordTask(TASK, 1)).toEqual([])
    expect(validateNextWordTask(definition.defaultTask({ id: 1 }), 1)).toEqual([])
  })

  it('needs nothing: no texts, panels or guesses is fine', () => {
    expect(validateNextWordTask({ taskType: 'activity', activityType: 'next_word' }, 1)).toEqual([])
  })

  it('still accepts an old task that has items, allowPaste and showTemperature', () => {
    const old = {
      ...TASK,
      allowPaste: true,
      showTemperature: true,
      items: [{ id: 'a', prompt: 'the cat', answer: 'sat' }],
    }
    expect(validateNextWordTask(old, 1)).toEqual([])
  })

  it('checks each text', () => {
    const errors = validateNextWordTask(
      {
        texts: [
          { title: '', body: 'a b' },
          { title: 'T', body: '' },
          { title: 'T', body: 'x'.repeat(MAX_TEXT_CHARS + 1) },
          { title: 'T', body: 'one' },
          { title: 'T', body: 'a b', emoji: '' },
        ],
      },
      2
    )
    expect(errors).toEqual([
      'Task 2 text 1: title is required.',
      'Task 2 text 2: body is required.',
      `Task 2 text 3: body is longer than ${MAX_TEXT_CHARS} characters.`,
      'Task 2 text 4: body needs at least 2 words.',
      'Task 2 text 5: emoji must be one short emoji.',
    ])
    expect(validateNextWordTask({ texts: 'nope' }, 1)).toEqual(['Task 1: texts must be a list.'])
  })

  it('accepts the known panels and rejects unknown ones', () => {
    expect(validateNextWordTask({ panels: ['stats', 'silly', 'voices'] }, 1)).toEqual([])
    expect(validateNextWordTask({ panels: [] }, 1)).toEqual([])
    expect(validateNextWordTask({ panels: ['stats', 'wheel'] }, 1)).toEqual([
      'Task 1: panels has "wheel", which is not one of stats, silly, voices.',
    ])
    expect(validateNextWordTask({ panels: 'stats' }, 1)).toEqual(['Task 1: panels must be a list.'])
  })

  it('checks guesses', () => {
    expect(validateNextWordTask({ guesses: 3 }, 1)).toEqual([])
    for (const bad of [0, 2.5, '5', MAX_GUESSES + 1]) {
      expect(validateNextWordTask({ guesses: bad }, 1)).toEqual([
        `Task 1: guesses must be a whole number from 1 to ${MAX_GUESSES}.`,
      ])
    }
  })
})

describe('panels, guesses and voices', () => {
  it('defaults the panels to stats and keeps a fixed order', () => {
    expect(panelsOf({})).toEqual(['stats'])
    expect(panelsOf({ panels: [] })).toEqual([])
    expect(panelsOf({ panels: ['voices', 'bogus', 'stats'] })).toEqual(['stats', 'voices'])
  })

  it('defaults the guesses to 5', () => {
    expect(guessGoalOf({})).toBe(5)
    expect(guessGoalOf({ guesses: 3 })).toBe(3)
    expect(guessGoalOf({ guesses: 0 })).toBe(5)
  })

  it('offers only My writing without the voices panel, and the texts then My writing with it', () => {
    expect(voicesOf(TASK).map((voice) => voice.id)).toEqual(['own'])
    expect(voicesOf(WITH_VOICES).map((voice) => voice.id)).toEqual(['text:0', 'own'])
    expect(voicesOf(WITH_VOICES)[0]).toMatchObject({ label: 'Pets', emoji: '🐱' })
  })

  it('falls back to My writing for a voice that is not on offer', () => {
    expect(voiceOf(TASK, { voice: 'text:0' }).id).toBe('own')
    expect(voiceOf(WITH_VOICES, { voice: 'text:7' }).id).toBe('own')
    expect(initialNextWordState(WITH_VOICES).voice).toBe('text:0')
    expect(initialNextWordState(TASK).voice).toBe('own')
  })
})

describe('the model and a step', () => {
  it('learns from the student own sentences, and needs two words', () => {
    const state = { ...initialNextWordState(TASK), own: 'The cat sat. The cat ran.' }
    expect(activeModel(TASK, state)).not.toBeNull()
    expect(activeModel(TASK, { ...state, own: 'hello' })).toBeNull()
  })

  it('learns from the lesson text when that voice is chosen', () => {
    const state = { ...initialNextWordState(WITH_VOICES), own: '' }
    expect(activeModel(WITH_VOICES, state)).not.toBeNull()
    expect(activeModel(WITH_VOICES, { ...state, voice: 'own' })).toBeNull()
  })

  it('offers up to five candidates for the last word, most likely first', () => {
    const model = activeModel(WITH_VOICES, initialNextWordState(WITH_VOICES))
    const info = candidatesOf(model, 'the cat sat on the')
    expect(info.options.map((option) => option.word)).toEqual(['cat', 'mat'])
    expect(info.total).toBe(3)
  })

  it('adds the word, counts a guess (right or wrong) and records what happened', () => {
    const base = { ...initialNextWordState(TASK), sentence: 'the' }
    const right = applyStep(base, 'cat', 'cat')
    expect(right).toMatchObject({
      sentence: 'the cat',
      guesses: 1,
      right: 1,
      last: { guess: 'cat', picked: 'cat', ok: true },
    })
    const wrong = applyStep(right, 'sat', 'mat')
    expect(wrong).toMatchObject({
      sentence: 'the cat sat',
      guesses: 2,
      right: 1,
      last: { guess: 'mat', picked: 'sat', ok: false },
    })
  })

  it('does not count a step with no guess, and ignores a missing word', () => {
    const base = { ...initialNextWordState(TASK), sentence: 'the' }
    expect(applyStep(base, 'cat')).toMatchObject({ sentence: 'the cat', guesses: 0, last: null })
    expect(applyStep(base, null)).toBe(base)
  })

  it('keeps the sentence short by dropping its oldest words', () => {
    let state = initialNextWordState(TASK)
    for (let i = 0; i < 200; i++) state = applyStep(state, 'wordy')
    expect(state.sentence.length).toBeLessThanOrEqual(400)
    expect(state.sentence.endsWith('wordy')).toBe(true)
  })
})

describe('grading', () => {
  it('counts guesses against the goal, right or wrong, with bonus after it', () => {
    const task = { ...TASK, guesses: 3 }
    expect(gradeTask(task, { guesses: 2, right: 0 })).toMatchObject({ core: 2, done: false })
    expect(gradeTask(task, { guesses: 3, right: 0 })).toMatchObject({ core: 3, done: true })
    expect(gradeTask(task, { guesses: 5, right: 4 })).toMatchObject({
      core: 3,
      bonus: 2,
      right: 4,
      done: true,
    })
  })

  it('passes with the solution state and not with the blank one', () => {
    expect(definition.grade(TASK, solutionStateFor(TASK)).passed).toBe(true)
    expect(definition.grade(TASK, definition.initialState(TASK)).passed).toBe(false)
  })

  it('summarises for the tutor card: guessed, right, own words', () => {
    const state = { ...initialNextWordState(TASK), own: 'a b c d', guesses: 3, right: 2 }
    expect(definition.summarize(TASK, state)).toEqual({
      text: '3/5 guessed · 2 right · 4 own words',
      tone: 'neutral',
    })
    const done = { ...state, guesses: 7 }
    expect(definition.summarize(TASK, done)).toMatchObject({
      text: expect.stringContaining('5/5 guessed · +2 bonus'),
      tone: 'success',
    })
  })

  it('reports progress against the goal', () => {
    expect(definition.getProgress(TASK, { guesses: 2, right: 1 })).toMatchObject({
      kind: 'items',
      filled: 2,
      total: 5,
      correct: 1,
    })
  })
})

describe('state', () => {
  it('keeps the student own sentences out of the shared form, with a word count instead', () => {
    const state = { ...initialNextWordState(TASK), own: 'Secret words here', sentence: 'the cat' }
    const shared = JSON.parse(definition.serializeShared(state))
    expect(shared).not.toHaveProperty('own')
    expect(JSON.stringify(shared)).not.toContain('Secret')
    expect(shared).toMatchObject({ ownWords: 3, sentence: 'the cat' })
    expect(sharedState(state)).toEqual(shared)
  })

  it('keeps them in the device copy and reads both forms back', () => {
    const state = { ...initialNextWordState(TASK), own: 'Secret words here', guesses: 2 }
    const local = definition.deserialize(definition.serialize(state), TASK)
    expect(local).toMatchObject({ own: 'Secret words here', ownWords: 3, guesses: 2 })
    const shared = definition.deserialize(definition.serializeShared(state), TASK)
    expect(shared).toMatchObject({ own: '', ownWords: 3, guesses: 2 })
  })

  it('reads an old v1 state, bad JSON and nothing as a blank state', () => {
    const old = JSON.stringify({ v: 1, source: 'text', index: 0, items: { a: { guess: 'net' } } })
    expect(definition.deserialize(old, TASK)).toEqual(initialNextWordState(TASK))
    expect(definition.deserialize('not json', TASK)).toEqual(initialNextWordState(TASK))
    expect(normalizeNextWordState(TASK, null)).toEqual(initialNextWordState(TASK))
  })

  it('never lets right exceed guesses, and clamps the temperature', () => {
    const state = normalizeNextWordState(TASK, { guesses: 1, right: 9, temperature: 50 })
    expect(state).toMatchObject({ guesses: 1, right: 1, temperature: 2 })
  })

  it('keeps the starting and solution state small', () => {
    expect(JSON.stringify(definition.initialState(TASK)).length).toBeLessThan(2048)
    expect(JSON.stringify(definition.solutionState(TASK)).length).toBeLessThan(2048)
  })

  it('classifies typing and the slider as continuous, taps and presses as discrete', () => {
    const before = definition.initialState(TASK)
    expect(definition.classifyChange(before, { ...before, own: 'a b' })).toBe('continuous')
    expect(definition.classifyChange(before, { ...before, temperature: 1.5 })).toBe('continuous')
    expect(definition.classifyChange(before, { ...before, pending: 'cat' })).toBe('discrete')
    expect(definition.classifyChange(before, { ...before, sentence: 'the' })).toBe('discrete')
    expect(definition.classifyChange(before, { ...before, voice: 'text:0' })).toBe('discrete')
    expect(definition.classifyChange(before, { ...before, guesses: 1 })).toBe('discrete')
    expect(definition.classifyChange(before, before)).toBe('discrete')
  })

  it('prints the goal and the voices', () => {
    const html = definition.printHtml({ ...TASK, guesses: 4 }, { esc: (value) => String(value) })
    expect(html).toContain('4 times')
    expect(html).toContain('Pets')
  })
})

describe('sillyLabel', () => {
  it('names the slider in words', () => {
    expect(sillyLabel(0)).toBe('Super sensible')
    expect(sillyLabel(0.3)).toBe('Sensible')
    expect(sillyLabel(1)).toBe('A bit silly')
    expect(sillyLabel(1.5)).toBe('Silly')
    expect(sillyLabel(2)).toBe('Super silly')
  })
})
