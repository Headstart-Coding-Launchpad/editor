import React, { useRef, useEffect, useState } from 'react'

const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

/**
 * Output panel for the lesson builder.
 * Like the classroom OutputPanel but also shows check verification results.
 */
export default function BuilderOutputPanel({
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  checkResults = null, // null | [{type, value?, passed}]
  incorrectCheckResults = null, // null | [{type, value?, passed, hint?}]
  testResults = null, // null | [{id, name, passed, output}]
  running = false,
}) {
  const [inputValue, setInputValue] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [displayedOutput, setDisplayedOutput] = useState('')

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
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
      setDisplayedOutput((prev) => {
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

  // Scroll to bottom when output grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const statusColour =
    runStatus === 'success' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#9ca3af'
  const statusLabel =
    runStatus === 'success' ? 'Ran OK' : runStatus === 'error' ? 'Error' : 'Not run'
  const showCursor = running || (output && displayedOutput !== output)

  const allPassed = checkResults !== null && checkResults.every((r) => r.passed)

  return (
    <div style={s.wrap}>
      {/* Output */}
      <div
        style={{
          ...s.panel,
          minHeight: isCollapsed ? 'auto' : 100,
          maxHeight: isCollapsed ? 'auto' : 240,
        }}
        className="card"
      >
        <div
          style={{
            ...s.header,
            borderRadius: isCollapsed ? '10px' : '10px 10px 0 0',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={s.headerLabel}>Output</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{isCollapsed ? '▶' : '▼'}</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ ...s.statusDot, background: statusColour }} />
            <span style={s.statusLabel}>{statusLabel}</span>
          </div>
        </div>
        {!isCollapsed && (
          <pre style={s.pre}>
            {displayedOutput || <span style={{ color: '#9ca3af' }}>Run to see output.</span>}
            {showCursor && <span className="terminal-cursor" />}
            {inputPrompt !== null && (
              <form onSubmit={handleInputSubmit} style={s.inputRow}>
                <span style={s.prompt}>&gt;</span>
                <input
                  ref={inputRef}
                  style={s.input}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  autoFocus
                  placeholder="Type input and press Enter"
                />
              </form>
            )}
            <span ref={bottomRef} />
          </pre>
        )}
      </div>

      {/* Completion check verification */}
      {!isCollapsed && checkResults !== null && (
        <div
          style={{
            ...s.checkResult,
            background: allPassed ? '#f0fdf4' : '#fffbeb',
            borderColor: allPassed ? '#bbf7d0' : '#fde68a',
          }}
        >
          {checkResults.length === 1 ? (
            checkResults[0].passed ? (
              <span>
                ✅ <strong>Check passes</strong> — students will see the completion banner.
              </span>
            ) : (
              <span>
                ⚠️ <strong>Check does not pass</strong> {checkHint(checkResults[0])}
              </span>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {checkResults.map((r, i) => (
                <div key={i}>
                  {r.passed ? (
                    <span>
                      ✅ <strong>Check {i + 1}</strong> passes.
                    </span>
                  ) : (
                    <span>
                      ⚠️ <strong>Check {i + 1}</strong> does not pass {checkHint(r)}
                    </span>
                  )}
                </div>
              ))}
              <div
                style={{
                  marginTop: 4,
                  borderTop: '1px solid',
                  borderColor: allPassed ? '#bbf7d0' : '#fde68a',
                  paddingTop: 6,
                  fontWeight: 700,
                }}
              >
                {allPassed
                  ? '✅ All checks pass — students will see the completion banner.'
                  : '⚠️ Not all checks pass — students will not see the completion banner.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test results */}
      {!isCollapsed && testResults !== null && (
        <div
          style={{
            ...s.checkResult,
            background: testResults.every((r) => r.passed) ? '#f0fdf4' : '#fffbeb',
            borderColor: testResults.every((r) => r.passed) ? '#bbf7d0' : '#fde68a',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: testResults.length > 0 ? 6 : 0 }}>
            Test results:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {testResults.map((r, i) => (
              <div key={r.id ?? i}>
                {r.passed ? (
                  <span>
                    ✅ <strong>{r.name || `Test ${i + 1}`}</strong> passed.
                  </span>
                ) : (
                  <span>
                    ⚠️ <strong>{r.name || `Test ${i + 1}`}</strong> did not pass.
                  </span>
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 6,
              borderTop: '1px solid',
              borderColor: testResults.every((r) => r.passed) ? '#bbf7d0' : '#fde68a',
              paddingTop: 6,
              fontWeight: 700,
            }}
          >
            {testResults.every((r) => r.passed)
              ? `✅ All ${testResults.length} test${testResults.length !== 1 ? 's' : ''} pass — students will be able to complete the task.`
              : `⚠️ ${testResults.filter((r) => !r.passed).length}/${testResults.length} test${testResults.length !== 1 ? 's' : ''} did not pass.`}
          </div>
        </div>
      )}

      {/* Incorrect check verification — shown when completion check failed */}
      {!isCollapsed && incorrectCheckResults !== null && (
        <div style={{ ...s.checkResult, background: '#f0f4ff', borderColor: '#c7d2fe' }}>
          <div style={{ fontWeight: 700, marginBottom: incorrectCheckResults.length > 0 ? 6 : 0 }}>
            Incorrect checks:
          </div>
          {incorrectCheckResults.length === 0 ? (
            <span style={{ color: '#6b7280' }}>No incorrect checks configured.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {incorrectCheckResults.map((r, i) => (
                <div key={i}>
                  {r.passed ? (
                    <span>
                      🎯 <strong>Incorrect check {i + 1} matched</strong>
                      {r.hint ? (
                        <>
                          {' '}
                          — hint: <em>"{r.hint}"</em>
                        </>
                      ) : (
                        ' — no hint set'
                      )}
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>
                      — Incorrect check {i + 1} did not match {checkHint(r)}
                    </span>
                  )}
                </div>
              ))}
              {!incorrectCheckResults.some((r) => r.passed) && (
                <div style={{ marginTop: 4, color: '#6b7280', fontSize: '0.85em' }}>
                  No incorrect check matched — the completion check hint (if any) will be shown
                  instead.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function checkHint(result) {
  if (result.type === 'code_no_error') return 'because the code errored.'
  if (result.type === 'output_not_empty') return 'because the output is empty.'
  if (result.type === 'output_empty') return 'because the output is not empty.'
  if (result.type === 'code_contains')
    return (
      <>
        — the code does not contain (<code style={s.code}>{result.value}</code>).
      </>
    )
  if (result.type === 'code_does_not_contain')
    return (
      <>
        — the code contains (<code style={s.code}>{result.value}</code>) but shouldn't.
      </>
    )
  if (result.type === 'code_equals')
    return <>— the code does not exactly match the expected value.</>
  if (result.type === 'element_exists')
    return (
      <>
        — no element matches selector (<code style={s.code}>{result.selector}</code>).
      </>
    )
  if (result.type === 'element_count')
    return (
      <>
        — the matching element count is not <code style={s.code}>{result.value}</code> for selector
        (<code style={s.code}>{result.selector}</code>).
      </>
    )
  if (result.type === 'element_value')
    return (
      <>
        — the first matching element does not contain (<code style={s.code}>{result.value}</code>).
      </>
    )
  return (
    <>
      with this output — review your check value (<code style={s.code}>{result.value}</code>).
    </>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  panel: { overflow: 'hidden' },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '10px 10px 0 0',
  },
  headerLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  statusLabel: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', opacity: 0.85 },
  pre: {
    margin: 0,
    padding: '10px 14px',
    ...CODE_FONT_STYLE,
    fontSize: '14px',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#fafafa',
    minHeight: 100,
    maxHeight: 240,
    borderRadius: '0 0 10px 10px',
  },
  inputRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  prompt: { color: 'var(--colour-primary)', fontWeight: 700 },
  input: {
    flex: 1,
    ...CODE_FONT_STYLE,
    fontSize: '14px',
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    padding: '2px 4px',
  },
  checkResult: {
    border: '1px solid',
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: 'var(--colour-text)',
  },
  code: {
    ...CODE_FONT_STYLE,
    fontSize: '0.85em',
    background: 'rgba(0,0,0,0.06)',
    padding: '1px 5px',
    borderRadius: 4,
  },
}
