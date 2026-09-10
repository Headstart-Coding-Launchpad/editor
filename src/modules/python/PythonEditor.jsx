import React, { useRef } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'

// Symbols that are fiddly to reach on an on-screen keyboard but come up
// constantly in Python source — shown as a tap-to-insert row so touch/iPad
// students aren't hunting through keyboard shift layers mid-task.
const SYMBOL_BUTTONS = [':', '(', ')', '[', ']', '{', '}', '"', "'", '_', '=', '#']

export default function PythonEditor({
  code,
  onChange,
  onSelectionChange,
  onActivity,
  remoteSelection,
  teacherHighlights,
  onHighlightDismiss,
  readOnly = false,
  pyodideStatus,
  editorStyle,
  errorLine = null,
  onRunShortcut,
}) {
  const editorRef = useRef(null)
  const isTouchDevice = useIsTouchDevice()
  const showSymbolBar = isTouchDevice && !readOnly

  return (
    <div style={s.wrap}>
      {pyodideStatus === 'loading' && <div style={s.pyBanner}>⏳ Getting Python ready…</div>}
      {pyodideStatus === 'error' && (
        <div style={{ ...s.pyBanner, background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ Python failed to load. Please refresh the page.
        </div>
      )}
      {showSymbolBar && (
        <div style={s.symbolBar} role="toolbar" aria-label="Insert Python symbol">
          {SYMBOL_BUTTONS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              style={s.symbolBtn}
              onClick={() => editorRef.current?.insertAtCursor(symbol)}
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
      <CodeEditor
        ref={editorRef}
        value={code}
        language="python"
        readOnly={readOnly}
        onChange={onChange}
        onSelectionChange={onSelectionChange}
        onActivity={onActivity}
        remoteSelection={remoteSelection}
        teacherHighlights={teacherHighlights}
        onHighlightDismiss={onHighlightDismiss}
        errorLine={errorLine}
        onRunShortcut={onRunShortcut}
        style={{ flex: 1, minHeight: 240, ...editorStyle }}
      />
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 240,
    gap: 6,
  },
  pyBanner: {
    background: '#f0eafa',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #e9d5ff',
  },
  symbolBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 0,
  },
  symbolBtn: {
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
  },
}
