import React, { useRef, useEffect, useState } from 'react'
import { useTypewriterOutput } from '../hooks/useTypewriterOutput'

const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

// Extended_Pictographic covers emoji-representable code points without also
// matching plain digits/punctuation that carry the emoji presentation only
// when followed by U+FE0F (which Extended_Pictographic already accounts for).
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u

// Exported for unit testing. Splits text into alternating plain/emoji runs
// (grapheme-cluster aware, so multi-codepoint sequences like flags or
// ZWJ-joined emoji stay whole) so emoji can be rendered a bit larger than
// the surrounding monospace text without touching the plain-text runs.
export function splitEmojiRuns(text) {
  if (!text || typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    return [{ text, emoji: false }]
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const runs = []
  for (const { segment } of segmenter.segment(text)) {
    const isEmoji = EMOJI_PATTERN.test(segment)
    const last = runs[runs.length - 1]
    if (last && last.emoji === isEmoji) {
      last.text += segment
    } else {
      runs.push({ text: segment, emoji: isEmoji })
    }
  }
  return runs
}

export default function OutputPanel({
  title = 'Output',
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  onInputChange,
  // Read-only mirror mode: a teacher watching a student sees the student's
  // own not-yet-submitted input() text, but must never be able to edit it —
  // this renders the same prompt row as plain text instead of a live <input>,
  // driven entirely by the given value rather than local state.
  inputReadOnly = false,
  mirroredInputValue = '',
  checkPassed = false,
  hasCheck = false,
  running = false,
  openOnRun = true,
  openOnOutput = false,
  fill = false,
  collapsible = true,
  defaultCollapsed = true,
  leadingActions = null,
  rightActions = null,
}) {
  const [inputValue, setInputValue] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const displayedOutput = useTypewriterOutput(output)

  const preRef = useRef(null)
  const inputRef = useRef(null)
  const prevRunningRef = useRef(running)
  const prevOutputRef = useRef(output)
  const contentCollapsed = collapsible && isCollapsed

  useEffect(() => {
    if (openOnRun && running && !prevRunningRef.current) {
      setIsCollapsed(false)
    }
    prevRunningRef.current = running
  }, [running, openOnRun])

  useEffect(() => {
    if (openOnOutput && output && output !== prevOutputRef.current) {
      setIsCollapsed(false)
    }
    prevOutputRef.current = output
  }, [output, openOnOutput])

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight
  }, [displayedOutput, inputPrompt])

  // A run stopped (or finished) mid-prompt must not leave the student's
  // half-typed answer sitting in the box for the next input() prompt.
  useEffect(() => {
    if (inputPrompt === null) setInputValue('')
  }, [inputPrompt])

  useEffect(() => {
    if (inputPrompt !== null && !contentCollapsed && !inputReadOnly) {
      inputRef.current?.focus()
    }
  }, [inputPrompt, contentCollapsed, inputReadOnly])

  function handleInputSubmit(e) {
    e.preventDefault()
    onInputSubmit?.(inputValue)
    setInputValue('')
  }

  function handleInputValueChange(e) {
    setInputValue(e.target.value)
    onInputChange?.(e.target.value)
  }

  const statusColour =
    runStatus === 'success' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#9ca3af'
  const statusLabel =
    runStatus === 'success' ? 'Ran OK' : runStatus === 'error' ? 'Error' : 'Not run'
  const showCursor = running || (output && displayedOutput !== output)
  return (
    <div
      style={{
        ...s.panel,
        ...(fill ? s.panelFill : {}),
        minHeight: contentCollapsed ? 'auto' : fill ? 0 : 140,
        maxHeight: contentCollapsed ? 'auto' : fill ? 'none' : 300,
      }}
      className="card"
    >
      <div
        style={{
          ...s.header,
          borderRadius: contentCollapsed ? '10px' : '10px 10px 0 0',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={collapsible ? () => setIsCollapsed((prev) => !prev) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
          {leadingActions && <div style={s.leadingActions}>{leadingActions}</div>}
          <span style={s.headerLabel}>{title}</span>
          {collapsible && <span style={s.toggleIcon}>{isCollapsed ? 'Show' : 'Hide'}</span>}
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ ...s.statusDot, background: statusColour }} />
          <span style={s.statusLabel}>{statusLabel}</span>
          {rightActions && <div style={s.trailingActions}>{rightActions}</div>}
        </div>
      </div>

      {!contentCollapsed && (
        <pre ref={preRef} style={s.pre}>
          {displayedOutput ? (
            splitEmojiRuns(displayedOutput).map((run, index) =>
              run.emoji ? (
                <span key={index} style={s.emoji}>
                  {run.text}
                </span>
              ) : (
                <React.Fragment key={index}>{run.text}</React.Fragment>
              )
            )
          ) : (
            <span style={{ color: '#9ca3af' }}>Run your code to see output here.</span>
          )}
          {showCursor && <span className="terminal-cursor" />}

          {inputPrompt !== null && inputReadOnly && (
            <div style={s.inputRow}>
              <span style={s.prompt}>&gt;</span>
              <span style={s.input}>{mirroredInputValue}</span>
              <span className="terminal-cursor" />
            </div>
          )}

          {inputPrompt !== null && !inputReadOnly && (
            <form onSubmit={handleInputSubmit} style={s.inputRow}>
              <span style={s.prompt}>&gt;</span>
              <input
                ref={inputRef}
                style={s.input}
                value={inputValue}
                onChange={handleInputValueChange}
                placeholder="Type your input…"
                autoFocus
              />
              {/* Enter still submits; this button covers on-screen keyboards
                  (e.g. iPad Safari) where Enter/Return may not be reachable
                  or wired to submit a form the way it is on a hardware keyboard. */}
              <button type="submit" style={s.inputSubmitBtn} aria-label="Submit input">
                ↵
              </button>
            </form>
          )}
        </pre>
      )}
    </div>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 140,
    maxHeight: 300,
    overflow: 'hidden',
  },
  panelFill: {
    flex: 1,
    minHeight: 0,
    maxHeight: 'none',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '10px 10px 0 0',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  leadingActions: {
    display: 'flex',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    marginLeft: -8,
    marginRight: 2,
  },
  trailingActions: {
    display: 'flex',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  toggleIcon: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    opacity: 0.82,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    opacity: 0.85,
  },
  pre: {
    flex: 1,
    margin: 0,
    padding: '10px 14px',
    ...CODE_FONT_STYLE,
    fontSize: '14px',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#fafafa',
    borderRadius: '0 0 10px 10px',
    minHeight: 0,
  },
  emoji: {
    fontSize: '1.3em',
    lineHeight: 1,
    verticalAlign: 'middle',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  prompt: {
    color: 'var(--colour-primary)',
    fontWeight: 700,
  },
  input: {
    flex: 1,
    ...CODE_FONT_STYLE,
    fontSize: '14px',
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    color: 'var(--colour-text)',
    padding: '2px 4px',
  },
  inputSubmitBtn: {
    flexShrink: 0,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    lineHeight: 1,
    border: 'none',
    borderRadius: 6,
    background: 'var(--colour-primary)',
    color: '#fff',
    cursor: 'pointer',
  },
}
