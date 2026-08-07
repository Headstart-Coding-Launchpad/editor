import React, { useEffect, useRef } from 'react'
import { useTileDragAndDrop } from '../hooks/useTileDragAndDrop'
import OutputPanel from './OutputPanel'
import CollapsibleIframePreview from './CollapsibleIframePreview'
import { baseStyles as s, interactionStyles as sm, QuestionPanel } from './quiz/quizUtils'
import {
  assembleCodeArrangement, getFragmentCodeById, getLineParts, getLines, getSlotIds, getTaskPool, isArrangementComplete,
} from '../../shared/codeArrange'

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
}) {
  const lines = getLines(task)
  const pool = getTaskPool(task)
  const slotIds = getSlotIds(task)
  const state = selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer) ? selectedAnswer : {}
  const placedIds = new Set(Object.values(state))
  const blocked = !!disabled || running
  const complete = isArrangementComplete(task, state)
  const assembledRef = useRef(null)
  const stateKey = JSON.stringify(state)

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

  const dnd = useTileDragAndDrop({
    blocked,
    getLabelForTile: fragmentId => getFragmentCodeById(task, fragmentId),
  })
  const { draggingTile, dragOverTarget, touchSelectedTile } = dnd
  const activeId = draggingTile || touchSelectedTile

  const remainingCount = slotIds.filter(id => state[id] == null || state[id] === '').length
  const runLabel = running
    ? 'Stop'
    : moduleType === 'python' && pyodideStatus === 'loading'
    ? 'Getting Python ready...'
    : 'Run'

  function renderTargetContent(placedFragment, canReceive, emptyPlaceholder) {
    if (placedFragment) return placedFragment.code
    if (canReceive && !blocked) return touchSelectedTile && !draggingTile ? 'Tap to place' : 'Drop here'
    return emptyPlaceholder
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.fillWrap}>
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
              const placedFragment = pool.find(fragment => fragment.id === placedFragmentId)
              const canReceive = !!(activeId && activeId !== placedFragmentId)
              const isDragHighlight = canReceive && dragOverTarget === slotPart.id && !blocked
              const isTapHighlight = canReceive && !!touchSelectedTile && !draggingTile && !blocked
              return (
                <div key={line.id} style={ca.row}>
                  <div style={ca.rowMain}>
                    <span style={ca.rowIndex}>{index + 1}</span>
                    <div
                      style={{
                        ...ca.slot,
                        ...(placedFragment ? sm.slotFilled : sm.slotEmpty),
                        ...((isDragHighlight || isTapHighlight) ? sm.slotHighlight : {}),
                      }}
                      onDragOver={event => dnd.handleTargetDragOver(event, slotPart.id)}
                      onDragLeave={dnd.clearDragOver}
                      onDrop={event => dnd.handleTargetDrop(event, slotPart.id, state, publishState)}
                      onClick={() => dnd.handleTargetClick(slotPart.id, state, publishState)}
                      draggable={!!placedFragment && !blocked}
                      onDragStart={event => placedFragment && dnd.handleDragStart(event, placedFragmentId)}
                      onDragEnd={dnd.handleDragEnd}
                      title={placedFragment && !blocked ? 'Click to pick this line back up' : undefined}
                    >
                      <span style={ca.slotCode}>{renderTargetContent(placedFragment, canReceive, 'Empty line')}</span>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={line.id} style={ca.row}>
                <div style={ca.rowMain}>
                  <span style={ca.rowIndex}>{index + 1}</span>
                  <div style={ca.inlineLine}>
                    {parts.map((part, partIndex) => part?.type === 'slot' ? (
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
                      />
                    ) : (
                      <span key={partIndex} style={ca.textPart}>{part?.text ?? ''}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {pool.length > 0 && (
          <div style={sm.answerPool} onDragOver={dnd.handlePoolDragOver} onDrop={event => dnd.handlePoolDrop(event, state, publishState)}>
            <div style={sm.poolLabel}>Code tiles</div>
            <div style={sm.poolTiles}>
              {pool.filter(fragment => !placedIds.has(fragment.id)).map(fragment => (
                <button
                  key={fragment.id}
                  type="button"
                  style={{ ...ca.tile, ...((draggingTile === fragment.id || touchSelectedTile === fragment.id) ? sm.tileSelected : {}) }}
                  draggable={!blocked}
                  onDragStart={event => dnd.handleDragStart(event, fragment.id)}
                  onDragEnd={dnd.handleDragEnd}
                  onClick={() => dnd.handleTileClick(fragment.id)}
                  disabled={blocked}
                >
                  {fragment.code}
                </button>
              ))}
              {pool.filter(fragment => !placedIds.has(fragment.id)).length === 0 && (
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
              disabled={!running && (!complete || (moduleType === 'python' && pyodideStatus === 'loading'))}
            >
              {runLabel}
            </button>
            {!complete && (
              <span style={ca.runHint}>
                Fill in every blank to run{remainingCount > 0 ? ` (${remainingCount} left)` : ''}.
              </span>
            )}
          </div>
        )}

        {moduleType === 'html' ? (
          <div style={ca.previewShell}>
            <CollapsibleIframePreview src={iframeSrc} iframeRef={iframeRef} fill collapsed={false} onToggle={() => {}} />
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

// A single inline blank rendered in place within the fixed line text: its
// own small drop target showing the currently placed tile (or "___" while
// empty), drawing from the task's one shared pool like every other slot.
function InlineSlot({ part, pool, state, dnd, blocked, activeId, publishState, renderTargetContent }) {
  const placedFragmentId = state[part.id]
  const placedFragment = pool.find(fragment => fragment.id === placedFragmentId)
  const canReceive = !!(activeId && activeId !== placedFragmentId)
  const isDragHighlight = canReceive && dnd.dragOverTarget === part.id && !blocked
  const isTapHighlight = canReceive && !!dnd.touchSelectedTile && !dnd.draggingTile && !blocked

  return (
    <span
      style={{
        ...ca.inlineSlot,
        ...(placedFragment ? sm.slotFilled : sm.slotEmpty),
        ...((isDragHighlight || isTapHighlight) ? sm.slotHighlight : {}),
      }}
      onDragOver={event => dnd.handleTargetDragOver(event, part.id)}
      onDragLeave={dnd.clearDragOver}
      onDrop={event => dnd.handleTargetDrop(event, part.id, state, publishState)}
      onClick={() => dnd.handleTargetClick(part.id, state, publishState)}
      draggable={!!placedFragment && !blocked}
      onDragStart={event => placedFragment && dnd.handleDragStart(event, placedFragmentId)}
      onDragEnd={dnd.handleDragEnd}
      title={placedFragment && !blocked ? 'Click to pick this tile back up' : 'Drop a tile here'}
    >
      {renderTargetContent(placedFragment, canReceive, '___')}
    </span>
  )
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
    fontFamily: "'JetBrains Mono', monospace",
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
    fontFamily: "'JetBrains Mono', monospace",
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
    fontFamily: "'JetBrains Mono', monospace",
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
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'pre',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
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
  previewShell: {
    minHeight: 220,
    height: 260,
    display: 'flex',
    flexDirection: 'column',
  },
}
