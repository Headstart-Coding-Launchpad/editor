import { describe, expect, it } from 'vitest'
import {
  TYPING_BURST_GAP_MS,
  applyTypingEvent,
  applyTypingRun,
  charsPerMinOf,
  copyDistanceFor,
  createTypingState,
  editDistance,
  normalizeForCopyComparison,
  typingRecordOf,
  typingReportFields,
} from '../typingStats'

function typeAll(state, events) {
  for (const event of events) applyTypingEvent(state, event)
  return state
}

describe('applyTypingEvent', () => {
  it('adds gaps within a burst to active time and ends a burst after a 5 s gap', () => {
    const state = typeAll(createTypingState(), [
      { kind: 'insert', chars: 1, at: 0 },
      { kind: 'insert', chars: 1, at: 1000 },
      { kind: 'correction', at: 1500 },
      // A long pause: not active time, but the longest pause.
      { kind: 'insert', chars: 2, at: 1500 + TYPING_BURST_GAP_MS + 1 },
      { kind: 'insert', chars: 1, at: 1500 + TYPING_BURST_GAP_MS + 301 },
    ])
    expect(state).toMatchObject({
      charsTyped: 5,
      corrections: 1,
      activeTypingMs: 1800,
      longestPauseMs: TYPING_BURST_GAP_MS + 1,
    })
  })

  it('counts a gap of exactly 5 s as active time', () => {
    const state = typeAll(createTypingState(), [
      { kind: 'insert', chars: 1, at: 0 },
      { kind: 'insert', chars: 1, at: TYPING_BURST_GAP_MS },
    ])
    expect(state.activeTypingMs).toBe(TYPING_BURST_GAP_MS)
  })

  it('counts autocomplete accepts without touching typed characters or time', () => {
    const state = typeAll(createTypingState(), [
      { kind: 'insert', chars: 3, at: 0 },
      { kind: 'autocomplete' },
      { kind: 'insert', chars: 1, at: 400 },
    ])
    expect(state).toMatchObject({ charsTyped: 4, autocompleteAccepts: 1, activeTypingMs: 400 })
  })

  it('ignores empty inserts and unknown events', () => {
    const state = typeAll(createTypingState(), [
      { kind: 'insert', chars: 0, at: 0 },
      { kind: 'paste', chars: 50, at: 10 },
    ])
    expect(typingRecordOf(state)).toBeNull()
  })
})

describe('createTypingState seeding', () => {
  it('carries on from a stored record, keeping its copy distance as the first Run', () => {
    const state = createTypingState({
      charsTyped: 10,
      activeTypingMs: 4000,
      corrections: 2,
      longestPauseMs: 7000,
      autocompleteAccepts: 1,
      copyDistance: 3,
    })
    applyTypingEvent(state, { kind: 'insert', chars: 1, at: 100 })
    expect(applyTypingRun(state, { copyCode: 'print(1)', work: 'x' })).toBe(false)
    expect(typingRecordOf(state)).toEqual({
      charsTyped: 11,
      activeTypingMs: 4000,
      corrections: 2,
      longestPauseMs: 7000,
      autocompleteAccepts: 1,
      copyDistance: 3,
    })
  })
})

describe('copy distance', () => {
  it('is the Levenshtein distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('same', 'same')).toBe(0)
  })

  it('ignores trailing whitespace on each line and at the end', () => {
    expect(normalizeForCopyComparison('a  \r\nb\t\n\n')).toBe('a\nb')
    expect(copyDistanceFor('print("hi")\nx = 1\n', 'print("hi")   \nx = 1')).toBe(0)
    expect(copyDistanceFor('print("hi")', 'prnt("hi")')).toBe(1)
  })

  it('takes the closest file for multi-file work and is null without copyCode', () => {
    const files = [
      { name: 'index.html', content: '<p>Hi</p>' },
      { name: 'style.css', content: 'p { color: red; }' },
    ]
    expect(copyDistanceFor('<p>Hi!</p>', files)).toBe(1)
    expect(copyDistanceFor('', 'x')).toBeNull()
    expect(copyDistanceFor(undefined, 'x')).toBeNull()
  })

  it('is set by the first Run only', () => {
    const state = createTypingState()
    expect(applyTypingRun(state, { copyCode: 'abc', work: 'abd' })).toBe(true)
    expect(applyTypingRun(state, { copyCode: 'abc', work: 'abc' })).toBe(false)
    expect(state.copyDistance).toBe(1)
  })
})

describe('typingReportFields', () => {
  it('derives charsPerMin from active typing time', () => {
    expect(charsPerMinOf(148, 151000)).toBe(59)
    expect(charsPerMinOf(10, 4999)).toBeNull()
    expect(typingReportFields({ charsTyped: 120, activeTypingMs: 60000, corrections: 3 })).toEqual({
      charsTyped: 120,
      activeTypingMs: 60000,
      charsPerMin: 120,
      corrections: 3,
      longestPauseMs: 0,
      autocompleteAccepts: 0,
    })
  })

  it('is null when nothing was typed', () => {
    expect(typingReportFields(null)).toBeNull()
    expect(typingReportFields({ charsTyped: 0, corrections: 0, autocompleteAccepts: 2 })).toBeNull()
  })
})
