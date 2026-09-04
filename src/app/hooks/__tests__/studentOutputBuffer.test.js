import { describe, expect, it } from 'vitest'
import {
  OUTPUT_TRUNCATED_MESSAGE,
  appendStudentOutput,
  collapseStudentOutputForDisplay,
  createStudentOutputBuffer,
} from '../studentOutputBuffer'

describe('studentOutputBuffer', () => {
  it('accumulates raw output and keeps short output visible unchanged', () => {
    const buffer = appendStudentOutput(createStudentOutputBuffer(), 'hello\nworld', {
      maxDisplayLines: 3,
      maxStreamedOutput: 100,
    })

    expect(buffer).toEqual({
      raw: 'hello\nworld',
      display: 'hello\nworld',
      capReached: false,
    })
  })

  it('collapses display output to the most recent lines', () => {
    const output = ['one', 'two', 'three', 'four'].join('\n')

    expect(collapseStudentOutputForDisplay(output, 2)).toBe('[2 earlier lines hidden]\nthree\nfour')
  })

  it('truncates raw output once the streamed cap is exceeded', () => {
    const buffer = appendStudentOutput(createStudentOutputBuffer('1234'), '567', {
      maxStreamedOutput: 5,
      maxDisplayLines: 10,
    })

    expect(buffer.raw).toBe(`12345\n${OUTPUT_TRUNCATED_MESSAGE}`)
    expect(buffer.display).toBe(`12345\n${OUTPUT_TRUNCATED_MESSAGE}`)
    expect(buffer.capReached).toBe(true)
  })

  it('ignores later output after the cap has been reached', () => {
    const capped = appendStudentOutput(createStudentOutputBuffer('1234'), '567', {
      maxStreamedOutput: 5,
      maxDisplayLines: 10,
    })

    expect(
      appendStudentOutput(capped, 'more', {
        maxStreamedOutput: 5,
        maxDisplayLines: 10,
      })
    ).toBe(capped)
  })

  it('collapses the truncation message like any other output line', () => {
    const buffer = appendStudentOutput(createStudentOutputBuffer('a\nb\nc'), '\nd', {
      maxStreamedOutput: 3,
      maxDisplayLines: 2,
    })

    expect(buffer.raw).toBe(`a\nb\n${OUTPUT_TRUNCATED_MESSAGE}`)
    expect(buffer.display).toBe(`[1 earlier lines hidden]\nb\n${OUTPUT_TRUNCATED_MESSAGE}`)
  })
})
