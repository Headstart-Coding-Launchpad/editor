import React, { useRef } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'
import EmojiPickerButton from '../../shared/EmojiPickerButton'
import { useBlockGuidesOn } from '../../shared/blockGuidesSetting'

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
  lineHints = null,
  onRunShortcut,
  // The task allows block brackets (taskShowsBlocks in ../../shared/blockGuides.js). When it
  // does, the Blocks button turns them on and off for this device; when not, both are hidden.
  showBlocks = true,
}) {
  const editorRef = useRef(null)
  const isTouchDevice = useIsTouchDevice()
  const showSymbolButtons = isTouchDevice && !readOnly
  const showEmojiButton = !readOnly
  const [blockGuidesOn, setBlockGuidesOn] = useBlockGuidesOn()

  return (
    <div style={s.wrap}>
      {pyodideStatus === 'loading' && <div style={s.pyBanner}>⏳ Getting Python ready…</div>}
      {pyodideStatus === 'error' && (
        <div style={{ ...s.pyBanner, background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ Python failed to load. Please refresh the page.
        </div>
      )}
      {(showSymbolButtons || showEmojiButton || showBlocks) && (
        <div style={s.symbolBar} role="toolbar" aria-label="Python editor tools">
          {showSymbolButtons &&
            SYMBOL_BUTTONS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                style={s.symbolBtn}
                onClick={() => editorRef.current?.insertAtCursor(symbol)}
              >
                {symbol}
              </button>
            ))}
          {showEmojiButton && (
            <EmojiPickerButton onInsert={(emoji) => editorRef.current?.insertAtCursor(emoji)} />
          )}
          {showBlocks && (
            <button
              type="button"
              style={{ ...s.blocksBtn, ...(blockGuidesOn ? s.blocksBtnOn : null) }}
              aria-pressed={blockGuidesOn}
              title={
                blockGuidesOn
                  ? 'Hide the coloured brackets that show which lines belong to each block'
                  : 'Show coloured brackets for which lines belong to each block'
              }
              onClick={() => setBlockGuidesOn(!blockGuidesOn)}
            >
              <span aria-hidden="true" style={s.blocksIcon}>
                ⎣
              </span>
              Blocks
            </button>
          )}
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
        lineHints={lineHints}
        onRunShortcut={onRunShortcut}
        blockGuides={showBlocks && blockGuidesOn}
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
  blocksBtn: {
    marginLeft: 'auto',
    height: 32,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
  },
  blocksBtnOn: {
    color: 'var(--colour-primary)',
    background: '#f0eafa',
    borderColor: '#d8c4f5',
  },
  blocksIcon: {
    fontFamily: "'JetBrains Mono', monospace",
    color: '#7c3aed',
    fontWeight: 700,
  },
}
