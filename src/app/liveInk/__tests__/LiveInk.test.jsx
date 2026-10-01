import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveInkProvider from '../LiveInkProvider'
import InkSurface from '../InkSurface'
import { STROKE_FADE_MS, STROKE_HOLD_MS } from '../liveInkData'

// jsdom has no PointerEvent; React only needs the event type, plus clientX/Y and pointer fields.
beforeAll(() => {
  if (!window.PointerEvent) {
    class PointerEvent extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
    window.PointerEvent = PointerEvent
  }
})

// Layout: the surface sits at the top-left of a 400x300 box; the paragraph inside it is 200x40
// at (20, 100). A far-away list item lives way below the visible window.
const RECTS = {
  'info:1': { left: 0, top: 0, width: 400, height: 300 },
  'explainer:1': { left: 0, top: 0, width: 400, height: 300 },
  'b0.p0': { left: 20, top: 100, width: 200, height: 40 },
  'b0.li9': { left: 20, top: 2000, width: 200, height: 40 },
}

function rectFor(el) {
  const key = el.getAttribute?.('data-md-anchor') ?? el.getAttribute?.('data-ink-surface')
  const r = RECTS[key] ?? { left: 0, top: 0, width: 0, height: 0 }
  return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height }
}

let rectSpy
let originalRangeRects
beforeEach(() => {
  rectSpy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function getRect() {
      return rectFor(this)
    })
  originalRangeRects = Range.prototype.getClientRects
})
afterEach(() => {
  rectSpy.mockRestore()
  if (originalRangeRects) Range.prototype.getClientRects = originalRangeRects
  else delete Range.prototype.getClientRects
  delete document.caretPositionFromPoint
  vi.useRealTimers()
})

// Fake text layout for the paragraph (b0.p0 at (20, 100)): 10px-wide characters on 20px lines,
// `perLine` characters to a line - a narrow screen wraps after fewer characters.
function mockParagraphText(perLine) {
  Range.prototype.getClientRects = function getClientRects() {
    const p = document.querySelector('[data-md-anchor="b0.p0"]')
    if (this.startContainer !== p?.firstChild) return []
    const rects = []
    for (let i = this.startOffset; i < this.endOffset; i += 1) {
      const left = 20 + (i % perLine) * 10
      const top = 100 + Math.floor(i / perLine) * 20
      rects.push({ left, right: left + 10, top, bottom: top + 20, width: 10, height: 20 })
    }
    return rects
  }
}

// The caret lands between the paragraph's characters nearest the pointer's x (one line).
function mockCaretLookup() {
  document.caretPositionFromPoint = (x) => {
    const text = document.querySelector('[data-md-anchor="b0.p0"]').firstChild
    const offset = Math.min(text.data.length, Math.max(0, Math.round((x - 20) / 10)))
    return { offsetNode: text, offset }
  }
}

function makeSubscription() {
  let emit = null
  const subscribe = vi.fn((callback) => {
    emit = callback
    return vi.fn()
  })
  return {
    subscribe,
    push(value) {
      act(() => emit(value))
    },
  }
}

function makeWriter() {
  return {
    armDisconnectCleanup: vi.fn(),
    movePointer: vi.fn(),
    hidePointer: vi.fn(),
    addStroke: vi.fn(),
    addHighlight: vi.fn(),
    removeHighlight: vi.fn(),
    clearAll: vi.fn(),
    dispose: vi.fn(),
  }
}

function Content() {
  return (
    <div data-md-anchor="b0">
      <p data-md-anchor="b0.p0">Use print to show text.</p>
      <ul>
        <li data-md-anchor="b0.li9">Far below</li>
      </ul>
    </div>
  )
}

function renderInk({ role, surface = 'info:1', subscribe, writer, onExplainerAnnotate } = {}) {
  return render(
    <LiveInkProvider
      lessonId="lesson-1"
      role={role}
      subscribe={subscribe}
      createWriter={writer ? () => writer : undefined}
      onExplainerAnnotate={onExplainerAnnotate}
    >
      <InkSurface id={surface}>
        <Content />
      </InkSurface>
    </LiveInkProvider>
  )
}

