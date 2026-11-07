// The rows of a change view (src/shared/stageChange.js): a Complete stage's changes and the Copy
// the Code panel's anchored lines. Colour is never the only cue: each row has a sign (+, -, →)
// and a word (Add, Remove, Indent, after this line), and a screen-reader label ("added: …",
// "removed: …", "unchanged anchor: …"). Long lines wrap, so the sign and word stay in view.

const ROW_KINDS = {
  add: { sign: '+', tag: 'Add', label: 'added' },
  remove: { sign: '-', tag: 'Remove', label: 'removed' },
  indent: { sign: '→', tag: 'Indent', label: 'indent changed' },
  same: { sign: '', tag: null, label: 'unchanged' },
  anchor: { sign: '', tag: null, label: 'unchanged anchor' },
}

function ChangeRow({ type, text, tag }) {
  const kind = ROW_KINDS[type] ?? ROW_KINDS.same
  const shownTag = tag ?? kind.tag
  return (
    <div role="listitem" aria-label={`${kind.label}: ${text.trim()}`} style={s.row(type)}>
      <span aria-hidden="true" style={s.sign(type)}>
        {kind.sign}
      </span>
      <span aria-hidden="true" style={s.text(type)}>
        {text === '' ? ' ' : text}
      </span>
      {shownTag ? (
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
  const anchorRows = anchor ? <AnchorRows anchor={anchor} /> : null
  return (
    <div style={s.hunk}>
      {rows.length > 0 || anchor ? (
        <div role="list">
          {anchor?.position !== 'before' && anchorRows}
          {rows.map((row, index) => (
            <ChangeRow key={index} type={row.type} text={row.text} />
          ))}
          {anchor?.position === 'before' && anchorRows}
        </div>
      ) : null}
      {indent && <IndentNote indent={indent} />}
    </div>
  )
}

/** The whole program, every line marked (the fall-back and "Show all the code"). */
export function FullChangeRows({ rows }) {
  return (
    <div role="list">
      {rows.map((row, index) => (
        <ChangeRow key={index} type={row.type} text={row.text} />
      ))}
    </div>
  )
}

const ROW_COLOURS = {
  add: { bg: '#dcfce7', bar: '#16a34a', tag: '#15803d' },
  remove: { bg: '#fee2e2', bar: '#dc2626', tag: '#b91c1c' },
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
    padding: '2px 10px 2px 7px',
    background: ROW_COLOURS[type]?.bg,
    borderLeft: `3px solid ${ROW_COLOURS[type]?.bar}`,
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
  }),
  text: (type) => ({
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    // The anchor is shown dimmed, as it is: it's already in the student's code.
    color: type === 'anchor' ? '#64748b' : '#111827',
  }),
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
