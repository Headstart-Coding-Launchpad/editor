// "You can change this": ONE look for a value the student may change in an otherwise fixed
// place, shared by the editable values of a `#@lock-values` line (P6-22,
// ./lockedLinesEditor.js) and the always-visible marker on every scrubbable number (P6-24,
// ./scrub/scrubExtension.js).
//
// A light box with a dashed outline: the dashed border (a shape, not only a colour) carries it
// for colour-blind students and on a projector. Calm: no animation, drawn with an outline and a
// box shadow so it never changes the line's layout. Deliberately unlike the linked name tags'
// marks (./variableLinksEditor.js: a solid coloured underline, a soft colour wash and a small
// number), so "this is the `small` tag's variable" and "you can change this" never look alike.
import { EditorView } from '@codemirror/view'

export const EDITABLE_VALUE_CLASS = 'cm-editableValue'

// An empty editable string (`name = ""`): a small box between the quote marks to type into.
export const EDITABLE_VALUE_EMPTY_CLASS = 'cm-editableValueEmpty'

export const editableValueTheme = EditorView.baseTheme({
  [`.${EDITABLE_VALUE_CLASS}`]: {
    background: 'rgba(100, 116, 139, 0.08)',
    outline: '1px dashed #64748b',
    outlineOffset: '1px',
    borderRadius: '3px',
  },
  [`.${EDITABLE_VALUE_EMPTY_CLASS}`]: {
    display: 'inline-block',
    width: '0.7em',
    height: '1em',
    verticalAlign: 'text-bottom',
    background: 'rgba(100, 116, 139, 0.08)',
    outline: '1px dashed #64748b',
    outlineOffset: '1px',
    borderRadius: '3px',
    pointerEvents: 'none',
  },
})
