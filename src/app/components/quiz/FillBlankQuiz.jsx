import React, { useMemo } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { useTileDragAndDrop } from '../../hooks/useTileDragAndDrop'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { fillBlankDraftText } from '../../../shared/answerDrafts'
import TutorTileHighlightNote from './TutorTileHighlightNote'
import { useChoiceEntrance } from '../../../activities/ui/choiceEntrance.jsx'
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
  // (text) => void: typed gaps not yet submitted, as one line for the tutor's draft view.
  onDraftChange,
  submitted,
  checkPassed,
  disabled,
  showQuestion,
  showResult,
  showCorrectAnswer,
  // Tutor "look again" highlights, { [blankId]: { id, note } } (drag mode; see
  // src/shared/tutorTileHighlights.js).
  tileHighlights = null,
  // StudentModal's highlight mode: tapping a blank calls this instead of picking the tile up.
  onTargetTap = null,
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
  const entrance = useChoiceEntrance()

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
    onDraftChange?.(fillBlankDraftText(task, next))
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
    const tutorHighlight = mode === 'drag' ? (tileHighlights?.[blankId] ?? null) : null

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
          ...(tutorHighlight ? sm.tutorHighlight : {}),
          cursor: onTargetTap
            ? 'pointer'
            : blocked
              ? 'default'
              : isTapHighlight || placedTileId
                ? 'pointer'
                : 'copy',
        }}
        data-tutor-highlight={tutorHighlight ? 'true' : undefined}
        data-testid={`fill-blank-${blankId}`}
        onDragOver={(event) => dnd.handleTargetDragOver(event, blankId)}
        onDragLeave={dnd.clearDragOver}
        onDrop={(event) => dnd.handleTargetDrop(event, blankId, state, publishState)}
        onClick={() =>
          onTargetTap
            ? onTargetTap(blankId, placedTileId ?? null)
            : dnd.handleTargetClick(blankId, state, publishState)
        }
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
          <TutorHighlightNotes
            segments={segments}
            tileHighlights={tileHighlights}
            tilePool={tilePool}
          />
        )}

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
                .map((t, tileIndex) => (
                  <button
                    key={t.id}
                    type="button"
                    className={entrance(tileIndex).className}
                    style={{
                      ...sm.tile,
                      ...(draggingTile === t.id || touchSelectedTile === t.id
                        ? sm.tileSelected
                        : {}),
                      ...entrance(tileIndex).style,
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

// The notes of the passage's highlighted blanks, under the passage in reading order (a blank sits
// inside the text, so its note can't go under it). Each names the tile in that blank.
function TutorHighlightNotes({ segments, tileHighlights, tilePool }) {
  if (!tileHighlights || Object.keys(tileHighlights).length === 0) return null
  const blankIds = []
  for (const seg of segments) {
    if (seg.type === 'blank') blankIds.push(seg.blankId)
    if (seg.type === 'codeBlock') {
      for (const part of seg.parts) if (part.type !== 'codeText') blankIds.push(part.blankId)
    }
  }
  const shown = blankIds.filter((id) => tileHighlights[id])
  if (shown.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-live="polite">
      {shown.map((blankId) => {
        const highlight = tileHighlights[blankId]
        const text = tilePool.find((t) => t.id === highlight.tileId)?.text
        return (
          <TutorTileHighlightNote key={blankId} note={highlight.note}>
            {text ? (
              <span style={sm.fillBlankMarkdown}>
                <InlineMarkdown content={text} />
              </span>
            ) : (
              'an empty gap'
            )}
          </TutorTileHighlightNote>
        )
      })}
    </div>
  )
}
