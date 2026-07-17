import React, { useMemo } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { useTileDragAndDrop } from '../../hooks/useTileDragAndDrop'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { baseStyles as s, interactionStyles as sm, parseQuizAnswerState, QuestionPanel, stableHash } from './quizUtils'

export default function MatchQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }) {
  const pairs = task?.pairs ?? []
  const revealAnswers = showCorrectAnswer && submitted && disabled

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledAnswers = useMemo(() => [...pairs].sort((a, b) => stableHash(a.answer ?? '') - stableHash(b.answer ?? '')), [JSON.stringify(pairs)])

  const state = useMemo(() => parseQuizAnswerState(selectedAnswer), [selectedAnswer])
  const placedIds = new Set(Object.values(state))
  const blocked = disabled || (submitted && checkPassed)

  function publishState(next) {
    const allFilled = pairs.every(p => next[p.id] !== undefined)
    if (allFilled) {
      const allCorrect = pairs.every(p => next[p.id] === p.id)
      onSelectAnswer?.(next, allCorrect)
    } else {
      onSelectAnswer?.(next, null)
    }
  }

  const dnd = useTileDragAndDrop({
    blocked,
    getLabelForTile: pairId => pairs.find(p => p.id === pairId)?.answer ?? '',
  })
  const { draggingTile, dragOverTarget: dragOverSlot, touchSelectedTile } = dnd

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.matchLayout}>
        <div style={sm.promptList}>
          {pairs.map(pair => {
            const placedId = state[pair.id]
            const placedPair = placedId ? pairs.find(p => p.id === placedId) : null
            const isOccupied = !!placedId
            const activeId = draggingTile || touchSelectedTile
            const canReceive = !!(activeId && activeId !== placedId)
            const isDragHighlight = canReceive && dragOverSlot === pair.id && !blocked
            const isTapHighlight = canReceive && !!touchSelectedTile && !draggingTile && !blocked
            const isSlotCorrect = isOccupied && placedId === pair.id
            const isSlotWrong = isOccupied && placedId !== pair.id
            const correctPair = revealAnswers && !isSlotCorrect ? pair : null

            return (
              <div key={pair.id} style={sm.matchRow}>
                <div style={sm.promptCell}>
                  <span style={s.markdownOnDark}>
                    <InlineMarkdown content={pair.prompt} />
                  </span>
                </div>
                <div style={sm.matchArrow}>→</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      ...sm.slot,
                      ...(isOccupied ? sm.slotFilled : sm.slotEmpty),
                      ...(isSlotCorrect ? sm.slotCorrect : {}),
                      ...(isSlotWrong ? sm.slotWrong : {}),
                      ...((isDragHighlight || isTapHighlight) ? sm.slotHighlight : {}),
                      cursor: blocked ? 'default' : (isTapHighlight || isOccupied) ? 'pointer' : 'copy',
                    }}
                    onDragOver={event => dnd.handleTargetDragOver(event, pair.id)}
                    onDragLeave={dnd.clearDragOver}
                    onDrop={event => dnd.handleTargetDrop(event, pair.id, state, publishState)}
                    onClick={() => dnd.handleTargetClick(pair.id, state, publishState)}
                    draggable={isOccupied && !blocked}
                    onDragStart={event => isOccupied && dnd.handleDragStart(event, placedId)}
                    onDragEnd={dnd.handleDragEnd}
                  >
                    {placedPair?.answer
                      ? <InlineMarkdown content={placedPair.answer} />
                      : (canReceive && !blocked ? (touchSelectedTile && !draggingTile ? 'Tap to place' : 'Drop here') : '—')}
                  </div>
                  {correctPair && (
                    <div style={sm.correctAnswerHint}>
                      ✓ Correct: <InlineMarkdown content={correctPair.answer} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={sm.answerPool} onDragOver={dnd.handlePoolDragOver} onDrop={event => dnd.handlePoolDrop(event, state, publishState)}>
          <div style={sm.poolLabel}>Answers</div>
          <div style={sm.poolTiles}>
            {shuffledAnswers.filter(p => !placedIds.has(p.id)).map(pair => (
              <button
                key={pair.id}
                type="button"
                style={{
                  ...sm.tile,
                  ...((draggingTile === pair.id || touchSelectedTile === pair.id) ? sm.tileSelected : {}),
                }}
                draggable={!blocked}
                onDragStart={event => dnd.handleDragStart(event, pair.id)}
                onDragEnd={dnd.handleDragEnd}
                onClick={() => dnd.handleTileClick(pair.id)}
                disabled={blocked}
              >
                <InlineMarkdown content={pair.answer} />
              </button>
            ))}
            {shuffledAnswers.filter(p => !placedIds.has(p.id)).length === 0 && !checkPassed && (
              <span style={sm.poolEmpty}>All answers placed</span>
            )}
          </div>
        </div>
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.feedback ?? task?.check?.hint ?? ''} />
      )}
    </div>
  )
}
