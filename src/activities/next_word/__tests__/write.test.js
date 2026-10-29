import { describe, expect, it } from 'vitest'
import { modelFor, seededRandom, tokenise } from '../ngram.js'
import {
  activeModel,
  choicesFor,
  initialNextWordState,
  isCopiedSentence,
  modelBodyOf,
  sharedState,
  trainingBodyOf,
  trainingSentencesOf,
  validateNextWordTask,
  writeText,
} from '../next_word.js'

// The Fun moment (authoring request 2026-10-28, next-word bot that writes like): with a small
// headlines pack and look-back 2, Go writes a headline nobody ever wrote, and a word-for-word
// copy is caught.

const PACK = [
  'Local team wins big match.',
  'Local mayor opens new park.',
  'Town team opens new park.',
  'Mayor wins big prize.',
  'Local team loses big match.',
  'Town mayor wins new prize.',
].join(' ')

const norm = (text) => tokenise(text).join(' ')

describe('Next Word write mode: the fun moment', () => {
  it('writes a sentence that is NOT one of the training sentences, at least sometimes', () => {
    const model = modelFor(PACK)
    const training = new Set(trainingSentencesOf(PACK))
    let fresh = 0
    for (let seed = 1; seed <= 60; seed++) {
      const { text } = writeText(model, {
        lookBack: 2,
        temperature: 1.5,
        maxWords: 15,
        random: seededRandom(seed),
      })
      expect(text.length).toBeGreaterThan(0)
      if (!training.has(norm(text))) fresh += 1
    }
    expect(fresh).toBeGreaterThan(0)
  })

  it('flags an exact copy of a training sentence, ignoring case and punctuation', () => {
    expect(isCopiedSentence(PACK, 'Local team wins big match.')).toBe(true)
    expect(isCopiedSentence(PACK, 'local TEAM wins big match!')).toBe(true)
    expect(isCopiedSentence(PACK, 'Local team wins big prize.')).toBe(false)
  })

  it('marks copied on what it writes', () => {
    const model = modelFor(PACK)
    let copies = 0
    let fresh = 0
    for (let seed = 1; seed <= 60; seed++) {
      const out = writeText(model, {
        lookBack: 2,
        temperature: 1.5,
        random: seededRandom(seed),
        source: PACK,
      })
      expect(out.copied).toBe(isCopiedSentence(PACK, out.text))
      if (out.copied) copies += 1
      else fresh += 1
    }
    expect(copies + fresh).toBe(60)
  })
})

// #341: in write mode the student's own lines count about 5 times each, so a few typed lines show up
// against a big pack.
describe('own sentences against a big pack (#341)', () => {
  // 40 headlines with 20 different opening words, two each, like a real pack.
  const OPENERS = [
    'Local',
    'Town',
    'City',
    'Rival',
    'Young',
    'Old',
    'Famous',
    'Tiny',
    'Giant',
    'Brave',
    'Quiet',
    'Loud',
    'Happy',
    'Angry',
    'Clever',
    'Lucky',
    'Hungry',
    'Sleepy',
    'Proud',
    'Shy',
  ]
  const HEADLINES = Array.from(
    { length: 40 },
    (_, i) =>
      `${OPENERS[i % 20]} ${['team', 'mayor', 'school', 'shop'][i % 4]} ${['wins', 'opens', 'loses', 'closes', 'sells'][i % 5]} ${['big', 'new', 'old', 'small'][i % 4]} ${['match', 'park', 'prize', 'road', 'cafe', 'bridge', 'show', 'fair'][i % 8]}.`
  )
  const TASK = {
    id: 1,
    taskType: 'activity',
    activityType: 'next_word',
    mode: 'write',
    texts: [{ title: 'News', body: HEADLINES.join(' ') }],
  }
  const OWN =
    'My dog eats pizza. The dragon saves the school. Robots love swimming. Pizza dragons play football.'
  const OWN_WORDS = new Set([
    'dog',
    'pizza',
    'dragon',
    'dragons',
    'robots',
    'swimming',
    'football',
    'eats',
    'saves',
    'love',
    'play',
  ])
  const rate = (state, modelOf) => {
    let seen = 0
    const trials = 120
    for (let t = 0; t < trials; t++) {
      const model = modelOf(state)
      let any = false
      for (let press = 0; press < 3; press++) {
        const text = writeText(model, {
          lookBack: 1,
          temperature: 1,
          maxWords: 12,
          random: seededRandom(t * 3 + press + 1),
        }).text
        if (tokenise(text).some((w) => OWN_WORDS.has(w))) any = true
      }
      if (any) seen += 1
    }
    return seen / trials
  }

  it('shows the student their own words in a decent share of 3 Go presses on a 40-headline pack', () => {
    const state = { ...initialNextWordState(TASK), own: OWN }
    const weighted = rate(state, (st) => activeModel(TASK, st))
    // Same lines, counted once: the pack drowns them out.
    const unweighted = rate(state, (st) => modelFor(modelBodyOf(TASK, st)))
    expect(weighted).toBeGreaterThan(unweighted)
    expect(weighted).toBeGreaterThan(0.5)
  })

  it('still checks Copied word for word against the real sentences only', () => {
    const state = { ...initialNextWordState(TASK), own: OWN }
    const real = modelBodyOf(TASK, state)
    expect(isCopiedSentence(real, 'The dragon saves the school.')).toBe(true)
    // A sentence stitched across the repeated copies is not a real sentence.
    expect(isCopiedSentence(real, 'Pizza dragons play football. My dog eats pizza.')).toBe(false)
    expect(trainingBodyOf(TASK, state).length).toBeGreaterThan(real.length)
  })
})

