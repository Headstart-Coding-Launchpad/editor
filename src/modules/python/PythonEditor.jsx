import React from 'react'
import { CodeEditor } from '../../shared/CodeEditor'

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
  return (
    <div style={s.wrap}>
      {pyodideStatus === 'loading' && <div style={s.pyBanner}>⏳ Getting Python ready…</div>}
      {pyodideStatus === 'error' && (
        <div style={{ ...s.pyBanner, background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ Python failed to load. Please refresh the page.
        </div>
      )}
      <CodeEditor
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
}
