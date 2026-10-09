import React, { useRef, useState } from 'react'
import {
  MAX_INDENT_DEPTH,
  INDENT_STEP,
  getLineDepth,
  getLines,
  isMovableLine,
  setLineDepth,
} from '../../shared/codeArrangeIndent'
import { blockGuideColour, findPythonBlocks, taskShowsBlocks } from '../../shared/blockGuides'
import { useBlockGuidesOn } from '../../shared/blockGuidesSetting'

// code_arrange's indent mode (src/shared/codeArrangeIndent.js): the lines stay in order and the
// student sets each one's depth. A movable line changes depth by dragging it sideways (snapping to
// whole steps), with its ← → buttons, or with ← → while it has focus (↑ ↓ move between lines).
// Locked lines sit greyed at their depth. With the task's block brackets on, each line ending in
// ":" gets the same coloured bracket as the Python editor (src/shared/blockGuides.js), redrawn as
// lines move. Controlled: `state` is the { lineId: depth } map, `onChange` gets the next map on
// every change (a drag reports once, on release). No `onChange` (or `blocked`) is read-only.
export default function CodeArrangeIndentBoard({ task, state, onChange, blocked = false }) {
  const lines = getLines(task)
  const editable = !!onChange && !blocked
  const [blocksOn, setBlocksOn] = useBlockGuidesOn()
  const showBlocks = taskShowsBlocks(task) && blocksOn
  // A sideways drag in progress: { lineId, pointerId, startX, startDepth, depth }.
  const [drag, setDrag] = useState(null)
  const stepRef = useRef(null)
  const chipRefs = useRef({})

  const depthOf = (line) =>
    drag && drag.lineId === line.id ? drag.depth : getLineDepth(line, state)
  const depths = lines.map(depthOf)
  const blocks = showBlocks
    ? findPythonBlocks(
        lines.map((line, i) => INDENT_STEP.repeat(depths[i]) + String(line.code ?? '').trim()),
        { tabSize: INDENT_STEP.length, indentSize: INDENT_STEP.length }
      )
    : []
  const colonColours = new Map(blocks.map((b) => [b.header, blockGuideColour(b.level)]))

  function commit(line, depth) {
    const next = Math.min(Math.max(depth, 0), MAX_INDENT_DEPTH)
    if (next === getLineDepth(line, state)) return
    onChange?.(setLineDepth(state, line.id, next))
  }

  // One indent step in pixels: the width of four code characters.
  function stepPx() {
    return stepRef.current?.getBoundingClientRect().width || 36
  }

  function handlePointerDown(event, line) {
    if (!editable || !isMovableLine(line) || event.button > 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const depth = getLineDepth(line, state)
    setDrag({
      lineId: line.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startDepth: depth,
      depth,
    })
  }

  function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return
    const moved = Math.round((event.clientX - drag.startX) / stepPx())
    const depth = Math.min(Math.max(drag.startDepth + moved, 0), MAX_INDENT_DEPTH)
    if (depth !== drag.depth) setDrag({ ...drag, depth })
  }

  function handlePointerUp(event, line) {
    if (!drag || event.pointerId !== drag.pointerId) return
    const { depth } = drag
    setDrag(null)
    commit(line, depth)
  }

  function focusLine(index, direction) {
    for (let i = index + direction; i >= 0 && i < lines.length; i += direction) {
      if (isMovableLine(lines[i])) {
        chipRefs.current[lines[i].id]?.focus()
        return
      }
    }
  }

  function handleKeyDown(event, line, index) {
    if (!editable) return
    const depth = getLineDepth(line, state)
    if (event.key === 'ArrowRight') commit(line, depth + 1)
    else if (event.key === 'ArrowLeft') commit(line, depth - 1)
    else if (event.key === 'ArrowDown') focusLine(index, 1)
    else if (event.key === 'ArrowUp') focusLine(index, -1)
    else return
    event.preventDefault()
  }

  return (
    <div style={ib.board} data-testid="code-arrange-indent-board">
      <div style={ib.header}>
        <span style={ib.hint}>
          {editable
            ? 'Slide each line left or right to set how far it is indented.'
            : 'Indentation'}
        </span>
        {taskShowsBlocks(task) && (
          <button
            type="button"
            style={{ ...ib.blocksBtn, ...(blocksOn ? ib.blocksBtnOn : null) }}
            aria-pressed={blocksOn}
            title={
              blocksOn
                ? 'Hide the coloured brackets that show which lines belong to each block'
                : 'Show coloured brackets for which lines belong to each block'
            }
            onClick={() => setBlocksOn(!blocksOn)}
          >
            <span aria-hidden="true" style={ib.blocksIcon}>
              ⎣
            </span>
            Blocks
          </button>
        )}
      </div>
      <div style={ib.stack}>
        {/* Measures one indent step (four code characters) for drag snapping. */}
        <span ref={stepRef} style={ib.stepProbe} aria-hidden="true">
          {INDENT_STEP}
        </span>
        {lines.map((line, index) => {
          const n = index + 1
          const depth = depths[index]
          const movable = isMovableLine(line)
          const canMove = editable && movable
          const dragging = drag?.lineId === line.id
          const code = String(line.code ?? '').trim()
          const colonColour = colonColours.get(n)
          const bars = blocks.filter((b) => n >= b.from && n <= b.to)
          return (
            <div key={line.id} style={ib.row}>
              <span style={ib.rowIndex}>{n}</span>
              <div style={ib.track}>
                {bars.map((b) => (
                  <span
                    key={b.header}
                    aria-hidden="true"
                    data-testid="indent-block-bar"
                    style={{
                      ...ib.bar,
                      left: `calc(${b.column}ch + ${CHIP_TEXT_INSET}px)`,
                      background: blockGuideColour(b.level),
                      ...(n === b.to ? { bottom: 4 } : null),
                    }}
                  >
                    {n === b.to && (
                      <span style={{ ...ib.barFoot, background: blockGuideColour(b.level) }} />
                    )}
                  </span>
                ))}
                <div
                  ref={(el) => {
                    chipRefs.current[line.id] = el
                  }}
                  role={movable ? 'slider' : undefined}
                  tabIndex={canMove ? 0 : undefined}
                  aria-label={movable ? `Line ${n}: ${code}` : `Line ${n} (fixed): ${code}`}
                  aria-valuemin={movable ? 0 : undefined}
                  aria-valuemax={movable ? MAX_INDENT_DEPTH : undefined}
                  aria-valuenow={movable ? depth : undefined}
                  aria-valuetext={movable ? `indent ${depth}` : undefined}
                  aria-disabled={movable && !canMove ? true : undefined}
                  className={canMove ? 'act-indent-line' : undefined}
                  style={{
                    ...ib.chip,
                    marginLeft: `${depth * INDENT_STEP.length}ch`,
                    ...(movable ? null : ib.chipLocked),
                    ...(canMove ? ib.chipMovable : null),
                    ...(dragging ? ib.chipDragging : null),
                  }}
                  onPointerDown={(event) => handlePointerDown(event, line)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => handlePointerUp(event, line)}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(event) => handleKeyDown(event, line, index)}
                >
                  {!movable && (
                    <span aria-hidden="true" style={ib.lock} title="This line is fixed">
                      🔒
                    </span>
                  )}
                  <span style={ib.code}>
                    {colonColour && code.endsWith(':') ? (
                      <>
                        {code.slice(0, -1)}
                        <span style={{ color: colonColour, fontWeight: 700 }}>:</span>
                      </>
                    ) : (
                      code
                    )}
                  </span>
                </div>
              </div>
              {canMove && (
                <div style={ib.arrows}>
                  <button
                    type="button"
                    style={ib.arrowBtn}
                    aria-label={`Move line ${n} left`}
                    disabled={depth <= 0}
                    onClick={() => commit(line, depth - 1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    style={ib.arrowBtn}
                    aria-label={`Move line ${n} right`}
                    disabled={depth >= MAX_INDENT_DEPTH}
                    onClick={() => commit(line, depth + 1)}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Where a line's text starts inside its chip (border + left padding), so a bracket sits under the
// first character of its header line.
const CHIP_TEXT_INSET = 12

// JetBrains Mono renders operators like != and <= as ligatures (≠, ≤); students must see the
// literal characters they will type.
const codeFont = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
  fontSize: '0.92rem',
}

const ib = {
  board: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  blocksBtn: {
    height: 32,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
  },
  blocksBtnOn: {
    color: 'var(--colour-primary)',
    background: '#f0eafa',
    borderColor: '#d8c4f5',
  },
  blocksIcon: {
    fontFamily: "'JetBrains Mono', monospace",
    color: '#7c3aed',
    fontWeight: 700,
  },
  stack: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  stepProbe: {
    ...codeFont,
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre',
    pointerEvents: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  rowIndex: {
    flexShrink: 0,
    width: 20,
    textAlign: 'right',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#9ca3af',
  },
  // Holds the chip and the bracket bars; the code font makes `ch` one code character wide.
  track: {
    ...codeFont,
    position: 'relative',
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    overflowX: 'auto',
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    pointerEvents: 'none',
  },
  barFoot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '1ch',
    height: 3,
    borderRadius: 2,
  },
  chip: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    padding: '4px 10px',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    background: '#f9fafb',
    color: 'var(--colour-text)',
    whiteSpace: 'pre',
    userSelect: 'none',
    transition: 'margin-left 0.12s ease-out, box-shadow 0.12s, border-color 0.12s',
  },
  chipMovable: {
    background: '#fff',
    borderColor: '#c4b5fd',
    cursor: 'grab',
    // Vertical swipes still scroll the page; sideways moves the line.
    touchAction: 'pan-y',
  },
  chipLocked: {
    color: '#6b7280',
    background: '#f3f4f6',
    borderStyle: 'dashed',
  },
  chipDragging: {
    cursor: 'grabbing',
    borderColor: '#7c3aed',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
    transition: 'none',
  },
  lock: {
    fontSize: '0.8rem',
  },
  code: {
    whiteSpace: 'pre',
  },
  arrows: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-text)',
    fontSize: '1.1rem',
    cursor: 'pointer',
  },
}
