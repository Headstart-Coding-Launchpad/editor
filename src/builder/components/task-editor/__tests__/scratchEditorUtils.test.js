import { describe, it, expect } from 'vitest'
import { buildScratchToolboxXml, parseScratchToolboxXml } from '../ScratchEditors'

describe('buildScratchToolboxXml', () => {
  it('returns an xml element with category children for selected types', () => {
    const xml = buildScratchToolboxXml(['event_whenflagclicked', 'motion_movesteps'])
    expect(xml).toMatch(/^<xml>/)
    expect(xml).toContain('<block type="event_whenflagclicked"/>')
    expect(xml).toContain('<block type="motion_movesteps"/>')
    expect(xml).not.toContain('<block type="looks_say"/>')
  })

  it('omits categories entirely when none of their blocks are selected', () => {
    const xml = buildScratchToolboxXml(['event_whenflagclicked'])
    expect(xml).toContain('Events')
    expect(xml).not.toContain('Motion')
    expect(xml).not.toContain('Looks')
  })

  it('returns <xml></xml> when no types selected', () => {
    const xml = buildScratchToolboxXml([])
    expect(xml).toBe('<xml></xml>')
  })

  it('wraps output in a <category> per group with correct colour', () => {
    const xml = buildScratchToolboxXml(['event_whenflagclicked'])
    expect(xml).toContain('colour="#FFAB19"')
  })
})

describe('parseScratchToolboxXml', () => {
  it('returns all block types when toolbox is null (no restriction)', () => {
    const types = parseScratchToolboxXml(null)
    expect(types.length).toBeGreaterThan(10)
    expect(types).toContain('event_whenflagclicked')
    expect(types).toContain('motion_movesteps')
  })

  it('returns all block types when toolbox is empty string', () => {
    const types = parseScratchToolboxXml('')
    expect(types.length).toBeGreaterThan(10)
  })

  it('round-trips with buildScratchToolboxXml', () => {
    const input = ['event_whenflagclicked', 'motion_movesteps', 'looks_say']
    const xml = buildScratchToolboxXml(input)
    const parsed = parseScratchToolboxXml(xml)
    expect(new Set(parsed)).toEqual(new Set(input))
  })

  it('returns empty array for malformed XML', () => {
    const types = parseScratchToolboxXml('<not valid xml<<<')
    expect(Array.isArray(types)).toBe(true)
    expect(types.length).toBe(0)
  })

  it('preserves order of selected types as they appear in XML', () => {
    const xml = buildScratchToolboxXml(['event_whenflagclicked', 'motion_movesteps'])
    const parsed = parseScratchToolboxXml(xml)
    expect(parsed).toEqual(['event_whenflagclicked', 'motion_movesteps'])
  })

  it('includes all blocks that are defined in scratch.js and exposed via the builder picker', () => {
    const types = parseScratchToolboxXml(null)
    const expected = [
      'motion_glidesecstoxy',
      'motion_xposition',
      'motion_yposition',
      'motion_direction',
      'motion_setrotationstyle',
      'sensing_touchingobject',
    ]
    for (const type of expected) {
      expect(types).toContain(type)
    }
  })
})
