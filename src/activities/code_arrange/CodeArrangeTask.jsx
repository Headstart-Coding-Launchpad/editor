import React, { useEffect, useRef, useState } from 'react'
import { useTileDragAndDrop } from '../../app/hooks/useTileDragAndDrop'
import OutputPanel from '../../app/components/OutputPanel'
import CollapsibleIframePreview from '../../app/components/CollapsibleIframePreview'
import {
  baseStyles as s,
  interactionStyles as sm,
  QuestionPanel,
} from '../../app/components/quiz/quizUtils'
import {
  assembleCodeArrangement,
  getFragmentCodeById,
  getLineParts,
  getLines,
  getSlotIds,
  getTaskPool,
  getTileFlags,
  isArrangementComplete,
} from '../../shared/codeArrange'
import { isIndentArrangeTask } from '../../shared/codeArrangeIndent'
import CodeArrangeIndentBoard from './CodeArrangeIndentBoard.jsx'
import TutorTileHighlightNote from '../../app/components/quiz/TutorTileHighlightNote.jsx'

// Matches ScratchWorkspace's live-cursor mirror (see CURSOR_THROTTLE_MS /
// CURSOR_STALE_MS there) so both task types feel the same during Go Live.
const DRAG_CURSOR_THROTTLE_MS = 50
const DRAG_CURSOR_STALE_MS = 2000

