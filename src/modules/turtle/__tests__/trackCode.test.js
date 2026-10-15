// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { trackCodeSegments } from '../trackCode.js'

function rounded(segments) {
  // `+ 0` turns -0 (cos/sin rounding) into 0.
  return segments.map((s) => [s.x1, s.y1, s.x2, s.y2].map((v) => Math.round(v * 10) / 10 + 0))
}

describe('trackCodeSegments', () => {
  it('turns drawn lines into wall segments, skipping imports, comments and pen-up moves', () => {
    const { segments } = trackCodeSegments(
      [
        'import turtle',
        '# the outer wall',
        'turtle.penup()',
        'turtle.goto(-100, -100)',
        'turtle.pendown()',
        'turtle.forward(200)  # bottom',
        'turtle.left(90)',
        'turtle.fd(50)',
      ].join('\n')
    )
    expect(rounded(segments)).toEqual([
      [-100, -100, 100, -100],
      [100, -100, 100, -50],
    ])
  })

  it('repeats indented loops, nested too', () => {
    const { segments } = trackCodeSegments(
      'for i in range(2):\n    for j in range(2):\n        forward(10)\n    right(90)'
    )
    expect(rounded(segments)).toEqual([
      [0, 0, 10, 0],
      [10, 0, 20, 0],
      [20, 0, 20, -10],
      [20, -10, 20, -20],
    ])
  })

  it('draws circles as short lines, like the Turtle shim', () => {
    const { segments } = trackCodeSegments('circle(50)')
    expect(segments.length).toBeGreaterThanOrEqual(12)
    const last = segments[segments.length - 1]
    expect(last.x2).toBeCloseTo(0, 5)
    expect(last.y2).toBeCloseTo(0, 5)
  })

  it('understands setheading, backward and home', () => {
    const { segments } = trackCodeSegments('setheading(90)\nforward(20)\nbackward(5)\nhome()')
    expect(rounded(segments)).toEqual([
      [0, 0, 0, 20],
      [0, 20, 0, 15],
      [0, 15, 0, 0],
    ])
  })

  it('names the line for anything it cannot read', () => {
    expect(trackCodeSegments('forward(10)\nprint("hi")').error).toMatch(
      /^line 2: trackCode can't use print/
    )
    expect(trackCodeSegments('forward(size)').error).toMatch(
      /line 1: forward\(\) needs plain numbers/
    )
    expect(trackCodeSegments('forward(1, 2)').error).toMatch(/takes 1 number/)
    expect(trackCodeSegments('x = 5').error).toMatch(/isn't a turtle command/)
    expect(trackCodeSegments('    forward(1)\nforward(2)').error).toMatch(/indentation/)
    expect(trackCodeSegments('for i in range(3):\nforward(2)').error).toMatch(
      /needs an indented line/
    )
  })

  it('refuses snippets that draw far too much', () => {
    expect(trackCodeSegments('for i in range(5000):\n    forward(1)').error).toMatch(/too much/)
  })
})
