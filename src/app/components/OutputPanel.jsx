import React, { useRef, useEffect, useState } from 'react'

const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

export default function OutputPanel({
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  checkPassed = false,
  hasCheck = false,
  running = false,
}) {
  const [inputValue, setInputValue] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [displayedOutput, setDisplayedOutput] = useState('')
  
  const preRef     = useRef(null)
  const inputRef   = useRef(null)
  const prevRunningRef = useRef(running)

  // Auto-expand when code starts running
  useEffect(() => {
    if (running && !prevRunningRef.current) {
      setIsCollapsed(false)
    }
    prevRunningRef.current = running
  }, [running])

  // Retro typing animation effect
  useEffect(() => {
    if (!output) {
      setDisplayedOutput('')
      return
    }

    if (displayedOutput === output) return

    const timer = setTimeout(() => {
      setDisplayedOutput(prev => {
        if (prev === output) return prev
        
        let current = prev
        if (!output.startsWith(prev)) {
          current = ''
        }

        const remaining = output.slice(current.length)
        if (remaining.length === 0) return current

        // Speed adjustment so long outputs don't take forever
        let chunkSize = 1
        if (remaining.length > 500) {
          chunkSize = 25
        } else if (remaining.length > 200) {
          chunkSize = 12
        } else if (remaining.length > 100) {
          chunkSize = 6
        } else if (remaining.length > 50) {
          chunkSize = 3
        } else if (remaining.length > 20) {
          chunkSize = 2
        }

        return current + remaining.slice(0, chunkSize)
      })
    }, 12)

    return () => clearTimeout(timer)
  }, [output, displayedOutput])

  // Snap scroll to bottom on every output update — smooth scrolling wobbles
  // when updates arrive faster than the animation can complete (~60fps/12ms).
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight
  }, [displayedOutput, inputPrompt])

  // Focus input field when prompt appears or panel is expanded
  useEffect(() => {
    if (inputPrompt !== null && !isCollapsed) {
      inputRef.current?.focus()
    }
  }, [inputPrompt, isCollapsed])

  function handleInputSubmit(e) {
    e.preventDefault()
    onInputSubmit?.(inputValue)
    setInputValue('')
  }

  const statusColour = runStatus === 'success' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#9ca3af'
  const statusLabel  = runStatus === 'success' ? 'Ran OK' : runStatus === 'error' ? 'Error' : 'Not run'
  const showCursor   = running || (output && displayedOutput !== output)

  return (
    <div style={{ ...s.panel, minHeight: isCollapsed ? 'auto' : 140, maxHeight: isCollapsed ? 'auto' : 300 }} className="card">
      {/* Header */}
      <div 
        style={{ ...s.header, borderRadius: isCollapsed ? '10px' : '10px 10px 0 0', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setIsCollapsed(prev => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={s.headerLabel}>Output</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
            {isCollapsed ? '▶' : '▼'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          <span style={{ ...s.statusDot, background: statusColour }} />
          <span style={s.statusLabel}>{statusLabel}</span>
        </div>
      </div>

      {/* Output text (collapsible) */}
      {!isCollapsed && (
        <pre ref={preRef} style={s.pre}>
          {displayedOutput || <span style={{ color: '#9ca3af' }}>Run your code to see output here.</span>}
          {showCursor && <span className="terminal-cursor" />}

          {/* Input field appears inline when input() is waiting */}
          {inputPrompt !== null && (
            <form onSubmit={handleInputSubmit} style={s.inputRow}>
              <span style={s.prompt}>&gt;</span>
              <input
                ref={inputRef}
                style={s.input}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Type your input and press Enter"
              />
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
}