// Student-facing (and Builder-preview-facing) workspace for the `code_arrange`
// task type. Every authored line is a `parts` sequence (fixed text and
// slots) — a line that's just a single slot with no surrounding text renders
// as a full-width ordered drop-slot (the traditional "whole line" look),
// while a line mixing text and slots renders as fixed text with small inline
// blanks in place. Every blank in the task, whichever style it renders as,
// draws from the one shared "Code tiles" pool below the program — any tile
// can be dropped into any blank.
//
// This component only renders the interaction and reports the current slot
// state / assembled code upward — it never runs code or evaluates checks
// itself. That happens one layer up (CodeArrangeTaskContainer for students,
// CodeArrangeEditor for the Builder preview), which both hand the assembled
// code to the *same* run function and check evaluator a normal python/html
// task uses.
//
// Tile feedback: a tile sitting in a blank where the author marked it known-wrong (a distractor
// anywhere, or one of that blank's `wrongTiles`) turns the blank red with its hint underneath the
// line, the moment it lands (getTileFlags, src/shared/codeArrange.js). Derived from the
// arrangement, so it shows wherever the board does (Builder preview, a teacher's mirror). A right
// tile is never marked: Run stays the only judge of the program.
//
// Tutor highlights (src/shared/tutorTileHighlights.js): a blank the tutor highlighted from
// StudentModal gets the same red outline plus a ring, with "👀 Look again" and the tutor's note
// under the line. `tileHighlights` is { [slotId]: { id, tileId, note } }; `onTargetTap` is
// StudentModal's highlight mode (a tap on a blank highlights it instead of picking the tile up).
//
// An indent-mode task (`arrangeMode: indent`) swaps the program and tile pool
// for CodeArrangeIndentBoard (fixed lines, the student sets each depth); the
// Run row and output below are shared.
export default function CodeArrangeTask({
  task,
  moduleType,
  selectedAnswer,
  onSelectAnswer,
  onAssembledCodeChange,
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  running = false,
  checkPassed = false,
  checkAttempted = false,
  pyodideStatus = 'ready',
  iframeSrc = null,
  iframeRef = null,
  onRun,
  onStop,
  disabled = false,
  showQuestion = false,
  // Live drag mirror for a teacher's "Go Live to Students" broadcast (see
  // CodeArrangeTaskContainer): the interactive side reports its own drag
  // position via onDragCursor, a read-only viewer renders whatever position
  // it's told via externalDragCursor — same split as Scratch's
  // handleScratchCursor / externalCursor.
  onDragCursor,
  externalDragCursor = null,
  tileHighlights = null,
  onTargetTap = null,
}) {
  const indentMode = isIndentArrangeTask(task)
  const lines = getLines(task)
  const pool = getTaskPool(task)
  const slotIds = getSlotIds(task)
  const state =
    selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)
      ? selectedAnswer
      : {}
  const placedIds = new Set(Object.values(state))
  const blocked = !!disabled || running
  const complete = isArrangementComplete(task, state)
  const tileFlags = indentMode ? {} : getTileFlags(task, state)
  const tutorHighlights = (!indentMode && tileHighlights) || {}
  const assembledRef = useRef(null)
  const stateKey = JSON.stringify(state)
  const boardRef = useRef(null)
  const dragCursorRafRef = useRef(null)
  const pendingDragCursorRef = useRef(null)
  const lastDragCursorSentRef = useRef(0)

  useEffect(() => {
    const assembled = assembleCodeArrangement(task, state)
    if (assembled !== null && assembled !== assembledRef.current) {
      assembledRef.current = assembled
      onAssembledCodeChange?.(assembled)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, stateKey])

  function publishState(next) {
    onSelectAnswer?.(next)
  }

  // Reports this dragger's own live position to onDragCursor, rAF+time
  // throttled to match ScratchWorkspace's cursor mirror (see top of file).
  // dragStart bypasses the throttle so the mirror appears the instant a tile
  // is picked up rather than waiting for the first dragover frame.
  function emitDragCursorNow(clientX, clientY, tileId) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    lastDragCursorSentRef.current = Date.now()
    onDragCursor?.({ tileId, x, y, at: lastDragCursorSentRef.current })
  }

  function scheduleDragCursor(clientX, clientY, tileId) {
    if (!onDragCursor) return
    pendingDragCursorRef.current = { clientX, clientY, tileId }
    if (dragCursorRafRef.current) return
    dragCursorRafRef.current = requestAnimationFrame(() => {
      dragCursorRafRef.current = null
      const pending = pendingDragCursorRef.current
      if (!pending || Date.now() - lastDragCursorSentRef.current < DRAG_CURSOR_THROTTLE_MS) return
      emitDragCursorNow(pending.clientX, pending.clientY, pending.tileId)
    })
  }

  const dnd = useTileDragAndDrop({
    blocked,
    getLabelForTile: (fragmentId) => getFragmentCodeById(task, fragmentId),
    onDragStart: (event, tileId) =>
      onDragCursor && emitDragCursorNow(event.clientX, event.clientY, tileId),
    onDragEnd: () => onDragCursor?.(null),
  })
  const { draggingTile, dragOverTarget, touchSelectedTile } = dnd
  // A read-only viewer (teacher Go Live mirror) never has its own
  // draggingTile/touchSelectedTile — this instance's dnd never runs a drag,
  // it only mirrors one. Without externalDragCursor's tileId here, "canReceive"
  // below stays false throughout the whole mirrored drag and every empty slot
  // keeps showing its plain placeholder instead of "Drop here" — the tile
  // visibly floats across the board but nothing on it reacts, which is what
  // looked wrong.
  const activeId = draggingTile || touchSelectedTile || externalDragCursor?.tileId || null

  // A tap on a blank: StudentModal's highlight mode, else the usual pick up / place.
  function handleTargetTap(slotId) {
    if (onTargetTap) onTargetTap(slotId, state[slotId] ?? null)
    else dnd.handleTargetClick(slotId, state, publishState)
  }

  useEffect(
    () => () => {
      if (dragCursorRafRef.current) cancelAnimationFrame(dragCursorRafRef.current)
    },
    []
  )

  // A blank holding a tile id that isn't in the pool shows empty, so it counts as left to fill.
  const remainingCount = slotIds.filter((id) => !pool.some((f) => f.id === state[id])).length
  const pythonLoading = moduleType === 'python' && pyodideStatus === 'loading'
  const pythonFailed = moduleType === 'python' && pyodideStatus === 'error'
  const runLabel = running ? 'Stop' : pythonLoading ? 'Getting Python ready...' : 'Run'

  function renderTargetContent(placedFragment, canReceive, emptyPlaceholder) {
    if (placedFragment) return placedFragment.code
    // A live-mirror viewer is always `blocked` (dropping there must stay
    // impossible), but should still show the invite text while the mirrored
    // drag is active — it's mirroring the teacher's screen, not gating real
    // interaction here.
    if (canReceive && (!blocked || externalDragCursor))
      return touchSelectedTile && !draggingTile ? 'Tap to place' : 'Drop here'
    return emptyPlaceholder
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div
        ref={boardRef}
        style={{ ...sm.fillWrap, position: 'relative' }}
        onDragOver={(event) => {
          if (!draggingTile) return
          event.preventDefault()
          scheduleDragCursor(event.clientX, event.clientY, draggingTile)
        }}
      >
        {externalDragCursor && <DragCursorMirror task={task} cursor={externalDragCursor} />}
        {indentMode && (
          <CodeArrangeIndentBoard
            task={task}
            state={state}
            onChange={onSelectAnswer ? publishState : undefined}
            blocked={blocked}
          />
        )}
        {!indentMode && (
          <div style={ca.programStack}>
            {lines.map((line, index) => {
              const parts = getLineParts(line)
              // A line that's just one blank with no surrounding text renders
              // as the traditional full-width "whole line" slot rather than a
              // cramped inline chip; nothing in the data model distinguishes
              // it — it's purely how a single-slot, text-free line displays.
              const isWholeLineStyle = parts.length === 1 && parts[0]?.type === 'slot'

              if (isWholeLineStyle) {
                const slotPart = parts[0]
                const placedFragmentId = state[slotPart.id]
                const placedFragment = pool.find((fragment) => fragment.id === placedFragmentId)
                const canReceive = !!(activeId && activeId !== placedFragmentId)
                const isDragHighlight = canReceive && dragOverTarget === slotPart.id && !blocked
                const isTapHighlight =
                  canReceive && !!touchSelectedTile && !draggingTile && !blocked
                return (
                  <div key={line.id} style={ca.row}>
                    <div style={ca.rowMain}>
                      <span style={ca.rowIndex}>{index + 1}</span>
                      <div
                        style={{
                          ...ca.slot,
                          ...(placedFragment ? sm.slotFilled : sm.slotEmpty),
                          ...(tileFlags[slotPart.id] ? sm.slotWrong : {}),
                          ...(isDragHighlight || isTapHighlight ? sm.slotHighlight : {}),
                          ...(tutorHighlights[slotPart.id] ? sm.tutorHighlight : {}),
                          ...(onTargetTap ? { cursor: 'pointer' } : {}),
                        }}
                        data-testid={`code-arrange-slot-${slotPart.id}`}
                        data-tile-flagged={tileFlags[slotPart.id] ? 'true' : undefined}
                        data-tutor-highlight={tutorHighlights[slotPart.id] ? 'true' : undefined}
                        aria-invalid={tileFlags[slotPart.id] ? true : undefined}
                        onDragOver={(event) => dnd.handleTargetDragOver(event, slotPart.id)}
                        onDragLeave={dnd.clearDragOver}
                        onDrop={(event) =>
                          dnd.handleTargetDrop(event, slotPart.id, state, publishState)
                        }
                        onClick={() => handleTargetTap(slotPart.id)}
                        draggable={!!placedFragment && !blocked}
                        onDragStart={(event) =>
                          placedFragment && dnd.handleDragStart(event, placedFragmentId)
                        }
                        onDragEnd={dnd.handleDragEnd}
                        title={
                          placedFragment && !blocked ? 'Click to pick this line back up' : undefined
                        }
                      >
                        <span style={ca.slotCode}>
                          {renderTargetContent(placedFragment, canReceive, 'Empty line')}
                        </span>
                      </div>
                    </div>
                    <TileFlagHints parts={parts} pool={pool} tileFlags={tileFlags} />
                    <TutorHighlightHints parts={parts} pool={pool} highlights={tutorHighlights} />
                  </div>
                )
              }

              return (
                <div key={line.id} style={ca.row}>
                  <div style={ca.rowMain}>
                    <span style={ca.rowIndex}>{index + 1}</span>
                    <div style={ca.inlineLine}>
                      {parts.map((part, partIndex) =>
                        part?.type === 'slot' ? (
                          <InlineSlot
                            key={part.id}
                            part={part}
                            pool={pool}
                            state={state}
                            dnd={dnd}
                            blocked={blocked}
                            activeId={activeId}
                            publishState={publishState}
                            renderTargetContent={renderTargetContent}
                            flag={tileFlags[part.id] ?? null}
                            tutorHighlight={tutorHighlights[part.id] ?? null}
                            onTap={handleTargetTap}
                            tapToHighlight={!!onTargetTap}
                          />
                        ) : (
                          <span key={partIndex} style={ca.textPart}>
                            {part?.text ?? ''}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <TileFlagHints parts={parts} pool={pool} tileFlags={tileFlags} />
                  <TutorHighlightHints parts={parts} pool={pool} highlights={tutorHighlights} />
                </div>
              )
            })}
          </div>
        )}

        {!indentMode && pool.length > 0 && (
          <div
            style={sm.answerPool}
            onDragOver={dnd.handlePoolDragOver}
            onDrop={(event) => dnd.handlePoolDrop(event, state, publishState)}
          >
            <div style={sm.poolLabel}>Code tiles</div>
            <div style={sm.poolTiles}>
              {pool
                .filter((fragment) => !placedIds.has(fragment.id))
                .map((fragment) => (
                  <button
                    key={fragment.id}
                    type="button"
                    style={{
                      ...ca.tile,
                      // touchSelectedTile (tap-to-place) is safe to style with the
                      // "lifted" transform/box-shadow look — there's no native OS
                      // drag session in progress. draggingTile must NOT get that
                      // treatment: mutating an element's own transform while it is
                      // the active source of a native HTML5 drag is a known way to
                      // destabilise the drag session in Chromium (the browser keeps
                      // re-hitting-testing the shifted/rescaled box against the
                      // still-tracked grab point) — this is what made dragging feel
                      // "wonky"/position-dependent. The lifted drag-image ghost
                      // (setLiftedDragImage, above) already gives the "picked up"
                      // visual feedback without touching this element.
                      ...(touchSelectedTile === fragment.id ? sm.tileSelected : {}),
                      ...(draggingTile === fragment.id ? ca.tileDragging : {}),
                    }}
                    draggable={!blocked}
                    onDragStart={(event) => dnd.handleDragStart(event, fragment.id)}
                    onDragEnd={dnd.handleDragEnd}
                    onClick={() => dnd.handleTileClick(fragment.id)}
                    disabled={blocked}
                  >
                    {fragment.code}
                  </button>
                ))}
              {pool.filter((fragment) => !placedIds.has(fragment.id)).length === 0 && (
                <span style={sm.poolEmpty}>All tiles placed</span>
              )}
            </div>
          </div>
        )}

        {!disabled && (
          <div style={ca.runRow}>
            <button
              type="button"
              className={running ? 'btn-danger' : 'btn-primary'}
              style={ca.runBtn}
              onClick={running ? onStop : onRun}
              disabled={!running && (!complete || pythonLoading || pythonFailed)}
            >
              {runLabel}
            </button>
            {pythonFailed && !running ? (
              <span style={ca.runError} role="alert">
                Python failed to load. Please refresh the page.
              </span>
            ) : (
              !complete && (
                <span style={ca.runHint}>
                  Fill in every blank to run{remainingCount > 0 ? ` (${remainingCount} left)` : ''}.
                </span>
              )
            )}
          </div>
        )}

        {moduleType === 'html' ? (
          <div style={ca.previewShell}>
            <CollapsibleIframePreview
              src={iframeSrc}
              iframeRef={iframeRef}
              fill
              collapsed={false}
              onToggle={() => {}}
            />
          </div>
        ) : (
          <OutputPanel
            output={output}
            runStatus={runStatus}
            inputPrompt={inputPrompt}
            onInputSubmit={onInputSubmit}
            checkPassed={checkPassed}
            hasCheck={!!task?.check}
            checkAttempted={checkAttempted}
            running={running}
            collapsible={false}
          />
        )}
      </div>
    </div>
  )
}

// Read-only mirror of a remote drag in progress (teacher Go Live viewer):
// a small dot at the reported position plus a floating clone of the tile
// being dragged, so a student watching sees the same motion the teacher's
// own screen shows — not just the slot board snapping once the drag ends.
// Fades out if updates stop arriving (dropped connection, missed drag-end).
function DragCursorMirror({ task, cursor }) {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    setStale(false)
    const remaining = DRAG_CURSOR_STALE_MS - (Date.now() - (cursor?.at ?? 0))
    if (remaining <= 0) {
      setStale(true)
      return undefined
    }
    const t = setTimeout(() => setStale(true), remaining)
    return () => clearTimeout(t)
  }, [cursor?.at])

  if (stale) return null
  const label = getFragmentCodeById(task, cursor.tileId)
  const left = `${cursor.x * 100}%`
  const top = `${cursor.y * 100}%`

  return (
    <>
      <div data-testid="code-arrange-drag-dot" style={{ ...ca.dragDot, left, top }} />
      {label && (
        <div data-testid="code-arrange-drag-ghost" style={{ ...ca.dragGhost, left, top }}>
          {label}
        </div>
      )}
    </>
  )
}

