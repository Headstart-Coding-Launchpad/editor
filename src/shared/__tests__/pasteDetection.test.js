// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isFlaggablePaste, isSamePasteText, measurePaste } from '../pasteDetection'

describe('pasteDetection', () => {
  it('flags long or multi-line pastes but not short snippets', () => {
    expect(isFlaggablePaste('score')).toBe(false)
    expect(isFlaggablePaste('print("hello")')).toBe(false)
    expect(isFlaggablePaste('a\nb\nc')).toBe(true)
    expect(isFlaggablePaste('x'.repeat(40))).toBe(true)
    expect(isFlaggablePaste('   \n\n  ')).toBe(false)
  })

  it('measures trimmed, newline-normalised text', () => {
    expect(measurePaste('  a\r\nb  ')).toEqual({ chars: 3, lines: 2 })
    expect(measurePaste('')).toEqual({ chars: 0, lines: 0 })
  })

  it('treats the same text (ignoring line endings and outer whitespace) as the same paste', () => {
    expect(isSamePasteText('a\r\nb\n', 'a\nb')).toBe(true)
    expect(isSamePasteText('a', 'b')).toBe(false)
    expect(isSamePasteText('', '')).toBe(false)
  })
})
