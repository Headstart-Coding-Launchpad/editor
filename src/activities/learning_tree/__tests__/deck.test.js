import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  featuresOf,
  gradeTask,
  normalizeState,
  sharedState,
  solutionFor,
  treeOf,
  validateLearningTreeTask,
} from '../learning_tree.js'
import { classify, pathOf } from '../tree.js'

// Deck mode: the child sorts ready-made cards into bins and the tree regrows from them.
const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'learning_tree',
  labels: ["I'd eat it", 'No thanks'],
  studentLabels: false,
  twentyQuestions: true,
  deck: [
    { name: 'Doughnut', emoji: '🍩', yes: ['is_sweet', 'is_fried'] },
    { name: 'Cake', emoji: '🍰', yes: ['is_sweet'] },
    { name: 'Apple', emoji: '🍎', yes: ['is_sweet', 'is_crunchy'] },
    { name: 'Chips', emoji: '🍟', yes: ['is_fried', 'is_crunchy'] },
    { name: 'Sprouts', emoji: '🥦', yes: ['is_crunchy'] },
    { name: 'Liver', emoji: '🥩', yes: [] },
  ],
  testItems: [
    { name: 'Cookie', emoji: '🍪', yes: ['is_sweet', 'is_crunchy'], label: "I'd eat it" },
    { name: 'Olive', emoji: '🫒', yes: [], label: 'No thanks' },
    { name: 'Trifle', emoji: '🍮', yes: ['is_sweet'], label: "I'd eat it" },
    { name: 'Tripe', emoji: '🍲', yes: [], label: 'No thanks' },
  ],
  passAt: 3,
}

// Sweet cards (0,1,2) in bin 0; the rest in bin 1.
const SORTED = { v: 1, b: '000111' }

describe('Learning Tree deck mode', () => {
  it('takes the features from the deck tags', () => {
    expect(featuresOf(TASK)).toEqual(['is_sweet', 'is_fried', 'is_crunchy'])
  })

  it('FUN MOMENT: sorting by sweetness makes sweetness the first question, and 20 Questions guesses the sweet bin', () => {
    const state = normalizeState(TASK, SORTED)
    expect(state.examples).toHaveLength(6)
    const tree = treeOf(TASK, state)
    expect(tree.leaf).toBe(false)
    expect(featuresOf(TASK)[tree.feature]).toBe('is_sweet')
    // A new sweet card, answered as 20 Questions would: the path asks about sweetness first.
    const sweet = [1, 0, 0]
    expect(featuresOf(TASK)[pathOf(tree, sweet).steps[0].feature]).toBe('is_sweet')
    expect(classify(tree, sweet)).toBe(0)
    const played = normalizeState(TASK, { ...SORTED, q: 'rrrr' })
    const g = gradeTask(TASK, played)
    expect(g.results.every((r) => r.right)).toBe(true)
    expect(g.passed).toBe(true)
  })

  it('regrows at once when a card moves', () => {
    const before = treeOf(TASK, normalizeState(TASK, SORTED))
    const after = treeOf(TASK, normalizeState(TASK, { v: 1, b: '000110' }))
    expect(after).not.toEqual(before)
  })

  it('grades by the test item labels without studentLabels', () => {
    // The child marks everything wrong, but the tree's guesses match the labels.
    const g = gradeTask(TASK, normalizeState(TASK, { ...SORTED, q: 'wwww' }))
    expect(g.correct).toBe(4)
    expect(g.passed).toBe(true)
  })

  it('with studentLabels, passing counts the rounds the child marked right', () => {
    const task = { ...TASK, studentLabels: true }
    const wrong = gradeTask(task, normalizeState(task, { ...SORTED, q: 'wwww' }))
    expect(wrong.correct).toBe(0)
    expect(wrong.passed).toBe(false)
    const mixed = gradeTask(task, normalizeState(task, { ...SORTED, q: 'rrrw' }))
    expect(mixed.correct).toBe(3)
    expect(mixed.passed).toBe(true)
    const partial = gradeTask(task, normalizeState(task, { ...SORTED, q: 'rr--' }))
    expect(partial.correct).toBe(2)
    expect(partial.passed).toBe(false)
  })

  it('clears the 20 Questions rounds when fewer than 2 cards are binned', () => {
    expect(normalizeState(TASK, { v: 1, b: '0-----', q: 'rrrr' }).q).toBe('----')
  })

  it('keeps the child bin names, and shares bins, sorted count and rounds with the tutor', () => {
    const task = { ...TASK, studentLabels: true }
    const shared = sharedState(task, { ...SORTED, ln: ['Yum', ''], q: 'rr--' })
    expect(shared.b).toBe('000111')
    expect(shared.sorted).toBe(6)
    expect(shared.labelNames).toEqual(['Yum', 'No thanks'])
    expect(shared.q).toBe('rr--')
  })

  it('summarises for the tutor card', () => {
    const text = definition.summarize(TASK, { ...SORTED, q: 'rrr-' }).text
    expect(text).toContain('sorted 6')
    expect(text).toContain('20Q 3 of 3')
  })

  it('shows answers: a solution that passes', () => {
    const g = gradeTask(TASK, solutionFor(TASK))
    expect(g.passed).toBe(true)
  })

  it('validates deck fields', () => {
    expect(validateLearningTreeTask(TASK, 1)).toEqual([])
    const bad = {
      ...TASK,
      features: ['is_sweet'],
      deck: [{ name: '', yes: ['nope'] }],
      twentyQuestions: 'yes',
    }
    const errors = validateLearningTreeTask(bad, 1).join('\n')
    expect(errors).toContain('deck needs 4 to 16 cards')
    expect(errors).toContain('twentyQuestions must be true or false')
    expect(errors).toContain('card 1: name is required')
    expect(errors).toContain('card 1: emoji is required')
    expect(errors).toContain('card 1: yes must list only')
    const noDeck = { ...TASK, deck: undefined, features: ['a'] }
    expect(validateLearningTreeTask(noDeck, 1).join('\n')).toContain('need a deck')
  })

  it('does nothing different without a deck', () => {
    const plain = { ...TASK, deck: undefined, twentyQuestions: undefined, features: ['is_sweet'] }
    expect(normalizeState(plain, { v: 1, examples: [], b: '000111' }).b).toBeUndefined()
  })
})
