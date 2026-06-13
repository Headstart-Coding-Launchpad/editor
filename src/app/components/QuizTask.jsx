import React, { useState, useMemo } from 'react'
import { InlineMarkdown, MarkdownRenderer } from '../../shared/markdown'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import { useTileDragAndDrop } from '../hooks/useTileDragAndDrop'

export function getQuizOptionText(task, answerId) {
  return task?.options?.find(option => option.id === answerId)?.text ?? ''
}

export const CONFIDENCE_COLOURS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

const OPTION_COLOURS = [
  { background: '#dbeafe', border: '#2563eb', active: '#2563eb', text: '#1e3a8a' },
  { background: '#fee2e2', border: '#dc2626', active: '#dc2626', text: '#7f1d1d' },
  { background: '#fef3c7', border: '#f59e0b', active: '#f59e0b', text: '#78350f' },
  { background: '#dcfce7', border: '#16a34a', active: '#16a34a', text: '#14532d' },
]

function stableHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

function QuestionPanel({ task }) {
  if (!task?.explainer) return null
  return (
    <div style={s.question}>
      <div style={s.questionLabel}>Question</div>
      <div style={s.questionBody}>
        <MarkdownRenderer title={task.title} content={task.explainer} />
      </div>
    </div>
  )
}

export default function QuizTask({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted = false,
  checkPassed = false,
  disabled = false,
  showQuestion = false,
  showResult = true,
  showCorrectAnswer = false,
}) {
  const quizType = task?.quizType ?? 'multiple_choice'
  const props = { task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }

  if (quizType === 'match') return <MatchQuiz {...props} />
  if (quizType === 'fill_blank') return <FillBlankQuiz {...props} />
  if (quizType === 'short_answer') return <ShortAnswerQuiz {...props} />
  if (quizType === 'confidence') return <ConfidenceQuiz {...props} />
  return <MultipleChoiceQuiz {...props} />
}

function MultipleChoiceQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }) {
  const options = task?.options ?? []
  const correctId = task?.check?.type === 'answer_equals' ? task.check.value : null
  const revealAnswers = showCorrectAnswer && submitted && disabled && correctId
  const locked = disabled || (submitted && checkPassed)

  // Shuffle once per task (stable during the session, different each time the task mounts)
  const shuffledOptions = useMemo(() => {
    const arr = [...options]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div style={s.options} role="radiogroup" aria-label={task?.title ?? 'Quiz options'}>
        {shuffledOptions.map((option, index) => {
          const active = selectedAnswer === option.id
          const isCorrect = revealAnswers && option.id === correctId
          const isWrong = revealAnswers && active && option.id !== correctId
          const colour = OPTION_COLOURS[index % OPTION_COLOURS.length]

          const bg = isCorrect ? '#16a34a' : isWrong ? '#dc2626' : active ? colour.active : colour.background
          const border = isCorrect ? '#16a34a' : isWrong ? '#dc2626' : colour.border
          const textColour = isCorrect || isWrong || active ? '#fff' : colour.text

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              style={{
                ...s.option,
                background: bg,
                borderColor: border,
                color: textColour,
                ...((active || isCorrect || isWrong) ? s.optionActive : {}),
              }}
              onClick={() => onSelectAnswer?.(option.id)}
              disabled={locked}
            >
              <span style={{ ...s.optionId, background: active || isCorrect || isWrong ? 'rgba(255,255,255,0.22)' : colour.active, color: '#fff' }}>
                {option.id}
              </span>
              <span style={s.optionText}>
                <span style={active || isCorrect || isWrong ? s.markdownOnDark : undefined}>
                  <InlineMarkdown content={option.text} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {revealAnswers && !checkPassed && (
        <div style={s.correctAnswerNote}>
          Correct answer: <strong>{options.find(o => o.id === correctId)?.text ?? correctId}</strong>
        </div>
      )}
      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Wrong answer, try again."
          suggestion={getMultipleChoiceSuggestion(task, selectedAnswer)}
        />
      )}
    </div>
  )
}

function getMultipleChoiceSuggestion(task, selectedAnswer) {
  if (checkPassedFromTask(task, selectedAnswer)) return ''
  const option = task?.options?.find(o => o.id === selectedAnswer)
  return String(option?.feedback ?? option?.hint ?? task?.feedback ?? task?.check?.hint ?? '').trim()
}

function checkPassedFromTask(task, selectedAnswer) {
  return task?.check?.type === 'answer_equals' && task.check.value === selectedAnswer
}

// ─── Match ────────────────────────────────────────────────────────────────────

function MatchQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }) {
  const pairs = task?.pairs ?? []
  const revealAnswers = showCorrectAnswer && submitted && disabled

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledAnswers = useMemo(() => [...pairs].sort((a, b) => stableHash(a.answer ?? '') - stableHash(b.answer ?? '')), [JSON.stringify(pairs)])

  const state = useMemo(() => {
    if (selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)) return selectedAnswer
    if (typeof selectedAnswer === 'string' && selectedAnswer) {
      try { const parsed = JSON.parse(selectedAnswer); if (parsed && typeof parsed === 'object') return parsed } catch {}
    }
    return {}
  }, [selectedAnswer])

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
            const isSlotCorrect = revealAnswers && placedId === pair.id
            const isSlotWrong = revealAnswers && isOccupied && placedId !== pair.id
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

