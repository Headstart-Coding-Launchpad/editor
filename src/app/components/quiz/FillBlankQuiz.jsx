import React, { useMemo } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { useTileDragAndDrop } from '../../hooks/useTileDragAndDrop'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import {
  baseStyles as s,
  fillDragTileMatchesBlank,
  interactionStyles as sm,
  parseFillBlankSegments,
  parseQuizAnswerState,
  QuestionPanel,
  stableHash,
  typedValueMatchesBlank,
} from './quizUtils'

export default function FillBlankQuiz({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted,
  checkPassed,
  disabled,
  showQuestion,
  showResult,
  showCorrectAnswer,
}) {
  const blanks = task?.blanks ?? []
  const mode = task?.mode ?? 'drag'
  const text = task?.text ?? ''
  const distractors = task?.distractors ?? []

  // Unified pool: correct answer tiles + distractor tiles, both normalised to { id, text }
  const tilePool = useMemo(() => {
    const all = [
      ...blanks.map((b) => ({ id: b.id, text: b.answer })),
      ...distractors.map((d) => ({ id: d.id, text: d.text })),
    ]
    return all.sort((a, b) => stableHash(a.text ?? '') - stableHash(b.text ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(blanks), JSON.stringify(distractors)])

  const state = useMemo(() => parseQuizAnswerState(selectedAnswer), [selectedAnswer])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const segments = useMemo(
    () => parseFillBlankSegments(text, blanks),
    [text, JSON.stringify(blanks)]
  )

  const placedIds = new Set(Object.values(state))
  const blocked = disabled || (submitted && checkPassed)

  function publishState(next) {
    const allFilled = blanks.every((b) => next[b.id] !== undefined)
    if (allFilled) {
      const allCorrect = blanks.every((b) => {
        const placedTile = tilePool.find((t) => t.id === next[b.id])
        return fillDragTileMatchesBlank(placedTile, b)
      })
      onSelectAnswer?.(next, allCorrect)
    } else {
      onSelectAnswer?.(next, null)
    }
  }

  const dnd = useTileDragAndDrop({
    blocked,
    dragEnabled: mode === 'drag',
    getLabelForTile: (tileId) => tilePool.find((t) => t.id === tileId)?.text ?? '',
  })
  const { draggingTile, dragOverTarget: dragOverBlank, touchSelectedTile } = dnd

  function handleTypeChange(blankId, value) {
    const next = { ...state, [blankId]: value }
    onSelectAnswer?.(next, null)
  }

  function handleTypeSubmit() {
    const allFilled = blanks.every((b) => String(state[b.id] ?? '').trim())
    if (!allFilled) return
    const allCorrect = blanks.every((b) => {
      return typedValueMatchesBlank(state[b.id], b)
    })
    onSelectAnswer?.(state, allCorrect)
  }

  function renderBlank(blankId, key) {
    const blank = blanks.find((b) => b.id === blankId)
    const placedTileId = state[blankId]
    const placedText = tilePool.find((t) => t.id === placedTileId)?.text
    const activeId = draggingTile || touchSelectedTile
    const canReceive = mode === 'drag' && !!(activeId && activeId !== placedTileId)
    const isDragHighlight = canReceive && dragOverBlank === blankId && !blocked
    const isTapHighlight = canReceive && !!touchSelectedTile && !draggingTile && !blocked
    const hasBlankValue =
      mode === 'drag'
        ? placedTileId !== undefined && placedTileId !== null
        : String(placedTileId ?? '').trim() !== ''
    const isBlankCorrect =
      hasBlankValue &&
      (mode === 'drag'
        ? fillDragTileMatchesBlank(
            tilePool.find((t) => t.id === placedTileId),
            blank
          )
        : typedValueMatchesBlank(placedTileId, blank))
    const isBlankWrong = hasBlankValue && !isBlankCorrect

    if (mode === 'type') {
      return (
        <input
          key={key}
          style={{
            ...sm.fillInput,
            ...(isBlankCorrect ? sm.fillInputCorrect : {}),
            ...(isBlankWrong ? sm.fillInputWrong : {}),
          }}
          value={state[blankId] ?? ''}
          onChange={(e) => handleTypeChange(blankId, e.target.value)}
          disabled={blocked}
          placeholder="..."
        />
      )
    }

    return (
      <span
        key={key}
        style={{
          ...sm.fillBlank,
          ...(placedTileId ? sm.fillBlankFilled : sm.fillBlankEmpty),
          ...(isBlankCorrect ? sm.fillBlankCorrect : {}),
          ...(isBlankWrong ? sm.fillBlankWrong : {}),
          ...(isDragHighlight || isTapHighlight ? sm.fillBlankHighlight : {}),
          cursor: blocked ? 'default' : isTapHighlight || placedTileId ? 'pointer' : 'copy',
        }}
        onDragOver={(event) => dnd.handleTargetDragOver(event, blankId)}
        onDragLeave={dnd.clearDragOver}
        onDrop={(event) => dnd.handleTargetDrop(event, blankId, state, publishState)}
        onClick={() => dnd.handleTargetClick(blankId, state, publishState)}
        draggable={!!placedTileId && !blocked}
        onDragStart={(event) => placedTileId && dnd.handleDragStart(event, placedTileId)}
        onDragEnd={dnd.handleDragEnd}
        title={isBlankWrong && blank ? `Correct: ${blank.answer}` : undefined}
      >
        {placedText ? (
          <span style={sm.fillBlankMarkdown}>
            <InlineMarkdown content={placedText} />
          </span>
        ) : canReceive && !blocked ? (
          touchSelectedTile && !draggingTile ? (
            'Tap to place'
          ) : (
            'Drop here'
          )
        ) : (
          '___'
        )}
      </span>
    )
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.fillWrap}>
        <div style={sm.fillText}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return (
                <span key={i}>
                  <InlineMarkdown content={seg.text} />
                </span>
              )
            }
            if (seg.type === 'code') {
              const mdCode = `\`${seg.lang ? seg.lang + ':' : ''}${seg.text}\``
              return (
                <span key={i}>
                  <InlineMarkdown content={mdCode} />
                </span>
              )
            }
            if (seg.type === 'codeBlock') {
              return (
                <div key={i} style={sm.fillCodeBlock}>
                  <pre style={sm.fillCodeBlockPre}>
                    <code>
                      {seg.parts.map((part, j) =>
                        part.type === 'codeText' ? (
                          <span key={j}>{part.text}</span>
                        ) : (
                          renderBlank(part.blankId, j)
                        )
                      )}
                    </code>
                  </pre>
                </div>
              )
            }
            return renderBlank(seg.blankId, i)
          })}
        </div>

        {mode === 'drag' && (
          <div
            style={sm.answerPool}
            onDragOver={dnd.handlePoolDragOver}
            onDrop={(event) => dnd.handlePoolDrop(event, state, publishState)}
          >
            <div style={sm.poolLabel}>Answer bank</div>
            <div style={sm.poolTiles}>
              {tilePool
                .filter((t) => !placedIds.has(t.id))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    style={{
                      ...sm.tile,
                      ...(draggingTile === t.id || touchSelectedTile === t.id
                        ? sm.tileSelected
                        : {}),
                    }}
                    draggable={!blocked}
                    onDragStart={(event) => dnd.handleDragStart(event, t.id)}
                    onDragEnd={dnd.handleDragEnd}
                    onClick={() => dnd.handleTileClick(t.id)}
                    disabled={blocked}
                  >
                    <span
                      style={
                        draggingTile === t.id || touchSelectedTile === t.id
                          ? sm.selectedTileMarkdown
                          : undefined
                      }
                    >
                      <InlineMarkdown content={t.text} />
                    </span>
                  </button>
                ))}
              {tilePool.filter((t) => !placedIds.has(t.id)).length === 0 && !checkPassed && (
                <span style={sm.poolEmpty}>All answers placed</span>
              )}
            </div>
          </div>
        )}

        {mode === 'type' && !submitted && !blocked && (
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 24px', marginTop: 4 }}
            onClick={handleTypeSubmit}
            disabled={!blanks.every((b) => String(state[b.id] ?? '').trim())}
          >
            Submit
          </button>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Not quite right, try again."
          suggestion={task?.feedback ?? task?.check?.hint ?? ''}
        />
      )}
    </div>
  )
}
