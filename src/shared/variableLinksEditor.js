// Linked name tags in the CodeMirror editor (a task's `showVariables.link`;
// ./variablesPanel/links.js): every real use of a linked variable's name in the code gets its
// tag's colour (a coloured underline and a soft background) and its tag's small number, so the
// `small` tag and the `small` on line 3 match by colour AND number.
//
// - Only real identifiers are marked: the Python syntax tree's VariableName nodes, so a name
//   inside a string or a comment, an attribute after a dot (`city.lower`) or a keyword
//   argument's name (`size=26`) is left alone. An f-string's {name} is code, so it is marked.
// - Marks are styling only (a mark decoration, the number drawn by CSS above the name), so they
//   never shift the line layout, hide the text cursor, or reach the document or undo history.
// - The active link (a tag hovered, focused or tapped, or this variable hovered or holding the
//   text cursor in the code) is marked more strongly. The editor reports its own side through
//   `onActive(name | null)`.
//
// Dispatch `setVariableLinks.of({ links: [{ name, number, colour }], active })` to update.
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

export const setVariableLinks = StateEffect.define()

const EMPTY = Object.freeze({ links: [], active: null })

export const variableLinksField = StateField.define({
  create: () => EMPTY,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setVariableLinks)) continue
      const links = Array.isArray(effect.value?.links) ? effect.value.links : []
      return { links, active: effect.value?.active ?? null }
    }
    return value
  },
})

// How long building the syntax tree for the marks may take before the partial tree is used.
const PARSE_BUDGET_MS = 50

function treeFor(state, upto) {
  return ensureSyntaxTree(state, upto, PARSE_BUDGET_MS) ?? syntaxTree(state)
}

// A VariableName that is a keyword argument's name (`text(t, size=26)`): not the variable.
function isKeywordArgumentName(node) {
  return node.parent?.name === 'ArgList' && node.nextSibling?.name === 'AssignOp'
}

/**
 * The linked variables' real uses between `from` and `to`: `[{ from, to, name }]`, in document
 * order. `names` is a Set of the linked names.
 */
export function findVariableOccurrences(state, names, from = 0, to = state.doc.length) {
  const found = []
  if (!names || names.size === 0) return found
  treeFor(state, to).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'VariableName') return
      const name = state.doc.sliceString(node.from, node.to)
      if (!names.has(name) || isKeywordArgumentName(node.node)) return
      found.push({ from: node.from, to: node.to, name })
    },
  })
  return found
}

function buildDecorations(view) {
  const { links, active } = view.state.field(variableLinksField)
  if (links.length === 0) return Decoration.none
  const byName = new Map(links.map((link) => [link.name, link]))
  const names = new Set(byName.keys())
  const ranges = []
  for (const { from, to } of view.visibleRanges) {
    for (const occurrence of findVariableOccurrences(view.state, names, from, to)) {
      const link = byName.get(occurrence.name)
      ranges.push(
        Decoration.mark({
          class: `cm-varLink${occurrence.name === active ? ' cm-varLink--active' : ''}`,
          attributes: {
            'data-var-link': link.name,
            'data-var-number': String(link.number),
            style: `--var-link: ${link.colour}`,
          },
        }).range(occurrence.from, occurrence.to)
      )
    }
  }
  return Decoration.set(ranges, true)
}

// The linked variable at a document position (the text cursor), or null.
function linkedNameAt(state, pos) {
  const { links } = state.field(variableLinksField)
  if (links.length === 0) return null
  const names = new Set(links.map((link) => link.name))
  const line = state.doc.lineAt(pos)
  const hit = findVariableOccurrences(state, names, line.from, line.to).find(
    (occurrence) => occurrence.from <= pos && pos <= occurrence.to
  )
  return hit?.name ?? null
}

const variableLinksTheme = EditorView.baseTheme({
  '.cm-varLink': {
    position: 'relative',
    textDecoration: 'underline 2px solid var(--var-link)',
    textUnderlineOffset: '3px',
    background: 'color-mix(in srgb, var(--var-link) 12%, transparent)',
    borderRadius: '3px',
  },
  // The tag's number, small and above the end of the name: drawn, not typed, and taking no room.
  '.cm-varLink::after': {
    content: 'attr(data-var-number)',
    position: 'absolute',
    right: '-0.45em',
    top: '-0.7em',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    fontSize: '0.6em',
    fontWeight: '700',
    lineHeight: '1',
    color: 'var(--var-link)',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  '.cm-varLink--active': {
    background: 'color-mix(in srgb, var(--var-link) 30%, transparent)',
    boxShadow: '0 0 0 2px var(--var-link)',
  },
})

/**
 * The linked-tags extension. `onActiveRef.current(name | null)` is told which linked variable
 * the student is pointing at in the code (hover, or the text cursor on it), read at call time.
 */
export function variableLinksExtension({ onActiveRef } = {}) {
  let hovered = null
  let caret = null
  let reported = null
  const report = () => {
    const next = hovered ?? caret
    if (next === reported) return
    reported = next
    onActiveRef?.current?.(next)
  }

  const marks = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view)
      }
      update(update) {
        const changedLinks = update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setVariableLinks))
        )
        if (
          changedLinks ||
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = buildDecorations(update.view)
        }
        if (update.selectionSet || update.docChanged || update.focusChanged || changedLinks) {
          const nextCaret = update.view.hasFocus
            ? linkedNameAt(update.state, update.state.selection.main.head)
            : null
          if (nextCaret !== caret) {
            caret = nextCaret
            // Reported after this update: the owner's state change re-renders the editor.
            queueMicrotask(report)
          }
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )

  return [
    variableLinksField,
    marks,
    variableLinksTheme,
    EditorView.domEventHandlers({
      mouseover(event) {
        const target = event.target?.closest?.('.cm-varLink')
        const name = target?.dataset?.varLink ?? null
        if (name !== hovered) {
          hovered = name
          report()
        }
        return false
      },
      mouseleave() {
        if (hovered != null) {
          hovered = null
          report()
        }
        return false
      },
      blur() {
        if (caret != null) {
          caret = null
          report()
        }
        return false
      },
    }),
  ]
}