// ─── Fill in the Blank ────────────────────────────────────────────────────────

// Parses fill-blank text into tokens: {type:'text'|'code'|'blank', text?, lang?, blankId?}
// Handles backtick code spans atomically so `python:range(___, ___)` doesn't produce
// orphaned backticks when the ___ markers fall inside a code span.
function parseFillBlankSegments(text, blanks) {
  const tokens = []
  let blankCount = 0
  let i = 0

  while (i < text.length) {
    if (text.startsWith('___', i)) {
      tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
      blankCount++
      i += 3
      continue
    }

    const close = text[i] === '`' ? text.indexOf('`', i + 1) : -1
    if (close !== -1) {
      const raw = text.slice(i + 1, close)
      const langMatch = raw.match(/^(python|html|css|js):/)
      const lang = langMatch ? langMatch[1] : null
      const body = lang ? raw.slice(lang.length + 1) : raw
      if (body.includes('___')) {
        const codeParts = body.split('___')
        codeParts.forEach((part, j) => {
          if (part) tokens.push({ type: 'code', lang, text: part })
          if (j < codeParts.length - 1) {
            tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
            blankCount++
          }
        })
      } else {
        tokens.push({ type: 'code', lang, text: body })
      }
      i = close + 1
      continue
    }

    const textStart = i
    i++
    while (i < text.length && !text.startsWith('___', i) && text[i] !== '`') i++
    tokens.push({ type: 'text', text: text.slice(textStart, i) })
  }

  return tokens
}

function FillBlankQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }) {
  const blanks = task?.blanks ?? []
  const mode = task?.mode ?? 'drag'
  const revealAnswers = showCorrectAnswer && submitted && disabled
  const text = task?.text ?? ''

  const distractors = task?.distractors ?? []

  // Unified pool: correct answer tiles + distractor tiles, both normalised to { id, text }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tilePool = useMemo(() => {
    const all = [
      ...blanks.map(b => ({ id: b.id, text: b.answer })),
      ...distractors.map(d => ({ id: d.id, text: d.text })),
    ]
    return all.sort((a, b) => stableHash(a.text ?? '') - stableHash(b.text ?? ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(blanks), JSON.stringify(distractors)])

  const state = useMemo(() => {
    if (selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)) return selectedAnswer
    if (typeof selectedAnswer === 'string' && selectedAnswer) {
      try { const parsed = JSON.parse(selectedAnswer); if (parsed && typeof parsed === 'object') return parsed } catch {}
    }
    return {}
  }, [selectedAnswer])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const segments = useMemo(() => parseFillBlankSegments(text, blanks), [text, JSON.stringify(blanks)])

  const placedIds = new Set(Object.values(state))
  const blocked = disabled || (submitted && checkPassed)

  function publishState(next) {
    const allFilled = blanks.every(b => next[b.id] !== undefined)
    if (allFilled) {
      const allCorrect = blanks.every(b => {
        const placedTile = tilePool.find(t => t.id === next[b.id])
        return placedTile?.text === b.answer
      })
      onSelectAnswer?.(next, allCorrect)
    } else {
      onSelectAnswer?.(next, null)
    }
  }

  const dnd = useTileDragAndDrop({
    blocked,
    dragEnabled: mode === 'drag',
    getLabelForTile: tileId => tilePool.find(t => t.id === tileId)?.text ?? '',
  })
  const { draggingTile, dragOverTarget: dragOverBlank, touchSelectedTile } = dnd

  function handleTypeChange(blankId, value) {
    const next = { ...state, [blankId]: value }
    onSelectAnswer?.(next, null)
  }

  function handleTypeSubmit() {
    const allFilled = blanks.every(b => String(state[b.id] ?? '').trim())
    if (!allFilled) return
    const allCorrect = blanks.every(b => {
      const typed = String(state[b.id] ?? '').trim().toLowerCase()
      const expected = String(b.answer ?? '').trim().toLowerCase()
      return typed === expected
    })
    onSelectAnswer?.(state, allCorrect)
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.fillWrap}>
        <div style={sm.fillText}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return <span key={i}><InlineMarkdown content={seg.text} /></span>
            }
            if (seg.type === 'code') {
              const mdCode = `\`${seg.lang ? seg.lang + ':' : ''}${seg.text}\``
              return <span key={i}><InlineMarkdown content={mdCode} /></span>
            }

            const { blankId } = seg
            const blank = blanks.find(b => b.id === blankId)
            const placedTileId = state[blankId]
            const placedText = tilePool.find(t => t.id === placedTileId)?.text
            const activeId = draggingTile || touchSelectedTile
            const canReceive = mode === 'drag' && !!(activeId && activeId !== placedTileId)
            const isDragHighlight = canReceive && dragOverBlank === blankId && !blocked
            const isTapHighlight = canReceive && !!touchSelectedTile && !draggingTile && !blocked

            const isBlankCorrect = revealAnswers && placedTileId && (
              mode === 'drag'
                ? tilePool.find(t => t.id === placedTileId)?.text === blank?.answer
                : String(placedTileId ?? '').trim().toLowerCase() === String(blank?.answer ?? '').trim().toLowerCase()
            )
            const isBlankWrong = revealAnswers && placedTileId && !isBlankCorrect

            if (mode === 'type') {
              return (
                <input
                  key={i}
                  style={{
                    ...sm.fillInput,
                    ...(isBlankCorrect ? sm.fillInputCorrect : {}),
                    ...(isBlankWrong ? sm.fillInputWrong : {}),
                  }}
                  value={state[blankId] ?? ''}
                  onChange={e => handleTypeChange(blankId, e.target.value)}
                  disabled={blocked}
                  placeholder="..."
                />
              )
            }

            return (
              <span
                key={i}
                style={{
                  ...sm.fillBlank,
                  ...(placedTileId ? sm.fillBlankFilled : sm.fillBlankEmpty),
                  ...(isBlankCorrect ? sm.fillBlankCorrect : {}),
                  ...(isBlankWrong ? sm.fillBlankWrong : {}),
                  ...((isDragHighlight || isTapHighlight) ? sm.fillBlankHighlight : {}),
                  cursor: blocked ? 'default' : (isTapHighlight || placedTileId) ? 'pointer' : 'copy',
                }}
                onDragOver={event => dnd.handleTargetDragOver(event, blankId)}
                onDragLeave={dnd.clearDragOver}
                onDrop={event => dnd.handleTargetDrop(event, blankId, state, publishState)}
                onClick={() => dnd.handleTargetClick(blankId, state, publishState)}
                draggable={!!placedTileId && !blocked}
                onDragStart={event => placedTileId && dnd.handleDragStart(event, placedTileId)}
                onDragEnd={dnd.handleDragEnd}
                title={isBlankWrong && blank ? `Correct: ${blank.answer}` : undefined}
              >
                {placedText
                  ? <span style={sm.fillBlankMarkdown}><InlineMarkdown content={placedText} /></span>
                  : (canReceive && !blocked ? (touchSelectedTile && !draggingTile ? 'Tap to place' : 'Drop here') : '___')}
              </span>
            )
          })}
        </div>

        {mode === 'drag' && (
          <div style={sm.answerPool} onDragOver={dnd.handlePoolDragOver} onDrop={event => dnd.handlePoolDrop(event, state, publishState)}>
            <div style={sm.poolLabel}>Answer bank</div>
            <div style={sm.poolTiles}>
              {tilePool.filter(t => !placedIds.has(t.id)).map(t => (
                <button
                  key={t.id}
                  type="button"
                  style={{ ...sm.tile, ...((draggingTile === t.id || touchSelectedTile === t.id) ? sm.tileSelected : {}) }}
                  draggable={!blocked}
                  onDragStart={event => dnd.handleDragStart(event, t.id)}
                  onDragEnd={dnd.handleDragEnd}
                  onClick={() => dnd.handleTileClick(t.id)}
                  disabled={blocked}
                >
                  <span style={(draggingTile === t.id || touchSelectedTile === t.id) ? sm.selectedTileMarkdown : undefined}>
                    <InlineMarkdown content={t.text} />
                  </span>
                </button>
              ))}
              {tilePool.filter(t => !placedIds.has(t.id)).length === 0 && !checkPassed && (
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
            disabled={!blanks.every(b => String(state[b.id] ?? '').trim())}
          >
            Submit
          </button>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.feedback ?? task?.check?.hint ?? ''} />
      )}
    </div>
  )
}

