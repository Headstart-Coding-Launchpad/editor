// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findBlockedContent } from '../peerHelpFilter'

describe('findBlockedContent', () => {
  it('lets ordinary code feedback through', () => {
    for (const note of [
      'Try adding a colon after the if',
      'Your class name is spelt differently on line 3',
      'Pass the number as an int, not a string',
      'Use a thicker border on the box',
      'print("as you can see") works',
      'Scunthorpe',
    ]) {
      expect(findBlockedContent(note)).toBeNull()
    }
  })

  it('blocks swearing, including look-alike spellings and stretched letters', () => {
    for (const note of [
      'this is shit',
      'SH1T',
      'shiiiit code',
      's.h.i.t',
      'what the f*ck',
      'fuk',
    ]) {
      expect(findBlockedContent(note)).toBe('language')
    }
  })

  it('blocks unkind words and phrases aimed at a person', () => {
    expect(findBlockedContent('you are so stupid')).toBe('language')
    expect(findBlockedContent('Idiot')).toBe('language')
    expect(findBlockedContent('just shut up')).toBe('language')
    expect(findBlockedContent('nobody likes this')).toBe('language')
  })

  it('blocks links, emails, phone numbers and social handles', () => {
    expect(findBlockedContent('look at https://example.com')).toBe('contact')
    expect(findBlockedContent('www.example.com')).toBe('contact')
    expect(findBlockedContent('email me kid@example.com')).toBe('contact')
    expect(findBlockedContent('call 07700 900123')).toBe('contact')
    expect(findBlockedContent('add me on snapchat')).toBe('contact')
  })
})
