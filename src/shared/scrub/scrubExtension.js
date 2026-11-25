// CodeMirror 6 extension for live number, colour and True / False scrubbing (a task's `scrub`
// field; ./scrubConfig.js). The shared CodeEditor turns it on through a Compartment
// (./useEditorScrub.jsx).
//
// - A number scrubs only from its small ↔ handle (shown with its box): dragging the handle left
//   / right changes it (./literals.js steps, clamps and formats), a click on it opens the slider.
//   A click on the number itself is a plain click, however shaky (calmer guided editor, 25 Nov).
// - Touch and pen: a long press on a number opens the slider popover; a tap just selects.
//   Clicking or tapping a colour opens the picker.
// - A click or tap on a Python True or False flips it (P6-31): one edit, no popover.
// - Keyboard: Alt-Enter on a number or colour opens its popover (arrow keys move the slider);
//   on a True or False it flips it.
// - The scrubbable values on the line being worked on (the caret's line) and on the error line
//   after a failed run carry the shared "you can change this" box (../editableValueStyle.js),
//   colours a small swatch after the word. Before the student first clicks in, the first line
//   with a value shows them instead; a read-only editor shows none. Other lines stay plain, but
//   their values still work: a tap or click (a long press for a number) opens its control and
//   moves the caret to its line (not in a view-only editor or onto a locked line), so its boxes
//   show (calmer Stage lines, 18 Nov; was every line, P6-24).
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
  flippedBoolean,
  formatScrubNumber,
  literalAtColumn,
  numberStep,
  scrubRangeFor,
  scrubSyntaxFor,
  startsInsideStyle,
  valueForDrag,
} from './literals.js'
import { isFullyLockedPos, isLockedPos } from '../lockedLinesEditor.js'
import { errorLineStart } from '../errorLine.js'
import { EDITABLE_VALUE_CLASS, editableValueTheme } from '../editableValueStyle.js'

/** On a preview change: 'preview' (re-run it) or 'revert' (undoing a preview before the commit). */
export const scrubPreviewAnnotation = Annotation.define()
/** On the committed edit: `{ kind: 'number' | 'colour' | 'boolean', from? }`. */
export const scrubCommitAnnotation = Annotation.define()
/** The committed edit's user event: an 'input' edit, but never typed characters. */
export const SCRUB_USER_EVENT = 'input.scrub'

const DRAG_START_PX = 3
const TAP_SLOP_PX = 10
const LONG_PRESS_MS = 450
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

/**
 * Flips the True / False at `literal` (document positions) as ONE real edit, as a finished
 * scrub. Returns whether it changed (false when the word there is no longer True or False).
 */
