// @vitest-environment jsdom
// Calmer Python Stage code lines (feature/stage-lines-calmer, sketch OK'd by Ryan 18 Nov): a
// line carries the hint tag and one soft box, value boxes show only on the line being worked on
// (and the error line), and every value still opens its control when tapped.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { lineHintsExtension, setLineHints } from '../codemirror.js'
import { lockedLinesExtension, setLockedLineSets } from '../lockedLinesEditor.js'
import { scrubExtension } from '../scrub/scrubExtension.js'
import { errorLineField, setErrorLine } from '../errorLine.js'

const IMPORT = 'from stage import *'
const MOON = 'circle(33, "white", x=50, y=50)'
const DOC = `${IMPORT}\nbackground("navy")\n${MOON}\nshow()`
const LOCKS = [
  [
    { line: 1, target: IMPORT },
    { line: 3, slot: 1, after: 'background("navy")', before: null },
    { line: 4, target: 'show()', fence: 'last' },
  ],
]
const SCRUB = { numbers: true, colours: true, booleans: true, ranges: [] }
const views = []

function makeView({ scrub = SCRUB, doc = DOC, locks = LOCKS, hints, extra = [] } = {}) {
  const handlers = { openPopover: vi.fn() }
  const selections = []
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineHintsExtension(),
        lockedLinesExtension(),
        errorLineField,
        scrubExtension({ config: scrub, language: 'python', handlersRef: { current: handlers } }),
        EditorView.updateListener.of((u) => u.selectionSet && selections.push(u)),
        extra,
      ],
    }),
    parent: document.body,
  })
  view.dispatch({
    effects: [
      setLineHints.of(hints ?? [{ line: 3, text: 'Draw a white moon in the top right' }]),
      setLockedLineSets.of(locks),
    ],
  })
  views.push(view)
  return { view, handlers, selections }
}

const boxed = (view) => [...view.dom.querySelectorAll('.cm-scrubbable')].map((el) => el.textContent)
const focus = (view) => view.contentDOM.dispatchEvent(new FocusEvent('focus'))
const caretOn = (view, n) => {
  focus(view)
  view.dispatch({ selection: { anchor: view.state.doc.line(n).from } })
}
// Each character 10px wide, one 10px-high row per line: a stand-in layout for jsdom.
function fakeLayout(view) {
  view.coordsAtPos = (pos) => {
    const line = view.state.doc.lineAt(pos)
    const x = (pos - line.from) * 10
    return { left: x, right: x, top: line.number * 10, bottom: line.number * 10 + 10 }
  }
  view.posAtCoords = ({ x, y }) => {
    const line = view.state.doc.line(Math.floor(y / 10))
    return line.from + Math.max(0, Math.min(line.length, Math.floor(x / 10)))
  }
}
function tap(view, x, y) {
  const down = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y })
  Object.defineProperty(down, 'pointerType', { value: 'touch' })
  view.contentDOM.dispatchEvent(down)
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }))
  vi.runAllTimers()
}

afterEach(() => {
  while (views.length) views.pop().destroy()
  vi.useRealTimers()
})