// ─── Short Answer ─────────────────────────────────────────────────────────────

function ShortAnswerQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const [localAnswer, setLocalAnswer] = useState(typeof selectedAnswer === 'string' ? selectedAnswer : '')

  React.useEffect(() => {
    setLocalAnswer(typeof selectedAnswer === 'string' ? selectedAnswer : '')
  }, [selectedAnswer])

  function handleSubmit() {
    const trimmed = localAnswer.trim()
    if (!trimmed) return
    onSelectAnswer?.(trimmed)
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.shortAnswerWrap}>
        <textarea
          style={sm.shortAnswerInput}
          value={localAnswer}
          onChange={e => setLocalAnswer(e.target.value)}
          placeholder="Type your answer here…"
          disabled={disabled || (submitted && checkPassed)}
          rows={3}
        />
        {!submitted && !disabled && (
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 24px' }}
            onClick={handleSubmit}
            disabled={!localAnswer.trim()}
          >
            Submit Answer
          </button>
        )}
        {submitted && (
          <div style={sm.submittedAnswer}>
            Your answer: <strong>{localAnswer || (typeof selectedAnswer === 'string' ? selectedAnswer : '')}</strong>
          </div>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.check?.hint ?? task?.feedback ?? ''} />
      )}
    </div>
  )
}

// ─── Confidence ───────────────────────────────────────────────────────────────

