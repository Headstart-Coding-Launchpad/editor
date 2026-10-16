import { describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { python } from '@codemirror/lang-python'
import {
  findVariableOccurrences,
  setVariableLinks,
  variableLinksExtension,
} from '../variableLinksEditor.js'

const CODE = [
  'city = "LEEDS"',
  '# small is a comment',
  'city.lower()',
  'small = city.lower()',
  'print("small", small)',
  'text(small, size=26)',
  'print(f"{small}!")',
].join('\n')

const LINKS = [{ name: 'small', number: 1, colour: '#0b63c4' }]

function stateOf(doc) {
  return EditorState.create({ doc, extensions: [python()] })
}

describe('findVariableOccurrences', () => {
  it('finds only real identifiers: not strings, comments, attributes or keyword names', () => {
    const state = stateOf(CODE)
    const found = findVariableOccurrences(state, new Set(['small', 'size', 'lower']))
    const where = found.map(({ from, name }) => [state.doc.lineAt(from).number, name])
    expect(where).toEqual([
      [4, 'small'],
      [5, 'small'],
      [6, 'small'],
      [7, 'small'],
    ])
  })

  it('finds nothing for no names', () => {
    expect(findVariableOccurrences(stateOf(CODE), new Set())).toEqual([])
  })
})

describe('variableLinksExtension', () => {
  function mount(doc) {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const onActive = vi.fn()
    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [python(), variableLinksExtension({ onActiveRef: { current: onActive } })],
      }),
      parent,
    })
    return { view, parent, onActive }
  }

  it('marks each use with its colour and number, and the active one more strongly', () => {
    const { view, parent } = mount(CODE)
    view.dispatch({ effects: setVariableLinks.of({ links: LINKS, active: null }) })
    const marks = parent.querySelectorAll('.cm-varLink')
    expect(marks.length).toBe(4)
    expect(marks[0].dataset.varNumber).toBe('1')
    expect(marks[0].getAttribute('style')).toContain('#0b63c4')
    expect(parent.querySelector('.cm-varLink--active')).toBeNull()
    view.dispatch({ effects: setVariableLinks.of({ links: LINKS, active: 'small' }) })
    expect(parent.querySelectorAll('.cm-varLink--active').length).toBe(4)
    // Marks are styling only: the document never changes.
    expect(view.state.doc.toString()).toBe(CODE)
    view.destroy()
  })

  it('clears every mark when the links go', () => {
    const { view, parent } = mount(CODE)
    view.dispatch({ effects: setVariableLinks.of({ links: LINKS, active: null }) })
    view.dispatch({ effects: setVariableLinks.of({ links: [], active: null }) })
    expect(parent.querySelector('.cm-varLink')).toBeNull()
    view.destroy()
  })

  it('reports the linked variable the pointer is over', () => {
    const { view, parent, onActive } = mount(CODE)
    view.dispatch({ effects: setVariableLinks.of({ links: LINKS, active: null }) })
    parent
      .querySelector('.cm-varLink')
      .dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(onActive).toHaveBeenLastCalledWith('small')
    view.contentDOM.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(onActive).toHaveBeenLastCalledWith(null)
    view.destroy()
  })
})