describe('calmer Stage code lines', () => {
  it('shows the hint as its tag only: no lightbulb in the gutter', () => {
    const { view } = makeView()
    expect(view.dom.querySelector('.cm-lineHintGutter')).toBeNull()
    expect(view.dom.querySelector('.cm-lineHintIcon')).toBeNull()
    const note = view.dom.querySelector('.cm-lineHintNote')
    expect(note.textContent).toBe('Hint: Draw a white moon in the top right')
    expect(note.getAttribute('role')).toBe('note')
  })

  it('shows a hint on line 1 too, as a note above the first line', () => {
    const { view } = makeView({ doc: 'x = 1', locks: [], hints: [{ line: 1, text: 'Start' }] })
    const note = view.dom.querySelector('.cm-lineHintNote')
    expect(note.textContent).toBe('Hint: Start')
    expect(note.compareDocumentPosition(view.dom.querySelector('.cm-line'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('a slot line has a wash and a small pencil (read out), no pill and no dashed outline', () => {
    const { view } = makeView()
    expect(view.dom.querySelector('.cm-slotTag')).toBeNull()
    expect(view.dom.textContent).not.toContain('Write one line here')
    const slot = view.dom.querySelector('.cm-slotLine')
    expect(slot.textContent).toBe(`${MOON}✎`)
    const pencil = slot.querySelector('.cm-slotMark')
    expect(pencil.textContent).toBe('✎')
    expect(pencil.getAttribute('role')).toBe('img')
    expect(pencil.getAttribute('aria-label')).toBe('This space takes one line')
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    const rule = css.match(/\.cm-slotLine\s*\{[^}]*\}/)[0]
    expect(rule).not.toMatch(/outline|dashed/)
    expect(rule).toMatch(/background-color/)
  })

  it('a plain locked line shows a lock icon only, labelled Locked', () => {
    const { view } = makeView()
    const tag = view.dom.querySelector('.cm-line .cm-lockedTag')
    expect(tag.textContent.trim()).toBe('🔒')
    expect(tag.getAttribute('aria-label')).toBe('Locked')
    expect(tag.getAttribute('role')).toBe('img')
    expect(tag.title).toBe('This line is locked')
  })

  it('a fenced locked line keeps its short words in view', () => {
    const { view } = makeView()
    const tag = view.dom.querySelectorAll('.cm-lockedTag')[1]
    expect(tag.textContent).toBe('🔒 nothing below')
    expect(tag.getAttribute('aria-label')).toBe('Locked · nothing below')
  })

  it('value boxes and swatches show only on the line the student is working on', () => {
    const { view } = makeView({ doc: 'x = 10\nbackground("navy")\ny = 20' })
    caretOn(view, 1)
    expect(boxed(view)).toEqual(['10'])
    expect(view.dom.querySelector('.cm-scrubSwatch')).toBeNull()
    caretOn(view, 2)
    expect(boxed(view)).toEqual(['navy'])
    expect(view.dom.querySelector('.cm-scrubSwatch')).not.toBeNull()
  })

  it('before the student has clicked in, the first line with a value shows its boxes', () => {
    const { view } = makeView({ doc: 'print("hi")\nx = 10\ny = 20' })
    expect(boxed(view)).toEqual(['10'])
    caretOn(view, 3)
    expect(boxed(view)).toEqual(['20'])
  })

  it('a read-only editor shows no value boxes, even on the error line', () => {
    const doc = 'x = 10\ny = 20'
    const { view } = makeView({ doc, extra: EditorState.readOnly.of(true) })
    view.dispatch({ effects: setErrorLine.of(2) })
    expect(boxed(view)).toEqual([])
  })

  it('the error line after a failed run shows its boxes too, until the code changes', () => {
    const { view } = makeView({ doc: 'x = 10\nbackground("navy")\ny = 20' })
    caretOn(view, 1)
    view.dispatch({ effects: setErrorLine.of(3) })
    expect(boxed(view)).toEqual(['10', '20'])
    view.dispatch({ changes: { from: view.state.doc.length, insert: ' ' } })
    expect(boxed(view)).toEqual(['10'])
  })

  it("a tap on another line's number still opens its control and moves the caret there", () => {
    vi.useFakeTimers()
    const { view, handlers } = makeView({ doc: 'x = 10\ny = 20' })
    caretOn(view, 1)
    fakeLayout(view)
    tap(view, 50, 25)
    expect(handlers.openPopover).toHaveBeenCalledWith(
      expect.objectContaining({ literal: expect.objectContaining({ text: '20', line: 2 }) })
    )
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(2)
    expect(boxed(view)).toEqual(['20'])
  })

  it('opening a value in a view-only editor or on a values-locked line leaves the caret be', () => {
    vi.useFakeTimers()
    const doc = 'x = 10\ny = 20'
    const viewOnly = makeView({ doc, extra: EditorView.editable.of(false) })
    const locked = makeView({ doc, locks: [[{ line: 2, target: 'y = 20', values: true }]] })
    for (const { view, handlers, selections } of [viewOnly, locked]) {
      caretOn(view, 1)
      selections.length = 0
      fakeLayout(view)
      tap(view, 50, 25)
      expect(handlers.openPopover).toHaveBeenCalledTimes(1)
      expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(1)
      expect(selections).toEqual([])
    }
  })

  it('a colour swatch sits after its word, so showing it never moves the word', () => {
    vi.useFakeTimers()
    const { view, handlers } = makeView({ doc: 'background("navy")\nfill("red")' })
    caretOn(view, 1)
    const swatch = view.dom.querySelector('.cm-scrubSwatch')
    expect(swatch.previousSibling.textContent).toBe('navy')
    fakeLayout(view)
    // "navy" is columns 12-16 (x 120-160): just past its end, over the swatch, still picks it ...
    view.posAtCoords = () => 13
    tap(view, 165, 15)
    expect(handlers.openPopover).toHaveBeenCalledTimes(1)
    // ... but just before its start does not, and "red" (columns 6-9, no swatch) ends at its word.
    tap(view, 110, 15)
    view.posAtCoords = () => view.state.doc.line(2).from + 7
    tap(view, 100, 25)
    expect(handlers.openPopover).toHaveBeenCalledTimes(1)
  })

  it("the task's scrub switch off still turns every value box off", () => {
    const { view } = makeView({ scrub: null, doc: 'x = 10' })
    caretOn(view, 1)
    expect(boxed(view)).toEqual([])
  })
})
