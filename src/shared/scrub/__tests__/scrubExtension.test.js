// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import {
  SCRUB_USER_EVENT,
  beginScrub,
  cancelScrub,
  commitScrub,
  isScrubPreviewUpdate,
  previewScrub,
  scrubExtension,
  scrubLiteralAt,
} from '../scrubExtension.js'

const CONFIG = { numbers: true, colours: true, ranges: [] }
const views = []

function makeView(doc, { config = CONFIG, language = 'python' } = {}) {
  const handlers = { onPreview: vi.fn(), onCommit: vi.fn(), openPopover: vi.fn() }
  const updates = []
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        history(),
        scrubExtension({ config, language, handlersRef: { current: handlers } }),
        EditorView.updateListener.of((update) => updates.push(update)),
      ],
    }),
    parent: document.body,
  })
  views.push(view)
  return { view, handlers, updates }
}

afterEach(() => {
  while (views.length) views.pop().destroy()
})

describe('scrubExtension', () => {
  it('is empty when nothing can be scrubbed', () => {
    expect(scrubExtension({ config: null, language: 'python' })).toEqual([])
    expect(scrubExtension({ config: CONFIG, language: 'javascript' })).toEqual([])
    expect(
      scrubExtension({ config: { numbers: false, colours: false }, language: 'python' })
    ).toEqual([])
  })

  it('finds the literal at a document position, with its line', () => {
    const { view } = makeView('import turtle\nturtle.forward(100)\nturtle.color("red")')
    const number = scrubLiteralAt(view.state, 30, { syntax: 'python', ...CONFIG })
    expect(number).toMatchObject({ kind: 'number', text: '100', from: 29, to: 32, line: 2 })
    const colour = scrubLiteralAt(view.state, 48, { syntax: 'python', ...CONFIG })
    expect(colour).toMatchObject({ kind: 'colour', text: 'red', line: 3 })
    const noColours = scrubLiteralAt(view.state, 48, {
      syntax: 'python',
      ...CONFIG,
      colours: false,
    })
    expect(noColours).toBeNull()
  })

  it('previews without history or edits, then commits one undoable scrub edit', () => {
    const { view, handlers, updates } = makeView('turtle.forward(100)')
    const literal = scrubLiteralAt(view.state, 16, { syntax: 'python', ...CONFIG })
    const session = beginScrub(view, literal)
    previewScrub(view, session, '120')
    previewScrub(view, session, '150')
    expect(view.state.doc.toString()).toBe('turtle.forward(150)')
    expect(updates.filter((u) => u.docChanged).every(isScrubPreviewUpdate)).toBe(true)
    expect(handlers.onPreview).toHaveBeenLastCalledWith(
      'turtle.forward(150)',
      expect.objectContaining({ view })
    )

    updates.length = 0
    expect(commitScrub(view, session)).toBe(true)
    expect(view.state.doc.toString()).toBe('turtle.forward(150)')
    const edits = updates.filter((u) => u.docChanged && !isScrubPreviewUpdate(u))
    expect(edits).toHaveLength(1)
    expect(edits[0].transactions[0].isUserEvent(SCRUB_USER_EVENT)).toBe(true)
    expect(handlers.onCommit).toHaveBeenCalledWith({ kind: 'number' })

    undo(view)
    expect(view.state.doc.toString()).toBe('turtle.forward(100)')
  })

  it('a scrub that ends where it started is not an edit', () => {
    const { view, handlers } = makeView('x = 5')
    const literal = scrubLiteralAt(view.state, 4, { syntax: 'python', ...CONFIG })
    const session = beginScrub(view, literal)
    previewScrub(view, session, '9')
    previewScrub(view, session, '5')
    expect(commitScrub(view, session)).toBe(false)
    expect(handlers.onCommit).not.toHaveBeenCalled()
  })

  it('cancel puts the original value back and previews it again', () => {
    const { view, handlers } = makeView('color("red")')
    const literal = scrubLiteralAt(view.state, 8, { syntax: 'python', ...CONFIG })
    const session = beginScrub(view, literal)
    previewScrub(view, session, 'blue')
    cancelScrub(view, session)
    expect(view.state.doc.toString()).toBe('color("red")')
    expect(handlers.onPreview).toHaveBeenLastCalledWith('color("red")', expect.anything())
    expect(handlers.onCommit).not.toHaveBeenCalled()
  })

  it('follows other edits before the literal, and gives up if the literal itself is edited', () => {
    const { view } = makeView('f(10)')
    const literal = scrubLiteralAt(view.state, 3, { syntax: 'python', ...CONFIG })
    const session = beginScrub(view, literal)
    view.dispatch({ changes: { from: 0, insert: 'go = 1\n' } })
    previewScrub(view, session, '20')
    expect(view.state.doc.toString()).toBe('go = 1\nf(20)')
    view.dispatch({ changes: { from: 9, to: 10, insert: '5' } })
    expect(session.dead).toBe(true)
    expect(commitScrub(view, session)).toBe(false)
  })
})

// P6-24: every scrubbable number is marked without hovering, in the shared "you can change
// this" look (src/shared/editableValueStyle.js).
describe('always-visible marker on scrubbable numbers', () => {
  it('marks each number, and none with numbers off', () => {
    const { view } = makeView('rect(120, 60)\nname = "Sam"')
    const marked = [...view.dom.querySelectorAll('.cm-editableValue.cm-scrubbable')]
    expect(marked.map((el) => el.textContent)).toEqual(['120', '60'])
    const off = makeView('rect(120, 60)', { config: { ...CONFIG, numbers: false } })
    expect(off.view.dom.querySelector('.cm-scrubbable')).toBeNull()
  })
})