function ConfidenceQuiz({ task, selectedAnswer, onSelectAnswer, submitted, disabled, showQuestion }) {
  const blocked = disabled
  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div style={sc.wrap}>
        <div style={sc.labelRow}>
          <span style={sc.labelEdge}>👎 Not confident</span>
          <span style={sc.labelEdge}>Very confident 👍</span>
        </div>
        <div style={sc.buttons}>
          {CONFIDENCE_COLOURS.map((colour, i) => {
            const level = i + 1
            const isSelected = selectedAnswer === String(level)
            return (
              <button
                key={level}
                type="button"
                style={{
                  ...sc.btn,
                  background: isSelected ? colour : '#f3f4f6',
                  borderColor: colour,
                  color: isSelected ? '#fff' : colour,
                  opacity: blocked && !isSelected ? 0.35 : 1,
                  boxShadow: isSelected ? `0 0 0 4px ${colour}38, 0 6px 18px ${colour}28` : undefined,
                  transform: isSelected ? 'scale(1.08)' : undefined,
                }}
                onClick={() => !blocked && onSelectAnswer?.(String(level), true)}
                disabled={blocked}
                aria-pressed={isSelected}
                title={`Confidence level ${level}`}
              >
                <span style={sc.btnNum}>{level}</span>
                {level === 1 && <span style={sc.btnIcon}>👎</span>}
                {level === 5 && <span style={sc.btnIcon}>👍</span>}
              </button>
            )
          })}
        </div>
        {submitted && selectedAnswer && (
          <div style={{ ...sc.result, borderColor: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1], color: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1], background: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1] + '18' }}>
            You rated your confidence: <strong>{selectedAnswer} / 5</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  question: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  questionLabel: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  questionBody: {
    padding: '14px 16px',
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(0, 1fr)',
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 0,
    height: '100%',
    padding: '18px 20px',
    border: '2px solid',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '1.35rem',
    fontWeight: 600,
    transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  optionActive: {
    boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.5), 0 6px 18px rgba(17, 24, 39, 0.18)',
    zIndex: 2,
  },
  optionId: {
    width: 42,
    height: 42,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  optionText: {
    minWidth: 0,
    lineHeight: 1.35,
  },
  markdownOnDark: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  correctAnswerNote: {
    padding: '8px 12px',
    borderRadius: 6,
    background: '#dcfce7',
    border: '1px solid #16a34a',
    color: '#15803d',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
}

const sm = {
  // Match
  matchLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
    minHeight: 0,
  },
  promptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  matchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 10,
    alignItems: 'center',
  },
  promptCell: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
  },
  matchArrow: {
    color: '#9ca3af',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  slot: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, border-color 0.12s',
  },
  slotEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  slotFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  slotHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.03)',
  },
  slotCorrect: {
    borderColor: '#16a34a',
    borderStyle: 'solid',
    background: '#dcfce7',
    color: '#15803d',
  },
  slotWrong: {
    borderColor: '#dc2626',
    borderStyle: 'solid',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  correctAnswerHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#15803d',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 5,
    padding: '3px 8px',
  },
  answerPool: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  poolLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  poolTiles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 42,
  },
  tile: {
    padding: '8px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
  },
  tileSelected: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
    boxShadow: '0 16px 34px rgba(35, 18, 76, 0.3), 0 0 0 5px rgba(251, 165, 4, 0.24)',
    transform: 'translateY(-8px) rotate(-2deg) scale(1.06)',
  },
  selectedTileMarkdown: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  poolEmpty: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  // Fill in the blank
  fillWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
  },
  fillText: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 20px',
    fontFamily: 'var(--font-body)',
    fontSize: '1.1rem',
    lineHeight: 2.2,
    color: 'var(--colour-text)',
  },
  fillBlank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    padding: '2px 12px',
    borderRadius: 6,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    margin: '0 2px',
    verticalAlign: 'middle',
    transition: 'background 0.1s, border-color 0.1s',
  },
  fillBlankMarkdown: {
    '--colour-text': 'var(--colour-text)',
    '--colour-primary-dark': 'var(--colour-primary-dark)',
    color: 'var(--colour-text)',
  },
  fillBlankEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  fillBlankFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  fillBlankHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.05)',
  },
  fillBlankCorrect: {
    borderColor: '#16a34a',
    borderStyle: 'solid',
    background: '#dcfce7',
    color: '#15803d',
  },
  fillBlankWrong: {
    borderColor: '#dc2626',
    borderStyle: 'solid',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  fillInput: {
    display: 'inline-block',
    minWidth: 90,
    width: 'auto',
    padding: '2px 10px',
    borderRadius: 6,
    border: '2px solid #d1d5db',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--colour-text)',
    background: '#fff',
    margin: '0 2px',
    verticalAlign: 'middle',
    outline: 'none',
  },
  fillInputCorrect: {
    borderColor: '#16a34a',
    background: '#dcfce7',
    color: '#15803d',
  },
  fillInputWrong: {
    borderColor: '#dc2626',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  // Short answer
  shortAnswerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
  },
  shortAnswerInput: {
    padding: '12px 14px',
    border: '2px solid #d1d5db',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--colour-text)',
    resize: 'vertical',
    lineHeight: 1.6,
    outline: 'none',
    width: '100%',
  },
  submittedAnswer: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#4b5563',
    padding: '8px 12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
}

const sc = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  labelEdge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 12,
    padding: '8px 6px',
    overflow: 'visible',
  },
  btn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '16px 0',
    borderRadius: 12,
    border: '3px solid',
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s, transform 0.12s, box-shadow 0.12s',
    fontFamily: 'var(--font-body)',
  },
  btnNum: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '2rem',
    lineHeight: 1,
  },
  btnIcon: {
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  result: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '2px solid',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    fontWeight: 600,
    textAlign: 'center',
  },
}
