// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { scrubNoticeText, scrubReplayNoteText } from '../replay.js'

describe('scrubReplayNoteText', () => {
  it('lists the answers used', () => {
    expect(scrubReplayNoteText(['Ada', 'Mars', 'teal'])).toBe(
      'Using your last answers: Ada, Mars, teal'
    )
  })

  it('cuts long lists and long answers, and names blank answers', () => {
    expect(scrubReplayNoteText(['a', 'b', 'c', 'd', 'e'])).toBe(
      'Using your last answers: a, b, c and 2 more'
    )
    expect(scrubReplayNoteText(['a really long answer here'])).toBe(
      'Using your last answers: a really long a…'
    )
    expect(scrubReplayNoteText(['', 'Mars'])).toBe('Using your last answers: (blank), Mars')
  })

  it('says nothing without answers', () => {
    expect(scrubReplayNoteText([])).toBe('')
    expect(scrubReplayNoteText(null)).toBe('')
  })
})

describe('scrubNoticeText', () => {
  it('says why the program needs a Run', () => {
    expect(scrubNoticeText('press-run')).toBe('Press Run to see it')
    expect(scrubNoticeText('press-run-answers')).toBe('Press Run and answer the questions first')
    expect(scrubNoticeText('preview')).toBeNull()
  })
})