// A single inline blank rendered in place within the fixed line text: its
// own small drop target showing the currently placed tile (or "___" while
// empty), drawing from the task's one shared pool like every other slot.
function InlineSlot({
  part,
  pool,
  state,
  dnd,
  blocked,
  activeId,
  publishState,
  renderTargetContent,
  flag,
  tutorHighlight = null,
  onTap,
  tapToHighlight = false,
}) {
  const placedFragmentId = state[part.id]
  const placedFragment = pool.find((fragment) => fragment.id === placedFragmentId)
  const canReceive = !!(activeId && activeId !== placedFragmentId)
  const isDragHighlight = canReceive && dnd.dragOverTarget === part.id && !blocked
  const isTapHighlight = canReceive && !!dnd.touchSelectedTile && !dnd.draggingTile && !blocked

  return (
    <span
      style={{
        ...ca.inlineSlot,
        ...(placedFragment ? sm.slotFilled : sm.slotEmpty),
        ...(flag ? sm.slotWrong : {}),
        ...(isDragHighlight || isTapHighlight ? sm.slotHighlight : {}),
        ...(tutorHighlight ? sm.tutorHighlight : {}),
      }}
      data-testid={`code-arrange-slot-${part.id}`}
      data-tile-flagged={flag ? 'true' : undefined}
      data-tutor-highlight={tutorHighlight ? 'true' : undefined}
      aria-invalid={flag ? true : undefined}
      onDragOver={(event) => dnd.handleTargetDragOver(event, part.id)}
      onDragLeave={dnd.clearDragOver}
      onDrop={(event) => dnd.handleTargetDrop(event, part.id, state, publishState)}
      onClick={() => onTap(part.id)}
      draggable={!!placedFragment && !blocked}
      onDragStart={(event) => placedFragment && dnd.handleDragStart(event, placedFragmentId)}
      onDragEnd={dnd.handleDragEnd}
      title={
        tapToHighlight
          ? 'Tap to highlight for the student'
          : placedFragment && !blocked
            ? 'Click to pick this tile back up'
            : 'Drop a tile here'
      }
    >
      {renderTargetContent(placedFragment, canReceive, '___')}
    </span>
  )
}

