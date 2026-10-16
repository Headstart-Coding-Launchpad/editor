// Run-count boxes in the CodeMirror editor (a task's `runCounts`, p6-26, ./runCounts.js): at the
// END of each `#@count` line, a small number box "How many times will this run?" (predict mode,
// before the first Run), then the line's count after a Run: "ran 3 times ✓", "ran 1 time ✗ ·
// you said 3", or (show mode) "ran 3 times". Words and a symbol, never colour alone; screen
// readers hear "Line 3 ran 4 times. You predicted 4: right." The box is at least 44 px on touch
// screens and brings up the number keypad (the shared number-answer rules,
// ./variablesPanel/answerFields.js).
//
// The widgets are decorations, not part of the document, so they never reach the student's code,
// the clipboard or the undo history. They follow their line through edits (like the #@peek band,
// ./peekBandEditor.js) and go when it is deleted; the caller re-places them from the code
// (getRunCountWidgets in ./runCounts.js, which re-anchors the marks by line text).
//
// Dispatch `setRunCountWidgets.of({ mode, readOnly, marks: [{ key, line, value, count, correct,
// editable }] })` (1-based lines) to place them; null clears them. Typing reaches
// `handlersRef.current.onChange(key, text)` (digits only) and leaving the box
// `handlersRef.current.onCommit()`.
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { lineRemoved } from './codemirror'
import { RUN_COUNT_BOX_LABEL, describeRunCount, ranTimesText } from './runCounts.js'
import { numberInputAttributes, sanitizeNumberText } from './variablesPanel/answerFields.js'

export const setRunCountWidgets = StateEffect.define()

const MARK_FIELDS = ['key', 'value', 'count', 'correct', 'editable']

// Holds `{ mode, readOnly, marks: [{ pos, key, value, count, correct, editable }] }` (`pos` the
// start of the marked line) or null.
export const runCountsField = StateField.define({
  create() {
    return null
  },
  update(current, transaction) {
    let next = current
    if (transaction.docChanged && current) {
      const marks = []
      for (const mark of current.marks) {
        const line = transaction.startState.doc.lineAt(mark.pos)
        if (lineRemoved(transaction.changes, line.from, line.to)) continue
        const mapped = transaction.changes.mapPos(line.from, 1)
        marks.push({ ...mark, pos: transaction.state.doc.lineAt(mapped).from })
      }
      next = { ...current, marks }
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setRunCountWidgets)) continue
      const value = effect.value
      const { doc } = transaction.state
      next =
        value && Array.isArray(value.marks)
          ? {
              mode: value.mode === 'show' ? 'show' : 'predict',
              readOnly: !!value.readOnly,
              marks: value.marks
                .filter((mark) => Number.isInteger(mark?.line) && mark.line >= 1)
                .filter((mark) => mark.line <= doc.lines)
                .map((mark) => ({
                  pos: doc.line(mark.line).from,
                  ...Object.fromEntries(MARK_FIELDS.map((field) => [field, mark[field] ?? null])),
                })),
            }
          : null
    }
    return next
  },
})

/** The widgets a state shows, as dispatched (lines, not positions), or null. */
export function getRunCountsState(state) {
  const current = state.field(runCountsField, false)
  if (!current) return null
  return {
    mode: current.mode,
    readOnly: current.readOnly,
    marks: current.marks.map(({ pos, ...mark }) => ({
      ...mark,
      line: state.doc.lineAt(pos).number,
    })),
  }
}

/**
 * What one marked line shows: 'input' (the box), 'result' (after a Run), 'said' (a prediction
 * with no count yet: a tutor's or Go Live view, or a run in progress) or null (nothing).
 */
export function runCountWidgetKind(mark, mode, readOnly) {
  if (Number.isInteger(mark?.count)) return 'result'
  if (mode !== 'predict') return null
  if (mark?.editable && !readOnly) return 'input'
  if (String(mark?.value ?? '').trim() || readOnly) return 'said'
  return null
}

/** The visible words after a Run: "ran 3 times ✓", "ran 1 time ✗ · you said 3", "ran 3 times". */
export function runCountResultText(mark, mode) {
  const ran = ranTimesText(mark.count)
  const typed = String(mark.value ?? '').trim()
  if (mode !== 'predict' || !typed || mark.correct == null) return ran
  return mark.correct ? `${ran} ✓` : `${ran} ✗ · you said ${typed}`
}

function srOnly(text) {
  const span = document.createElement('span')
  span.className = 'cm-runCount-sr'
  span.textContent = text
  return span
}

class RunCountWidget extends WidgetType {
  constructor(mark, line, mode, readOnly, handlersRef) {
    super()
    this.mark = mark
    this.line = line
    this.mode = mode
    this.readOnly = readOnly
    this.kind = runCountWidgetKind(mark, mode, readOnly)
    this.handlersRef = handlersRef
  }

  eq(other) {
    return (
      other.kind === this.kind &&
      other.line === this.line &&
      other.mode === this.mode &&
      MARK_FIELDS.every((field) => other.mark[field] === this.mark[field])
    )
  }

