import { useState, useRef, useEffect } from 'react'
import {
  DEFAULT_FS,
  listChildren,
  createEntry,
  deleteEntry,
  renameEntry,
  entryName,
  normaliseDirPath,
  normaliseFilePath,
} from '../../../shared/filesystem.js'

const s = {
  label: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' },
  input: {
    fontFamily: 'var(--font-body)', fontSize: '0.9rem', padding: '6px 10px',
    border: '1px solid var(--ui-border)', borderRadius: 6, background: '#fff',
    color: 'var(--colour-text)', width: '100%', boxSizing: 'border-box',
  },
  smallBtn: {
    background: 'none', border: '1px solid var(--ui-border)', borderRadius: 4,
    cursor: 'pointer', fontSize: '0.75rem', padding: '2px 5px',
    fontFamily: 'var(--font-body)', color: 'var(--colour-text)',
  },
}

// ── Compact tree editor used in the builder ───────────────────────────────────

function FsTreeEditorNode({ fs, path, onFsChange, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [adding, setAdding] = useState(null) // 'file' | 'dir'
  const [renaming, setRenaming] = useState(false)
  const addRef = useRef(null)
  const renameRef = useRef(null)

  useEffect(() => { if (adding && addRef.current) addRef.current.focus() }, [adding])
  useEffect(() => { if (renaming && renameRef.current) renameRef.current.focus() }, [renaming])

  const children = listChildren(fs, path).sort((a, b) => {
    const aIsDir = a.endsWith('/')
    const bIsDir = b.endsWith('/')
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return entryName(a).localeCompare(entryName(b))
  })

  function commitAdd(name) {
    if (!name.trim()) { setAdding(null); return }
    const type = adding
    const raw = adding === 'dir' ? normaliseDirPath(path + name.trim()) : normaliseFilePath(path + name.trim())
    onFsChange(createEntry(fs, raw, type))
    setAdding(null)
  }

  function commitRename(newName) {
    setRenaming(false)
    if (!newName.trim() || newName.trim() === entryName(path)) return
    onFsChange(renameEntry(fs, path, newName.trim()))
  }

  function handleDelete() {
    if (!confirm(`Delete "${entryName(path)}"?`)) return
    onFsChange(deleteEntry(fs, path))
  }

  const isRoot = path === '/'
  const name = isRoot ? '/ (root)' : entryName(path)

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
        <span
          style={{ cursor: 'pointer', fontSize: '0.75rem', width: 14, textAlign: 'center', opacity: 0.6 }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ fontSize: '0.85rem' }}>📁</span>
        {renaming && !isRoot ? (
          <input
            ref={renameRef}
            defaultValue={entryName(path)}
            style={{ ...s.input, padding: '1px 4px', width: 120, fontSize: '0.8rem' }}
            onBlur={e => commitRename(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(e.target.value); if (e.key === 'Escape') setRenaming(false) }}
          />
        ) : (
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', flex: 1 }}>{name}</span>
        )}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <button
            title="Add file"
            style={{ ...s.smallBtn }}
            onClick={() => { setExpanded(true); setAdding('file') }}
          >📄+</button>
          <button
            title="Add folder"
            style={{ ...s.smallBtn }}
            onClick={() => { setExpanded(true); setAdding('dir') }}
          >📁+</button>
          {!isRoot && (
            <>
              <button title="Rename" style={{ ...s.smallBtn }} onClick={() => setRenaming(true)}>✏️</button>
              <button title="Delete" style={{ ...s.smallBtn, color: '#dc2626' }} onClick={handleDelete}>🗑</button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div>
          {adding && (
            <div style={{ marginLeft: 30, padding: '2px 0' }}>
              <input
                ref={addRef}
                placeholder={adding === 'file' ? 'filename.txt' : 'folder-name'}
                style={{ ...s.input, padding: '2px 6px', width: 160, fontSize: '0.8rem' }}
                onBlur={e => commitAdd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitAdd(e.target.value); if (e.key === 'Escape') setAdding(null) }}
              />
            </div>
          )}
          {children.map(childPath =>
            childPath.endsWith('/') ? (
              <FsTreeEditorNode
                key={childPath}
                fs={fs}
                path={childPath}
                onFsChange={onFsChange}
                depth={depth + 1}
              />
            ) : (
              <FsFileRow
                key={childPath}
                path={childPath}
                onRename={newName => onFsChange(renameEntry(fs, childPath, newName))}
                onDelete={() => onFsChange(deleteEntry(fs, childPath))}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function FsFileRow({ path, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (renaming && ref.current) ref.current.focus() }, [renaming])

  function commitRename(newName) {
    setRenaming(false)
    if (newName.trim() && newName.trim() !== entryName(path)) onRename(newName.trim())
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', marginLeft: 30 }}>
      <span style={{ fontSize: '0.85rem' }}>📄</span>
      {renaming ? (
        <input
          ref={ref}
          defaultValue={entryName(path)}
          style={{ ...s.input, padding: '1px 4px', width: 140, fontSize: '0.8rem' }}
          onBlur={e => commitRename(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(e.target.value); if (e.key === 'Escape') setRenaming(false) }}
        />
      ) : (
        <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', flex: 1 }}>{entryName(path)}</span>
      )}
      <button title="Rename" style={{ ...s.smallBtn }} onClick={() => setRenaming(true)}>✏️</button>
      <button title="Delete" style={{ ...s.smallBtn, color: '#dc2626' }} onClick={() => { if (confirm(`Delete "${entryName(path)}"?`)) onDelete() }}>🗑</button>
    </div>
  )
}

export function FsTreeEditor({ label, fs, onFsChange }) {
  const safeFsValue = fs && typeof fs === 'object' ? fs : DEFAULT_FS

  return (
    <div>
      <div style={{ ...s.label, marginBottom: 6 }}>{label}</div>
      <div style={{ border: '1px solid var(--ui-border)', borderRadius: 6, padding: '8px 10px', background: '#fbf9ff', maxHeight: 280, overflowY: 'auto' }}>
        <FsTreeEditorNode fs={safeFsValue} path="/" onFsChange={onFsChange} depth={0} />
      </div>
    </div>
  )
}

// ── Check editor for filesystem checks ───────────────────────────────────────

const FS_CHECK_TYPE_OPTIONS = [
  { value: 'fs_file_exists', label: 'File exists', fields: ['path'] },
  { value: 'fs_dir_exists', label: 'Folder exists', fields: ['path'] },
  { value: 'fs_not_exists', label: 'Path does not exist', fields: ['path'] },
  { value: 'fs_content_contains', label: 'File content contains', fields: ['path', 'value'] },
  { value: 'fs_content_equals', label: 'File content equals', fields: ['path', 'value'] },
  { value: 'fs_file_in_dir', label: 'File is inside folder', fields: ['path', 'dir'] },
]

function FsSingleCheckEditor({ check, onChange, onRemove }) {
  const opt = FS_CHECK_TYPE_OPTIONS.find(o => o.value === check.type) ?? FS_CHECK_TYPE_OPTIONS[0]

  function setField(field, val) {
    onChange({ ...check, [field]: val })
  }

  return (
    <div style={{ border: '1px solid var(--ui-border)', borderRadius: 6, padding: 10, marginBottom: 8, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select
          value={check.type}
          onChange={e => {
            const next = FS_CHECK_TYPE_OPTIONS.find(o => o.value === e.target.value)
            const skeleton = { type: e.target.value, path: check.path ?? '' }
            if (next.fields.includes('value')) skeleton.value = check.value ?? ''
            if (next.fields.includes('dir')) skeleton.dir = check.dir ?? '/'
            if (check.hint) skeleton.hint = check.hint
            onChange(skeleton)
          }}
          style={{ ...s.input, flex: 1, fontSize: '0.82rem' }}
        >
          {FS_CHECK_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem' }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Path
          <input
            value={check.path ?? ''}
            onChange={e => setField('path', e.target.value)}
            placeholder={opt.fields.includes('dir') ? '/Documents/notes.txt' : check.type === 'fs_dir_exists' ? '/Documents/' : '/file.txt'}
            style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
          />
        </label>

        {opt.fields.includes('value') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Expected content
            <input
              value={check.value ?? ''}
              onChange={e => setField('value', e.target.value)}
              placeholder="Text the file should contain…"
              style={{ ...s.input, fontSize: '0.82rem' }}
            />
          </label>
        )}

        {opt.fields.includes('dir') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Parent folder
            <input
              value={check.dir ?? '/'}
              onChange={e => setField('dir', e.target.value)}
              placeholder="/Documents/"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Hint (optional)
          <input
            value={check.hint ?? ''}
            onChange={e => setField('hint', e.target.value || undefined)}
            placeholder="Shown to the student when this check fails…"
            style={{ ...s.input, fontSize: '0.82rem' }}
          />
        </label>
      </div>
    </div>
  )
}

export function FsCheckListEditor({ checks, onChange }) {
  const safeChecks = Array.isArray(checks) ? checks : checks ? [checks] : []

  function handleChange(i, updated) {
    const next = [...safeChecks]
    next[i] = updated
    onChange(next.length === 1 ? next[0] : next)
  }

  function handleRemove(i) {
    const next = safeChecks.filter((_, idx) => idx !== i)
    onChange(next.length === 0 ? null : next.length === 1 ? next[0] : next)
  }

  function handleAdd() {
    const next = [...safeChecks, { type: 'fs_file_exists', path: '' }]
    onChange(next.length === 1 ? next[0] : next)
  }

  return (
    <div>
      {safeChecks.map((c, i) => (
        <FsSingleCheckEditor
          key={i}
          check={c}
          onChange={updated => handleChange(i, updated)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      <button onClick={handleAdd} style={{ ...s.smallBtn, fontSize: '0.82rem', padding: '4px 10px' }}>
        + Add check
      </button>
    </div>
  )
}
