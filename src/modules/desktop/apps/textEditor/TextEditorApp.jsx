import React, { useState } from 'react'
import { entryName, parentPath } from '../../../filesystem/filesystem.js'
import { openWindow, isWindowDirty } from '../../desktopState.js'
import FileDialog from '../shared/FileDialog.jsx'

// A plain-text editor window. Unlike File Manager's directly-bound textarea, edits live in
// this window's own `draftContent` until explicitly saved — matching the spec's Open/Save/Save
// As model rather than the rest of the platform's continuous autosave.
export default function TextEditorApp({ win, state, onStateChange, disabled, onInteraction }) {
  const { fs } = state
  const filePath = win.filePath ?? null
  const draftContent = win.draftContent ?? ''
  const dirty = isWindowDirty(win, fs)
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  function updateWindow(patch) {
    onStateChange({ ...state, windows: state.windows.map(w => w.id === win.id ? { ...w, ...patch } : w) })
  }

  function commitSave(path, content) {
    onStateChange({
      ...state,
      fs: { ...fs, [path]: { type: 'file', content } },
      windows: state.windows.map(w => w.id === win.id ? { ...w, filePath: path, draftContent: content } : w),
    })
    onInteraction?.({ currentDir: parentPath(path), openFile: path })
  }

  function handleSave() {
    if (disabled) return
    if (filePath) commitSave(filePath, draftContent)
    else setShowSaveDialog(true)
  }

  function handleOpenConfirm(path) {
    setShowOpenDialog(false)
    const content = fs[path]?.content ?? ''
    if (!dirty) {
      updateWindow({ filePath: path, draftContent: content })
      onInteraction?.({ currentDir: parentPath(path), openFile: path })
    } else {
      // Unsaved edits in this window — open the chosen file in a new window rather than
      // silently discarding them.
      onStateChange(openWindow(state, 'textEditor', { filePath: path, draftContent: content }))
    }
  }

  function handleKeyDown(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div style={s.wrap} onKeyDown={handleKeyDown}>
      <div style={s.toolbar}>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={() => setShowOpenDialog(true)}>
          📂 Open
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={handleSave}>
          💾 Save
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={() => setShowSaveDialog(true)}>
          Save As…
        </button>
        <span style={s.fileLabel}>{filePath ? entryName(filePath) : 'Untitled'}{dirty ? ' •' : ''}</span>
      </div>
      <textarea
        value={draftContent}
        onChange={e => updateWindow({ draftContent: e.target.value })}
        disabled={disabled}
        spellCheck={false}
        aria-label="Text editor content"
        style={s.textarea}
      />
      {showOpenDialog && (
        <FileDialog
          fs={fs}
          mode="open"
          title="Open File"
          onConfirm={handleOpenConfirm}
          onCancel={() => setShowOpenDialog(false)}
        />
      )}
      {showSaveDialog && (
        <FileDialog
          fs={fs}
          mode="saveAs"
          title="Save As"
          defaultFileName={filePath ? entryName(filePath) : 'Untitled.txt'}
          initialDir={filePath ? parentPath(filePath) : '/'}
          onFsChange={nextFs => onStateChange({ ...state, fs: nextFs })}
          onConfirm={path => { commitSave(path, draftContent); setShowSaveDialog(false) }}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--ui-border)' },
  toolbarBtn: { fontSize: '0.78rem', padding: '3px 10px' },
  fileLabel: { marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280', fontFamily: 'var(--font-body)' },
  textarea: {
    flex: 1, minHeight: 0, resize: 'none', border: 'none', outline: 'none', padding: '10px 12px',
    fontFamily: 'var(--font-code)', fontSize: '0.85rem', lineHeight: 1.5,
  },
}
