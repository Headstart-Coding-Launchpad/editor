import { describe, expect, it } from 'vitest'
import {
  asciiTable,
  gradeItem,
  gradeTask,
  parseInBase,
  solutionFor,
  validateBinaryTask,
} from '../binary.js'
import binary from '../definition.js'

const esc = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

describe('overflow mode', () => {
  const task = { mode: 'overflow', bits: 4, items: [{ id: 'a', a: '1100', b: '0110' }] }
  const item = task.items[0]

  it('validates that the sum really overflows', () => {
    expect(validateBinaryTask(task, 1)).toEqual([])
    expect(validateBinaryTask({ ...task, items: [{ id: 'a', a: '0011', b: '0001' }] }, 2)).toEqual([
      'Task 2 item 1: a + b fits in 4 bits, so it does not overflow.',
    ])
    expect(validateBinaryTask({ ...task, items: [{ id: 'a', a: '11', b: '0110' }] }, 1)).toEqual([
      'Task 1 item 1: a and b must each be 4 binary digits (0s and 1s).',
    ])
  })

  it('solves to the truncated sum and "yes"', () => {
    // 12 + 6 = 18 = 10010 -> the lost carry leaves 0010.
    expect(solutionFor(task, item)).toEqual({ bits: '0010', carries: '1000', overflow: 'yes' })
  })

  it('needs the right bits and the yes answer, with a lost-carry hint', () => {
    expect(gradeItem(task, item, { bits: '0010', overflow: 'yes' })).toEqual({
      correct: true,
      hint: null,
    })
    expect(gradeItem(task, item, { bits: '0010', overflow: '' }).hint).toBe(
      'Your bits are right. Now answer: did it overflow?'
    )
    expect(gradeItem(task, item, { bits: '0010', overflow: 'no' }).hint).toMatch(
      /carry had no column left to go into, so it was lost/
    )
    expect(gradeItem(task, item, { bits: '0110', overflow: 'yes' }).hint).toMatch(
      /Check the 4 column.*Only 4 bits fit/
    )
    expect(gradeItem(task, item, {}).correct).toBe(false)
  })

  it('can require the carries', () => {
    const strict = { ...task, requireCarries: true }
    expect(gradeItem(strict, item, { bits: '0010', overflow: 'yes', carries: '0000' }).hint).toBe(
      'Your answer is right. Now fill in the carries too.'
    )
    expect(
      gradeItem(strict, item, { bits: '0010', overflow: 'yes', carries: '1000' }).correct
    ).toBe(true)
  })
})

