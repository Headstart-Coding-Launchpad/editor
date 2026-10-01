import { afterEach, describe, expect, it } from 'vitest'
import {
  ROOT_ANCHOR,
  anchorElementFor,
  charBoxAt,
  decodeTextPoint,
  emToPx,
  encodeTextPoint,
  fractionPairOf,
  isTextPoint,
  pxToEm,
  resolveInkStroke,
  segmentsToSvgPath,
  splitStrokeSegments,
  textOffsetWithin,
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
  strokeToInkPoints,
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

describe('text-anchored points: pure maths', () => {
  it('converts between px and em of the font size (16px when unknown)', () => {
    expect(pxToEm(8, 16)).toBe(0.5)
    expect(pxToEm(10, 0)).toBe(0.625)
    expect(pxToEm(1, 3)).toBe(0.333)
    expect(emToPx(0.5, 20)).toBe(10)
    expect(emToPx(1, undefined)).toBe(16)
  })

  it('recognises text points and box-fraction points in every stored form', () => {
    expect(isTextPoint({ c: 3, dx: 0.1, dy: -0.2 })).toBe(true)
    expect(isTextPoint({ c: -1, dx: 0, dy: 0 })).toBe(false)
    expect(isTextPoint({ c: 3, dx: 500, dy: 0 })).toBe(false)
    expect(isTextPoint([0.1, 0.2])).toBe(false)
    expect(fractionPairOf([0.1, 0.2])).toEqual([0.1, 0.2])
    expect(fractionPairOf({ 0: 0.1, 1: 0.2 })).toEqual([0.1, 0.2])
    expect(fractionPairOf({ rx: 0.1, ry: 0.2 })).toEqual([0.1, 0.2])
    expect(fractionPairOf({ c: 3, dx: 0, dy: 0 })).toBeNull()
    expect(fractionPairOf([50, 0])).toBeNull()
  })

  it('keeps a point on the same character on a screen with a different layout and font size', () => {
    const teacherChar = { x: 100, mid: 50, fontSize: 16 }
    const encoded = encodeTextPoint({ x: 104, y: 62 }, teacherChar, 7)
    expect(encoded).toEqual({ c: 7, dx: 0.25, dy: 0.75 })
    // The same character sits somewhere else, in a bigger font, on the student's screen.
    const studentChar = { x: 30, mid: 90, fontSize: 20 }
    expect(decodeTextPoint(encoded, studentChar)).toEqual({ x: 35, y: 105 })
  })

  it('refuses to snap a point that is far from the text', () => {
    const char = { x: 100, mid: 50, fontSize: 16 }
    expect(encodeTextPoint({ x: 100, y: 50 + 16 * 3 }, char, 0)).toBeNull()
    expect(encodeTextPoint({ x: 100 + 16 * 20, y: 50 }, char, 0)).toBeNull()
    expect(encodeTextPoint({ x: 100, y: 50 }, null, 0)).toBeNull()
  })

  it('splits a stroke where its words have wrapped onto another line', () => {
    const line1 = { mid: 10, height: 20 }
    const line2 = { mid: 30, height: 20 }
    const a = { x: 20, y: 22, line: line1, dyPx: 12 }
    const b = { x: 60, y: 22, line: line1, dyPx: 12 }
    const c = { x: 20, y: 42, line: line2, dyPx: 12 }
    const d = { x: 50, y: 42, line: line2, dyPx: 12 }
    expect(splitStrokeSegments([a, b, c, d])).toEqual([
      [a, b],
      [c, d],
    ])
  })

  it('does not split a stroke the teacher really drew down across lines', () => {
    const line1 = { mid: 10, height: 20 }
    const line2 = { mid: 30, height: 20 }
    // Moving down a line: the character changes line and the offset from it resets.
    const points = [
      { x: 20, y: 16, line: line1, dyPx: 6 },
      { x: 20, y: 34, line: line2, dyPx: 4 },
    ]
    expect(splitStrokeSegments(points)).toEqual([points])
    // Box-fraction points carry no line and never split.
    const loose = [
      { x: 0, y: 0 },
      { x: 0, y: 500 },
    ]
    expect(splitStrokeSegments(loose)).toEqual([loose])
  })

  it('builds one SVG path through every segment', () => {
    expect(
      segmentsToSvgPath([
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        [{ x: 5, y: 6 }],
      ])
    ).toBe('M1.0 2.0 L3.0 4.0 M5.0 6.0 l0.01 0')
    expect(segmentsToSvgPath([])).toBe('')
  })
})

describe('text-anchored points: DOM side', () => {
  const TEXT = 'Every game you make in these lessons runs here'
  const originalRangeRects = Range.prototype.getClientRects
  const originalCaret = document.caretPositionFromPoint
  const originalElementsFromPoint = document.elementsFromPoint

  afterEach(() => {
    document.body.innerHTML = ''
    if (originalRangeRects) Range.prototype.getClientRects = originalRangeRects
    else delete Range.prototype.getClientRects
    if (originalCaret) document.caretPositionFromPoint = originalCaret
    else delete document.caretPositionFromPoint
    if (originalElementsFromPoint) document.elementsFromPoint = originalElementsFromPoint
    else delete document.elementsFromPoint
  })

  // Fake text layout: 10px-wide characters on 20px lines, `perLine` characters to a line.
  function mockTextLayout(root, perLine) {
    Range.prototype.getClientRects = function getClientRects() {
      if (!root.contains(this.startContainer)) return []
      const start = textOffsetWithin(root, this.startContainer, this.startOffset)
      const end = textOffsetWithin(root, this.endContainer, this.endOffset)
      const rects = []
      for (let i = start; i < end; i += 1) {
        const left = (i % perLine) * 10
        const top = Math.floor(i / perLine) * 20
        rects.push({ left, right: left + 10, top, bottom: top + 20, width: 10, height: 20 })
      }
      return rects
    }
  }

  function mountParagraph(html = TEXT) {
    const p = document.createElement('p')
    p.setAttribute('data-md-anchor', 'b0.p0')
    p.innerHTML = html
    document.body.appendChild(p)
    return p
  }

  it('counts character offsets across nested text nodes', () => {
    const p = mountParagraph('Use <strong>pr<em>int</em></strong> to show text.')
    const em = p.querySelector('em').firstChild
    expect(textOffsetWithin(p, em, 2)).toBe(8)
    expect(textOffsetWithin(p, p.lastChild, 1)).toBe(10)
    const range = rangeFromTextOffsets(p, 6, 7)
    expect(range.startContainer).toBe(em)
    expect(range.startOffset).toBe(0)
  })

  it('measures a character box, falling back to the previous character right edge', () => {
    const p = mountParagraph()
    mockTextLayout(p, 10)
    expect(charBoxAt(p, 12)).toEqual({ x: 20, mid: 30, height: 20, fontSize: 16 })
    // Past the end of the text: the last character's right edge.
    const last = TEXT.length - 1
    expect(charBoxAt(p, TEXT.length)).toEqual({
      x: (last % 10) * 10 + 10,
      mid: Math.floor(last / 10) * 20 + 10,
      height: 20,
      fontSize: 16,
    })
    expect(charBoxAt(p, TEXT.length + 5)).toBeNull()
  })

  it('encodes points over text as characters, and others as box fractions', () => {
    const p = mountParagraph()
    mockTextLayout(p, 100)
    p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 20 })
    document.caretPositionFromPoint = (x) => ({
      offsetNode: p.firstChild,
      offset: Math.min(TEXT.length, Math.max(0, Math.round(x / 10))),
    })
    const points = strokeToInkPoints(
      [
        { x: 44, y: 22 },
        { x: 44, y: 80 },
      ],
      p
    )
    // Char 4's box: left 40, line midline 10 -> (4px, 12px) = (0.25em, 0.75em).
    expect(points[0]).toEqual({ c: 4, dx: 0.25, dy: 0.75 })
    // 70px (4.4em) below the line is not "on the text": fractions of the paragraph's box.
    expect(points[1]).toEqual([0.11, 4])
  })

  it('keeps box fractions for points over an image', () => {
    const p = mountParagraph('Look: <img alt="diagram">')
    const img = p.querySelector('img')
    mockTextLayout(p, 100)
    p.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 100 })
    document.elementsFromPoint = () => [img, p]
    document.caretPositionFromPoint = () => ({ offsetNode: p.firstChild, offset: 5 })
    expect(strokeToInkPoints([{ x: 100, y: 50 }], p)).toEqual([[0.25, 0.5]])
    // An image that is itself the anchor never snaps to text.
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 })
    expect(strokeToInkPoints([{ x: 100, y: 50 }], img)).toEqual([[0.5, 0.5]])
  })

  it('follows the words when the text wraps differently, splitting at the new line break', () => {
    const p = mountParagraph()
    const underline = [
      { c: 2, dx: 0, dy: 0.75 },
      { c: 6, dx: 0, dy: 0.75 },
      { c: 12, dx: 0, dy: 0.75 },
    ]
    // Wide screen: one line, one segment under characters 2-12.
    mockTextLayout(p, 100)
    expect(resolveInkStroke(p, underline)).toEqual([
      [
        expect.objectContaining({ x: 20, y: 22 }),
        expect.objectContaining({ x: 60, y: 22 }),
        expect.objectContaining({ x: 120, y: 22 }),
      ],
    ])
    // Narrow screen: characters 10+ wrap onto line two, so the stroke breaks there.
    mockTextLayout(p, 10)
    expect(resolveInkStroke(p, underline)).toEqual([
      [expect.objectContaining({ x: 20, y: 22 }), expect.objectContaining({ x: 60, y: 22 })],
      [expect.objectContaining({ x: 20, y: 42 })],
    ])
  })

  it('still resolves legacy [rx, ry] points against the anchor box', () => {
    const p = mountParagraph()
    p.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 40 })
    expect(
      resolveInkStroke(p, [
        [0, 0],
        [1, 1],
      ])
    ).toEqual([
      [
        { x: 10, y: 20 },
        { x: 210, y: 60 },
      ],
    ])
  })
})