// The hints of a line's flagged blanks, under the line (always visible, no hover, so they work
// on touch). A line with more than one blank names the tile each hint is about.
function TileFlagHints({ parts, pool, tileFlags }) {
  const slots = parts.filter((part) => part?.type === 'slot' && tileFlags[part.id])
  if (slots.length === 0) return null
  const named = parts.filter((part) => part?.type === 'slot').length > 1
  return (
    <div style={ca.flagList} aria-live="polite">
      {slots.map((part) => {
        const flag = tileFlags[part.id]
        const code = pool.find((fragment) => fragment.id === flag.tileId)?.code ?? ''
        return (
          <div key={part.id} style={ca.flagHint} data-testid="code-arrange-tile-hint">
            <span aria-hidden="true" style={ca.flagIcon}>
              ✗
            </span>
            <span>
              {named && code ? <code style={ca.flagCode}>{code}</code> : null}
              {named && code ? ' ' : null}
              {flag.hint}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// "👀 Look again" (and the tutor's note) for each blank of the line the tutor highlighted, under
// the line beside any tile-feedback hint. A line with more than one blank names the tile.
function TutorHighlightHints({ parts, pool, highlights }) {
  const slots = parts.filter((part) => part?.type === 'slot' && highlights[part.id])
  if (slots.length === 0) return null
  const named = parts.filter((part) => part?.type === 'slot').length > 1
  return (
    <div style={ca.flagList} aria-live="polite">
      {slots.map((part) => {
        const highlight = highlights[part.id]
        const code = pool.find((fragment) => fragment.id === highlight.tileId)?.code ?? ''
        return (
          <TutorTileHighlightNote key={part.id} note={highlight.note}>
            {named ? code ? <code style={ca.flagCode}>{code}</code> : 'the empty blank' : null}
          </TutorTileHighlightNote>
        )
      })}
    </div>
  )
}

// JetBrains Mono renders operators like != and <= as ligatures (≠, ≤);
// students must see the literal characters they will type.
const codeFont = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

const ca = {
  programStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  rowMain: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowIndex: {
    flexShrink: 0,
    width: 20,
    marginTop: 8,
    textAlign: 'right',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#9ca3af',
  },
  slot: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    padding: '6px 12px',
    borderRadius: 6,
    border: '2px dashed',
    ...codeFont,
    fontSize: '0.92rem',
    transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  slotCode: {
    whiteSpace: 'pre',
    overflowX: 'auto',
  },
  inlineLine: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
    padding: '6px 12px',
    borderRadius: 6,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    ...codeFont,
    fontSize: '0.92rem',
  },
  textPart: {
    whiteSpace: 'pre',
    color: 'var(--colour-text)',
  },
  inlineSlot: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 26,
    padding: '2px 8px',
    margin: '0 2px',
    borderRadius: 5,
    border: '2px dashed',
    ...codeFont,
    fontSize: '0.9rem',
    whiteSpace: 'pre',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  tile: {
    padding: '8px 14px',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    ...codeFont,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'pre',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
  },
  // Applied to a pool tile only while it is the active source of a native
  // drag — deliberately has no transform/size change (see the comment where
  // this is used) so the browser's hit-testing of the drag origin never
  // shifts mid-gesture. Opacity is safe: it doesn't affect layout geometry.
  tileDragging: {
    opacity: 0.35,
  },
  // Live drag mirror (DragCursorMirror) — colour matches ScratchWorkspace's
  // cursor dot (#7c3aed) so both task types read as the same "teacher is
  // live" affordance.
  dragDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#7c3aed',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  dragGhost: {
    position: 'absolute',
    transform: 'translate(-50%, calc(-100% - 12px))',
    padding: '6px 12px',
    border: '2px solid #7c3aed',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-text)',
    ...codeFont,
    fontSize: '0.85rem',
    whiteSpace: 'pre',
    boxShadow: '0 6px 16px rgba(124, 58, 237, 0.25)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  // Tile-feedback hints: the fill-in-the-blank red (quizStyles slotWrong / fillBlankWrong).
  flagList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginLeft: 30,
  },
  flagHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #fecaca',
    background: '#fee2e2',
    color: '#b91c1c',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.4,
  },
  flagIcon: {
    fontWeight: 700,
    flexShrink: 0,
  },
  flagCode: {
    ...codeFont,
    fontSize: '0.82rem',
    whiteSpace: 'pre',
    padding: '0 4px',
    borderRadius: 3,
    background: 'rgba(255, 255, 255, 0.7)',
  },
  runRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  runBtn: {
    padding: '8px 22px',
    fontSize: 14,
    flexShrink: 0,
  },
  runHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  runError: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#b91c1c',
  },
  previewShell: {
    minHeight: 220,
    height: 260,
    display: 'flex',
    flexDirection: 'column',
  },
}
