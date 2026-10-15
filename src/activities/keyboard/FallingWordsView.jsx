import React, { useEffect, useRef, useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import TypingHistoryLine from './TypingHistoryLine.jsx'
import { showsTypingHistory, typingHistoryForMode } from '../../shared/typingHistory.js'
import { normalizeKeyEvent } from '../../shared/input/index.js'
import { prefersReducedMotion } from '../../shared/motion.js'
import {
  FALLING_ROUND_ID,
  bufferOnTrack,
  createFallingGame,
  fallingDurationMs,
  fallingResult,
  stepFallingGame,
  typeFallingKey,
} from './fallingWords.js'

// The falling_words round. The game runs in memory (fallingWords.js); the activity state only
// gets the small round result, written when a token is cleared or missed (continuous, so it
// streams while the teacher watches) and once more, with done, when the time runs out. The
// round pauses whenever the tab is hidden or the play area loses focus.

const MAX_FRAME_MS = 250

// requestAnimationFrame, with a timer fallback where there is none (some test environments).
const nextFrame = (callback) =>
  typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(Date.now()), 16)
const cancelFrame = (id) =>
  typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame(id)
    : window.clearTimeout(id)

function Stats({ result }) {
  return (
    <p className="act-row" aria-live="polite" data-testid="falling-stats">
      <span className="act-badge">Score {result.score ?? 0}</span>
      <span className="act-badge">Cleared {result.cleared ?? 0}</span>
      <span className="act-badge">Missed {result.missed ?? 0}</span>
      <span className="act-badge">Accuracy {Math.round((result.accuracy ?? 1) * 100)}%</span>
      <span className="act-badge">{result.cpm ?? 0} characters a minute</span>
    </p>
  )
}

