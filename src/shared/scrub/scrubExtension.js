// CodeMirror 6 extension for live number and colour scrubbing (a task's `scrub` field;
// ./scrubConfig.js). The shared CodeEditor turns it on through a Compartment (./useEditorScrub.jsx).
//
// - Desktop: hovering a number underlines it with an ew-resize cursor; dragging left / right
//   changes it (./literals.js steps, clamps and formats). Clicking a colour opens the picker.
// - Touch and pen: tapping a number opens a slider popover, tapping a colour the picker.
// - Keyboard: Alt-Enter on a number or colour opens its popover (arrow keys move the slider).
// - Colour literals get a small swatch before them.
//
// While a value is moving the document changes with `scrubPreviewAnnotation` (and no undo
// history): the editor's owner must not treat those as edits (no save, no live write, no typing
// count; see isScrubPreviewUpdate). When the drag or popover ends, the preview is reverted and
// the final value applied as ONE real edit (user event 'input.scrub', one undo step), which the
// editor saves and sends like any other edit.
import { Annotation, Prec, StateEffect, StateField, Transaction } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from '@codemirror/view'
import {
  findScrubLiterals,
  formatScrubNumber,
  literalAtColumn,
  numberStep,
  scrubRangeFor,
  scrubSyntaxFor,
  startsInsideStyle,
  valueForDrag,
} from './literals.js'
import { isLockedPos } from '../lockedLinesEditor.js'

/** On a preview change: 'preview' (re-run it) or 'revert' (undoing a preview before the commit). */
export const scrubPreviewAnnotation = Annotation.define()
/** On the committed edit: `{ kind: 'number' | 'colour' }`. */
export const scrubCommitAnnotation = Annotation.define()
/** The committed edit's user event: an 'input' edit, but never typed characters. */
export const SCRUB_USER_EVENT = 'input.scrub'

const DRAG_START_PX = 3
const TAP_SLOP_PX = 10
// How far back a markup line looks for an open <style> tag.
const STYLE_LOOKBACK_CHARS = 20000

/** Whether a view update is only scrub previews (the owner skips its change handling). */
export function isScrubPreviewUpdate(update) {
  const transactions = update?.transactions ?? []
  return (
    transactions.some((tr) => tr.annotation(scrubPreviewAnnotation) != null) &&
    transactions.every((tr) => !tr.docChanged || tr.annotation(scrubPreviewAnnotation) != null)
  )
}

// ── Sessions: one value being scrubbed in a view ────────────────────────────────────────────

const activeSessions = new WeakMap()

/** Starts scrubbing `literal` (document positions): returns the session the calls below take. */
export function beginScrub(view, literal) {
  const session = {
    from: literal.from,
    original: literal.text,
    current: literal.text,
    kind: literal.kind,
    dead: false,
  }
  activeSessions.set(view, session)
  return session
}

/** Shows `text` in place of the literal as a preview (not an edit). */
export function previewScrub(view, session, text) {
  if (!session || session.dead || text === session.current) return
  view.dispatch({
    changes: { from: session.from, to: session.from + session.current.length, insert: text },
    annotations: [scrubPreviewAnnotation.of('preview'), Transaction.addToHistory.of(false)],
  })
  session.current = text
}

function endSession(view, session) {
  if (activeSessions.get(view) === session) activeSessions.delete(view)
}

/**
 * Ends the session, keeping its value as one real edit. Returns whether anything changed (a
 * value dragged back to where it started is not an edit).
 */
export function commitScrub(view, session) {
  if (!session) return false
  endSession(view, session)
  if (session.dead || session.current === session.original) {
    session.dead = true
    return false
  }
  const { from, original, current } = session
  session.dead = true
  view.dispatch({
    changes: { from, to: from + current.length, insert: original },
    annotations: [scrubPreviewAnnotation.of('revert'), Transaction.addToHistory.of(false)],
  })
  view.dispatch({
    changes: { from, to: from + original.length, insert: current },
    userEvent: SCRUB_USER_EVENT,
    annotations: scrubCommitAnnotation.of({ kind: session.kind }),
  })
  return true
}

/** Ends the session, putting the original value back (and previewing it again). */
export function cancelScrub(view, session) {
  if (!session) return
  endSession(view, session)
  if (session.dead) return
  previewScrub(view, session, session.original)
  session.dead = true
}

// ── Finding literals in the document ────────────────────────────────────────────────────────

function lineLiterals(state, line, options) {
  // A locked line (../lockedLinesEditor.js) can't change, so it has nothing to scrub.
  if (isLockedPos(state, line.from)) return []
  const inStyle =
    options.syntax === scrubSyntaxFor('html')
      ? startsInsideStyle(
          state.doc.sliceString(Math.max(0, line.from - STYLE_LOOKBACK_CHARS), line.from)
        )
      : false
  return findScrubLiterals(line.text, options.syntax, { inStyle })
    .filter((literal) => (literal.kind === 'number' ? options.numbers : options.colours))
    .map((literal) => ({
      ...literal,
      from: line.from + literal.from,
      to: line.from + literal.to,
      line: line.number,
    }))
}