describe('LiveInkOverlay (what students see)', () => {
  it('draws the pointer on the same content, as fractions of its anchor element', () => {
    const sub = makeSubscription()
    renderInk({ role: 'student', subscribe: sub.subscribe })
    expect(sub.subscribe).toHaveBeenCalledTimes(1)
    sub.push({ pointer: { surface: 'info:1', anchor: 'b0.p0', rx: 0.5, ry: 0.5, t: 1 } })
    const dot = screen.getByTestId('live-ink-pointer')
    // (20 + 0.5 * 200, 100 + 0.5 * 40) inside the surface.
    expect(dot).toHaveAttribute('data-x', '120')
    expect(dot).toHaveAttribute('data-y', '120')
  })

  it('ignores annotations that belong to another surface (another task)', () => {
    const sub = makeSubscription()
    renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({ pointer: { surface: 'info:2', anchor: 'b0.p0', rx: 0.5, ry: 0.5, t: 1 } })
    expect(screen.queryByTestId('live-ink-pointer')).toBeNull()
  })

  it('draws a stroke and removes it once it has faded', () => {
    vi.useFakeTimers()
    const sub = makeSubscription()
    const { container } = renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({
      strokes: {
        s1: {
          surface: 'info:1',
          anchor: 'b0.p0',
          points: [
            [0, 0],
            [1, 1],
          ],
          colour: 'red',
          t: 1,
        },
      },
    })
    const path = container.querySelector('[data-stroke-id="s1"]')
    expect(path).toHaveAttribute('d', 'M20.0 100.0 L220.0 140.0')
    act(() => {
      vi.advanceTimersByTime(STROKE_HOLD_MS + STROKE_FADE_MS + 100)
    })
    expect(container.querySelector('[data-stroke-id="s1"]')).toBeNull()
  })

  it('draws a text-anchored stroke under the same words, split where they wrap', () => {
    mockParagraphText(10)
    const sub = makeSubscription()
    const { container } = renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({
      strokes: {
        s1: {
          surface: 'info:1',
          anchor: 'b0.p0',
          // Under characters 2-12; the teacher drew it along one line.
          points: [
            { c: 2, dx: 0, dy: 0.75 },
            { c: 6, dx: 0, dy: 0.75 },
            { c: 12, dx: 0, dy: 0.75 },
          ],
          colour: 'red',
          t: 1,
        },
      },
    })
    // Character 12 wraps onto the second line here: a new segment, not a diagonal.
    expect(container.querySelector('[data-stroke-id="s1"]')).toHaveAttribute(
      'd',
      'M40.0 122.0 L80.0 122.0 M40.0 142.0 l0.01 0'
    )
  })

  it('draws a text-anchored pointer on its character', () => {
    mockParagraphText(100)
    const sub = makeSubscription()
    renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({ pointer: { surface: 'info:1', anchor: 'b0.p0', c: 2, dx: 0.25, dy: 0, t: 1 } })
    const dot = screen.getByTestId('live-ink-pointer')
    // Character 2 starts at x 40 on a line whose midline is y 110; 0.25em = 4px.
    expect(dot).toHaveAttribute('data-x', '44')
    expect(dot).toHaveAttribute('data-y', '110')
  })

  it('re-finds a highlighted quote and draws it over the text', () => {
    Range.prototype.getClientRects = function getClientRects() {
      return [{ left: 24, top: 100, width: 36, height: 20, right: 60, bottom: 120 }]
    }
    const sub = makeSubscription()
    const { container } = renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({
      highlights: {
        h1: { surface: 'info:1', anchor: 'b0.p0', quote: 'print', occurrence: 0, t: 1 },
      },
    })
    const mark = container.querySelector('[data-highlight-id="h1"]')
    expect(mark).not.toBeNull()
    expect(mark.style.left).toBe('24px')
    expect(mark.style.top).toBe('100px')
    // The paragraph itself is untouched (no <mark> injected into React's DOM).
    expect(container.querySelector('[data-md-anchor="b0.p0"]').innerHTML).toBe(
      'Use print to show text.'
    )
  })

  it('shows an edge chip for an off-screen pointer and only scrolls when clicked', () => {
    const scrollBy = vi.fn()
    const originalScrollBy = window.scrollBy
    window.scrollBy = scrollBy
    try {
      const sub = makeSubscription()
      renderInk({ role: 'student', subscribe: sub.subscribe })
      sub.push({ pointer: { surface: 'info:1', anchor: 'b0.li9', rx: 0.5, ry: 0.5, t: 1 } })
      const chip = screen.getByTestId('live-ink-chip')
      expect(chip).toHaveTextContent('Teacher is pointing here')
      expect(chip).toHaveTextContent('↓')
      expect(scrollBy).not.toHaveBeenCalled()
      fireEvent.click(chip)
      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }))
      expect(scrollBy.mock.calls[0][0].top).toBeGreaterThan(0)
    } finally {
      window.scrollBy = originalScrollBy
    }
  })

  it('shows no chip while the pointer is on screen', () => {
    const sub = makeSubscription()
    renderInk({ role: 'student', subscribe: sub.subscribe })
    sub.push({ pointer: { surface: 'info:1', anchor: 'b0.p0', rx: 0.5, ry: 0.5, t: 1 } })
    expect(screen.queryByTestId('live-ink-chip')).toBeNull()
  })

  it('stays inert, without subscribing, outside a live lesson or the Presentation window', () => {
    const sub = makeSubscription()
    const { container } = renderInk({ role: null, subscribe: sub.subscribe })
    expect(sub.subscribe).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ink-surface]')).toBeNull()
    expect(screen.getByText('Use print to show text.')).toBeInTheDocument()
  })
})