describe('mixed packs reach the tutor (#342)', () => {
  it('keeps which packs are on when the state is shared', () => {
    const shared = JSON.parse(
      JSON.stringify(sharedState({ packs: ['text:0', 'text:2'], voice: 'text:0' }))
    )
    expect(shared.packs).toEqual(['text:0', 'text:2'])
  })
})

describe('a pack of about 1,000 sentences (#342)', () => {
  const BIG = Array.from(
    { length: 1000 },
    (_, i) => `Headline number ${i} says the team ${['wins', 'loses', 'draws'][i % 3]} again today.`
  ).join(' ')
  const TASK = {
    id: 1,
    taskType: 'activity',
    activityType: 'next_word',
    mode: 'write',
    texts: [{ title: 'Big', body: BIG }],
  }

  it('is accepted by validation (it was over the old 6,000-character cap)', () => {
    expect(BIG.length).toBeGreaterThan(6000)
    expect(BIG.length).toBeLessThan(80000)
    expect(validateNextWordTask(TASK, 1)).toEqual([])
  })

  it('builds the model and writes quickly enough for a classroom laptop', () => {
    const started = performance.now()
    const model = activeModel(TASK, { ...initialNextWordState(TASK), own: 'I like pizza. ' })
    const { text } = writeText(model, { lookBack: 2, maxWords: 12, random: seededRandom(3) })
    expect(text.length).toBeGreaterThan(0)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

describe('choicesFor: the word-tree rows (#342)', () => {
  const TEXT =
    'The cat sat. The cat ran. The cat sat. The cat jumped. The cat hid. The cat slept. The cat ate.'
  const model = modelFor(TEXT)

  it('lists what could follow with counts, marks the taken word, and counts the rest', () => {
    const tree = choicesFor(model, 'the cat sat', 2, 1)
    expect(tree.total).toBe(7)
    expect(tree.options).toHaveLength(5)
    expect(tree.options[0]).toMatchObject({ word: 'sat', count: 2, taken: true })
    expect(tree.more).toBe(1)
  })

  it('keeps a long shot on show when it was the word taken', () => {
    const tree = choicesFor(model, 'the cat ate', 2, 1)
    expect(tree.options.some((option) => option.taken && option.word === 'ate')).toBe(true)
    expect(tree.options).toHaveLength(5)
  })

  it('has no tree for the first word or a bad index', () => {
    expect(choicesFor(model, 'the cat sat', 0, 1)).toBeNull()
    expect(choicesFor(model, 'the cat sat', 9, 1)).toBeNull()
  })
})
