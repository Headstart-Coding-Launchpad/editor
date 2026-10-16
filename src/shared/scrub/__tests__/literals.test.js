// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SCRUB_COMMON_COLOURS,
  SCRUB_SAFE_COLOUR_NAMES,
  SCRUB_SAFE_COLOURS,
  clampScrubValue,
  defaultScrubRange,
  findScrubLiterals,
  formatScrubColour,
  formatScrubNumber,
  literalAtColumn,
  normaliseHexInput,
  numberStep,
  scrubRangeFor,
  scrubSyntaxFor,
  startsInsideStyle,
  valueForDrag,
} from '../literals.js'

const texts = (line, syntax, options) =>
  findScrubLiterals(line, syntax, options).map((literal) => `${literal.kind}:${literal.text}`)

describe('scrubSyntaxFor', () => {
  it('maps editor languages to scrub syntaxes', () => {
    expect(scrubSyntaxFor('python')).toBe('python')
    expect(scrubSyntaxFor('html')).toBe('markup')
    expect(scrubSyntaxFor('css')).toBe('css')
    expect(scrubSyntaxFor('javascript')).toBeNull()
    expect(scrubSyntaxFor(undefined)).toBeNull()
  })
})

describe('findScrubLiterals: python', () => {
  it('finds whole numbers and decimals in code, with their positions', () => {
    const [literal] = findScrubLiterals('turtle.forward(100)', 'python')
    expect(literal).toMatchObject({ kind: 'number', from: 15, to: 18, text: '100', value: 100 })
    expect(texts('x = 3.25 * .5', 'python')).toEqual(['number:3.25', 'number:.5'])
  })

  it('keeps a unary minus with the number, but not a subtraction', () => {
    expect(texts('turtle.left(-90)', 'python')).toEqual(['number:-90'])
    expect(texts('a = -3', 'python')).toEqual(['number:-3'])
    expect(texts('return -5', 'python')).toEqual(['number:-5'])
    expect(texts('x = y2 - 4', 'python')).toEqual(['number:4'])
    expect(texts('x = (a) -4', 'python')).toEqual(['number:4'])
  })

  it('skips numbers inside identifiers, strings, comments and other number forms', () => {
    expect(texts('x2 = player1 + 1e5 + 0x1F + 1_000', 'python')).toEqual([])
    expect(texts('print("level 5")  # 50 steps', 'python')).toEqual([])
  })

  it('finds colour strings (names and hex), as the text inside the quotes', () => {
    const literals = findScrubLiterals('rect(1, 2, 3, 4, "Red"); c = \'#FF0000\'', 'python')
    const colours = literals.filter((literal) => literal.kind === 'colour')
    expect(colours.map((c) => c.text)).toEqual(['Red', '#FF0000'])
    expect(colours[0]).toMatchObject({ hex: '#ff0000', style: 'name', from: 18, to: 21 })
    expect(colours[1]).toMatchObject({ hex: '#ff0000', style: 'hex', upper: true, short: false })
    expect(texts("fill('hello')", 'python')).toEqual([])
  })

  it('gives Stage angle=, opacity=, light= and hue() numbers their natural ranges', () => {
    const line = "square(i * 8, angle=i * 9, colour=hue(i * 9, light=60), opacity=1, outline='red')"
    const literals = findScrubLiterals(line, 'python')
    const numbers = literals.filter((literal) => literal.kind === 'number')
    expect(numbers.map((n) => [n.text, n.range ?? null])).toEqual([
      ['8', null],
      ['9', null],
      ['9', { min: 0, max: 360 }],
      ['60', { min: 0, max: 100 }],
      ['1', { min: 0, max: 1 }],
    ])
    // `angle=i * 9`: only a number right after angle= is the angle.
    expect(findScrubLiterals('square(80, angle=45)', 'python')[1].range).toEqual({
      min: 0,
      max: 360,
    })
    // A whole-number opacity scrubs in tenths.
    const opacity = numbers[4]
    expect(numberStep(opacity)).toBe(0.1)
    expect(defaultScrubRange(opacity)).toEqual({ min: 0, max: 1 })
    expect(defaultScrubRange({ value: 400, decimals: 0, range: { min: 0, max: 360 } })).toEqual({
      min: 0,
      max: 400,
    })
    // outline= colours scrub like any colour.
    expect(literals.filter((literal) => literal.kind === 'colour').map((c) => c.text)).toEqual([
      'red',
    ])
  })
})