describe('hex mode', () => {
  const task = {
    mode: 'hex',
    bits: 8,
    items: [
      { id: 'a', value: '00101111', from: 'binary', to: 'hex' },
      { id: 'b', value: 'ff', from: 'hex', to: 'decimal' },
      { id: 'c', value: 200, from: 'decimal', to: 'hex' },
      { id: 'd', value: '3C', from: 'hex', to: 'binary' },
    ],
  }

  it('validates bases and value formats', () => {
    expect(validateBinaryTask(task, 1)).toEqual([])
    expect(
      validateBinaryTask(
        {
          mode: 'hex',
          bits: 4,
          items: [
            { id: 'a', value: '1', from: 'hex', to: 'hex' },
            { id: 'b', value: '1G', from: 'hex', to: 'binary' },
            { id: 'c', value: '10', from: 'hex', to: 'binary' },
            { id: 'd', value: '101', from: 'binary', to: 'hex' },
            { id: 'e', value: 16, from: 'decimal', to: 'binary' },
            { id: 'f', value: '9', from: 'octal', to: 'binary' },
          ],
        },
        3
      )
    ).toEqual([
      'Task 3 item 1: from and to must be two different bases: binary, hex or decimal.',
      'Task 3 item 2: value must be a hex number (0-9, A-F) from 0 to F.',
      'Task 3 item 3: value must be a hex number (0-9, A-F) from 0 to F.',
      'Task 3 item 4: value must be 4 binary digits (0s and 1s).',
      'Task 3 item 5: value must be a whole number from 0 to 15.',
      'Task 3 item 6: from and to must be two different bases: binary, hex or decimal.',
    ])
  })

  it('solves in the target base', () => {
    expect(parseInBase('ff', 'hex')).toBe(255)
    expect(solutionFor(task, task.items[0])).toEqual({ answer: '2F' })
    expect(solutionFor(task, task.items[1])).toEqual({ answer: '255' })
    expect(solutionFor(task, task.items[2])).toEqual({ answer: 'C8' })
    expect(solutionFor(task, task.items[3])).toEqual({ bits: '00111100' })
  })

  it('accepts hex answers in any case, with or without 0x and leading zeros', () => {
    for (const answer of ['2F', '2f', '0x2F', '02f', ' 2F ']) {
      expect(gradeItem(task, task.items[0], { answer }).correct).toBe(true)
    }
    expect(gradeItem(task, task.items[0], { answer: 'G1' }).hint).toBe(
      'Type a hex number using 0-9 and A-F.'
    )
    expect(gradeItem(task, task.items[0], { answer: '2E' }).hint).toMatch(/groups of 4/)
    expect(gradeItem(task, task.items[2], { answer: 'C9' }).hint).toMatch(/16 times/)
  })

  it('marks decimal and binary answers', () => {
    expect(gradeItem(task, task.items[1], { answer: '255' }).correct).toBe(true)
    expect(gradeItem(task, task.items[1], { answer: '254' }).hint).toMatch(/place value/)
    expect(gradeItem(task, task.items[1], { answer: 'x' }).hint).toBe('Type a whole number.')
    expect(gradeItem(task, task.items[3], { bits: '00111100' }).correct).toBe(true)
    expect(gradeItem(task, task.items[3], { bits: '00111000' }).hint).toBe(
      'Not quite. Each hex digit makes a group of 4 bits. Check the 4 column.'
    )
  })
})

describe('ascii mode', () => {
  const task = {
    mode: 'ascii',
    showTable: true,
    items: [
      { id: 'a', text: 'Hi', direction: 'encode' },
      { id: 'b', text: 'OK!', direction: 'decode' },
    ],
  }

  it('validates text, direction and codeFormat', () => {
    expect(validateBinaryTask(task, 1)).toEqual([])
    expect(
      validateBinaryTask(
        {
          mode: 'ascii',
          codeFormat: 'hex',
          items: [
            { id: 'a', text: 'café', direction: 'encode' },
            { id: 'b', text: 'x'.repeat(17), direction: 'decode' },
            { id: 'c', text: 'ok', direction: 'sideways' },
            { id: 'd', text: '', direction: 'encode' },
          ],
        },
        2
      )
    ).toEqual([
      'Task 2: binary codeFormat must be binary or decimal.',
      'Task 2 item 1: text must be 1 to 16 printable ASCII characters (letters, digits, spaces and symbols).',
      'Task 2 item 2: text must be 1 to 16 printable ASCII characters (letters, digits, spaces and symbols).',
      'Task 2 item 3: ascii direction must be encode or decode.',
      'Task 2 item 4: text must be 1 to 16 printable ASCII characters (letters, digits, spaces and symbols).',
    ])
  })

  it('solves with 8-bit or decimal codes', () => {
    expect(solutionFor(task, task.items[0])).toEqual({ codes: ['01001000', '01101001'] })
    expect(solutionFor({ ...task, codeFormat: 'decimal' }, task.items[0])).toEqual({
      codes: ['72', '105'],
    })
    expect(solutionFor(task, task.items[1])).toEqual({ answer: 'OK!' })
    expect(asciiTable()).toHaveLength(95)
    expect(asciiTable()[33]).toEqual({ char: 'A', code: 65, binary: '01000001' })
  })

  it('marks encoded codes', () => {
    const item = task.items[0]
    expect(gradeItem(task, item, { codes: ['01001000', '01101001'] }).correct).toBe(true)
    // Leading zeros are optional.
    expect(gradeItem(task, item, { codes: ['1001000', '1101001'] }).correct).toBe(true)
    expect(gradeItem(task, item, { codes: ['01001000', ''] }).hint).toBe(
      'Fill in a code for every character.'
    )
    expect(gradeItem(task, item, { codes: ['01001000', '01001001'] }).hint).toBe(
      'Check the code for "i". Find it in the ASCII table.'
    )
    const decimal = { ...task, codeFormat: 'decimal', showTable: false }
    expect(gradeItem(decimal, item, { codes: ['72', '105'] }).correct).toBe(true)
    expect(
      gradeItem(
        decimal,
        { id: 'c', text: 'a b', direction: 'encode' },
        {
          codes: ['97', '33', '98'],
        }
      ).hint
    ).toBe('Check the code for space. Capital A is 65, and each letter after it is one more.')
  })

  it('marks decoded text exactly, with length and case hints', () => {
    const item = task.items[1]
    expect(gradeItem(task, item, { answer: 'OK!' }).correct).toBe(true)
    expect(gradeItem(task, item, { answer: 'OK' }).hint).toMatch(/needs 3 characters/)
    expect(gradeItem(task, item, { answer: 'Ok!' }).hint).toBe(
      'Check character 2. Capital and small letters have different codes.'
    )
    expect(gradeItem(task, item, { answer: 'OX!' }).hint).toBe(
      'Check character 2. Look up its code in the table.'
    )
  })
})

