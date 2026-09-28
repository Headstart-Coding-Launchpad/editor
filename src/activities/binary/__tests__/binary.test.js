import {
  toBits,
  fromBits,
  placeValues,
  carriesFor,
  solutionFor,
  validateBinaryTask,
  gradeItem,
  gradeTask,
} from '../binary.js'

const makeNumber = { mode: 'make_number', bits: 8, items: [{ id: 'a', target: 13 }] }

describe('conversions', () => {
  it('converts between numbers and fixed-width bit strings', () => {
    expect(toBits(13, 8)).toBe('00001101')
    expect(toBits(255, 8)).toBe('11111111')
    expect(fromBits('00001101')).toBe(13)
    expect(fromBits('10a')).toBeNull()
    expect(placeValues(4)).toEqual([8, 4, 2, 1])
  })

  it('works out the carry into each column', () => {
    // 0011 + 0001: carry into the 2 column and the 4 column.
    expect(carriesFor('0011', '0001')).toBe('0110')
    expect(carriesFor('0100', '0010')).toBe('0000')
  })

  it('gives the solution for each mode', () => {
    expect(solutionFor(makeNumber, makeNumber.items[0])).toEqual({ bits: '00001101' })
    expect(solutionFor({ mode: 'to_decimal', bits: 4 }, { value: '1011' })).toEqual({
      answer: '11',
    })
    expect(solutionFor({ mode: 'add', bits: 4 }, { a: '0011', b: '0001' })).toEqual({
      bits: '0100',
      carries: '0110',
    })
  })
})

describe('validateBinaryTask', () => {
  it('accepts valid tasks', () => {
    expect(validateBinaryTask(makeNumber, 1)).toEqual([])
    expect(
      validateBinaryTask({ mode: 'add', bits: 4, items: [{ id: 'x', a: '0011', b: '0100' }] }, 2)
    ).toEqual([])
  })

  it('reports each authoring mistake', () => {
    expect(validateBinaryTask({ mode: 'octal' }, 1)).toEqual([
      'Task 1: binary mode must be one of make_number, to_binary, to_decimal, add, overflow, hex, ascii, pixels.',
    ])
    expect(validateBinaryTask({ mode: 'make_number', bits: 20, items: [] }, 1)).toEqual([
      'Task 1: binary bits must be a whole number from 1 to 16.',
    ])
    expect(validateBinaryTask({ mode: 'make_number', bits: 4, items: [] }, 1)).toEqual([
      'Task 1: binary task needs at least one item.',
    ])
    expect(
      validateBinaryTask(
        {
          mode: 'make_number',
          bits: 4,
          items: [
            { id: 'a', target: 16 },
            { id: 'a', target: 3 },
          ],
        },
        3
      )
    ).toEqual([
      'Task 3 item 1: target must be a whole number from 0 to 15.',
      'Task 3 item 2: id "a" is used more than once.',
    ])
    expect(
      validateBinaryTask({ mode: 'to_decimal', bits: 4, items: [{ id: 'a', value: '101' }] }, 1)
    ).toEqual(['Task 1 item 1: value must be 4 binary digits (0s and 1s).'])
    expect(
      validateBinaryTask({ mode: 'add', bits: 4, items: [{ id: 'a', a: '1000', b: '1000' }] }, 1)
    ).toEqual(['Task 1 item 1: a + b is too big for 4 bits (use mode: overflow for that).'])
  })
})

describe('grading', () => {
  it('marks make_number and gives a column hint', () => {
    const item = makeNumber.items[0]
    expect(gradeItem(makeNumber, item, { bits: '00001101' })).toEqual({ correct: true, hint: null })
    expect(gradeItem(makeNumber, item, { bits: '00001100' })).toEqual({
      correct: false,
      hint: 'Your bits make 12, which is too small. Check the 1 column.',
    })
    expect(gradeItem(makeNumber, item, {}).correct).toBe(false)
  })

  it('does not reveal the value in to_binary', () => {
    const task = { ...makeNumber, mode: 'to_binary' }
    expect(gradeItem(task, task.items[0], { bits: '00011101' }).hint).toBe(
      'Not quite. Check the 16 column.'
    )
  })

  it('marks to_decimal answers', () => {
    const task = { mode: 'to_decimal', bits: 4, items: [{ id: 'a', value: '1011' }] }
    expect(gradeItem(task, task.items[0], { answer: ' 11 ' }).correct).toBe(true)
    expect(gradeItem(task, task.items[0], { answer: 'eleven' }).hint).toBe('Type a whole number.')
    expect(gradeItem(task, task.items[0], { answer: '12' }).correct).toBe(false)
  })

  it('marks addition and optionally requires carries', () => {
    const task = { mode: 'add', bits: 4, items: [{ id: 'a', a: '0011', b: '0001' }] }
    expect(gradeItem(task, task.items[0], { bits: '0100' }).correct).toBe(true)
    const strict = { ...task, requireCarries: true }
    expect(gradeItem(strict, strict.items[0], { bits: '0100', carries: '0000' })).toEqual({
      correct: false,
      hint: 'Your answer is right. Now fill in the carries too.',
    })
    expect(gradeItem(strict, strict.items[0], { bits: '0100', carries: '0110' }).correct).toBe(true)
    expect(gradeItem(task, task.items[0], { bits: '0010' }).hint).toMatch(/Check the 4 column/)
  })

  it('summarises a whole task', () => {
    const task = {
      mode: 'make_number',
      bits: 4,
      items: [
        { id: 'a', target: 5 },
        { id: 'b', target: 9 },
      ],
    }
    expect(gradeTask(task, { items: { a: { bits: '0101' } } })).toEqual({
      total: 2,
      correct: 1,
      done: false,
    })
    expect(gradeTask(task, { items: { a: { bits: '0101' }, b: { bits: '1001' } } }).done).toBe(true)
  })
})