export default function FallingWordsView({
  task,
  state,
  onChange,
  onSubmit,
  readOnly = false,
  device = {},
  // The student's typing history (src/shared/typingHistory.js), shown with `showHistory`.
  history = null,
}) {
  const saved = state?.items?.[FALLING_ROUND_ID] ?? {}
  const historyLine = (result, done) =>
    showsTypingHistory(task, null) ? (
      <TypingHistoryLine
        modeHistory={typingHistoryForMode(history, task?.mode)}
        result={result}
        finished={done}
      />
    ) : null
  const durationMs = fallingDurationMs(task)
  const [game, setGame] = useState(null)
  const [paused, setPaused] = useState(false)
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const gameRef = useRef(null)
  const lastFrameRef = useRef(null)
  const areaRef = useRef(null)
  const submittedRef = useRef(false)
  const playing = !!game && !game.over

  function save(next) {
    const result = fallingResult(next)
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      ...(device.platform
        ? { device: { ...(prev?.device ?? {}), platform: device.platform } }
        : {}),
      items: { ...(prev?.items ?? {}), [FALLING_ROUND_ID]: result },
    }))
  }

  // Applies a new game state; saves the result when something a teacher would see changed.
  function update(next) {
    const prev = gameRef.current
    gameRef.current = next
    setGame(next)
    if (!prev || prev.cleared !== next.cleared || prev.missed !== next.missed || next.over) {
      save(next)
    }
    if (next.over && !submittedRef.current) {
      submittedRef.current = true
      onSubmit?.()
    }
  }

  // The frame loop runs only while playing and not paused.
  useEffect(() => {
    if (!playing || paused || readOnly) return undefined
    let frame = null
    lastFrameRef.current = null
    const tick = (now) => {
      const last = lastFrameRef.current ?? now
      lastFrameRef.current = now
      const current = gameRef.current
      if (!current || current.over) return
      update(stepFallingGame(current, Math.min(MAX_FRAME_MS, now - last)))
      frame = nextFrame(tick)
    }
    frame = nextFrame(tick)
    return () => cancelFrame(frame)
    // update() only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, paused, readOnly])

  // The play area takes the keys as soon as a round starts.
  useEffect(() => {
    if (playing) areaRef.current?.focus?.({ preventScroll: true })
  }, [playing])

  // Pause when the student switches tab or window.
  useEffect(() => {
    if (!playing) return undefined
    const onVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [playing])

  function start() {
    submittedRef.current = false
    const fresh = createFallingGame({
      words: task?.words ?? [],
      durationMs,
      seed: Date.now(),
      reducedMotion,
    })
    setPaused(false)
    gameRef.current = null // so the fresh round's empty result is always saved
    update(fresh)
    areaRef.current?.focus?.({ preventScroll: true })
  }

  function resume() {
    if (playing) setPaused(false)
  }

  function onKeyDown(domEvent) {
    if (!playing) return
    const event = normalizeKeyEvent(domEvent)
    if (event.key === 'Tab') return
    if (paused) setPaused(false)
    const { game: next, handled } = typeFallingKey(gameRef.current, event)
    if (handled) {
      domEvent.preventDefault()
      update(next)
    }
  }

  if (device.virtualKeyboard && !readOnly) {
    return (
      <div className="act-panel" data-testid="keyboard-activity">
        <p className="act-hint" role="status" data-testid="keyboard-needs-keyboard">
          ⌨️ This one needs a real keyboard: the on-screen keyboard hides most symbols.
        </p>
      </div>
    )
  }

  if (readOnly || !game) {
    const finished = !!saved.done
    return (
      <div className="act-panel" data-testid="keyboard-activity">
        <p className="act-prompt">Type the falling words before they reach the bottom</p>
        <p className="act-target-text" style={{ fontSize: '1rem' }}>
          {(task?.words ?? []).map((word, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' '}
              <code className="act-falling-chip">{word}</code>
            </React.Fragment>
          ))}
        </p>
        {historyLine(saved, finished)}
        {saved.cleared != null && <Stats result={saved} />}
        {readOnly && saved.cleared != null && !finished && (
          <p role="status">
            Playing: {Math.round((saved.timeMs ?? 0) / 1000)}s of {Math.round(durationMs / 1000)}s
          </p>
        )}
        {finished && <ActivityCorrect>Round complete!</ActivityCorrect>}
        {!readOnly && (
          <div className="act-row">
            <button
              type="button"
              className="btn-primary act-btn"
              onClick={start}
              data-testid="falling-start"
            >
              {saved.cleared != null
                ? 'Play again'
                : `Start (${Math.round(durationMs / 1000)} seconds)`}
            </button>
          </div>
        )}
      </div>
    )
  }

  const secondsLeft = Math.max(0, Math.ceil((durationMs - game.elapsedMs) / 1000))
  const onTrack = bufferOnTrack(game)
  // The token the student is typing: the lowest one that starts with what they've typed.
  const aimed = game.buffer
    ? game.tokens.filter((token) => token.text.startsWith(game.buffer)).sort((a, b) => b.y - a.y)[0]
    : null
  const justMissed =
    !reducedMotion && game.lastEvent?.kind === 'missed' && game.elapsedMs - game.lastEvent.at < 300

  return (
    <div className="act-panel" data-testid="keyboard-activity">
      <p className="act-row" aria-live="off">
        <span className="act-badge" data-testid="falling-time">
          ⏱ {secondsLeft}s
        </span>
        <span className="act-badge">Score {game.score}</span>
        <span className="act-badge">Cleared {game.cleared}</span>
        <span className="act-badge">Missed {game.missed}</span>
      </p>
      <div
        ref={areaRef}
        className={`act-falling-area${justMissed ? ' act-falling-area--miss' : ''}`}
        role="application"
        tabIndex={0}
        aria-label="Falling words: type each word before it reaches the bottom"
        data-keyboard-practice="true"
        data-testid="falling-area"
        onKeyDown={onKeyDown}
        onFocus={resume}
        onPointerDown={resume}
        onBlur={() => !game.over && setPaused(true)}
        onPaste={(e) => e.preventDefault()}
      >
        {game.tokens.map((token) => {
          const isAimed = aimed?.id === token.id
          return (
            <span
              key={token.id}
              className={`act-falling-token${isAimed ? ' act-falling-token--aimed' : ''}`}
              style={{ left: `${token.x * 100}%`, top: `calc(${token.y} * (100% - 2.2em))` }}
              data-testid="falling-token"
            >
              {isAimed ? (
                <>
                  <span className="act-char--ok">{game.buffer}</span>
                  {token.text.slice(game.buffer.length)}
                </>
              ) : (
                token.text
              )}
            </span>
          )
        })}
        {paused && !game.over && (
          <div className="act-falling-paused" role="status">
            Paused: click here to carry on
          </div>
        )}
        {game.over && (
          <div className="act-falling-paused" role="status">
            Time&apos;s up!
          </div>
        )}
      </div>
      <p className="act-falling-buffer" aria-live="off">
        <span className="act-edit-label">You typed: </span>
        <code className={onTrack ? undefined : 'act-char--bad'} data-testid="falling-buffer">
          {game.buffer || ' '}
        </code>
      </p>
      {game.over && (
        <>
          <Stats result={fallingResult(game)} />
          {historyLine(fallingResult(game), true)}
          <ActivityCorrect>Round complete!</ActivityCorrect>
          <div className="act-row">
            <button type="button" className="btn-ghost-outline act-btn" onClick={start}>
              Play again
            </button>
          </div>
        </>
      )}
    </div>
  )
}
