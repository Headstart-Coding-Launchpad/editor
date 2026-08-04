import React, { useMemo, useState } from 'react'
import { listChildren, createEntry, entryName, parentPath, normaliseDirPath, normaliseFilePath } from '../../../filesystem/filesystem.js'

const ICON_DIR = '📁'
const ICON_FILE = '📄'

function matchesFilter(path, filterExtensions) {
  if (!filterExtensions) return true
  const lower = path.toLowerCase()
  return filterExtensions.some(ext => lower.endsWith(ext))
}

// Shared Open / Save As dialog for apps that need an explicit file-picking step
// (Text Editor, Image Viewer) instead of the continuous autosave every other module
// uses. `onFsChange` is only used to persist folders created via "New Folder".
export default function FileDialog({
  fs,
  mode, // 'open' | 'saveAs'
  initialDir = '/',
  filterExtensions = null,
  defaultFileName = '',
  onFsChange,
  onConfirm,
  onCancel,
  title,
}) {
  const [currentDir, setCurrentDir] = useState(normaliseDirPath(initialDir))
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState(defaultFileName)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState('')

  const entries = useMemo(() => {
    const children = listChildren(fs, currentDir)
    const dirs = children.filter(p => p.endsWith('/')).sort((a, b) => entryName(a).localeCompare(entryName(b)))
    const files = children
      .filter(p => !p.endsWith('/') && matchesFilter(p, filterExtensions))
      .sort((a, b) => entryName(a).localeCompare(entryName(b)))
    return { dirs, files }
  }, [fs, currentDir, filterExtensions])

  function navigate(dir) {
    setCurrentDir(dir)
    setSelectedFile(null)
    setCreatingFolder(false)
    setError('')
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    const path = normaliseDirPath(currentDir + name)
    if (fs[path]) { setError(`"${name}" already exists`); return }
    onFsChange?.(createEntry(fs, path, 'dir'))
    setNewFolderName('')
    setCreatingFolder(false)
    setError('')
  }

  function handleConfirm() {
    if (mode === 'open') {
      if (!selectedFile) { setError('Choose a file to open'); return }
      onConfirm(selectedFile)
      return
    }
    const name = fileName.trim()
    if (!name) { setError('Enter a file name'); return }
    const path = normaliseFilePath(currentDir + name)
    if (fs[path] && !window.confirm(`"${name}" already exists. Replace it?`)) return
    onConfirm(path)
  }

  return (
    <div style={s.overlay}>
      <div role="dialog" aria-label={title ?? (mode === 'open' ? 'Open File' : 'Save As')} style={s.dialog}>
        <div style={s.header}>{title ?? (mode === 'open' ? 'Open File' : 'Save As')}</div>

        <div style={s.pathBar}>
          <button
            className="btn-ghost-outline"
            style={s.pathBtn}
            onClick={() => navigate(parentPath(currentDir))}
            disabled={currentDir === '/'}
          >
            ⬆ Up
          </button>
          <span style={s.pathLabel}>{currentDir}</span>
        </div>

        <div style={s.list}>
          {entries.dirs.map(path => (
            <button key={path} style={s.entryRow} onClick={() => navigate(path)}>
              <span>{ICON_DIR}</span>
              <span style={s.entryName}>{entryName(path)}</span>
            </button>
          ))}
          {entries.files.map(path => (
            <button
              key={path}
              style={{ ...s.entryRow, background: selectedFile === path ? '#ede9fe' : 'none' }}
              onClick={() => {
                setSelectedFile(path)
                setError('')
                if (mode === 'saveAs') setFileName(entryName(path))
              }}
              onDoubleClick={() => mode === 'open' && onConfirm(path)}
            >
              <span>{ICON_FILE}</span>
              <span style={s.entryName}>{entryName(path)}</span>
            </button>
          ))}
          {entries.dirs.length === 0 && entries.files.length === 0 && (
            <div style={s.empty}>This folder is empty</div>
          )}
        </div>

        {creatingFolder ? (
          <div style={s.newFolderRow}>
            <input
              className="te-input"
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false) }}
              placeholder="Folder name"
              style={s.input}
            />
            <button className="btn-ghost-outline" style={s.smallBtn} onClick={handleCreateFolder}>Create</button>
            <button className="btn-ghost-outline" style={s.smallBtn} onClick={() => setCreatingFolder(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-ghost-outline" style={{ ...s.smallBtn, alignSelf: 'flex-start' }} onClick={() => setCreatingFolder(true)}>
            + New Folder
          </button>
        )}

        {mode === 'saveAs' && (
          <label style={s.fileNameLabel}>
            File name
            <input
              className="te-input"
              value={fileName}
              onChange={e => { setFileName(e.target.value); setError('') }}
              style={s.input}
            />
          </label>
        )}

        {error && <div style={s.error}>{error}</div>}

        <div style={s.footer}>
          <button className="btn-ghost-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>{mode === 'open' ? 'Open' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  dialog: {
    width: 380, maxHeight: '80%', background: '#fff', borderRadius: 8,
    boxShadow: '0 12px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-body)', overflow: 'hidden',
  },
  header: { padding: '10px 14px', fontWeight: 600, fontSize: '0.9rem', borderBottom: '1px solid var(--ui-border)' },
  pathBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--ui-border)' },
  pathBtn: { fontSize: '0.75rem', padding: '3px 8px' },
  pathLabel: { fontSize: '0.78rem', color: '#6b7280', fontFamily: 'var(--font-code)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  list: { flex: 1, minHeight: 120, maxHeight: 260, overflowY: 'auto', borderBottom: '1px solid var(--ui-border)' },
  entryRow: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
    fontFamily: 'var(--font-body)', color: 'var(--colour-text)',
  },
  entryName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { padding: '14px', fontSize: '0.8rem', color: '#9ca3af' },
  newFolderRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' },
  smallBtn: { fontSize: '0.75rem', padding: '4px 10px', margin: '8px 14px 0' },
  fileNameLabel: { display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 14px 0', fontSize: '0.8rem', fontWeight: 600 },
  input: { fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--ui-border)', borderRadius: 4, fontFamily: 'var(--font-body)' },
  error: { padding: '6px 14px 0', fontSize: '0.78rem', color: '#dc2626' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px' },
}