describe('findScrubLiterals: css', () => {
  it('finds numbers with units and colours in declaration values', () => {
    const literals = findScrubLiterals(
      '  margin: 20px -1.5em; color: red; background: #fff;',
      'css'
    )
    expect(literals.map((l) => `${l.kind}:${l.text}`)).toEqual([
      'number:20px',
      'number:-1.5em',
      'colour:red',
      'colour:#fff',
    ])
    expect(literals[0]).toMatchObject({ value: 20, unit: 'px', decimals: 0 })
    expect(literals[1]).toMatchObject({ value: -1.5, unit: 'em', decimals: 1 })
    expect(literals[3]).toMatchObject({ short: true, hex: '#ffffff' })
  })

  it('reads selectors as selectors, not declarations, and skips comments', () => {
    expect(texts('a:hover { color: blue }', 'css')).toEqual(['colour:blue'])
    expect(texts('/* margin: 10px */ width: 50%;', 'css')).toEqual(['number:50%'])
  })
})

describe('findScrubLiterals: markup', () => {
  it('scrubs style attributes and whole-value attributes, never page text or links', () => {
    expect(
      texts(
        '<div style="margin: 20px; color: tomato" width="200" href="#bad">Score: 10</div>',
        'markup'
      )
    ).toEqual(['number:20px', 'colour:tomato', 'number:200'])
    expect(texts('<rect fill="#f00" class="red">', 'markup')).toEqual(['colour:#f00'])
  })

  it('treats lines inside a <style> block as CSS', () => {
    expect(texts('  padding: 4px;', 'markup', { inStyle: true })).toEqual(['number:4px'])
    expect(texts('  padding: 4px;', 'markup')).toEqual([])
    expect(texts('<style>p { font-size: 12px }</style> 5 apples', 'markup')).toEqual([
      'number:12px',
    ])
  })

  it('startsInsideStyle reads whether a <style> tag is still open', () => {
    expect(startsInsideStyle('<html>\n<style>\n')).toBe(true)
    expect(startsInsideStyle('<STYLE>p{}</style>\n')).toBe(false)
    expect(startsInsideStyle('<p>hi</p>')).toBe(false)
  })
})

describe('literalAtColumn', () => {
  it('finds the literal under a column, its end included', () => {
    const literals = findScrubLiterals('f(10, 200)', 'python')
    expect(literalAtColumn(literals, 2)?.text).toBe('10')
    expect(literalAtColumn(literals, 4)?.text).toBe('10')
    expect(literalAtColumn(literals, 7)?.text).toBe('200')
    expect(literalAtColumn(literals, 0)).toBeNull()
  })
})