/** The scrubbable literal at a document position (with `line`, document from / to), or null. */
export function scrubLiteralAt(state, pos, options) {
  const line = state.doc.lineAt(pos)
  const literals = lineLiterals(state, line, options).map((literal) => ({
    ...literal,
    from: literal.from - line.from,
    to: literal.to - line.from,
  }))
  const found = literalAtColumn(literals, pos - line.from)
  return found ? { ...found, from: found.from + line.from, to: found.to + line.from } : null
}

// The literal under a pointer, only when the pointer is over its text (not past a line's end).
function literalAtPointer(view, event, options) {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos == null) return null
  const literal = scrubLiteralAt(view.state, pos, options)
  if (!literal) return null
  const start = view.coordsAtPos(literal.from, 1)
  const end = view.coordsAtPos(literal.to, -1)
  if (start && end) {
    // The colour swatch sits just before the literal and counts as part of it.
    const left = start.left - (literal.kind === 'colour' ? 18 : 2)
    if (event.clientX < left || event.clientX > end.right + 2) return null
    if (event.clientY < start.top - 2 || event.clientY > end.bottom + 2) return null
  }
  return literal
}

// ── Decorations: the hovered literal and colour swatches ────────────────────────────────────

const setHover = StateEffect.define()

const hoverField = StateField.define({
  create: () => ({ literal: null, deco: Decoration.none }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setHover)) continue
      const literal = effect.value
      if (!literal) return { literal: null, deco: Decoration.none }
      const max = tr.state.doc.length
      if (literal.to > max || literal.from >= literal.to) return value
      const cls = literal.kind === 'number' ? 'cm-scrubNumber' : 'cm-scrubColour'
      return {
        literal,
        deco: Decoration.set([Decoration.mark({ class: cls }).range(literal.from, literal.to)]),
      }
    }
    if (tr.docChanged) {
      return value.literal ? { literal: null, deco: Decoration.none } : value
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
})

class SwatchWidget extends WidgetType {
  constructor(hex) {
    super()
    this.hex = hex
  }
  eq(other) {
    return other.hex === this.hex
  }
  toDOM() {
    const swatch = document.createElement('span')
    swatch.className = 'cm-scrubSwatch'
    swatch.style.background = this.hex
    swatch.setAttribute('aria-hidden', 'true')
    return swatch
  }
  ignoreEvent() {
    return false
  }
}

function swatchDecorations(view, options) {
  if (!options.colours) return Decoration.none
  const ranges = []
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      for (const literal of lineLiterals(view.state, line, options)) {
        if (literal.kind !== 'colour') continue
        ranges.push(
          Decoration.widget({ widget: new SwatchWidget(literal.hex), side: -1 }).range(literal.from)
        )
      }
      pos = line.to + 1
    }
  }
  return Decoration.set(ranges, true)
}

const scrubTheme = EditorView.baseTheme({
  '.cm-scrubNumber': {
    cursor: 'ew-resize',
    textDecoration: 'underline dotted #7c3aed',
    textUnderlineOffset: '3px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '3px',
  },
  '.cm-scrubColour': {
    cursor: 'pointer',
    textDecoration: 'underline dotted #7c3aed',
    textUnderlineOffset: '3px',
  },
  '&.cm-scrubbing .cm-content, &.cm-scrubbing .cm-scrubNumber': { cursor: 'ew-resize' },
  '.cm-scrubSwatch': {
    display: 'inline-block',
    width: '0.8em',
    height: '0.8em',
    marginRight: '3px',
    verticalAlign: '-1px',
    border: '1px solid rgba(0, 0, 0, 0.35)',
    borderRadius: '3px',
    cursor: 'pointer',
  },
})

// ── The extension ───────────────────────────────────────────────────────────────────────────

/**
 * The scrub extension for an editable editor, or [] when nothing can be scrubbed.
 * - `config`: getTaskScrub's `{ numbers, colours, ranges }`.
 * - `language`: the editor language (python, html, css; others are not scrubbed).
 * - `handlersRef.current`: `{ onPreview(code, { view, from }), onCommit({ kind }),
 *   openPopover({ view, literal, range, step }) }`, read at call time so the owner can change them.
 */
