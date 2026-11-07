// The rows of a change view (src/shared/stageChange.js): a Complete stage's changes and the Copy
// the Code panel's anchored lines. Colour is never the only cue: each row has a sign (+, -, ±, →)
// and a word (Add, Remove, Indent, after this line), and a screen-reader label ("added: …",
// "removed: …", "unchanged anchor: …"). Long lines wrap, so the sign and word stay in view.
// A line that only gains text, or has a small swap (request 135, pairInlineRows), is one row with
// only the changed part marked: added text green, bold and underlined; removed text red and
// struck through; the rest of the line dimmed.

import { useMemo } from 'react'
import { pairInlineRows } from '../../shared/stageChange'

const ROW_KINDS = {
  add: { sign: '+', tag: 'Add', label: 'added' },
  remove: { sign: '-', tag: 'Remove', label: 'removed' },
  // A line with a small swap inside it (inline only).
  change: { sign: '±', tag: null, label: 'changed' },
  indent: { sign: '→', tag: 'Indent', label: 'indent changed' },
  same: { sign: '', tag: null, label: 'unchanged' },
  anchor: { sign: '', tag: null, label: 'unchanged anchor' },
}

// One label per row; the pieces themselves are hidden from screen readers. Each changed piece is
// in quotes, spaces-only pieces are skipped, and the parts are joined by commas:
// 'added: “, x=100”, in the line circle(100, x=100)' or
// 'changed: removed “5”, added “3”, in the line for i in range(3):'.
function inlineLabel(inline, text) {
  const changed = inline.pieces.filter((piece) => piece.type !== 'same' && piece.text.trim())
  const quoted = (piece) => `“${piece.text.trim()}”`
  const parts =
    inline.kind === 'insert'
      ? changed.map(quoted)
      : changed.map((piece) => `${piece.type === 'remove' ? 'removed' : 'added'} ${quoted(piece)}`)
  return `${inline.kind === 'insert' ? 'added' : 'changed'}: ${parts.join(', ')}, in the line ${text.trim()}`
}

function InlinePieces({ pieces }) {
  return pieces.map((piece, index) => (
    <span key={index} style={s.piece[piece.type]}>
      {piece.text}
    </span>
  ))
}

// `locked` / `hint`: the stage's lock tag and author line hint (the whole-program rows only).
// `inline`: the line's own change (inlineLineChange), shown in place of the plain text.
function ChangeRow({ type, text, tag, locked = false, hint = null, inline = null }) {
  const kind = ROW_KINDS[type] ?? ROW_KINDS.same
  const base = inline ? inlineLabel(inline, text) : `${kind.label}: ${text.trim()}`
  const label = `${base}${locked ? ', locked' : ''}${hint ? `, hint: ${hint}` : ''}`
  // A changed line says both words, Remove then Add, as far as it has each.
  const tags = inline
    ? [
        inline.pieces.some((p) => p.type === 'remove') && 'remove',
        inline.pieces.some((p) => p.type === 'add') && 'add',
      ].filter(Boolean)
    : null
  const shownTag = tag ?? kind.tag
  return (
    <div role="listitem" aria-label={label} style={s.row(type)}>
      <span aria-hidden="true" style={s.sign(type)}>
        {kind.sign}
      </span>
      <span aria-hidden="true" style={s.text(type, !!inline)}>
        {inline ? <InlinePieces pieces={inline.pieces} /> : text === '' ? ' ' : text}
        {locked && (
          <span style={s.lockedTag} title="Locked line">
            🔒 Locked
          </span>
        )}
        {hint && (
          <span style={s.lineHint} title={hint}>
            {hint}
          </span>
        )}
      </span>
      {tags ? (
        <span aria-hidden="true" style={s.tags}>
          {tags.map((tagType) => (
            <span key={tagType} style={s.tag(tagType)}>
              {ROW_KINDS[tagType].tag}
            </span>
          ))}
        </span>
      ) : shownTag ? (
        <span aria-hidden="true" style={s.tag(type)}>
          {shownTag}
        </span>
      ) : (
        <span />
      )}
    </div>
  )
}

function AnchorRows({ anchor }) {
  const words = anchor.position === 'before' ? 'before this line' : 'after this line'
  const plural = anchor.position === 'before' ? 'before these lines' : 'after these lines'
  return anchor.lines.map((text, index) => (
    <ChangeRow
      key={`anchor-${index}`}
      type="anchor"
      text={text}
      tag={index === anchor.lines.length - 1 ? (anchor.lines.length > 1 ? plural : words) : null}
    />
  ))
}

function indentNoteTitle(indent) {
  const count = indent.lines.length
  const these = count === 1 ? 'this line' : `these ${count} lines`
  if (indent.direction === 'in') {
    return `Indent ${these}${indent.spaces ? ` (${indent.spaces} spaces in)` : ''}`
  }
  if (indent.direction === 'out') {
    return `Move ${these} back${indent.spaces ? ` (${indent.spaces} spaces out)` : ''}`
  }
  return `Fix the indent on ${these}`
}

