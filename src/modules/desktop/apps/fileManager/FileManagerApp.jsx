import React, { useMemo, useState } from 'react'
import FilesystemTask from '../../../filesystem/FilesystemTask.jsx'
import { entryName, parentPath, normaliseDirPath } from '../../../filesystem/filesystem.js'
import { softDeleteEntry, restoreEntry, purgeEntry } from './recycleBin.js'

const ICON_DIR = '📁'
const ICON_FILE = '📄'

function sortChildren(fs, dir, sortBy) {
  const normDir = normaliseDirPath(dir ?? '/')
  const dirEntries = []
  const otherEntries = []
  for (const [key, value] of Object.entries(fs)) {
    if (key !== normDir && key !== '/' && parentPath(key) === normDir) dirEntries.push([key, value])
    else otherEntries.push([key, value])
  }
  dirEntries.sort(([pathA, entryA], [pathB, entryB]) => {
    if (sortBy === 'type' && entryA.type !== entryB.type) return entryA.type === 'dir' ? -1 : 1
    return entryName(pathA).localeCompare(entryName(pathB), undefined, { sensitivity: 'base' })
  })
  const next = {}
  for (const [key, value] of otherEntries) next[key] = value
  for (const [key, value] of dirEntries) next[key] = value
  return next
}

function searchFs(fs, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return Object.keys(fs)
    .filter(path => path !== '/' && entryName(path).toLowerCase().includes(q))
    .sort()
}

// Wraps the existing FilesystemTask component with a Recycle Bin panel, a search
// box, and a sort control — the desktop module's File Manager "app".
export default function FileManagerApp({
  state,
  onStateChange,
  disabled,
  onInteraction,
  assetsPath,
  assets,
  startsInDir = '/',
}) {
  const [showRecycleBin, setShowRecycleBin] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [query, setQuery] = useState('')
  const [currentDir, setCurrentDir] = useState(startsInDir)
  // FilesystemTask only reads `initialDir` on mount. A search-result jump needs to force it
  // to a new folder, so we remount it by bumping `jumpKey` — but only for jumps, never for
  // FilesystemTask's own internal navigation (that would wipe its cut/copy clipboard on every click).
  const [jumpDir, setJumpDir] = useState(null)
  const [jumpKey, setJumpKey] = useState(0)

  const { fs, recycleBin } = state

  const displayedFs = useMemo(() => sortChildren(fs, currentDir, sortBy), [fs, currentDir, sortBy])
  const searchResults = useMemo(() => searchFs(fs, query), [fs, query])

  function updateFs(nextFs) {
    onStateChange({ ...state, fs: nextFs })
  }

  function handleDeletePath(path) {
    const { fs: nextFs, recycleBin: nextBin } = softDeleteEntry(fs, recycleBin, path)
    onStateChange({ ...state, fs: nextFs, recycleBin: nextBin })
  }

  function handleRestore(path) {
    const { fs: nextFs, recycleBin: nextBin } = restoreEntry(fs, recycleBin, path)
    onStateChange({ ...state, fs: nextFs, recycleBin: nextBin })
  }

  function handlePurge(path) {
    onStateChange({ ...state, recycleBin: purgeEntry(recycleBin, path) })
  }

  function handleInteraction(interaction) {
    setCurrentDir(interaction.currentDir)
    onInteraction?.(interaction)
  }

  const toolbarExtras = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search files…"
        aria-label="Search files"
        style={{ fontSize: '0.78rem', padding: '3px 8px', border: '1px solid var(--ui-border)', borderRadius: 4, width: 140, fontFamily: 'var(--font-body)' }}
      />
      <select
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
        aria-label="Sort by"
        style={{ fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--ui-border)', borderRadius: 4, fontFamily: 'var(--font-body)' }}
      >
        <option value="name">Name</option>
        <option value="type">Type</option>
      </select>
      <button
        className="btn-ghost-outline"
        style={{ fontSize: '0.78rem', padding: '3px 10px' }}
        onClick={() => setShowRecycleBin(v => !v)}
      >
        🗑 Recycle Bin{recycleBin.length ? ` (${recycleBin.length})` : ''}
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {query.trim() && (
        <div style={{ borderBottom: '1px solid var(--ui-border)', maxHeight: 140, overflowY: 'auto', background: '#fbf9ff' }}>
          {searchResults.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'var(--font-body)' }}>
              No files match "{query}"
            </div>
          ) : (
            searchResults.map(path => (
              <button
                key={path}
                onClick={() => {
                  const target = path.endsWith('/') ? path : parentPath(path)
                  setJumpDir(target)
                  setJumpKey(k => k + 1)
                  setCurrentDir(target)
                  setQuery('')
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--colour-text)',
                }}
              >
                <span>{path.endsWith('/') ? ICON_DIR : ICON_FILE}</span>
                <span>{path}</span>
              </button>
            ))
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FilesystemTask
            key={jumpKey}
            fs={displayedFs}
            onFsChange={disabled ? undefined : updateFs}
            onInteraction={disabled ? undefined : handleInteraction}
            onDeletePath={disabled ? undefined : handleDeletePath}
            assetsPath={assetsPath}
            assets={assets}
            disabled={disabled}
            initialDir={jumpDir ?? startsInDir}
            extraToolbarItems={toolbarExtras}
          />
        </div>
        {showRecycleBin && (
          <div style={{ width: 220, borderLeft: '1px solid var(--ui-border)', overflowY: 'auto', background: '#fbf9ff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)', borderBottom: '1px solid var(--ui-border)' }}>
              Recycle Bin
            </div>
            {recycleBin.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#9ca3af', fontFamily: 'var(--font-body)' }}>Empty</div>
            ) : (
              recycleBin.map(item => (
                <div key={item.path} style={{ padding: '6px 12px', borderBottom: '1px solid #ece7f8', fontFamily: 'var(--font-body)' }}>
                  <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{item.path.endsWith('/') ? ICON_DIR : ICON_FILE}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryName(item.path)}</span>
                  </div>
                  {!disabled && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="btn-ghost-outline" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleRestore(item.path)}>
                        Restore
                      </button>
                      <button className="btn-ghost-outline" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handlePurge(item.path)}>
                        Delete forever
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