describe('pixels mode', () => {
  const task = {
    mode: 'pixels',
    width: 4,
    height: 3,
    items: [
      { id: 'a', rows: ['0110', '1001', '0110'], direction: 'draw' },
      { id: 'b', rows: ['1000', '0100', '0010'], direction: 'encode' },
    ],
  }

  it('validates the grid size and rows', () => {
    expect(validateBinaryTask(task, 1)).toEqual([])
    expect(validateBinaryTask({ ...task, width: 17 }, 1)).toEqual([
      'Task 1: binary pixels width and height must be whole numbers from 1 to 16.',
    ])
    expect(validateBinaryTask({ ...task, height: undefined }, 1)).toEqual([
      'Task 1: binary pixels width and height must be whole numbers from 1 to 16.',
    ])
    expect(
      validateBinaryTask(
        {
          ...task,
          items: [
            { id: 'a', rows: ['0110', '101', '0110'], direction: 'draw' },
            { id: 'b', rows: ['0110', '1001'], direction: 'encode' },
            { id: 'c', rows: ['0110', '1001', '0120'], direction: 'paint' },
          ],
        },
        4
      )
    ).toEqual([
      'Task 4 item 1: rows must be 3 rows of 4 binary digits (0s and 1s).',
      'Task 4 item 2: rows must be 3 rows of 4 binary digits (0s and 1s).',
      'Task 4 item 3: pixels direction must be draw or encode.',
      'Task 4 item 3: rows must be 3 rows of 4 binary digits (0s and 1s).',
    ])
  })

  it('keeps a finished task under the saved-state budget', () => {
    const big = {
      mode: 'pixels',
      width: 16,
      height: 16,
      items: Array.from({ length: 6 }, (_, i) => ({
        id: `p${i}`,
        rows: Array(16).fill('1'.repeat(16)),
        direction: 'draw',
      })),
    }
    const [message] = validateBinaryTask(big, 1)
    expect(message).toMatch(/^Task 1: binary task has too much to save \(\d+ characters/)
    expect(validateBinaryTask({ ...big, items: big.items.slice(0, 4) }, 1)).toEqual([])
    // A full 16x16 x 4 task still serialises well under 2 KB.
    const solved = binary.serialize(binary.solutionState({ ...big, items: big.items.slice(0, 4) }))
    expect(solved.length).toBeLessThan(2048)
  })

  it('marks drawn cells and typed rows', () => {
    const [draw, encode] = task.items
    expect(gradeItem(task, draw, { cells: ['0110', '1001', '0110'] }).correct).toBe(true)
    expect(gradeItem(task, draw, { cells: ['0110', '1011', '0110'] }).hint).toBe(
      'Check row 2. Each 1 is a filled square and each 0 is an empty one.'
    )
    expect(gradeItem(task, encode, { rows: ['1000', '0100', '0010'] }).correct).toBe(true)
    expect(gradeItem(task, encode, { rows: ['1000', '010', '0010'] }).hint).toBe(
      'Row 2 needs 4 digits, one for each square.'
    )
    expect(gradeItem(task, encode, { rows: ['1000', '0100', '0001'] }).hint).toMatch(
      /^Check row 3\./
    )
    expect(gradeTask(task, {}).correct).toBe(0)
  })
})

describe('definition for the follow-up modes', () => {
  const ascii = {
    mode: 'ascii',
    items: [
      { id: 'a', text: 'Hi', direction: 'encode' },
      { id: 'b', text: 'Yo', direction: 'decode' },
    ],
  }
  const pixels = {
    mode: 'pixels',
    width: 3,
    height: 2,
    items: [
      { id: 'a', rows: ['010', '101'], direction: 'draw' },
      { id: 'b', rows: ['111', '000'], direction: 'encode' },
    ],
  }

  it('builds blank and solved states that grade as expected', () => {
    expect(binary.initialState(ascii).items).toEqual({
      a: { codes: ['', ''] },
      b: { answer: '' },
    })
    expect(binary.initialState(pixels).items).toEqual({
      a: { cells: ['000', '000'] },
      b: { rows: ['', ''] },
    })
    expect(
      binary.initialState({ mode: 'overflow', bits: 4, items: [{ id: 'a' }] }).items.a
    ).toEqual({ bits: '0000', carries: '', overflow: '' })
    expect(
      binary.initialState({
        mode: 'hex',
        bits: 4,
        items: [
          { id: 'a', from: 'hex', to: 'binary' },
          { id: 'b', from: 'binary', to: 'hex' },
        ],
      }).items
    ).toEqual({ a: { bits: '0000' }, b: { answer: '' } })
    for (const task of [ascii, pixels]) {
      expect(binary.grade(task, binary.initialState(task)).passed).toBe(false)
      expect(binary.grade(task, binary.solutionState(task)).passed).toBe(true)
    }
  })

  it('classifies typing as continuous and clicks as discrete', () => {
    const at = (item) => ({ v: 1, items: { a: item } })
    expect(binary.classifyChange(at({ codes: ['', ''] }), at({ codes: ['1', ''] }))).toBe(
      'continuous'
    )
    expect(binary.classifyChange(at({ rows: ['', ''] }), at({ rows: ['0', ''] }))).toBe(
      'continuous'
    )
    expect(binary.classifyChange(at({ cells: ['000'] }), at({ cells: ['010'] }))).toBe('discrete')
    expect(
      binary.classifyChange(
        at({ bits: '0010', overflow: '' }),
        at({ bits: '0010', overflow: 'yes' })
      )
    ).toBe('discrete')
    expect(binary.classifyChange(at({ answer: '' }), at({ answer: 'F' }))).toBe('continuous')
  })

  it('prints each mode with its answer', () => {
    const print = (task) => binary.printHtml(task, { esc })
    expect(
      print({ mode: 'overflow', bits: 4, items: [{ id: 'a', a: '1100', b: '0110' }] })
    ).toContain('1100 + 0110 = ? Did it overflow? <em>(answer: 0010, yes)</em>')
    expect(
      print({ mode: 'hex', bits: 8, items: [{ id: 'a', value: 'ff', from: 'hex', to: 'decimal' }] })
    ).toContain('ff (hex) in decimal = ? <em>(answer: 255)</em>')
    expect(print(ascii)).toContain('Encode "Hi" (binary) <em>(answer: 01001000 01101001)</em>')
    expect(print(ascii)).toContain('<em>(answer: Yo)</em>')
    const pix = print(pixels)
    expect(pix).toContain('<strong>Pixel pictures</strong>')
    expect(pix).toContain('Draw 010 101')
    expect(pix).toContain('<em>(answer: 111 000)</em>')
    expect(pix).toContain('<table')
  })
})
