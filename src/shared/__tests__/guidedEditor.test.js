// @vitest-environment jsdom
// The calmer guided code editor (feature/calmer-guided-editor, sketch OK'd by Ryan 25 Nov): the
// Fun moment is "the editor only ever does what it looks like it does". Tap a blank, it is
// selected whole, type, done; the caret never rests on locked text; Enter in a slot goes to the
// next slot; a shaky click never scrubs; hints are chips inside their row. The audit task from
// .claude/scratch/design-review/2026-11-25-guided-editor/probe.mjs, driven through jsdom.
// Real layout (gutter alignment, a real wobbly mouse click) is checked by that probe in a browser.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { stripTaskLineHints, chooseLineHints, getTaskLineHintSets } from '../lineHints.js'
import { getTaskLockSets } from '../lockedLines.js'
import { lineHintsExtension, setLineHints } from '../codemirror.js'
import { lockedLinesExtension, setLockedLineSets } from '../lockedLinesEditor.js'
import { scrubExtension } from '../scrub/scrubExtension.js'

const STARTER = `from stage import *
#@lock
background("midnightblue")

#@lock
ship = "rocket"
fuel = 120

#>Do an if: check the fuel
#@lock-values
if fuel >= 100:
    #@slot
    #>Do: set the ship colour

    #@slot
    #>Do: print a message

    text("go", y=100)
`
const TASK = stripTaskLineHints({ id: 1, codeStages: [{ role: 'starter', code: STARTER }] }, 'python')
const DOC = TASK.codeStages[0].code
const views = []

function makeView({ doc = DOC, scrub = null } = {}) {
  const handlers = { openPopover: vi.fn() }
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineHintsExtension(),
        lockedLinesExtension(),
        scrubExtension({ config: scrub, language: 'python', handlersRef: { current: handlers } }),
        keymap.of([...defaultKeymap, indentWithTab]),
      ],
    }),
    parent: document.body,
  })
  view.dispatch({
    effects: [
      setLineHints.of(chooseLineHints(doc, getTaskLineHintSets(TASK))),
      setLockedLineSets.of(getTaskLockSets(TASK)),
    ],
  })
  views.push(view)
  return { view, handlers }
}

afterEach(() => {
  while (views.length) views.pop().destroy()
  vi.useRealTimers()
})

const line = (view, n) => view.state.doc.line(n)
const IF = 7
const SLOT1 = 8
const SLOT2 = 9
const TEXT = 10
const valueFrom = (view) => line(view, IF).from + line(view, IF).text.indexOf('100')
const sel = (view) => view.state.selection.main
const selected = (view) => view.state.sliceDoc(sel(view).from, sel(view).to)
const lineOf = (view, pos = sel(view).head) => view.state.doc.lineAt(pos).number
const click = (view, pos) => view.dispatch({ selection: { anchor: pos }, userEvent: 'select.pointer' })
const move = (view, pos) => view.dispatch({ selection: { anchor: pos }, userEvent: 'select' })
function key(view, k, opts = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })
  view.contentDOM.dispatchEvent(event)
}
const type = (view, text) =>
  view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.type' })
const note = (view) => view.dom.ownerDocument.querySelector('.cm-lockedNote')

