import { describe, expect, it } from 'vitest'
import { stageToSvg } from '../svg.js'

describe('stageToSvg: shapes as drawn', () => {
  it('places a filled shape at its centre and turns it clockwise', () => {
    const svg = stageToSvg([
      { type: 'square', x: 200, y: 200, size: 80, colour: '#ff0000', angle: 45 },
    ])
    expect(svg).toContain(
      '<polygon points="-40,-40 40,-40 40,40 -40,40" transform="translate(200 200) rotate(45)" fill="#ff0000"/>'
    )
  })

  it('draws a polygon with one corner straight up', () => {
    const svg = stageToSvg([
      { type: 'polygon', x: 100, y: 100, sides: 4, size: 50, colour: '#008080' },
    ])
    expect(svg).toContain('points="0,-50 50,0 0,50 -50,0"')
    expect(svg).toContain('transform="translate(100 100)"')
  })

  it('fades fill and outline separately, and leaves an outline-only shape unfilled', () => {
    const svg = stageToSvg([
      {
        type: 'circle',
        x: 50,
        y: 60,
        r: 20,
        colour: '#ff0000',
        opacity: 0.5,
        outline: '#000000',
        width: 4,
      },
      { type: 'circle', x: 10, y: 10, r: 5, colour: null, outline: '#0000ff', width: 2 },
    ])
    expect(svg).toContain(
      '<circle r="20" transform="translate(50 60)" fill="#ff0000" fill-opacity="0.5" stroke="#000000" stroke-width="4" stroke-linejoin="round" stroke-opacity="0.5"/>'
    )
    expect(svg).toContain(
      '<circle r="5" transform="translate(10 10)" fill="none" stroke="#0000ff" stroke-width="2" stroke-linejoin="round"/>'
    )
  })

  it('centres text and stamps, turned and faded', () => {
    const svg = stageToSvg([
      { type: 'text', x: 200, y: 50, text: 'Hi', colour: '#000000', size: 16, opacity: 0.25 },
      { type: 'stamp', emoji: '⭐', x: 100, y: 120, size: 32, angle: 90 },
    ])
    expect(svg).toContain(
      '<text transform="translate(200 50)" fill="#000000" font-size="16" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="central" opacity="0.25">Hi</text>'
    )
    expect(svg).toContain(
      '<text transform="translate(100 120) rotate(90)" font-size="32" text-anchor="middle" dominant-baseline="central">⭐</text>'
    )
  })
})