describe('Presentation window (teacher) tools', () => {
  it('shows the toolbar only in the Presentation window', () => {
    const sub = makeSubscription()
    const { unmount } = renderInk({ role: 'student', subscribe: sub.subscribe })
    expect(screen.queryByRole('toolbar', { name: 'Presentation annotations' })).toBeNull()
    unmount()
    renderInk({ role: 'teacher', subscribe: makeSubscription().subscribe, writer: makeWriter() })
    expect(screen.getByRole('toolbar', { name: 'Presentation annotations' })).toBeInTheDocument()
  })

  it('hides the toolbar when nothing annotatable is on screen', () => {
    render(
      <LiveInkProvider
        lessonId="lesson-1"
        role="teacher"
        subscribe={makeSubscription().subscribe}
        createWriter={() => makeWriter()}
      >
        <p>No surface here</p>
      </LiveInkProvider>
    )
    expect(screen.queryByRole('toolbar')).toBeNull()
  })

  it('pointer mode streams the pointer as anchor + fractions; Escape leaves the mode', () => {
    const writer = makeWriter()
    renderInk({ role: 'teacher', subscribe: makeSubscription().subscribe, writer })
    const pointerBtn = screen.getByRole('button', { name: /Pointer/ })
    const paragraph = screen.getByText('Use print to show text.')

    fireEvent.pointerMove(paragraph, { clientX: 120, clientY: 110 })
    expect(writer.movePointer).not.toHaveBeenCalled()

    fireEvent.click(pointerBtn)
    expect(pointerBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.pointerMove(paragraph, { clientX: 120, clientY: 110 })
    expect(writer.movePointer).toHaveBeenCalledWith({
      surface: 'info:1',
      anchor: 'b0.p0',
      rx: 0.5,
      ry: 0.25,
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(pointerBtn).toHaveAttribute('aria-pressed', 'false')
    expect(writer.hidePointer).toHaveBeenCalled()
  })

  it('pointer mode pins the pointer to the character under it when over text', () => {
    mockParagraphText(100)
    mockCaretLookup()
    const writer = makeWriter()
    renderInk({ role: 'teacher', subscribe: makeSubscription().subscribe, writer })
    fireEvent.click(screen.getByRole('button', { name: /Pointer/ }))
    fireEvent.pointerMove(screen.getByText('Use print to show text.'), {
      clientX: 44,
      clientY: 112,
    })
    expect(writer.movePointer).toHaveBeenCalledWith({
      surface: 'info:1',
      anchor: 'b0.p0',
      c: 2,
      dx: 0.25,
      dy: 0.125,
    })
  })

  it('ink over text is stored as characters plus em offsets', () => {
    mockParagraphText(100)
    mockCaretLookup()
    const writer = makeWriter()
    renderInk({ role: 'teacher', subscribe: makeSubscription().subscribe, writer })
    fireEvent.click(screen.getByRole('button', { name: /Ink/ }))
    const layer = screen.getByTestId('live-ink-capture')
    fireEvent.pointerDown(layer, { clientX: 44, clientY: 122, button: 0 })
    fireEvent.pointerMove(layer, { clientX: 84, clientY: 122 })
    fireEvent.pointerUp(layer, { clientX: 84, clientY: 122 })
    // jsdom can't hit-test, so the anchor is the surface; offsets count its whole text.
    expect(writer.addStroke).toHaveBeenCalledWith({
      surface: 'info:1',
      anchor: 'root',
      points: [
        { c: 2, dx: 0.25, dy: 0.75 },
        { c: 6, dx: 0.25, dy: 0.75 },
      ],
    })
    // The capture layer takes the pointer again afterwards.
    expect(layer.style.pointerEvents).toBe('')
  })

  it('only captures the pointer for drawing in ink mode', () => {
    const writer = makeWriter()
    renderInk({ role: 'teacher', subscribe: makeSubscription().subscribe, writer })
    expect(screen.queryByTestId('live-ink-capture')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Ink/ }))
    const layer = screen.getByTestId('live-ink-capture')
    fireEvent.pointerDown(layer, { clientX: 120, clientY: 120, button: 0 })
    fireEvent.pointerMove(layer, { clientX: 200, clientY: 150 })
    fireEvent.pointerUp(layer, { clientX: 200, clientY: 150 })

    // jsdom can't hit-test, so the stroke anchors on the surface itself (400x300 box).
    expect(writer.addStroke).toHaveBeenCalledWith({
      surface: 'info:1',
      anchor: 'root',
      points: [
        [0.3, 0.4],
        [0.5, 0.5],
      ],
    })
  })

  it('highlight mode turns a text selection into a highlight', () => {
    const writer = makeWriter()
    const onExplainerAnnotate = vi.fn()
    renderInk({
      role: 'teacher',
      surface: 'explainer:1',
      subscribe: makeSubscription().subscribe,
      writer,
      onExplainerAnnotate,
    })
    fireEvent.click(screen.getByRole('button', { name: /Highlight/ }))

    const text = screen.getByText('Use print to show text.').firstChild
    const range = document.createRange()
    range.setStart(text, 4)
    range.setEnd(text, 9)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.mouseUp(screen.getByText('Use print to show text.'))

    expect(writer.addHighlight).toHaveBeenCalledWith({
      surface: 'explainer:1',
      anchor: 'b0.p0',
      quote: 'print',
      occurrence: 0,
    })
    // Annotating an explainer opens it for students who have it collapsed.
    expect(onExplainerAnnotate).toHaveBeenCalledTimes(1)
  })

  it('Clear wipes every annotation', () => {
    const writer = makeWriter()
    const sub = makeSubscription()
    renderInk({ role: 'teacher', subscribe: sub.subscribe, writer })
    const clear = screen.getByRole('button', { name: 'Clear' })
    expect(clear).toBeDisabled()
    sub.push({
      highlights: {
        h1: { surface: 'info:1', anchor: 'b0.p0', quote: 'print', occurrence: 0, t: 1 },
      },
    })
    expect(clear).toBeEnabled()
    fireEvent.click(clear)
    expect(writer.clearAll).toHaveBeenCalled()
  })
})