describe('calmer guided editor: the Fun moment', () => {
  it('the audit task anchors as expected', () => {
    const { view } = makeView()
    expect(line(view, IF).text).toBe('if fuel >= 100:')
    expect(line(view, TEXT).text).toBe('    text("go", y=100)')
  })

  it('1. a click on a value field, or anywhere on its line, selects the whole value; typing replaces it', () => {
    const { view } = makeView()
    click(view, valueFrom(view) + 1)
    expect(selected(view)).toBe('100')
    click(view, line(view, IF).to)
    expect(selected(view)).toBe('100')
    type(view, '50')
    expect(line(view, IF).text).toBe('if fuel >= 50:')
  })

  it('1. a second click inside a selected field places the caret there', () => {
    const { view } = makeView()
    click(view, valueFrom(view) + 1)
    click(view, valueFrom(view) + 1)
    expect(sel(view).empty).toBe(true)
    expect(sel(view).head).toBe(valueFrom(view) + 1)
  })

  it('1. Tab on a values line selects the next field, Shift-Tab the one before', () => {
    const { view } = makeView({ doc: DOC.replace('if fuel >= 100:', 'if fuel >= 100 and ship == "rocket":') })
    click(view, valueFrom(view))
    key(view, 'Tab')
    expect(selected(view)).toBe('rocket')
    key(view, 'Tab', { shiftKey: true })
    expect(selected(view)).toBe('100')
    key(view, 'Tab', { shiftKey: true })
    expect(lineOf(view)).toBe(IF)
  })

  it('2. no dead spot after the colon: moving right off the last value goes to the slot', () => {
    const { view } = makeView()
    click(view, valueFrom(view))
    move(view, valueFrom(view) + 3)
    expect(sel(view).head).toBe(valueFrom(view) + 3)
    move(view, line(view, IF).to)
    expect(lineOf(view)).toBe(SLOT1)
  })

  it('2. moving onto a values line from another selects its value whole', () => {
    const { view } = makeView()
    move(view, line(view, 6).from)
    move(view, line(view, IF).from)
    expect(selected(view)).toBe('100')
  })

  it('2. a click on a fully locked line hops to the nearest line that can change', () => {
    const { view } = makeView()
    click(view, line(view, 4).from + 3)
    expect(lineOf(view)).toBe(5)
  })

  it('5. Enter in a slot moves to the next slot, then leaves the last one, adding no line', () => {
    const { view } = makeView()
    const lines = view.state.doc.lines
    click(view, line(view, SLOT1).to)
    type(view, '    colour = "red"')
    key(view, 'Enter')
    expect(lineOf(view)).toBe(SLOT2)
    key(view, 'Enter')
    expect(lineOf(view)).toBe(TEXT)
    expect(view.state.doc.lines).toBe(lines)
  })

  it('5. Enter after the colon of a values line goes into the slot below, adding no line', () => {
    const { view } = makeView()
    const lines = view.state.doc.lines
    view.dispatch({ selection: { anchor: line(view, IF).to } })
    key(view, 'Enter')
    expect(lineOf(view)).toBe(SLOT1)
    expect(view.state.doc.lines).toBe(lines)
  })

  it('5. select-and-delete across both slots clears their text instead of being dropped', () => {
    const { view } = makeView()
    click(view, line(view, SLOT1).to)
    type(view, '    a = 1')
    view.dispatch({ selection: { anchor: line(view, SLOT2).from } })
    type(view, '    b = 2')
    const lines = view.state.doc.lines
    view.dispatch({
      changes: { from: line(view, SLOT1).from, to: line(view, SLOT2).to },
      userEvent: 'delete.selection',
    })
    expect(line(view, SLOT1).text).toBe('')
    expect(line(view, SLOT2).text).toBe('')
    expect(view.state.doc.lines).toBe(lines)
  })

  it('6. a refused edit shows a note beside the caret that stays until the next key', () => {
    vi.useFakeTimers()
    const { view } = makeView()
    click(view, valueFrom(view))
    type(view, 'x')
    expect(line(view, IF).text).toBe('if fuel >= 100:')
    expect(note(view)).not.toBeNull()
    vi.advanceTimersByTime(10000)
    expect(note(view)).not.toBeNull()
    key(view, 'Shift')
    expect(note(view)).toBeNull()
  })

  it('7. the touch keyboard stays shut wherever the caret sits on locked text', () => {
    const { view } = makeView()
    view.dispatch({ selection: { anchor: line(view, IF).to } })
    expect(view.contentDOM.getAttribute('inputmode')).toBe('none')
    view.dispatch({ selection: { anchor: valueFrom(view) + 1 } })
    expect(view.contentDOM.getAttribute('inputmode')).toBeNull()
  })
})

