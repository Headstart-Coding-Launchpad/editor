import { afterEach, describe, expect, it } from 'vitest'
import {
  ROOT_ANCHOR,
  anchorElementFor,
  anchorNameOf,
  describeSelection,
  findAnchorElement,
  findQuoteRange,
  fractionToPoint,
  fractionsToStroke,
  normaliseSelectedQuote,
  occurrenceAt,
  offscreenDirection,
  pointToFraction,
  pointsToSvgPath,
  rangeFromTextOffsets,
  resolveHighlightRange,
  simplifyStrokePoints,
  strokeToFractions,
} from '../geometry'

const box = { left: 100, top: 50, width: 200, height: 100 }

describe('element box <-> fractions', () => {
  it('turns a client point into fractions of the box and back', () => {
    expect(pointToFraction({ x: 150, y: 100 }, box)).toEqual({ rx: 0.25, ry: 0.5 })
    expect(fractionToPoint({ rx: 0.25, ry: 0.5 }, box)).toEqual({ x: 150, y: 100 })
  })

  it('lands on the same content on a differently sized screen', () => {
    const teacherImage = { left: 0, top: 0, width: 400, height: 300 }
    const studentImage = { left: 20, top: 500, width: 200, height: 150 }
    const fraction = pointToFraction({ x: 300, y: 75 }, teacherImage)
    expect(fractionToPoint(fraction, studentImage)).toEqual({ x: 170, y: 537.5 })
  })

  it('allows a little overshoot but drops points far outside the box', () => {
    expect(pointToFraction({ x: 90, y: 50 }, box)).toEqual({ rx: -0.05, ry: 0 })
    expect(pointToFraction({ x: 100 + 200 * 11, y: 50 }, box)).toBeNull()
    expect(fractionToPoint({ rx: 'a', ry: 0 }, box)).toBeNull()
  })

  it('maps whole strokes, including the object form RTDB returns arrays in', () => {
    const fractions = strokeToFractions(
      [
        { x: 100, y: 50 },
        { x: 300, y: 150 },
      ],
      box
    )
    expect(fractions).toEqual([
      [0, 0],
      [1, 1],
    ])
    const asObject = { 0: { 0: 0, 1: 0 }, 1: { 0: 1, 1: 1 } }
    expect(fractionsToStroke(asObject, box)).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 150 },
    ])
  })

  it('thins stroke points and caps their number', () => {
    const thinned = simplifyStrokePoints([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 10, y: 0 },
    ])
    expect(thinned).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    const long = Array.from({ length: 1000 }, (_, i) => ({ x: i * 5, y: 0 }))
    const capped = simplifyStrokePoints(long, { maxPoints: 50 })
    expect(capped).toHaveLength(50)
    expect(capped[0]).toBe(long[0])
    expect(capped[49]).toBe(long[999])
  })

  it('builds SVG path data, with a visible dot for a single point', () => {
    expect(
      pointsToSvgPath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ])
    ).toBe('M1.0 2.0 L3.0 4.0')
    expect(pointsToSvgPath([{ x: 1, y: 2 }])).toBe('M1.0 2.0 l0.01 0')
    expect(pointsToSvgPath([])).toBe('')
  })

  it('says whether a point is above, below or inside the visible area', () => {
    const view = { top: 100, bottom: 400 }
    expect(offscreenDirection({ top: 20, bottom: 20 }, view)).toBe('above')
    expect(offscreenDirection({ top: 600, bottom: 600 }, view)).toBe('below')
    expect(offscreenDirection({ top: 200, bottom: 200 }, view)).toBe('visible')
  })
})

describe('quote re-finding', () => {
  const text = 'print it, then print it again'

  it('finds the requested occurrence', () => {
    expect(findQuoteRange(text, 'print', 0)).toEqual({ start: 0, end: 5 })
    expect(findQuoteRange(text, 'print', 1)).toEqual({ start: 15, end: 20 })
  })

  it('falls back to the last occurrence when there are fewer than expected', () => {
    expect(findQuoteRange(text, 'print', 7)).toEqual({ start: 15, end: 20 })
  })

  it('matches across different whitespace (a line break rendered as a space)', () => {
    const found = findQuoteRange('hello   big\nworld', 'big world', 0)
    expect(found).toEqual({ start: 8, end: 17 })
  })

  it('returns null when the quote is not there', () => {
    expect(findQuoteRange(text, 'while', 0)).toBeNull()
    expect(findQuoteRange(text, '   ', 0)).toBeNull()
  })

  it('works out which occurrence a selection started at', () => {
    expect(occurrenceAt(text, 'print', 0)).toBe(0)
    expect(occurrenceAt(text, 'print', 15)).toBe(1)
  })

  it('trims a selected quote and moves its start past the trimmed space', () => {
    expect(normaliseSelectedQuote('  hi ', 3)).toEqual({ quote: 'hi', start: 5 })
    expect(normaliseSelectedQuote('   ', 0)).toBeNull()
    expect(normaliseSelectedQuote('x'.repeat(501), 0)).toBeNull()
  })
})

describe('DOM anchors and ranges', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function mountSurface() {
    const surface = document.createElement('div')
    surface.innerHTML =
      '<div data-md-anchor="b0">' +
      '<p data-md-anchor="b0.p0">Use <strong>print</strong> to show text.</p>' +
      '<ul><li data-md-anchor="b0.li0">print once</li><li data-md-anchor="b0.li1">then print twice, print!</li></ul>' +
      '</div>'
    document.body.appendChild(surface)
    return surface
  }

  it('finds anchors by name, with "root" meaning the surface itself', () => {
    const surface = mountSurface()
    expect(findAnchorElement(surface, 'b0.li1')).toHaveTextContent('then print twice')
    expect(findAnchorElement(surface, ROOT_ANCHOR)).toBe(surface)
    expect(findAnchorElement(surface, 'b9.p9')).toBeNull()
  })

  it('picks the innermost anchored element for a node', () => {
    const surface = mountSurface()
    const strong = surface.querySelector('strong')
    const anchorEl = anchorElementFor(strong.firstChild, surface)
    expect(anchorNameOf(anchorEl, surface)).toBe('b0.p0')
    expect(anchorNameOf(surface, surface)).toBe(ROOT_ANCHOR)
  })

  it('builds a Range from textContent offsets across element boundaries', () => {
    const surface = mountSurface()
    const p = surface.querySelector('p')
    const range = rangeFromTextOffsets(p, 4, 17)
    expect(range.toString()).toBe('print to show')
  })

  it('describes a selection and re-finds it, including which occurrence', () => {
    const surface = mountSurface()
    const li = surface.querySelector('[data-md-anchor="b0.li1"]')
    const text = li.firstChild
    // Select the second "print" in "then print twice, print!".
    const start = text.data.lastIndexOf('print')
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, start + 5)

    const described = describeSelection(range, surface)
    expect(described).toEqual({ anchor: 'b0.li1', quote: 'print', occurrence: 1 })

    const found = resolveHighlightRange(surface, described)
    expect(found.startContainer).toBe(text)
    expect(found.startOffset).toBe(start)
    expect(found.toString()).toBe('print')
  })

  it('ignores selections outside the surface or empty ones', () => {
    const surface = mountSurface()
    const outside = document.createElement('p')
    outside.textContent = 'elsewhere'
    document.body.appendChild(outside)
    const range = document.createRange()
    range.selectNodeContents(outside)
    expect(describeSelection(range, surface)).toBeNull()
    const empty = document.createRange()
    empty.setStart(surface.querySelector('p').firstChild, 1)
    expect(describeSelection(empty, surface)).toBeNull()
  })
})