export function flipBoolean(view, literal) {
  const text = view.state.doc.sliceString(literal.from, literal.to)
  if (text !== 'True' && text !== 'False') return false
  view.dispatch({
    changes: { from: literal.from, to: literal.to, insert: flippedBoolean(text) },
    userEvent: SCRUB_USER_EVENT,
    annotations: scrubCommitAnnotation.of({ kind: 'boolean', from: literal.from }),
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

// A literal's kind → the scrub option that turns it on.
const KIND_OPTION = { number: 'numbers', colour: 'colours', boolean: 'booleans' }

function lineLiterals(state, line, options) {
  // A locked line (../lockedLinesEditor.js) can't change, so it has nothing to scrub. A
  // values-locked line (#@lock-values) can: its numbers and colours are its values, and its
  // True / False flips (valuesChangeAllowed lets a whole-word flip through).
  if (isFullyLockedPos(state, line.from)) return []
  const inStyle =
    options.syntax === scrubSyntaxFor('html')
      ? startsInsideStyle(
          state.doc.sliceString(Math.max(0, line.from - STYLE_LOOKBACK_CHARS), line.from)
        )
      : false
  return findScrubLiterals(line.text, options.syntax, { inStyle })
    .filter((literal) => options[KIND_OPTION[literal.kind]])
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

// Whether the student has clicked into the editor yet (it then boxes the caret's line).
const setEngaged = StateEffect.define()
const engagedField = StateField.define({
  create: () => false,
  update: (value, tr) => value || tr.effects.some((effect) => effect.is(setEngaged)),
})
const canEdit = (state) => !state.readOnly && state.facet(EditorView.editable)

// The line numbers whose values show their boxes: the caret's (before the first click, the first
// line with a value) and the error line's; none in a read-only editor.
function boxedLines(state, options) {
  const lines = new Set()
  if (!canEdit(state)) return lines
  if (state.field(engagedField)) {
    for (const range of state.selection.ranges) lines.add(state.doc.lineAt(range.head).number)
  } else {
    for (let n = 1; n <= state.doc.lines && !lines.size; n += 1) {
      if (lineLiterals(state, state.doc.line(n), options).length) lines.add(n)
    }
  }
  const error = errorLineStart(state)
  if (error != null) lines.add(state.doc.lineAt(error).number)
  return lines
}

// A tapped or dragged value's caret move to its line, so its boxes show: none in a view-only
// editor or onto a locked line (no on-screen keyboard raised there).
function caretMove(state, literal, anchor) {
  if (!canEdit(state) || isLockedPos(state, literal.from)) return []
  const here = state.doc.lineAt(state.selection.main.head).number === literal.line
  return [{ effects: setEngaged.of(true), ...(!here && { selection: { anchor } }) }]
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
    // A shown colour swatch sits just after the literal and counts as part of it.
    const swatch = literal.kind === 'colour' && boxedLines(view.state, options).has(literal.line)
    if (event.clientX < start.left - 2 || event.clientX > end.right + (swatch ? 18 : 2)) return null
    if (event.clientY < start.top - 2 || event.clientY > end.bottom + 2) return null
  }
  return literal
}

// ── Decorations: the value boxes, number handles and colour swatches ───────────────────────

// A colour's swatch (`hex`), or the small ↔ handle of the number starting at `from`: the one
// place a mouse drag scrubs it (a touch tap on it opens the slider; a touch drag scrolls).
class AfterValueWidget extends WidgetType {
  constructor(hex = null, from = null) {
    super()
    Object.assign(this, { hex, from })
  }
  eq(other) {
    return other.hex === this.hex && other.from === this.from
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = this.hex ? 'cm-scrubSwatch' : 'cm-scrubHandle'
    if (this.hex) el.style.background = this.hex
    else Object.assign(el, { textContent: '↔', title: 'Drag to change this number' })
    if (this.from != null) el.dataset.from = this.from
    el.setAttribute('aria-hidden', 'true')
    return el
  }
  ignoreEvent() {
    return false
  }
}

const scrubbableNumberMark = Decoration.mark({
  class: `${EDITABLE_VALUE_CLASS} cm-scrubbable`,
  attributes: { title: 'Drag the ↔ handle to change this number' },
})

// Pickable colours carry the same "you can change this" box as numbers, swatch beside it.
const scrubbableColourMark = Decoration.mark({
  class: `${EDITABLE_VALUE_CLASS} cm-scrubbable`,
  attributes: { title: 'Click or tap to pick a colour' },
})

// A True / False: the same box, with its name, value and what a click does for the title and a
// screen reader ("is_tall_enough, True, press to change to False"). The word itself is shown, so
// it never relies on colour.
function booleanMark(literal) {
  const next = flippedBoolean(literal.text)
  const label = `${literal.name ? `${literal.name}, ` : ''}${literal.text}, press to change to ${next}`
  return Decoration.mark({
    class: `${EDITABLE_VALUE_CLASS} cm-scrubbable cm-scrubBoolean`,
    attributes: {
      title: `Click or tap to change to ${next}`,
      role: 'button',
      'aria-label': label,
    },
  })
}

// Colour swatches and the box on each scrubbable number, colour and True / False of the boxed
// lines (boxedLines).
function swatchDecorations(state, options) {
  const ranges = []
  for (const n of [...boxedLines(state, options)].sort((a, b) => a - b)) {
    for (const literal of lineLiterals(state, state.doc.line(n), options)) {
      if (literal.kind === 'number') {
        if (literal.from < literal.to)
          ranges.push(scrubbableNumberMark.range(literal.from, literal.to))
        const handle = new AfterValueWidget(null, literal.from)
        ranges.push(Decoration.widget({ widget: handle, side: 1 }).range(literal.to))
        continue
      }
      if (literal.kind === 'boolean') {
        ranges.push(booleanMark(literal).range(literal.from, literal.to))
        continue
      }
      // After the word, so showing it never moves the word under a tap.
      if (literal.from < literal.to)
        ranges.push(scrubbableColourMark.range(literal.from, literal.to))
      ranges.push(
        Decoration.widget({ widget: new AfterValueWidget(literal.hex), side: 1 }).range(literal.to)
      )
    }
  }
  return Decoration.set(ranges, true)
}

const scrubTheme = EditorView.baseTheme({
  '&.cm-scrubbing .cm-content': { cursor: 'ew-resize' },
  '.cm-scrubBoolean': { cursor: 'pointer' },
  '.cm-scrubHandle': {
    display: 'inline-block',
    textIndent: 0,
    margin: '0 2px',
    padding: '0 3px',
    borderRadius: '4px',
    background: '#ede9fe',
    color: '#6d28d9 !important',
    fontSize: '0.85em',
    cursor: 'ew-resize',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  '.cm-scrubSwatch': {
    display: 'inline-block',
    width: '0.8em',
    height: '0.8em',
    marginLeft: '3px',
    verticalAlign: '-1px',
    border: '1px solid rgba(0, 0, 0, 0.35)',
    borderRadius: '3px',
    cursor: 'pointer',
  },
})

// ── The extension ───────────────────────────────────────────────────────────────────────────

/**
 * The scrub extension for an editable editor, or [] when nothing can be scrubbed.
 * - `config`: getTaskScrub's `{ numbers, colours, booleans, ranges, checkOnRelease }`.
 * - `language`: the editor language (python, html, css; others are not scrubbed).
 * - `handlersRef.current`: `{ onPreview(code, { view, from }), onCommit({ kind }),
 *   openPopover({ view, literal, range, step, settleSteps }) }`, read at call time so the owner can change them.
 */
export function scrubExtension({ config, language, handlersRef }) {
  const syntax = scrubSyntaxFor(language)
  if (!config || !syntax || (!config.numbers && !config.colours && !config.booleans)) return []
  const options = {
    syntax,
    numbers: !!config.numbers,
    colours: !!config.colours,
    booleans: !!config.booleans,
    ranges: config.ranges ?? [],
    // checkOnRelease: the slider popover keeps each step as an edit, so the checks run on it.
    settleSteps: config.checkOnRelease !== false,
    colourNames: config.colourNames !== false,
  }
  const handlers = () => handlersRef?.current ?? {}

  function popoverRequest(view, literal) {
    if (literal.kind !== 'number')
      return { view, literal, range: null, step: null, colourNames: options.colourNames }
    return {
      view,
      literal,
      range: scrubRangeFor(literal, literal.line, options.ranges),
      step: numberStep(literal),
      settleSteps: options.settleSteps,
    }
  }

  function openPopover(view, literal) {
    const move = caretMove(view.state, literal, literal.to)
    if (move.length) view.dispatch(...move)
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
        const move = caretMove(view.state, literal, literal.from)
        if (move.length) view.dispatch(...move)
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
    function onUp() {
      finish()
      // A click on the handle without a drag opens the slider.
      if (session) commitScrub(view, session)
      else openPopover(view, literal)
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

  // A tap (or a click on a colour or a True / False): pointer up close to where it went down
  // opens the popover, or flips the True / False.
  function trackTap(view, literal, event, quick = false) {
    const startX = event.clientX
    const startY = event.clientY
    const startedAt = Date.now()
    function onUp(e) {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onAbort)
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY)
      const held = Date.now() - startedAt
      if (
        moved > TAP_SLOP_PX ||
        (literal.kind === 'number' && !quick ? held < LONG_PRESS_MS : held > 800)
      )
        return
      if (literal.kind === 'boolean') {
        flipBoolean(view, literal)
        return
      }
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
        this.decorations = swatchDecorations(view.state, options)
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
        // Any transaction (caret, edit, error line, locks, first click, a reconfigure) may change
        // the boxed lines; they never depend on the viewport.
        if (update.transactions.length) {
          this.decorations = swatchDecorations(update.state, options)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )

  return [
    engagedField,
    swatches,
    scrubTheme,
    editableValueTheme,
    EditorView.updateListener.of((update) => {
      for (const tr of update.transactions) {
        const preview = tr.annotation(scrubPreviewAnnotation)
        const commit = tr.annotation(scrubCommitAnnotation)
        if (preview === 'preview' || commit) {
          const session = activeSessions.get(update.view)
          handlers().onPreview?.(update.state.doc.toString(), {
            view: update.view,
            from: session?.from ?? commit?.from ?? update.state.selection.main.head,
          })
        }
        if (commit) handlers().onCommit?.({ kind: commit.kind })
      }
    }),
    EditorView.domEventHandlers({
      focus(_event, view) {
        if (!view.state.field(engagedField)) view.dispatch({ effects: setEngaged.of(true) })
        return false
      },
      pointerdown(event, view) {
        if (event.button !== 0 || view.state.readOnly) return false
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false
        const handle = event.target.closest?.('.cm-scrubHandle')
        const literal = handle
          ? scrubLiteralAt(view.state, Number(handle.dataset.from), options)
          : literalAtPointer(view, event, options)
        if (!literal) return false
        if (handle && event.pointerType !== 'mouse') {
          trackTap(view, literal, event, true)
          return false
        }
        if (handle) {
          event.preventDefault()
          startMouseDrag(view, literal, event)
          return true
        }
        if (literal.kind === 'boolean') {
          // A mouse click flips it without moving the caret or starting a selection.
          if (event.pointerType === 'mouse') event.preventDefault()
          trackTap(view, literal, event)
          return event.pointerType === 'mouse'
        }
        // A mouse click on a number is a plain click; a touch tap is too (a long press opens it).
        if (event.pointerType !== 'mouse' || literal.kind !== 'number')
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
            if (literal.kind === 'boolean') flipBoolean(view, literal)
            else openPopover(view, literal)
            return true
          },
        },
      ])
    ),
  ]
}
