import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DEFAULT_FS,
  listChildren,
  createEntry,
  deleteEntry,
  renameEntry,
  moveEntry,
  copyEntry,
  updateFileContent,
  entryName,
  parentPath,
  normaliseDirPath,
} from '../../shared/filesystem.js'

const ICON_DIR = '📁'
const ICON_FILE = '📄'
const ICON_IMG = '🖼️'
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']

function isImage(path) {
  const lower = path.toLowerCase()
  return IMAGE_EXTS.some(ext => lower.endsWith(ext))
}

// ── Folder Tree ───────────────────────────────────────────────────────────────

function FolderTreeNode({ fs, path, currentDir, onNavigate, onDrop, onContextMenu, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [dragOver, setDragOver] = useState(false)
  const children = listChildren(fs, path).filter(p => p.endsWith('/'))

  const isActive = currentDir === path
  const hasChildren = children.length > 0

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const src = e.dataTransfer.getData('text/plain')
    if (src && onDrop) onDrop(src, path)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px 3px',
          paddingLeft: 8 + depth * 16,
          cursor: 'pointer',
          borderRadius: 4,
          background: dragOver ? 'rgba(98,34,204,0.18)' : isActive ? 'var(--colour-primary)' : 'transparent',
          color: isActive && !dragOver ? '#fff' : 'var(--colour-text)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.82rem',
          userSelect: 'none',
          outline: dragOver ? '2px dashed var(--colour-primary)' : 'none',
        }}
        onClick={() => onNavigate(path)}
        onContextMenu={onContextMenu ? e => onContextMenu(e, path) : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span
          style={{ width: 14, textAlign: 'center', opacity: hasChildren ? 1 : 0.25, fontSize: '0.7rem' }}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? '▾' : '▸'}
        </span>
        <span>{ICON_DIR}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path === '/' ? '/ (root)' : entryName(path)}
        </span>
      </div>
      {expanded && children.map(child => (
        <FolderTreeNode
          key={child}
          fs={fs}
          path={child}
          currentDir={currentDir}
          onNavigate={onNavigate}
          onDrop={onDrop}
          onContextMenu={onContextMenu}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

// ── File Grid ─────────────────────────────────────────────────────────────────

function FileGrid({ fs, currentDir, selected, onSelect, onNavigate, onDrop, renamingPath, onRenameCommit, onRenameKeyDown, onContextMenu, cutPath }) {
  const children = listChildren(fs, currentDir)
  const renameRef = useRef(null)

  useEffect(() => {
    if (renameRef.current) renameRef.current.focus()
  }, [renamingPath])

  function handleDragStart(e, path) {
    e.dataTransfer.setData('text/plain', path)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDropOnGrid(e) {
    e.preventDefault()
    const src = e.dataTransfer.getData('text/plain')
    if (src) onDrop(src, currentDir)
  }

  if (children.length === 0) {
    return (
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
        onDragOver={handleDragOver}
        onDrop={handleDropOnGrid}
        onContextMenu={onContextMenu ? e => onContextMenu(e, null) : undefined}
      >
        Folder is empty
      </div>
    )
  }

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 8, padding: 12, overflowY: 'auto', flex: 1 }}
      onDragOver={handleDragOver}
      onDrop={handleDropOnGrid}
      onContextMenu={onContextMenu ? e => { if (e.target === e.currentTarget) onContextMenu(e, null) } : undefined}
    >
      {children.map(path => {
        const isDirectory = path.endsWith('/')
        const name = entryName(path)
        const img = !isDirectory && isImage(path)
        const icon = isDirectory ? ICON_DIR : img ? ICON_IMG : ICON_FILE
        const isSelected = selected === path
        const isRenaming = renamingPath === path
        const isCut = cutPath === path

        return (
          <div
            key={path}
            draggable
            onDragStart={e => handleDragStart(e, path)}
            onClick={() => onSelect(path)}
            onDoubleClick={() => isDirectory ? onNavigate(path) : onSelect(path)}
            onContextMenu={onContextMenu ? e => onContextMenu(e, path) : undefined}
            style={{
              width: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 6,
              background: isSelected ? 'rgba(98,34,204,0.12)' : 'transparent',
              border: isSelected ? '1.5px solid var(--colour-primary)' : '1.5px solid transparent',
              cursor: 'pointer',
              userSelect: 'none',
              opacity: isCut ? 0.45 : 1,
            }}
          >
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{icon}</span>
            {isRenaming ? (
              <input
                ref={renameRef}
                defaultValue={name}
                style={{ width: 72, fontSize: '0.72rem', textAlign: 'center', border: '1px solid var(--colour-primary)', borderRadius: 3, padding: '1px 3px', fontFamily: 'var(--font-body)' }}
                onBlur={e => onRenameCommit(path, e.target.value)}
                onKeyDown={e => onRenameKeyDown(e, path, e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span style={{ fontSize: '0.72rem', textAlign: 'center', wordBreak: 'break-word', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', maxWidth: 72 }}>
                {name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Inline create input that appears in the toolbar area ──────────────────────

function InlineNameInput({ placeholder, onCommit, onCancel }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <input
      ref={ref}
      placeholder={placeholder}
      style={{ fontSize: '0.82rem', border: '1px solid var(--colour-primary)', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-body)', width: 140 }}
      onBlur={e => { if (e.target.value.trim()) onCommit(e.target.value.trim()); else onCancel() }}
      onKeyDown={e => {
        if (e.key === 'Enter' && e.target.value.trim()) onCommit(e.target.value.trim())
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}

// ── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey) }
  }, [onClose])
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 160,
        padding: '4px 0', fontFamily: 'var(--font-body)',
      }}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: '#e5e7eb', margin: '3px 0' }} />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick(); onClose() }}
            disabled={item.disabled}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 14px', background: 'none', border: 'none',
              cursor: item.disabled ? 'default' : 'pointer',
              fontSize: '0.82rem', fontFamily: 'var(--font-body)',
              color: item.danger ? '#dc2626' : item.disabled ? '#9ca3af' : 'var(--colour-text)',
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

// ── Address Bar ───────────────────────────────────────────────────────────────

function AddressBar({ currentDir, onNavigate }) {
  const parts = currentDir === '/' ? ['/'] : ['/', ...currentDir.slice(1, -1).split('/')]
  let accumulated = '/'
  const crumbs = parts.map((part, i) => {
    const target = i === 0 ? '/' : accumulated + part + '/'
    if (i > 0) accumulated = target
    return { label: part === '/' ? 'root' : part, target }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', flex: 1 }}>
      {crumbs.map((c, i) => (
        <span key={c.target} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <span style={{ color: '#9ca3af' }}>/</span>}
          <span
            style={{ cursor: 'pointer', color: i === crumbs.length - 1 ? 'var(--colour-text)' : 'var(--colour-primary)', fontWeight: i === crumbs.length - 1 ? 600 : 400 }}
            onClick={() => onNavigate(c.target)}
          >
            {c.label}
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FilesystemTask({ fs = DEFAULT_FS, onFsChange, disabled = false }) {
  const [currentDir, setCurrentDir] = useState('/')
  const [selected, setSelected] = useState(null)
  const [openFile, setOpenFile] = useState(null)
  const [creating, setCreating] = useState(null) // 'file' | 'folder'
  const [renamingPath, setRenamingPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, targetPath }
  const [clipboard, setClipboard] = useState(null) // { path, mode: 'copy' | 'cut' }

  // Keep currentDir valid if it gets deleted
  useEffect(() => {
    if (!fs[normaliseDirPath(currentDir)]) setCurrentDir('/')
  }, [fs, currentDir])

  // Keep openFile valid
  useEffect(() => {
    if (openFile && !fs[openFile]) setOpenFile(null)
  }, [fs, openFile])

  const navigate = useCallback(path => {
    setCurrentDir(path)
    setSelected(null)
    setOpenFile(null)
    setCreating(null)
    setRenamingPath(null)
  }, [])

  function handleSelect(path) {
    setSelected(path)
    setRenamingPath(null)
    if (!path.endsWith('/') && !isImage(path)) {
      setOpenFile(path)
    } else if (path.endsWith('/')) {
      setOpenFile(null)
    } else {
      setOpenFile(path) // image
    }
  }

  function handleNewFolder(name) {
    const newPath = normaliseDirPath(currentDir + name)
    onFsChange(createEntry(fs, newPath, 'dir'))
    setCreating(null)
  }

  function handleNewFile(name) {
    const newPath = currentDir === '/' ? '/' + name : currentDir + name
    onFsChange(createEntry(fs, newPath, 'file', ''))
    setCreating(null)
    setOpenFile(newPath)
    setSelected(newPath)
  }

  function handleDeletePath(path) {
    if (!window.confirm(`Delete "${entryName(path)}"?`)) return
    onFsChange(deleteEntry(fs, path))
    if (selected === path) { setSelected(null); setOpenFile(null) }
    if (clipboard?.path === path) setClipboard(null)
  }

  function handleDelete() {
    if (!selected) return
    handleDeletePath(selected)
  }

  function handleCopy(path) {
    setClipboard({ path, mode: 'copy' })
  }

  function handleCut(path) {
    setClipboard({ path, mode: 'cut' })
  }

  function handlePaste() {
    if (!clipboard) return
    const { path: srcPath, mode } = clipboard
    if (mode === 'copy') {
      onFsChange(copyEntry(fs, srcPath, currentDir))
    } else {
      onFsChange(moveEntry(fs, srcPath, currentDir))
      setClipboard(null)
    }
  }

  function openContextMenu(e, targetPath) {
    e.preventDefault()
    e.stopPropagation()
    if (targetPath) setSelected(targetPath)
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath: targetPath ?? null })
  }

  function buildContextMenuItems(targetPath) {
    const isDir = targetPath?.endsWith('/')
    const isRoot = targetPath === '/'

    if (!targetPath) {
      const items = [
        { label: '📁 New Folder', onClick: () => setCreating('folder') },
        { label: '📄 New File', onClick: () => setCreating('file') },
      ]
      if (clipboard) {
        items.push(null)
        items.push({ label: '📋 Paste', onClick: handlePaste })
      }
      return items
    }

    if (isDir) {
      const items = [
        {
          label: '📄 New File here',
          onClick: () => { setCurrentDir(targetPath); setSelected(null); setOpenFile(null); setRenamingPath(null); setCreating('file') },
        },
        {
          label: '📁 New Folder here',
          onClick: () => { setCurrentDir(targetPath); setSelected(null); setOpenFile(null); setRenamingPath(null); setCreating('folder') },
        },
      ]
      if (clipboard) {
        items.push(null)
        items.push({ label: '📋 Paste', onClick: handlePaste })
      }
      if (!isRoot) {
        items.push(null)
        items.push({ label: '📄 Copy', onClick: () => handleCopy(targetPath) })
        items.push({ label: '✂️ Cut', onClick: () => handleCut(targetPath) })
        items.push(null)
        items.push({ label: '✏️ Rename', onClick: () => setRenamingPath(targetPath) })
        items.push({ label: '🗑 Delete', onClick: () => handleDeletePath(targetPath), danger: true })
      }
      return items
    }

    const items = [
      { label: '📄 Copy', onClick: () => handleCopy(targetPath) },
      { label: '✂️ Cut', onClick: () => handleCut(targetPath) },
    ]
    if (clipboard) {
      items.push({ label: '📋 Paste', onClick: handlePaste })
    }
    items.push(null)
    items.push({ label: '✏️ Rename', onClick: () => setRenamingPath(targetPath) })
    items.push({ label: '🗑 Delete', onClick: () => handleDeletePath(targetPath), danger: true })
    return items
  }

  function handleRenameCommit(path, newName) {
    setRenamingPath(null)
    if (newName.trim() && newName.trim() !== entryName(path)) {
      const newFs = renameEntry(fs, path, newName.trim())
      onFsChange(newFs)
      // update open file if it was renamed
      if (openFile === path) {
        const isDirectory = path.endsWith('/')
        const parent = parentPath(path)
        const np = isDirectory ? normaliseDirPath(parent + newName.trim()) : (parent === '/' ? '/' + newName.trim() : parent + newName.trim())
        setOpenFile(np)
        setSelected(np)
      }
    }
  }

  function handleRenameKeyDown(e, path, value) {
    if (e.key === 'Escape') { setRenamingPath(null); return }
    if (e.key === 'Enter') handleRenameCommit(path, value)
  }

  function handleDrop(srcPath, destDir) {
    onFsChange(moveEntry(fs, srcPath, destDir))
    if (openFile === srcPath) {
      const name = entryName(srcPath)
      const destDirNorm = normaliseDirPath(destDir)
      const newPath = destDirNorm === '/' ? '/' + name : destDirNorm + name
      setOpenFile(newPath)
      setSelected(newPath)
    }
    setSelected(null)
  }

  function handleFileContentChange(content) {
    if (!openFile) return
    onFsChange(updateFileContent(fs, openFile, content))
  }

  function handleKeyDown(e) {
    if (disabled) return
    if (e.key === 'F2' && selected && !renamingPath) {
      e.preventDefault()
      setRenamingPath(selected)
    }
    if (e.key === 'Delete' && selected && !renamingPath) {
      e.preventDefault()
      handleDelete()
    }
    if (e.ctrlKey && e.key === 'c' && selected && !renamingPath) {
      e.preventDefault()
      handleCopy(selected)
    }
    if (e.ctrlKey && e.key === 'x' && selected && !renamingPath) {
      e.preventDefault()
      handleCut(selected)
    }
    if (e.ctrlKey && e.key === 'v' && clipboard && !renamingPath) {
      e.preventDefault()
      handlePaste()
    }
  }

  const openEntry = openFile ? fs[openFile] : null
  const showEditor = openEntry && openEntry.type === 'file' && !isImage(openFile)
  const showImage = openEntry && isImage(openFile)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none', fontFamily: 'var(--font-body)' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#f8f5ff', borderBottom: '1px solid var(--ui-border)', flexWrap: 'wrap' }}>
        {!disabled && (
          <>
            <button
              className="btn-ghost-outline"
              style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              onClick={() => setCreating('folder')}
              disabled={creating !== null}
            >
              📁 New Folder
            </button>
            <button
              className="btn-ghost-outline"
              style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              onClick={() => setCreating('file')}
              disabled={creating !== null}
            >
              📄 New File
            </button>
            <button
              className="btn-ghost-outline"
              style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              disabled={!selected || renamingPath !== null}
              onClick={() => setRenamingPath(selected)}
            >
              ✏️ Rename
            </button>
            <button
              className="btn-ghost-outline"
              style={{ fontSize: '0.78rem', padding: '3px 10px', color: '#dc2626', borderColor: '#fca5a5' }}
              disabled={!selected || selected === '/'}
              onClick={handleDelete}
            >
              🗑 Delete
            </button>
            {clipboard && (
              <button
                className="btn-ghost-outline"
                style={{ fontSize: '0.78rem', padding: '3px 10px' }}
                onClick={handlePaste}
              >
                📋 Paste {clipboard.mode === 'cut' ? '(move)' : '(copy)'}
              </button>
            )}
            {creating && (
              <InlineNameInput
                placeholder={creating === 'folder' ? 'Folder name…' : 'File name…'}
                onCommit={name => creating === 'folder' ? handleNewFolder(name) : handleNewFile(name)}
                onCancel={() => setCreating(null)}
              />
            )}
          </>
        )}
        <AddressBar currentDir={currentDir} onNavigate={navigate} />
      </div>

      {/* Main area: tree + grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Folder tree */}
        <div style={{ width: 180, minWidth: 140, borderRight: '1px solid var(--ui-border)', overflowY: 'auto', padding: '8px 4px', background: '#fbf9ff' }}>
          <FolderTreeNode
            fs={fs}
            path="/"
            currentDir={currentDir}
            onNavigate={navigate}
            onDrop={disabled ? undefined : handleDrop}
            onContextMenu={disabled ? undefined : openContextMenu}
            depth={0}
          />
        </div>

        {/* Right side: grid + optional file viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <FileGrid
            fs={fs}
            currentDir={currentDir}
            selected={selected}
            onSelect={handleSelect}
            onNavigate={navigate}
            onDrop={handleDrop}
            renamingPath={renamingPath}
            onRenameCommit={handleRenameCommit}
            onRenameKeyDown={handleRenameKeyDown}
            onContextMenu={disabled ? undefined : openContextMenu}
            cutPath={clipboard?.mode === 'cut' ? clipboard.path : null}
          />

          {/* File viewer */}
          {(showEditor || showImage) && (
            <div style={{ height: 220, borderTop: '1px solid var(--ui-border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', background: '#f3eeff', borderBottom: '1px solid var(--ui-border)', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-code)', color: 'var(--colour-text)', fontWeight: 600 }}>
                  {entryName(openFile)}
                </span>
                <button
                  onClick={() => setOpenFile(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', lineHeight: 1 }}
                  aria-label="Close file"
                >
                  ×
                </button>
              </div>
              {showEditor ? (
                <textarea
                  value={openEntry.content ?? ''}
                  onChange={e => handleFileContentChange(e.target.value)}
                  readOnly={disabled}
                  spellCheck={false}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: '8px 12px',
                    fontFamily: 'var(--font-code)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    background: '#fafafa',
                    color: 'var(--colour-text)',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Image preview not available in virtual filesystem</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {contextMenu && !disabled && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.targetPath)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
