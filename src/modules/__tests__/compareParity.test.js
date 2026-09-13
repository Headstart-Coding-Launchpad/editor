import { describe, expect, it } from 'vitest'
import { compareText } from '../../shared/checkHelpers.js'
import { evaluateSingleCheck } from '../checks.js'
import { evaluateFsCheck } from '../filesystem/checks.js'
import { evaluateHtmlCheck } from '../html/checks.js'
import { evaluateScratchCheck } from '../scratch/checks.js'

// Every module's text comparison operators go through compareText, so the same operator
// and value must give the same verdict whether an author checks program output, a quiz
// answer, a file's content, an HTML element's text, or a Scratch block input.

const CASES = [
  // [actual, operator, expected, flags, verdict]
  ['Hello World', 'contains', 'hello', undefined, true],
  ['Hello World', 'contains', 'h*d', undefined, true],
  ['Hello World', 'contains', '"bye","world"', undefined, true],
  ['Hello World', 'contains', '"bye","moon"', undefined, false],
  ['Hello World', 'not_contains', 'moon', undefined, true],
  ['Hello World', 'not_contains', '"bye","world"', undefined, false],
  ['Hello World', 'not_contains', '"bye","moon"', undefined, true],
  ['Hello World', 'equals', 'hello world', undefined, true],
  ['Hello World', 'equals', 'Hello*', undefined, true],
  ['Hello World', 'equals', 'Hello', undefined, false],
  ['Hello World', 'not_equals', 'Hello', undefined, true],
  ['Hello World', 'matches_regex', '^Hello', undefined, true],
  ['Hello World', 'matches_regex', '^hello', undefined, false],
  ['Hello World', 'matches_regex', '^hello', 'i', true],
  ['Hello World', 'not_matches_regex', '^Bye', undefined, true],
  // An invalid pattern is an authoring mistake and fails both regex operators.
  ['Hello World', 'matches_regex', '([', undefined, false],
  ['Hello World', 'not_matches_regex', '([', undefined, false],
]

function viaOutput(actual, operator, value, flags) {
  return evaluateSingleCheck({ type: 'output', operator, value, flags }, actual)
}

function viaAnswer(actual, operator, value, flags) {
  return evaluateSingleCheck({ type: 'answer', operator, value, flags }, '', { answer: actual })
}

function viaFile(actual, operator, value, flags) {
  const fs = { '/': { type: 'dir' }, '/notes.txt': { type: 'file', content: actual } }
  return evaluateFsCheck(
    { type: 'fs_file_content', path: '/notes.txt', operator, value, flags },
    fs
  )
}

function viaHtml(actual, operator, value, flags) {
  const iframeDoc = document.implementation.createHTMLDocument('')
  iframeDoc.body.innerHTML = `<p id="msg">${actual}</p>`
  return evaluateHtmlCheck(
    { type: 'html_element_value', selector: '#msg', operator, value, flags },
    '',
    { iframeDoc }
  )
}

function viaScratchInput(actual, operator, value, flags) {
  const block = {
    type: 'looks_say',
    previousConnection: { isConnected: () => false },
    getNextBlock: () => null,
    getInputTargetBlock: (name) => (name === 'MESSAGE' ? { getFieldValue: () => actual } : null),
  }
  return evaluateScratchCheck(
    {
      type: 'block_used',
      opcode: 'looks_say',
      fieldValues: { MESSAGE: { operator, value, flags } },
    },
    { getAllBlocks: () => [block] },
    null
  )
}

const SURFACES = {
  compareText: (actual, operator, value, flags) => compareText(actual, operator, value, { flags }),
  output: viaOutput,
  answer: viaAnswer,
  'file content': viaFile,
  'HTML element text': viaHtml,
  'Scratch block input': viaScratchInput,
}

describe('text comparison operators behave the same in every module', () => {
  for (const [surface, evaluate] of Object.entries(SURFACES)) {
    describe(surface, () => {
      it.each(CASES)('%s %s %s (flags %s) → %s', (actual, operator, value, flags, verdict) => {
        expect(evaluate(actual, operator, value, flags)).toBe(verdict)
      })
    })
  }
})

describe('Scratch block input numbers', () => {
  it('compares two numbers numerically, so 10 equals 10.0', () => {
    expect(viaScratchInput('10', 'equals', '10.0')).toBe(true)
    expect(viaScratchInput('10', 'not_equals', '10.0')).toBe(false)
    expect(viaScratchInput('12', 'greater_than', '10')).toBe(true)
    expect(viaScratchInput('abc', 'greater_than', '10')).toBe(false)
  })
})
