import { describe, expect, it } from 'vitest'
import {
  compareSpecificity,
  formatSpecificity,
  hasPseudoElement,
  selectorSpecificity,
  splitSelectorList,
} from '../specificity'

describe('selectorSpecificity', () => {
  it.each([
    ['p', [0, 0, 1]],
    ['*', [0, 0, 0]],
    ['.card', [0, 1, 0]],
    ['#main', [1, 0, 0]],
    ['div p', [0, 0, 2]],
    ['.card p', [0, 1, 1]],
    ['#main .card > p.big', [1, 2, 1]],
    ['a[href^="http"]', [0, 1, 1]],
    ['a:hover', [0, 1, 1]],
    ['li:nth-child(2n + 1)', [0, 1, 1]],
    ['ul li + li ~ li', [0, 0, 4]],
    ['p::before', [0, 0, 1]],
    ['p:after', [0, 0, 1]],
    [':is(#a, .b) p', [1, 0, 1]],
    [':not(.a)', [0, 1, 0]],
    [':not(.a, #b) span', [1, 0, 1]],
    [':where(#a, .b) p', [0, 0, 1]],
    ['div:has(> img)', [0, 0, 2]],
    ['[data-x="a,b"]', [0, 1, 0]],
  ])('%s → %j', (selector, expected) => {
    expect(selectorSpecificity(selector)).toEqual(expected)
  })

  it('compares ids before classes before tags', () => {
    expect(compareSpecificity([1, 0, 0], [0, 9, 9])).toBeGreaterThan(0)
    expect(compareSpecificity([0, 1, 0], [0, 0, 9])).toBeGreaterThan(0)
    expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0)
    expect(compareSpecificity([0, 0, 1], [0, 1, 0])).toBeLessThan(0)
  })

  it('splits selector lists on top-level commas only', () => {
    expect(splitSelectorList('h1, .a:is(.b, .c), [x="1,2"]')).toEqual([
      'h1',
      '.a:is(.b, .c)',
      '[x="1,2"]',
    ])
  })

  it('formats and spots pseudo-elements', () => {
    expect(formatSpecificity([0, 1, 2])).toBe('(0,1,2)')
    expect(hasPseudoElement('p::first-line')).toBe(true)
    expect(hasPseudoElement('p:before')).toBe(true)
    expect(hasPseudoElement('p:hover')).toBe(false)
  })
})