function IndentNote({ indent }) {
  return (
    <div style={s.indentNote} role="group" aria-label={indentNoteTitle(indent)}>
      <div style={s.indentTitle}>{indentNoteTitle(indent)}</div>
      <div role="list">
        {indent.lines.map((text, index) => (
          <ChangeRow key={index} type="indent" text={text} tag="" />
        ))}
      </div>
    </div>
  )
}

/** One change: its anchor line(s), its added / removed lines, and any indent note. */
export function ChangeHunk({ anchor = null, rows = [], indent = null }) {
  const paired = useMemo(() => pairInlineRows(rows), [rows])
  const anchorRows = anchor ? <AnchorRows anchor={anchor} /> : null
  return (
    <div style={s.hunk}>
      {rows.length > 0 || anchor ? (
        <div role="list">
          {anchor?.position !== 'before' && anchorRows}
          {paired.map((row, index) => (
            <ChangeRow key={index} type={row.type} text={row.text} inline={row.inline ?? null} />
          ))}
          {anchor?.position === 'before' && anchorRows}
        </div>
      ) : null}
      {indent && <IndentNote indent={indent} />}
    </div>
  )
}

/** The whole program, every line marked (the fall-back and "Show all the code"), with any lock
 * tags and line hints (rows' `locked` / `hint`). */
export function FullChangeRows({ rows }) {
  // (inlineLineChange keeps its answers too, for callers that build `rows` afresh each render.)
  const paired = useMemo(() => pairInlineRows(rows), [rows])
  return (
    <div role="list">
      {paired.map((row, index) => (
        <ChangeRow
          key={index}
          type={row.type}
          text={row.text}
          locked={!!row.locked}
          hint={row.hint ?? null}
          inline={row.inline ?? null}
        />
      ))}
    </div>
  )
}

const ROW_COLOURS = {
  add: { bg: '#dcfce7', bar: '#16a34a', tag: '#15803d' },
  remove: { bg: '#fee2e2', bar: '#dc2626', tag: '#b91c1c' },
  change: { bg: '#f0fdf4', bar: '#14532d', tag: '#15803d' },
  indent: { bg: '#fef9c3', bar: '#ca8a04', tag: '#854d0e' },
  same: { bg: 'transparent', bar: 'transparent', tag: '#475569' },
  anchor: { bg: 'transparent', bar: 'transparent', tag: '#1d4ed8' },
}

const s = {
  hunk: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: (type) => ({
    display: 'grid',
    gridTemplateColumns: '1.4em minmax(0, 1fr) auto',
    alignItems: 'start',
    columnGap: 6,
    padding: type === 'change' ? '2px 10px 2px 5px' : '2px 10px 2px 7px',
    background: ROW_COLOURS[type]?.bg,
    // A changed line (±) has a heavier double bar, so it never reads as a plain line in grey.
    borderLeft:
      type === 'change'
        ? `5px double ${ROW_COLOURS.change.bar}`
        : `3px solid ${ROW_COLOURS[type]?.bar}`,
    fontFamily: 'var(--font-code)',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "calt" 0',
    fontSize: 14,
    lineHeight: 1.5,
  }),
  sign: (type) => ({
    color: ROW_COLOURS[type]?.tag,
    fontWeight: 700,
    textAlign: 'center',
    ...(type === 'change' ? { fontWeight: 800, fontSize: '1.15em', lineHeight: 1.3 } : null),
  }),
  text: (type, inline = false) => ({
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    // The anchor is shown dimmed, as it is: it's already in the student's code (a slate dark
    // enough to read easily, 7:1 on the box). So is the unchanged part of an inline row (its
    // 'same' pieces set their own colour).
    color: type === 'anchor' ? '#475569' : inline ? '#4b5563' : '#111827',
  }),
  // Inline pieces: words and underline or strike as well as colour. The unchanged part is a
  // darker grey than the anchor's so it reads on the green row.
  piece: {
    same: { color: '#4b5563' },
    add: {
      color: '#14532d',
      background: '#bbf7d0',
      fontWeight: 700,
      textDecoration: 'underline',
      textDecorationThickness: 2,
      textUnderlineOffset: 3,
      borderRadius: 3,
    },
    remove: {
      color: '#991b1b',
      background: '#fecaca',
      textDecoration: 'line-through',
      textDecorationThickness: 2,
      borderRadius: 3,
      marginRight: 2,
    },
  },
  tags: { display: 'flex', gap: 4, alignSelf: 'center' },
  tag: (type) => ({
    alignSelf: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1.3,
    padding: '1px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    ...(type === 'anchor'
      ? { color: '#1d4ed8', background: '#dbeafe' }
      : { color: '#ffffff', background: ROW_COLOURS[type]?.tag }),
  }),
  // As SupportStagePanel's whole-program view writes them.
  lockedTag: {
    marginLeft: '1.2em',
    color: '#475569',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85em',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  lineHint: {
    marginLeft: '1.5em',
    color: '#6b7280',
    fontStyle: 'italic',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92em',
  },
  indentNote: {
    margin: '0 10px',
    padding: '6px 0 6px',
    border: '1px solid #facc15',
    borderRadius: 8,
    background: '#fefce8',
  },
  indentTitle: {
    padding: '0 10px 4px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: '#854d0e',
  },
}