  // While the student types, only the box's value changes: keep the same input (and its focus).
  updateDOM(dom) {
    if (this.kind !== 'input' || dom.dataset.kind !== 'input') return false
    if (dom.dataset.runCountKey !== this.mark.key) return false
    const input = dom.querySelector('input')
    if (!input) return false
    const value = String(this.mark.value ?? '')
    if (input.value !== value && document.activeElement !== input) input.value = value
    return true
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-runCount'
    wrap.dataset.runCountKey = this.mark.key
    wrap.dataset.kind = this.kind ?? 'none'
    if (this.kind === 'input') {
      const ask = document.createElement('span')
      ask.className = 'cm-runCount-ask'
      ask.setAttribute('aria-hidden', 'true')
      ask.textContent = 'how many times?'
      const input = document.createElement('input')
      input.className = 'cm-runCountInput'
      for (const [name, value] of Object.entries(numberInputAttributes({ whole: true }))) {
        input.setAttribute(name, value)
      }
      input.setAttribute('aria-label', RUN_COUNT_BOX_LABEL)
      input.title = RUN_COUNT_BOX_LABEL
      input.placeholder = '?'
      input.value = String(this.mark.value ?? '')
      const key = this.mark.key
      input.addEventListener('input', () => {
        const clean = sanitizeNumberText(input.value, { whole: true }).slice(0, 4)
        if (clean !== input.value) input.value = clean
        this.handlersRef?.current?.onChange?.(key, clean)
      })
      input.addEventListener('blur', () => this.handlersRef?.current?.onCommit?.())
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          input.blur()
        }
      })
      wrap.append(ask, input)
      return wrap
    }
    if (this.kind === 'result') {
      const typed = String(this.mark.value ?? '').trim()
      const verdict =
        this.mode === 'predict' && typed && this.mark.correct != null
          ? this.mark.correct
            ? ' is-right'
            : ' is-wrong'
          : ''
      wrap.className = `cm-runCount cm-runCount-result${verdict}`
      const shown = document.createElement('span')
      shown.setAttribute('aria-hidden', 'true')
      shown.textContent = runCountResultText(this.mark, this.mode)
      wrap.append(
        shown,
        srOnly(
          describeRunCount({
            line: this.line,
            count: this.mark.count,
            value: this.mode === 'predict' ? this.mark.value : '',
            correct: this.mark.correct,
          })
        )
      )
      return wrap
    }
    if (this.kind === 'said') {
      const typed = String(this.mark.value ?? '').trim()
      wrap.className = 'cm-runCount cm-runCount-said'
      wrap.textContent = typed ? `predicted ${typed}` : 'no prediction yet'
      wrap.append(srOnly(` for line ${this.line}`))
      return wrap
    }
    return wrap
  }

  ignoreEvent() {
    return true
  }
}

/**
 * The run-count widgets extension: add it to an editor, then dispatch setRunCountWidgets.
 * `handlersRef.current` is `{ onChange(key, text), onCommit() }` (the student's own editor).
 */
export function runCountsExtension({ handlersRef } = {}) {
  const decorations = EditorView.decorations.compute([runCountsField], (state) => {
    const current = state.field(runCountsField, false)
    if (!current || current.marks.length === 0) return Decoration.none
    const ranges = []
    for (const mark of [...current.marks].sort((a, b) => a.pos - b.pos)) {
      const line = state.doc.lineAt(mark.pos)
      if (!runCountWidgetKind(mark, current.mode, current.readOnly)) continue
      ranges.push(
        Decoration.widget({
          widget: new RunCountWidget(
            mark,
            line.number,
            current.mode,
            current.readOnly,
            handlersRef
          ),
          side: 1,
        }).range(line.to)
      )
    }
    return Decoration.set(ranges, true)
  })
  return [runCountsField, decorations, runCountsTheme]
}

const runCountsTheme = EditorView.baseTheme({
  '.cm-runCount': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '1.5em',
    padding: '0 6px',
    borderRadius: '6px',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    fontSize: '0.8em',
    fontWeight: '700',
    lineHeight: '1.6',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    color: '#4c1d95',
  },
  '.cm-runCount-ask': {
    fontWeight: '600',
    color: '#5b21b6',
  },
  '.cm-runCountInput': {
    width: '3.5em',
    minHeight: '1.8em',
    padding: '0 4px',
    boxSizing: 'border-box',
    border: '2px solid #6d28d9',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1em',
    fontWeight: '700',
    textAlign: 'center',
  },
  '.cm-runCountInput:focus-visible': {
    outline: '3px solid #6d28d9',
    outlineOffset: '1px',
  },
  '.cm-runCount-result': {
    background: '#f5f3ff',
    border: '1px solid #c4b5fd',
  },
  '.cm-runCount-result.is-right': {
    background: 'var(--colour-success-bg, #ecfdf5)',
    borderColor: 'var(--colour-success-edge, #34d399)',
    color: 'var(--colour-success-text, #065f46)',
  },
  '.cm-runCount-result.is-wrong': {
    background: 'var(--colour-warning-bg, #fffbeb)',
    borderColor: 'var(--colour-warning-edge, #f59e0b)',
    color: 'var(--colour-warning-text, #92400e)',
  },
  '.cm-runCount-said': {
    fontWeight: '600',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  '.cm-runCount-sr': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  },
  // Touch screens: the box is a 44 px target.
  '@media (pointer: coarse)': {
    '.cm-runCountInput': {
      minHeight: '44px',
      minWidth: '44px',
      width: '4em',
    },
  },
})
