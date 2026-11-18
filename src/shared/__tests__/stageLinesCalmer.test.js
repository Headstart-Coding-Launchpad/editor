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
const DOC = `${IMPORT}\nbackground("navy")\n${MOON}`
const LOCKS = [
  [
    { line: 1, target: IMPORT },
    { line: 3, slot: 1, after: 'background("navy")', before: null },
  ],
]
const SCRUB = { numbers: true, colours: true, booleans: true, ranges: [] }
const views = []

function makeView({ scrub = SCRUB, doc = DOC } = {}) {
  const handlers = { openPopover: vi.fn() }
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineHintsExtension(),
        lockedLinesExtension(),
        errorLineField,
        scrubExtension({ config: scrub, language: 'python', handlersRef: { current: handlers } }),
      ],
    }),
    parent: document.body,
  })
  view.dispatch({
    effects: [
      setLineHints.of([{ line: 3, text: 'Draw a white moon in the top right' }]),
      setLockedLineSets.of(LOCKS),
    ],
  })
  views.push(view)
  return { view, handlers }
}

const boxed = (view) =>
  [...view.dom.querySelectorAll('.cm-scrubbable')].map((el) => el.textContent)
const caretOn = (view, n) => view.dispatch({ selection: { anchor: view.state.doc.line(n).from } })

afterEach(() => {
  while (views.length) views.pop().destroy()
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

  it('a slot line has no "Write one line here" pill and no dashed outline, just the soft wash', () => {
    const { view } = makeView()
    expect(view.dom.querySelector('.cm-slotTag')).toBeNull()
    expect(view.dom.textContent).not.toContain('Write one line here')
    const slot = view.dom.querySelector('.cm-slotLine')
    expect(slot.textContent).toBe(MOON)
    expect(slot.getAttribute('title')).toBe('This space takes one line')
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    const rule = css.match(/\.cm-slotLine\s*\{[^}]*\}/)[0]
    expect(rule).not.toMatch(/outline|dashed/)
    expect(rule).toMatch(/background-color/)
  })

  it('a locked line shows a lock icon only, labelled Locked', () => {
    const { view } = makeView()
    const tag = view.dom.querySelector('.cm-lockedTag')
    expect(tag.textContent.trim()).toBe('🔒')
    expect(tag.getAttribute('aria-label')).toBe('Locked')
    expect(tag.getAttribute('role')).toBe('img')
    expect(tag.title).toBe('This line is locked')
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

  it('the error line after a failed run shows its boxes too, until the code changes', () => {
    const { view } = makeView({ doc: 'x = 10\nbackground("navy")\ny = 20' })
    caretOn(view, 1)
    view.dispatch({ effects: setErrorLine.of(3) })
    expect(boxed(view)).toEqual(['10', '20'])
    view.dispatch({ changes: { from: 0, insert: '#' } })
    expect(boxed(view)).toEqual(['10'])
  })

  it("a tap on another line's number still opens its control and moves the caret there", () => {
    vi.useFakeTimers()
    try {
      const { view, handlers } = makeView({ doc: 'x = 10\ny = 20' })
      caretOn(view, 1)
      const pos = view.state.doc.line(2).from + 5
      view.posAtCoords = () => pos
      view.coordsAtPos = () => null
      const down = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 5 })
      Object.defineProperty(down, 'pointerType', { value: 'touch' })
      view.contentDOM.dispatchEvent(down)
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 5 }))
      vi.runAllTimers()
      expect(handlers.openPopover).toHaveBeenCalledWith(
        expect.objectContaining({ literal: expect.objectContaining({ text: '20', line: 2 }) })
      )
      expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(2)
      expect(boxed(view)).toEqual(['20'])
    } finally {
      vi.useRealTimers()
    }
  })

  it("the task's scrub switch off still turns every value box off", () => {
    const { view } = makeView({ scrub: null, doc: 'x = 10' })
    caretOn(view, 1)
    expect(boxed(view)).toEqual([])
  })
})
