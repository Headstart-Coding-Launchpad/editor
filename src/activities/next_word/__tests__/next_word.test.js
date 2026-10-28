// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_GUESSES,
  activeModel,
  applyStep,
  candidatesOf,
  dotsOf,
  gradeGuess,
  gradeTask,
  guessGoalOf,
  initialNextWordState,
  lookBackOf,
  maxLookBackOf,
  startLookBackOf,
  nextWordBadgeResult,
  normalizeNextWordState,
  panelsOf,
  sharedState,
  sillyLabel,
  solutionStateFor,
  startWordOf,
  validateNextWordTask,
  voiceOf,
  voicesOf,
} from '../next_word.js'
import definition from '../definition.js'
import { MAX_TEXT_CHARS, buildModel } from '../ngram.js'

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
      'Task 1: panels has "wheel", which is not one of stats, silly, voices, lookback.',
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

  it('marks a guess right when it is the likeliest word, whatever the model picked', () => {
    const model = activeModel(WITH_VOICES, initialNextWordState(WITH_VOICES))
    const info = candidatesOf(model, 'the cat sat on the') // cat 2, mat 1
    expect(gradeGuess(info, 'cat', 'mat')).toEqual({
      ok: true,
      best: 'cat',
      bestCount: 2,
      total: 3,
      pickedBest: false,
    })
    expect(gradeGuess(info, 'mat', 'cat')).toMatchObject({
      ok: false,
      best: 'cat',
      pickedBest: true,
    })
    expect(gradeGuess(info, '', 'cat')).toBeNull()
    expect(gradeGuess({ total: 0, options: [] }, 'cat', 'cat')).toBeNull()
  })

  it('counts every word tied for the most likely as right', () => {
    const info = candidatesOf(buildModel('a x. a y. a y. a x.'), 'a') // x 2, y 2
    expect(gradeGuess(info, 'y', 'x').ok).toBe(true)
    expect(gradeGuess(info, 'x', 'x').ok).toBe(true)
  })

  it('stores the grade on the step and a right/wrong history for the dots', () => {
    const base = { ...initialNextWordState(TASK), sentence: 'the' }
    const grade = { ok: true, best: 'cat', bestCount: 2, total: 3, pickedBest: false }
    const right = applyStep(base, 'mat', 'cat', grade)
    expect(right).toMatchObject({
      guesses: 1,
      right: 1,
      history: 'r',
      last: {
        guess: 'cat',
        picked: 'mat',
        ok: true,
        best: 'cat',
        bestCount: 2,
        total: 3,
        pickedBest: false,
      },
    })
    const wrong = applyStep(right, 'sat', 'cat', { ...grade, ok: false, best: 'sat' })
    expect(wrong).toMatchObject({ guesses: 2, right: 1, history: 'rw' })
    expect(normalizeNextWordState(TASK, wrong).history).toBe('rw')
    expect(normalizeNextWordState(TASK, { history: 'rxw!' }).history).toBe('rw')
  })

  it('draws the dots from the history, handing older states their rights first', () => {
    const task = { ...TASK, guesses: 4 }
    expect(dotsOf(task, { guesses: 3, right: 2, history: 'rwr' })).toEqual([
      'right',
      'wrong',
      'right',
      'todo',
    ])
    expect(dotsOf(task, { guesses: 2, right: 1 })).toEqual(['right', 'wrong', 'todo', 'todo'])
    expect(dotsOf(task, { guesses: 9, right: 0, history: 'wwwwww' })).toEqual([
      'wrong',
      'wrong',
      'wrong',
      'wrong',
    ])
  })

  it('ends a sentence with the end mark stuck to the last word, then starts a new one', () => {
    const base = { ...initialNextWordState(TASK), sentence: 'the cat ran' }
    const ended = applyStep(base, '.')
    expect(ended.sentence).toBe('the cat ran.')
    expect(
      candidatesOf(activeModel(WITH_VOICES, initialNextWordState(WITH_VOICES)), ended.sentence)
    ).toMatchObject({
      total: 0,
      options: [],
    })
    expect(applyStep(ended, 'the').sentence).toBe('the')
  })

  it('starts a sentence on a word that starts sentences in the text', () => {
    const model = buildModel('The cat ran. A dog sat. The cat sat.')
    const seen = new Set()
    for (let i = 0; i < 20; i++) seen.add(startWordOf(model, () => i / 20))
    expect([...seen].sort()).toEqual(['a', 'the'])
    expect(startWordOf(buildModel('hello'))).toBeNull()
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

describe('badge result', () => {
  const own = { ...initialNextWordState(TASK), own: 'the cat sat on the mat' }

  it('counts words the model added from the student own writing, across the task', () => {
    let state = own
    expect(state.generated).toBe(0)
    state = applyStep(state, 'cat', 'cat')
    state = applyStep(state, 'sat')
    expect(state.generated).toBe(2)
    expect(JSON.parse(definition.serializeShared(state)).generated).toBe(2)
    expect(normalizeNextWordState(TASK, JSON.parse(definition.serialize(state))).generated).toBe(2)
  })

  it('does not count words made from the lesson texts, from too little writing, or a no-word step', () => {
    const voice = { ...own, voice: 'text:0' }
    expect(applyStep(voice, 'cat', 'cat').generated).toBe(0)
    expect(applyStep({ ...own, own: 'hi' }, 'cat').generated).toBe(0)
    expect(applyStep(own, '').generated).toBe(0)
    // An old save has no counter.
    expect(normalizeNextWordState(TASK, { v: 2, own: 'a b c' }).generated).toBe(0)
  })

  it('summarises the passing submission: numbers only', () => {
    let state = own
    for (const word of ['cat', 'sat', 'on', 'the', 'mat']) state = applyStep(state, word, word)
    state = applyStep(state, 'x', 'y')
    const result = definition.badgeResult(
      TASK,
      definition.deserialize(definition.serializeShared(state), TASK)
    )
    expect(result).toEqual({ core: 5, tries: 5, right: 5, ownWords: 6, generated: 6 })
    expect(nextWordBadgeResult(TASK, initialNextWordState(TASK))).toEqual({
      core: 5,
      tries: 0,
      right: 0,
      ownWords: 0,
      generated: 0,
    })
  })
})

describe('state', () => {
  it('shares the student own sentences with the tutor, with a word count', () => {
    const state = { ...initialNextWordState(TASK), own: 'Secret words here', sentence: 'the cat' }
    const shared = JSON.parse(definition.serializeShared(state))
    expect(shared).toMatchObject({ own: 'Secret words here', ownWords: 3, sentence: 'the cat' })
    expect(sharedState(state)).toEqual(shared)
  })

  it('shares the guess results and history too', () => {
    const state = { ...initialNextWordState(TASK), guesses: 2, right: 1, history: 'rw' }
    expect(JSON.parse(definition.serializeShared(state))).toMatchObject({ history: 'rw' })
  })

  it('keeps them in the device copy and reads both forms back', () => {
    const state = { ...initialNextWordState(TASK), own: 'Secret words here', guesses: 2 }
    const local = definition.deserialize(definition.serialize(state), TASK)
    expect(local).toMatchObject({ own: 'Secret words here', ownWords: 3, guesses: 2 })
    const shared = definition.deserialize(definition.serializeShared(state), TASK)
    expect(shared).toMatchObject({ own: 'Secret words here', ownWords: 3, guesses: 2 })
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

describe('look-back (lookback panel)', () => {
  const LOOK = {
    ...TASK,
    panels: ['stats', 'lookback'],
    texts: [
      { title: 'Dogs', body: 'the big dog ran. the big dog sat. the big cat ran. a big red ball.' },
    ],
  }

  it('defaults to a start of 1 and a maximum of 3', () => {
    expect(startLookBackOf(TASK)).toBe(1)
    expect(maxLookBackOf(TASK)).toBe(3)
    expect(initialNextWordState(TASK).lookBack).toBe(1)
    expect(initialNextWordState({ ...LOOK, lookBack: 2 }).lookBack).toBe(2)
  })

  it('keeps the start inside the maximum', () => {
    expect(startLookBackOf({ lookBack: 3, maxLookBack: 2 })).toBe(2)
  })

  it('lets the student change it only with the lookback panel', () => {
    expect(lookBackOf(LOOK, { lookBack: 3 })).toBe(3)
    expect(lookBackOf({ ...LOOK, maxLookBack: 2 }, { lookBack: 3 })).toBe(2)
    expect(lookBackOf(TASK, { lookBack: 3 })).toBe(1)
    expect(lookBackOf({ ...TASK, lookBack: 2 }, { lookBack: 3 })).toBe(2)
  })

  it('reads and shares the state, tolerating junk', () => {
    expect(normalizeNextWordState(LOOK, { lookBack: 2 }).lookBack).toBe(2)
    expect(normalizeNextWordState(LOOK, { lookBack: 9 }).lookBack).toBe(3)
    expect(normalizeNextWordState(LOOK, { lookBack: 'x' }).lookBack).toBe(1)
    expect(normalizeNextWordState(LOOK, { lookBack: 0 }).lookBack).toBe(1)
    expect(sharedState({ lookBack: 2 }).lookBack).toBe(2)
  })

  it('candidates use the longer context, and are unchanged at 1', () => {
    const model = buildModel('the big dog ran. the big dog sat. the big cat ran. a big red ball.')
    const two = candidatesOf(model, 'the big', 2)
    expect(two.options.map((o) => o.word)).toEqual(['dog', 'cat'])
    expect(two.total).toBe(3)
    expect(candidatesOf(model, 'the big')).toEqual(candidatesOf(model, 'the big', 1))
    expect(candidatesOf(model, 'the big dog.', 3).options).toEqual([])
  })

  it('a guess is graded against the longer context', () => {
    const info = candidatesOf(
      buildModel('the big dog ran. the big dog sat. the big cat ran. a big red ball.'),
      'the big',
      2
    )
    expect(gradeGuess(info, 'dog', 'cat').ok).toBe(true)
    expect(gradeGuess(info, 'cat', 'dog').ok).toBe(false)
  })

  it('the card summary names the look-back the student is on', () => {
    expect(definition.summarize(LOOK, { ...initialNextWordState(LOOK), lookBack: 2 }).text).toMatch(
      /looked back 2/
    )
    expect(definition.summarize(TASK, initialNextWordState(TASK)).text).not.toMatch(/looked back/)
  })

  it('treats a change of look-back as a discrete change', () => {
    const before = initialNextWordState(LOOK)
    expect(definition.classifyChange(before, { ...before, lookBack: 2 })).toBe('discrete')
  })

  it('validates lookBack and maxLookBack', () => {
    expect(validateNextWordTask({ ...LOOK, lookBack: 2, maxLookBack: 3 }, 1)).toEqual([])
    expect(validateNextWordTask({ ...LOOK, maxLookBack: 4 }, 1)).toEqual([
      'Task 1: maxLookBack must be a whole number from 1 to 3.',
    ])
    expect(validateNextWordTask({ ...LOOK, lookBack: 0 }, 1)).toHaveLength(1)
    expect(validateNextWordTask({ ...LOOK, lookBack: 3, maxLookBack: 2 }, 1)).toEqual([
      'Task 1: lookBack must be a whole number from 1 to 2.',
    ])
    expect(validateNextWordTask({ ...LOOK, panels: ['lookback'] }, 1)).toEqual([])
  })
})
