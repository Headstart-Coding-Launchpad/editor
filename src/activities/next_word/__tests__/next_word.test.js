// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  chosenText,
  gradeItem,
  gradeTask,
  initialNextWordState,
  optionsForPrompt,
  solutionStateFor,
  validateNextWordTask,
} from '../next_word.js'
import definition from '../definition.js'
import { MAX_PASTE_CHARS, MAX_TEXT_CHARS } from '../ngram.js'

// Pure logic tests for the Next Word activity. The shared contract (default task validates,
// state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

const FOOTBALL =
  'The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net.'
// the -> net 3, ball 2, keeper 1, striker 1
const GOALS = 'The ball goes into the goal. The goal was big. The ball hit the goal.'
// the -> goal 3, ball 2

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'next_word',
  texts: [
    { title: 'Football', body: FOOTBALL },
    { title: 'Goals', body: GOALS },
  ],
  allowPaste: true,
  showTemperature: true,
  items: [
    { id: 'a', prompt: 'the ball goes into the', answer: 'net' },
    { id: 'b', prompt: 'The keeper looks at the', answer: 'Net.' },
  ],
}

const chosen = (index, items = {}) => ({
  ...initialNextWordState(TASK),
  source: 'text',
  index,
  items: {
    a: { guess: '', revealed: false },
    b: { guess: '', revealed: false },
    ...items,
  },
})

