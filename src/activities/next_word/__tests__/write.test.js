import { describe, expect, it } from 'vitest'
import { modelFor, seededRandom, tokenise } from '../ngram.js'
import { isCopiedSentence, trainingSentencesOf, writeText } from '../next_word.js'

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
