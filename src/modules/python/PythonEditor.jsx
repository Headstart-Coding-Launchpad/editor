import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'
import EmojiPickerButton from '../../shared/EmojiPickerButton'
import { useBlockGuidesOn } from '../../shared/blockGuidesSetting'
import { applySlowMoMarker } from './slowMo/editorMarker.js'
import { describeRunCount } from '../../shared/runCounts.js'

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
  // Locked lines (lock sets, getTaskLockSets in src/shared/lockedLines.js), or null.
  lockedLines = null,
  onRunShortcut,
  // The task allows block brackets (taskShowsBlocks in ../../shared/blockGuides.js). When it
  // does, the Blocks button turns them on and off for this device; when not, both are hidden.
  showBlocks = true,
  // Live scrubbing (src/shared/scrub/): getTaskScrub's settings, the preview re-run and the
  // report hook (see CodeEditor).
  scrub = null,
  onScrubPreview,
  onScrubCommit,
  // Slow-mo playback (src/modules/python/slowMo/): `{ line, passes: [{ line, label }] }` marks
  // the line that just ran and each loop's pass, or null.
  slowMoMarker = null,
  // The #@peek "stopped here" band (src/shared/peekBandEditor.js): `{ line, missed }` or null.
  peekBand = null,
  // Linked name tags (src/shared/variableLinksEditor.js): `{ links, active, onActive }` or null.
  variableLinks = null,
  // Run-count boxes and counts on #@count lines (src/shared/runCountsEditor.js): getRunCountWidgets'
  // `{ mode, readOnly, marks }` plus `onChange` / `onCommit`, or null.
  runCounts = null,
}) {
  const editorRef = useRef(null)
  const slowMoKey = useMemo(() => JSON.stringify(slowMoMarker ?? null), [slowMoMarker])
  useEffect(() => {
    applySlowMoMarker(editorRef.current?.getView?.(), JSON.parse(slowMoKey))
  }, [slowMoKey])
  const isTouchDevice = useIsTouchDevice()
  const showSymbolButtons = isTouchDevice && !readOnly
  const showEmojiButton = !readOnly
  const [blockGuidesOn, setBlockGuidesOn] = useBlockGuidesOn()
  // The symbol row and the emoji key sit behind one "Keys" button, closed to start with, so the
  // bar is Keys, Blocks and Run rather than a dozen small keys (child-facing rules, Hub #315).
  const [keysOpen, setKeysOpen] = useState(false)
  const hasKeys = showSymbolButtons || showEmojiButton

  return (
    <div style={s.wrap} data-testid="editor-panel">
      {pyodideStatus === 'loading' && <div style={s.pyBanner}>⏳ Getting Python ready…</div>}
      {pyodideStatus === 'error' && (
        <div style={{ ...s.pyBanner, background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ Python failed to load. Please refresh the page.
        </div>
      )}
      {(showSymbolButtons || showEmojiButton || showBlocks) && (
        <div style={s.symbolBar} role="toolbar" aria-label="Python editor tools">
          {hasKeys && (
            <button
              type="button"
              style={{ ...s.blocksBtn, ...(keysOpen ? s.blocksBtnOn : null) }}
              aria-pressed={keysOpen}
              title="Show keys for symbols and emoji"
              onClick={() => setKeysOpen((v) => !v)}
            >
              Keys
            </button>
          )}
          {keysOpen &&
            showSymbolButtons &&
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
          {keysOpen && showEmojiButton && (
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
        lockedLines={lockedLines}
        peekBand={peekBand}
        variableLinks={variableLinks}
        runCounts={runCounts}
        onRunShortcut={onRunShortcut}
        blockGuides={showBlocks && blockGuidesOn}
        // On a tablet a long line was cut off with no visible sideways scroll: wrap it instead.
        lineWrapping={isTouchDevice}
        scrub={scrub}
        onScrubPreview={onScrubPreview}
        onScrubCommit={onScrubCommit}
        style={{ flex: 1, minHeight: 240, ...editorStyle }}
      />
      {runCounts && <RunCountAnnouncement runCounts={runCounts} />}
    </div>
  )
}

/**
 * Says each counted line's count once a Run reports it ("Line 3 ran 4 times. You predicted 4:
 * right."), in a polite live region: the widgets inside the editor are read in place, but a
 * screen reader only announces text that changes in a region already on the page. Only on a
 * task with run counts (it is there from when the task opens, so the first counts are heard).
 */
function RunCountAnnouncement({ runCounts }) {
  const text = (runCounts?.marks ?? [])
    .filter((mark) => Number.isInteger(mark.count))
    .map((mark) =>
      describeRunCount({
        line: mark.line,
        count: mark.count,
        value: runCounts.mode === 'predict' ? mark.value : '',
        correct: mark.correct,
      })
    )
    .join(' ')
  return (
    <p role="status" aria-live="polite" style={s.srOnly} data-testid="run-count-announcement">
      {text}
    </p>
  )
}

const s = {
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
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