describe('number steps, ranges and formatting', () => {
  it('steps whole numbers by 1 and decimals by their last place', () => {
    expect(numberStep({ decimals: 0 })).toBe(1)
    expect(numberStep({ decimals: 1 })).toBe(0.1)
    expect(numberStep({ decimals: 2 })).toBe(0.01)
  })

  it('formats with the literal decimals and unit, never as -0', () => {
    expect(formatScrubNumber(12, { decimals: 0, unit: 'px' })).toBe('12px')
    expect(formatScrubNumber(0.3, { decimals: 2, unit: '' })).toBe('0.30')
    expect(formatScrubNumber(-0, { decimals: 0, unit: '' })).toBe('0')
    expect(formatScrubNumber(-0.04, { decimals: 1, unit: '' })).toBe('0.0')
  })

  it('gives a sensible range around the value when the task has none', () => {
    expect(defaultScrubRange({ value: 100, decimals: 0 })).toEqual({ min: 0, max: 200 })
    expect(defaultScrubRange({ value: 5, decimals: 0 })).toEqual({ min: 0, max: 100 })
    expect(defaultScrubRange({ value: 0.25, decimals: 2 })).toEqual({ min: 0, max: 1 })
    expect(defaultScrubRange({ value: -90, decimals: 0 })).toEqual({ min: -180, max: 180 })
  })

  it('uses the task range for the line, widened to take in the current value', () => {
    const ranges = [{ line: 3, min: 10, max: 200 }]
    expect(scrubRangeFor({ value: 100, decimals: 0 }, 3, ranges)).toEqual({ min: 10, max: 200 })
    expect(scrubRangeFor({ value: 300, decimals: 0 }, 3, ranges)).toEqual({ min: 10, max: 300 })
    expect(scrubRangeFor({ value: 100, decimals: 0 }, 4, ranges)).toEqual({ min: 0, max: 200 })
  })

  it('clamps and rounds to the step without float noise', () => {
    expect(clampScrubValue(0.30000000000000004, { min: 0, max: 1 }, 0.1)).toBe(0.3)
    expect(clampScrubValue(250, { min: 10, max: 200 }, 1)).toBe(200)
    expect(clampScrubValue(-5, { min: 10, max: 200 }, 1)).toBe(10)
    expect(clampScrubValue(12.6, { min: 0, max: 100 }, 1)).toBe(13)
  })

  it('maps a horizontal drag across the range', () => {
    const range = { min: 0, max: 300 }
    expect(valueForDrag(100, 0, range, 1)).toBe(100)
    expect(valueForDrag(100, 30, range, 1)).toBe(130)
    expect(valueForDrag(100, -1000, range, 1)).toBe(0)
    // A short range still moves at least a step per 2 px.
    expect(valueForDrag(0.5, 4, { min: 0, max: 1 }, 0.1)).toBe(0.7)
  })
})

describe('colours', () => {
  it('offers named, labelled palettes', () => {
    expect(SCRUB_SAFE_COLOURS.length).toBe(8)
    for (const choice of [...SCRUB_SAFE_COLOURS, ...SCRUB_COMMON_COLOURS]) {
      expect(choice.label).toBeTruthy()
      expect(choice.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(SCRUB_COMMON_COLOURS.find((c) => c.name === 'red')?.hex).toBe('#ff0000')
  })

  it('normalises typed hex', () => {
    expect(normaliseHexInput('abc')).toBe('#aabbcc')
    expect(normaliseHexInput(' #00FF00 ')).toBe('#00ff00')
    expect(normaliseHexInput('red')).toBeNull()
  })

  it('writes a name back as a name (matching capitals) when the choice has one', () => {
    expect(
      formatScrubColour({ hex: '#0000ff', name: 'blue' }, { style: 'name', text: 'red' })
    ).toBe('blue')
    expect(
      formatScrubColour({ hex: '#0000ff', name: 'blue' }, { style: 'name', text: 'Red' })
    ).toBe('Blue')
    expect(
      formatScrubColour({ hex: '#0000ff', name: 'blue' }, { style: 'name', text: 'RED' })
    ).toBe('BLUE')
  })

  it('names only (scrub.colourNames): a named pick replaces a hex literal by name', () => {
    expect(
      formatScrubColour(
        { hex: '#008080', name: 'teal' },
        { style: 'hex', text: '#E69F00' },
        { namesOnly: true }
      )
    ).toBe('teal')
  })

  it('offers the colour-blind-safe palette under real CSS names', () => {
    expect(SCRUB_SAFE_COLOUR_NAMES).toHaveLength(SCRUB_SAFE_COLOURS.length)
    for (const choice of SCRUB_SAFE_COLOUR_NAMES) {
      expect(choice.name).toBe(choice.label)
      expect(choice.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('writes hex when the original is hex, or the choice has no name', () => {
    expect(formatScrubColour({ hex: '#e69f00', name: null }, { style: 'name', text: 'red' })).toBe(
      '#e69f00'
    )
    expect(
      formatScrubColour({ hex: '#0000ff', name: 'blue' }, { style: 'hex', text: '#ff0000' })
    ).toBe('#0000ff')
    expect(
      formatScrubColour(
        { hex: '#00ff00', name: 'lime' },
        { style: 'hex', upper: true, short: true }
      )
    ).toBe('#0F0')
    expect(
      formatScrubColour({ hex: '#e69f00', name: null }, { style: 'hex', upper: false, short: true })
    ).toBe('#e69f00')
  })
})