describe('calmer guided editor: slots and hint chips', () => {
  it('4. a hint is a chip inside its own row, never a block between lines', () => {
    const { view } = makeView()
    expect(view.dom.querySelector('.cm-lineHintNote')).toBeNull()
    const rows = [...view.dom.querySelectorAll('.cm-line')]
    const chip = rows[SLOT1 - 1].querySelector('.cm-lineHintChip')
    expect(chip.textContent).toBe('Hint: Do: set the ship colour')
    expect(rows[IF - 1].querySelector('.cm-lineHintChip').textContent).toBe(
      'Hint: Do an if: check the fuel'
    )
    expect(rows).toHaveLength(view.state.doc.lines)
  })

  it('4. an empty slot reads "your line goes here"; tapping its chip focuses the slot', () => {
    const { view } = makeView()
    const row = [...view.dom.querySelectorAll('.cm-line')][SLOT2 - 1]
    expect(row.textContent).toContain('your line goes here')
    const chip = row.querySelector('.cm-lineHintChip')
    chip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    expect(lineOf(view)).toBe(SLOT2)
  })
})

describe('calmer guided editor: scrub only from the handle', () => {
  const SCRUB = { numbers: true, colours: true, booleans: true, ranges: [] }
  function pointer(target, type, x, opts = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 75, ...opts })
    Object.defineProperty(event, 'pointerType', { value: opts.pointerType ?? 'mouse' })
    target.dispatchEvent(event)
    return event
  }
  function fakeLayout(view) {
    view.coordsAtPos = (pos) => {
      const l = view.state.doc.lineAt(pos)
      const x = (pos - l.from) * 10
      return { left: x, right: x, top: l.number * 10, bottom: l.number * 10 + 10 }
    }
    view.posAtCoords = ({ x, y }) => {
      const l = view.state.doc.line(Math.floor(y / 10))
      return l.from + Math.max(0, Math.min(l.length, Math.floor(x / 10)))
    }
  }

  it('3. a shaky click on a number (under 8px) never changes it and is not swallowed', () => {
    const { view } = makeView({ scrub: SCRUB })
    view.dispatch({ selection: { anchor: valueFrom(view) } })
    fakeLayout(view)
    const x = (valueFrom(view) - line(view, IF).from) * 10 + 5
    const down = pointer(view.contentDOM, 'pointerdown', x)
    pointer(window, 'pointermove', x + 6)
    pointer(window, 'pointerup', x + 6)
    expect(down.defaultPrevented).toBe(false)
    expect(line(view, IF).text).toBe('if fuel >= 100:')
  })

  it('3. a number field shows a small handle; dragging the handle scrubs', () => {
    const { view } = makeView({ scrub: SCRUB })
    view.dispatch({ selection: { anchor: valueFrom(view) } })
    const handle = view.dom.querySelector('.cm-scrubHandle')
    expect(handle).not.toBeNull()
    pointer(handle, 'pointerdown', 100)
    pointer(window, 'pointermove', 160)
    pointer(window, 'pointerup', 160)
    expect(line(view, IF).text).not.toBe('if fuel >= 100:')
  })

  it('3. on touch a quick tap selects only; a long press opens the slider', () => {
    vi.useFakeTimers()
    const { view, handlers } = makeView({ scrub: SCRUB })
    view.dispatch({ selection: { anchor: valueFrom(view) } })
    fakeLayout(view)
    const x = (valueFrom(view) - line(view, IF).from) * 10 + 5
    pointer(view.contentDOM, 'pointerdown', x, { pointerType: 'touch' })
    pointer(window, 'pointerup', x, { pointerType: 'touch' })
    vi.runAllTimers()
    expect(handlers.openPopover).not.toHaveBeenCalled()
    pointer(view.contentDOM, 'pointerdown', x, { pointerType: 'touch' })
    vi.advanceTimersByTime(600)
    pointer(window, 'pointerup', x, { pointerType: 'touch' })
    vi.runAllTimers()
    expect(handlers.openPopover).toHaveBeenCalledTimes(1)
  })
})