export function scrubExtension({ config, language, handlersRef }) {
  const syntax = scrubSyntaxFor(language)
  if (!config || !syntax || (!config.numbers && !config.colours)) return []
  const options = {
    syntax,
    numbers: !!config.numbers,
    colours: !!config.colours,
    ranges: config.ranges ?? [],
  }
  const handlers = () => handlersRef?.current ?? {}

  function popoverRequest(view, literal) {
    if (literal.kind !== 'number') return { view, literal, range: null, step: null }
    return {
      view,
      literal,
      range: scrubRangeFor(literal, literal.line, options.ranges),
      step: numberStep(literal),
    }
  }

  function openPopover(view, literal) {
    view.dispatch({ effects: setHover.of(null) })
    handlers().openPopover?.(popoverRequest(view, literal))
  }

  function startMouseDrag(view, literal, event) {
    const startX = event.clientX
    const range = scrubRangeFor(literal, literal.line, options.ranges)
    const step = numberStep(literal)
    let session = null
    const bodyCursor = document.body.style.cursor

    function finish() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      view.dom.classList.remove('cm-scrubbing')
      document.body.style.cursor = bodyCursor
    }
    function onMove(e) {
      const dx = e.clientX - startX
      if (!session) {
        if (Math.abs(dx) < DRAG_START_PX) return
        session = beginScrub(view, literal)
        view.dom.classList.add('cm-scrubbing')
        document.body.style.cursor = 'ew-resize'
      }
      e.preventDefault()
      previewScrub(
        view,
        session,
        formatScrubNumber(valueForDrag(literal.value, dx, range, step), literal)
      )
    }
    function onUp(e) {
      finish()
      if (session) {
        commitScrub(view, session)
        return
      }
      // A click without a drag places the caret, as a plain click would have.
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos != null) view.dispatch({ selection: { anchor: pos } })
      view.focus()
    }
    function onCancel() {
      finish()
      if (session) cancelScrub(view, session)
    }
    function onKey(e) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey, true)
  }

  // A tap (or a click on a colour): pointer up close to where it went down opens the popover.
  function trackTap(view, literal, event) {
    const startX = event.clientX
    const startY = event.clientY
    const startedAt = Date.now()
    function onUp(e) {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onAbort)
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY)
      if (moved > TAP_SLOP_PX || Date.now() - startedAt > 800) return
      // After CodeMirror has placed the caret for this click.
      setTimeout(() => openPopover(view, literal), 0)
    }
    function onAbort() {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onAbort)
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onAbort)
  }

  const swatches = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = swatchDecorations(view, options)
      }
      update(update) {
        // Keep an active session's position right when something else edits the document.
        const session = activeSessions.get(update.view)
        if (session && update.docChanged) {
          for (const tr of update.transactions) {
            if (!tr.docChanged || tr.annotation(scrubPreviewAnnotation) != null) continue
            if (tr.annotation(scrubCommitAnnotation) != null) continue
            let touched = false
            const end = session.from + session.current.length
            tr.changes.iterChangedRanges((fromA, toA) => {
              if (fromA < end && toA > session.from) touched = true
            })
            if (touched) {
              session.dead = true
              activeSessions.delete(update.view)
              break
            }
            session.from = tr.changes.mapPos(session.from, 1)
          }
        }
        if (update.docChanged || update.viewportChanged) {
          this.decorations = swatchDecorations(update.view, options)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )

  return [
    hoverField,
    swatches,
    scrubTheme,
    EditorView.updateListener.of((update) => {
      for (const tr of update.transactions) {
        const preview = tr.annotation(scrubPreviewAnnotation)
        const commit = tr.annotation(scrubCommitAnnotation)
        if (preview === 'preview' || commit) {
          const session = activeSessions.get(update.view)
          handlers().onPreview?.(update.state.doc.toString(), {
            view: update.view,
            from: session?.from ?? update.state.selection.main.head,
          })
        }
        if (commit) handlers().onCommit?.({ kind: commit.kind })
      }
    }),
    EditorView.domEventHandlers({
      mousemove(event, view) {
        if (event.buttons !== 0 || activeSessions.get(view)) return false
        const literal = literalAtPointer(view, event, options)
        const current = view.state.field(hoverField).literal
        if (literal?.from === current?.from && literal?.to === current?.to) return false
        view.dispatch({ effects: setHover.of(literal) })
        return false
      },
      mouseleave(_event, view) {
        if (view.state.field(hoverField).literal) view.dispatch({ effects: setHover.of(null) })
        return false
      },
      pointerdown(event, view) {
        if (event.button !== 0 || view.state.readOnly) return false
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false
        const literal = literalAtPointer(view, event, options)
        if (!literal) return false
        if (event.pointerType === 'mouse' && literal.kind === 'number') {
          // Cancelling pointerdown stops CodeMirror's mousedown text selection.
          event.preventDefault()
          startMouseDrag(view, literal, event)
          return true
        }
        trackTap(view, literal, event)
        return false
      },
    }),
    Prec.high(
      keymap.of([
        {
          key: 'Alt-Enter',
          run(view) {
            if (view.state.readOnly) return false
            const literal = scrubLiteralAt(view.state, view.state.selection.main.head, options)
            if (!literal) return false
            openPopover(view, literal)
            return true
          },
        },
      ])
    ),
  ]
}
