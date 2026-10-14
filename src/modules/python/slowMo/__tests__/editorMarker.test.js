import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { buildSlowMoDecorations, setSlowMoMarker, slowMoMarkerField } from '../editorMarker.js'

const doc = EditorState.create({ doc: 'total = 0\nfor n in [4, 7]:\n    total += n\n' }).doc

function decorationsOf(set) {
  const out = []
  set.between(0, doc.length, (from, to, value) => {
    out.push({ from, class: value.spec.class ?? null, widget: !!value.spec.widget })
  })
  return out
}

describe('slow-mo editor marker', () => {
  it('marks the current line and puts the pass counter on the loop header', () => {
    const deco = buildSlowMoDecorations(doc, {
      line: 3,
      passes: [{ line: 2, label: 'pass 1 of 2' }],
    })
    const items = decorationsOf(deco)
    expect(items.filter((item) => item.class === 'cm-slowMoLine')).toHaveLength(1)
    expect(items.filter((item) => item.widget)).toHaveLength(2)
    expect(items.find((item) => item.class === 'cm-slowMoLine').from).toBe(doc.line(3).from)
  })

  it('skips lines outside the code and clears for null', () => {
    expect(buildSlowMoDecorations(doc, { line: 99, passes: [{ line: 0, label: 'x' }] }).size).toBe(
      0
    )
    expect(buildSlowMoDecorations(doc, null).size).toBe(0)
  })

  it('clears itself when the code changes', () => {
    let state = EditorState.create({ doc: doc.toString(), extensions: [slowMoMarkerField] })
    state = state.update({ effects: setSlowMoMarker.of({ line: 1, passes: [] }) }).state
    expect(state.field(slowMoMarkerField).size).toBeGreaterThan(0)
    state = state.update({ changes: { from: 0, insert: '# ' } }).state
    expect(state.field(slowMoMarkerField).size).toBe(0)
  })
})