describe('validateNextWordTask', () => {
  it('accepts a valid task and the default task', () => {
    expect(validateNextWordTask(TASK, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('needs texts and items', () => {
    expect(validateNextWordTask({ texts: [], items: [] }, 2)).toEqual([
      'Task 2: next_word task needs at least one text in texts.',
      'Task 2: next_word task needs at least one item.',
    ])
    expect(validateNextWordTask({}, 2)).toHaveLength(2)
  })

  it('checks each text', () => {
    const errors = validateNextWordTask(
      {
        ...TASK,
        texts: [
          { title: '', body: FOOTBALL },
          { title: 'Empty', body: ' ' },
          { title: 'One', body: 'hello.' },
          { title: 'Long', body: 'word '.repeat(MAX_TEXT_CHARS / 4) },
        ],
        items: [],
      },
      3
    )
    expect(errors).toContain('Task 3 text 1: title is required.')
    expect(errors).toContain('Task 3 text 2: body is required.')
    expect(errors).toContain('Task 3 text 3: body needs at least 2 words.')
    expect(errors).toContain(`Task 3 text 4: body is longer than ${MAX_TEXT_CHARS} characters.`)
  })

  it('checks the true/false settings', () => {
    expect(
      validateNextWordTask({ ...TASK, allowPaste: 'yes', showTemperature: 1 }, 1).sort()
    ).toEqual([
      'Task 1: allowPaste must be true or false.',
      'Task 1: showTemperature must be true or false.',
    ])
  })

  it('checks each item', () => {
    expect(
      validateNextWordTask(
        {
          ...TASK,
          items: [
            { id: 'a', prompt: 'the ball goes into the', answer: 'net' },
            { id: 'a', prompt: '', answer: '' },
            { prompt: 'the', answer: 'net now' },
          ],
        },
        3
      )
    ).toEqual([
      'Task 3 item 2: id "a" is used more than once.',
      'Task 3 item 2: prompt is required.',
      'Task 3 item 2: answer is required.',
      'Task 3 item 3: needs an id.',
      'Task 3 item 3: answer must be one word.',
    ])
  })

  it('checks the answer against the first text', () => {
    const errors = validateNextWordTask(
      {
        ...TASK,
        items: [
          { id: 'a', prompt: 'the', answer: 'goal' },
          { id: 'b', prompt: 'net', answer: 'the' },
          { id: 'c', prompt: 'The ball goes into the', answer: 'NET.' },
        ],
      },
      1
    )
    expect(errors).toEqual([
      'Task 1 item 1: answer "goal" is not the most likely word after "the" in the first text (it is "net").',
    ])
  })
  it('reports a prompt word nothing follows in the first text', () => {
    const errors = validateNextWordTask(
      { ...TASK, items: [{ id: 'a', prompt: 'the cat', answer: 'sat' }] },
      1
    )
    expect(errors).toEqual(['Task 1 item 1: "cat" never has a word after it in the first text.'])
  })

  it('accepts any word in a tie as the answer', () => {
    const tie = {
      ...TASK,
      texts: [{ title: 'Tie', body: 'a b a c' }],
      items: [
        { id: 'a', prompt: 'a', answer: 'b' },
        { id: 'b', prompt: 'a', answer: 'c' },
      ],
    }
    expect(validateNextWordTask(tie, 1)).toEqual([])
  })
})

describe('the chosen text', () => {
  it('is null until a text is chosen', () => {
    expect(chosenText(TASK, initialNextWordState(TASK))).toBeNull()
  })

  it('is one of the task texts', () => {
    expect(chosenText(TASK, chosen(1))).toMatchObject({ label: 'Goals', body: GOALS, index: 1 })
    expect(chosenText(TASK, chosen(7))).toBeNull()
  })

  it('is the pasted text only when the task allows pasting, capped in size', () => {
    const state = { ...initialNextWordState(TASK), source: 'paste', pasted: 'the cat sat' }
    expect(chosenText(TASK, state)).toMatchObject({ label: 'Your own text', body: 'the cat sat' })
    expect(chosenText({ ...TASK, allowPaste: false }, state)).toBeNull()
    const long = { ...state, pasted: 'a '.repeat(MAX_PASTE_CHARS) }
    expect(chosenText(TASK, long).body).toHaveLength(MAX_PASTE_CHARS)
    expect(chosenText(TASK, { ...state, pasted: '  ' })).toBeNull()
  })
})

describe('grading', () => {
  it('asks for a text, then a prediction, then a reveal, with a hint each time', () => {
    const a = TASK.items[0]
    expect(gradeItem(TASK, a, initialNextWordState(TASK))).toMatchObject({
      correct: false,
      hint: 'Pick a text first, then make your prediction.',
    })
    expect(gradeItem(TASK, a, chosen(0)).hint).toBe('Type your prediction first.')
    expect(gradeItem(TASK, a, chosen(0, { a: { guess: 'two words', revealed: false } })).hint).toBe(
      'Type just one word.'
    )
    expect(gradeItem(TASK, a, chosen(0, { a: { guess: 'net', revealed: false } })).hint).toBe(
      'Press Reveal to see if you were right.'
    )
  })

  it('marks a revealed prediction right ignoring capitals and punctuation', () => {
    const state = chosen(0, { a: { guess: ' NET! ', revealed: true } })
    expect(gradeItem(TASK, TASK.items[0], state)).toEqual({
      correct: true,
      hint: null,
      top: ['net'],
    })
  })

  it('gives a hint that does not give the word away when wrong', () => {
    const result = gradeItem(
      TASK,
      TASK.items[0],
      chosen(0, { a: { guess: 'ball', revealed: true } })
    )
    expect(result.correct).toBe(false)
    expect(result.hint).toMatch(/longest bar/)
    expect(result.hint).not.toMatch(/net/)
  })

  it('marks against the text the student chose, not the one the answer was written for', () => {
    const item = TASK.items[0]
    // Goals text: "the" is followed by goal most often, so "net" is wrong and "goal" is right.
    expect(gradeItem(TASK, item, chosen(1, { a: { guess: 'net', revealed: true } })).correct).toBe(
      false
    )
    expect(gradeItem(TASK, item, chosen(1, { a: { guess: 'goal', revealed: true } })).correct).toBe(
      true
    )
  })

  it('marks against a pasted text', () => {
    const pasted = (guess) => ({
      ...initialNextWordState(TASK),
      source: 'paste',
      pasted: 'I like pie. I like cake. I like pie.',
      items: { a: { guess, revealed: true } },
    })
    const item = { id: 'a', prompt: 'I like', answer: 'unused' }
    expect(gradeItem(TASK, item, pasted('pie'))).toMatchObject({ correct: true, top: ['pie'] })
    expect(gradeItem(TASK, item, pasted('cake')).correct).toBe(false)
  })
  it('accepts any of the words tied for most likely', () => {
    const task = { ...TASK, texts: [{ title: 'Tie', body: 'a b a c' }] }
    const item = { id: 'a', prompt: 'a', answer: 'b' }
    const base = { ...initialNextWordState(task), source: 'text', index: 0 }
    for (const guess of ['b', 'c']) {
      expect(
        gradeItem(task, item, { ...base, items: { a: { guess, revealed: true } } }).correct
      ).toBe(true)
    }
    expect(
      gradeItem(task, item, { ...base, items: { a: { guess: 'a', revealed: true } } }).correct
    ).toBe(false)
  })

  it('says so when nothing follows the prompt word in the chosen text', () => {
    const result = gradeItem(
      TASK,
      { id: 'a', prompt: 'the cat', answer: 'x' },
      chosen(0, { a: { guess: 'sat', revealed: true } })
    )
    expect(result.correct).toBe(false)
    expect(result.hint).toMatch(/nothing comes after "cat"/)
  })

  it('exposes the bars for a prompt', () => {
    expect(optionsForPrompt(TASK, initialNextWordState(TASK), 'the')).toBeNull()
    const info = optionsForPrompt(TASK, chosen(0), 'Into the')
    expect(info.total).toBe(7)
    expect(info.options[0]).toMatchObject({ word: 'net', count: 3 })
  })
})

describe('task grading through the definition', () => {
  it('counts right, revealed and done', () => {
    const half = chosen(0, {
      a: { guess: 'net', revealed: true },
      b: { guess: 'net', revealed: false },
    })
    expect(gradeTask(TASK, half)).toEqual({ total: 2, correct: 1, revealed: 1, done: false })
    expect(definition.grade(TASK, half)).toMatchObject({
      passed: false,
      suggestion: 'Press Reveal to see if you were right.',
      itemResults: { a: true, b: false },
    })
    expect(definition.getProgress(TASK, half)).toEqual({
      kind: 'items',
      filled: 1,
      total: 2,
      correct: 1,
    })
    expect(definition.summarize(TASK, half)).toEqual({
      text: 'Football · 1/2 right',
      tone: 'neutral',
    })
  })

  it('passes with the solution state and summarises it as a success', () => {
    const solution = definition.solutionState(TASK)
    expect(solution).toEqual(solutionStateFor(TASK))
    expect(definition.grade(TASK, solution).passed).toBe(true)
    expect(definition.summarize(TASK, solution).tone).toBe('success')
  })

  it('summarises a blank state', () => {
    expect(definition.summarize(TASK, definition.initialState(TASK)).text).toBe(
      'No text yet · 0/2 right'
    )
  })

  it('keeps the starting and solution state small', () => {
    expect(JSON.stringify(definition.initialState(TASK)).length).toBeLessThan(2048)
    expect(JSON.stringify(definition.solutionState(TASK)).length).toBeLessThan(2048)
  })

  it('classifies deliberate clicks as discrete and typing and the slider as continuous', () => {
    const before = definition.initialState(TASK)
    expect(definition.classifyChange(before, { ...before, source: 'text', index: 1 })).toBe(
      'discrete'
    )
    expect(definition.classifyChange(before, { ...before, pasted: 'a b' })).toBe('discrete')
    expect(definition.classifyChange(before, { ...before, generated: 'a b' })).toBe('discrete')
    expect(
      definition.classifyChange(before, {
        ...before,
        items: { ...before.items, a: { guess: 'net', revealed: true } },
      })
    ).toBe('discrete')
    expect(definition.classifyChange(before, { ...before, probe: 'th' })).toBe('continuous')
    expect(definition.classifyChange(before, { ...before, temperature: 1.5 })).toBe('continuous')
    expect(
      definition.classifyChange(before, {
        ...before,
        items: { ...before.items, a: { guess: 'n', revealed: false } },
      })
    ).toBe('continuous')
    expect(definition.classifyChange(before, before)).toBe('discrete')
  })

  it('prints the texts and the answers', () => {
    const html = definition.printHtml(TASK, { esc: (value) => String(value) })
    expect(html).toContain('Football')
    expect(html).toContain('answer: net')
  })
})
