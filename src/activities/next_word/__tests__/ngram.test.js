// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildModel,
  describeCount,
  generateText,
  lastWordOf,
  modelFor,
  nextOptions,
  normaliseWord,
  pickOption,
  seededRandom,
  startingWords,
  temperatureLabel,
  tokenise,
  topWords,
} from '../ngram.js'

const CAT = 'The cat sat on the mat. The cat ran.'
// the -> cat 2, mat 1; cat -> ran 1, sat 1 (a tie); sat -> on; on -> the; mat -> the

describe('normalising words', () => {
  it('lower-cases and strips punctuation from both ends only', () => {
    expect(normaliseWord('  Net. ')).toBe('net')
    expect(normaliseWord('“Hello!”')).toBe('hello')
    expect(normaliseWord('DON’T')).toBe("don't")
    expect(normaliseWord('well-known,')).toBe('well-known')
    expect(normaliseWord('...')).toBe('')
    expect(normaliseWord(null)).toBe('')
  })

  it('tokenises on spaces, line breaks and dashes, dropping empty words', () => {
    expect(tokenise('The Ball,\nthe  NET — gone… yes')).toEqual([
      'the',
      'ball',
      'the',
      'net',
      'gone',
      'yes',
    ])
    expect(tokenise('')).toEqual([])
    expect(tokenise(' ... ')).toEqual([])
  })

  it('finds the last word of a prompt', () => {
    expect(lastWordOf('the ball goes into the')).toBe('the')
    expect(lastWordOf('Into the NET!')).toBe('net')
    expect(lastWordOf('')).toBe('')
  })
})

describe('the word-pair model', () => {
  const model = buildModel(CAT)

  it('counts which word follows which, most likely first', () => {
    expect(nextOptions(model, 'the')).toEqual({
      word: 'the',
      total: 3,
      options: [
        { word: 'cat', count: 2, share: 2 / 3 },
        { word: 'mat', count: 1, share: 1 / 3 },
      ],
    })
  })

  it('lists ties in alphabetical order and normalises the word asked about', () => {
    expect(nextOptions(model, 'CAT.').options.map((o) => o.word)).toEqual(['ran', 'sat'])
  })

  it('returns no options for an unknown word or the last word of the text', () => {
    expect(nextOptions(model, 'dog')).toEqual({ word: 'dog', total: 0, options: [] })
    expect(nextOptions(model, 'ran').total).toBe(0)
    expect(nextOptions(buildModel(''), 'the').total).toBe(0)
  })

  it('lets a sentence end run into the next sentence', () => {
    expect(nextOptions(buildModel('Go home. Stay'), 'home').options[0].word).toBe('stay')
  })

  it('handles words like constructor safely', () => {
    const odd = buildModel('constructor __proto__ constructor toString')
    expect(nextOptions(odd, 'constructor').total).toBe(2)
    expect(nextOptions(odd, 'constructor').options.map((o) => o.word)).toEqual([
      'proto',
      'tostring',
    ])
  })

  it('returns every word tied for most likely', () => {
    expect(topWords(model, 'the')).toEqual(['cat'])
    expect(topWords(model, 'cat')).toEqual(['ran', 'sat'])
    expect(topWords(model, 'dog')).toEqual([])
  })

  it('describes a count in plain words', () => {
    expect(describeCount('net', 3, 5)).toBe('net: 3 of 5 times')
    expect(describeCount('net', 1, 1)).toBe('net: 1 of 1 time')
  })

  it('offers the most frequent words that have something after them as starting points', () => {
    expect(startingWords(model, 2)).toEqual(['the', 'cat'])
    expect(startingWords(model)).not.toContain('ran')
  })

  it('caches models by text', () => {
    expect(modelFor(CAT)).toBe(modelFor(CAT))
  })
})

describe('sampling', () => {
  const model = buildModel(CAT)
  const options = nextOptions(model, 'the').options

  it('is repeatable with a seeded random', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom(7)()).not.toBe(seededRandom(8)())
  })

  it('always takes the most likely word at temperature 0', () => {
    for (let i = 0; i < 10; i++) {
      expect(pickOption(options, 0, seededRandom(i)).word).toBe('cat')
    }
    expect(pickOption([], 1)).toBeNull()
  })

  it('picks in proportion to the counts at temperature 1', () => {
    const random = seededRandom(3)
    let cats = 0
    for (let i = 0; i < 3000; i++) if (pickOption(options, 1, random).word === 'cat') cats++
    expect(cats / 3000).toBeGreaterThan(0.6)
    expect(cats / 3000).toBeLessThan(0.73)
  })

  it('flattens the odds at a high temperature', () => {
    const random = seededRandom(3)
    let cats = 0
    for (let i = 0; i < 3000; i++) if (pickOption(options, 2, random).word === 'cat') cats++
    expect(cats / 3000).toBeLessThan(0.64)
  })

  it('generates the same text for the same seed and length', () => {
    const first = generateText(model, { temperature: 1, random: seededRandom(5), length: 12 })
    const second = generateText(model, { temperature: 1, random: seededRandom(5), length: 12 })
    expect(first).toBe(second)
    expect(first.split(' ')).toHaveLength(12)
  })

  it('starts from the given word and follows the likeliest path at temperature 0', () => {
    expect(generateText(model, { start: 'The', temperature: 0, length: 3 })).toBe('the cat ran')
  })

  it('starts from the first word when no start is given', () => {
    expect(generateText(model, { temperature: 0, length: 3 }).startsWith('the cat')).toBe(true)
  })

  it('jumps to a new word when it runs out of text', () => {
    const text = generateText(buildModel('a b'), { start: 'b', temperature: 0, length: 5 })
    expect(text.split(' ')).toHaveLength(5)
    expect(text.startsWith('b ')).toBe(true)
  })

  it('returns an empty string when there are no word pairs', () => {
    expect(generateText(buildModel('hello'))).toBe('')
  })

  it('names temperatures', () => {
    expect(temperatureLabel(0)).toMatch(/most likely/)
    expect(temperatureLabel(0.3)).toBe('careful')
    expect(temperatureLabel(1)).toBe('balanced')
    expect(temperatureLabel(1.5)).toBe('adventurous')
    expect(temperatureLabel(2)).toBe('wild')
  })
})
