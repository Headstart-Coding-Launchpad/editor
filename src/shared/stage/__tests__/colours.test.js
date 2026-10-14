import { describe, expect, it } from 'vitest'
import {
  colourInWords,
  coloursMatch,
  describeHex,
  isTransparentColour,
  parseColour,
  PICO8_PALETTE,
} from '../colours.js'

describe('parseColour', () => {
  it('reads CSS names, any case and spacing', () => {
    expect(parseColour('red')).toBe('#ff0000')
    expect(parseColour('  CornflowerBlue ')).toBe('#6495ed')
    expect(parseColour('light blue')).toBe('#add8e6')
  })

  it('prefers the CSS colour where a PICO-8 name is also a CSS name', () => {
    expect(parseColour('white')).toBe('#ffffff')
    expect(parseColour('lavender')).toBe('#e6e6fa')
  })

  it('reads the PICO-8 names Arcade uses, with underscores, spaces or grey', () => {
    expect(parseColour('dark_blue')).toBe('#1d2b53')
    expect(parseColour('dark blue')).toBe('#1d2b53')
    expect(parseColour('dark_grey')).toBe('#5f574f')
    expect(parseColour('peach')).toBe('#ffccaa')
  })

  it('reads 3- and 6-digit hex codes', () => {
    expect(parseColour('#F00')).toBe('#ff0000')
    expect(parseColour('#1A2b3C')).toBe('#1a2b3c')
  })

  it('rejects anything else', () => {
    expect(parseColour('redd')).toBeNull()
    expect(parseColour('#12345')).toBeNull()
    expect(parseColour('ff0000')).toBeNull()
    expect(parseColour(3)).toBeNull()
    expect(parseColour(null)).toBeNull()
    expect(parseColour('')).toBeNull()
  })

  it('knows the see-through words', () => {
    expect(isTransparentColour('none')).toBe(true)
    expect(isTransparentColour('Transparent')).toBe(true)
    expect(isTransparentColour('red')).toBe(false)
  })

  it('keeps the 16 PICO-8 colours in index order', () => {
    expect(PICO8_PALETTE).toHaveLength(16)
    expect(PICO8_PALETTE[0]).toBe('#000000')
    expect(PICO8_PALETTE[8]).toBe('#ff004d')
  })
})

describe('coloursMatch', () => {
  it('allows a small difference per channel', () => {
    expect(coloursMatch('#ff0000', '#fa0303')).toBe(true)
    expect(coloursMatch('#ff0000', '#e00000')).toBe(false)
    expect(coloursMatch(null, null)).toBe(true)
    expect(coloursMatch('#ff0000', null)).toBe(false)
  })
})

describe('colour words', () => {
  it('names named colours and describes the rest by the nearest word', () => {
    expect(describeHex('#ff0000')).toBe('red')
    expect(describeHex('#d3d3d3')).toBe('light grey')
    expect(describeHex('#1d2b53')).toBe('dark blue')
    expect(describeHex('#ff1010')).toBe('a colour close to red (#ff1010)')
  })

  it('says an authored colour the way it was written', () => {
    expect(colourInWords('dark_blue')).toBe('dark blue')
    expect(colourInWords('lightgray')).toBe('light grey')
    expect(colourInWords('#ffff00')).toBe('yellow')
    expect(colourInWords('none')).toBe('see-through')
  })
})
