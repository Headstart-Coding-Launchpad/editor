import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

// Runtime error-line highlight: a single whole-line marker showing where the
// student's last Run threw. Cleared automatically the moment the document
// changes (first keystroke after the error), not just on the next Run.
// The scrub value boxes (./scrub/scrubExtension.js) also show on this line.
export const setErrorLine = StateEffect.define()

export const errorLineField = StateField.define({
  create() {
    return Decoration.none
  },
  update(deco, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue
      const line = effect.value
      if (line == null) return Decoration.none
      const maxLine = transaction.state.doc.lines
      const lineNum = Math.min(Math.max(Math.trunc(line), 1), maxLine)
      const lineInfo = transaction.state.doc.line(lineNum)
      return Decoration.set([Decoration.line({ class: 'cm-errorLine' }).range(lineInfo.from)])
    }
    if (transaction.docChanged) return Decoration.none
    return deco
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** The start of the error line, or null when there is none. */
export function errorLineStart(state) {
  const deco = state.field(errorLineField, false)
  if (!deco || deco.size === 0) return null
  return deco.iter().from
}
