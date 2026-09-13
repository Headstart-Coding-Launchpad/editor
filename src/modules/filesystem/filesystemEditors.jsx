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
} from './filesystem.js'
import { normalizeFsCheck } from './checks.js'
import { fileExtension } from '../../shared/textUtils'
import { CheckFeedbackControls } from '../../builder/components/task-editor/CheckEditors'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const TEXT_EXTS = new Set(['txt', 'md', 'csv'])

const s = {
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '6px 10px',
    border: '1px solid var(--ui-border)',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  smallBtn: {
    background: 'none',
    border: '1px solid var(--ui-border)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 5px',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
  },
}

// ── Compact tree editor used in the builder ───────────────────────────────────

function FsTreeEditorNode({ fs, path, onFsChange, storageAssets = [], depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [adding, setAdding] = useState(null) // 'file' | 'dir'
  const [renaming, setRenaming] = useState(false)
  const addRef = useRef(null)
  const renameRef = useRef(null)

  useEffect(() => {
    if (adding && addRef.current) addRef.current.focus()
  }, [adding])
  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus()
  }, [renaming])

  const children = listChildren(fs, path).sort((a, b) => {
    const aIsDir = a.endsWith('/')
    const bIsDir = b.endsWith('/')
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return entryName(a).localeCompare(entryName(b))
  })

  function commitAdd(name) {
    if (!name.trim()) {
      setAdding(null)
      return
    }
    const type = adding
    const raw =
      adding === 'dir'
        ? normaliseDirPath(path + name.trim())
        : normaliseFilePath(path + name.trim())
    onFsChange(createEntry(fs, raw, type))
    setAdding(null)
  }

  function commitRename(newName) {
    setRenaming(false)
    if (!newName.trim() || newName.trim() === entryName(path)) return
    onFsChange(renameEntry(fs, path, newName.trim()))
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${entryName(path)}"?`)) return
    onFsChange(deleteEntry(fs, path))
  }

  const isRoot = path === '/'
  const name = isRoot ? '/ (root)' : entryName(path)

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
        <span
          style={{
            cursor: 'pointer',
            fontSize: '0.75rem',
            width: 14,
            textAlign: 'center',
            opacity: 0.6,
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ fontSize: '0.85rem' }}>📁</span>
        {renaming && !isRoot ? (
          <input
            ref={renameRef}
            defaultValue={entryName(path)}
            style={{ ...s.input, padding: '1px 4px', width: 120, fontSize: '0.8rem' }}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(e.target.value)
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', flex: 1 }}>
            {name}
          </span>
        )}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <button
            title="Add file"
            style={{ ...s.smallBtn }}
            onClick={() => {
              setExpanded(true)
              setAdding('file')
            }}
          >
            📄+
          </button>
          <button
            title="Add folder"
            style={{ ...s.smallBtn }}
            onClick={() => {
              setExpanded(true)
              setAdding('dir')
            }}
          >
            📁+
          </button>
          {!isRoot && (
            <>
              <button title="Rename" style={{ ...s.smallBtn }} onClick={() => setRenaming(true)}>
                ✏️
              </button>
              <button
                title="Delete"
                style={{ ...s.smallBtn, color: '#dc2626' }}
                onClick={handleDelete}
              >
                🗑
              </button>
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
                onBlur={(e) => commitAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAdd(e.target.value)
                  if (e.key === 'Escape') setAdding(null)
                }}
              />
            </div>
          )}
          {children.map((childPath) =>
            childPath.endsWith('/') ? (
              <FsTreeEditorNode
                key={childPath}
                fs={fs}
                path={childPath}
                onFsChange={onFsChange}
                storageAssets={storageAssets}
                depth={depth + 1}
              />
            ) : (
              <FsFileRow
                key={childPath}
                path={childPath}
                entry={fs[childPath]}
                onRename={(newName) => onFsChange(renameEntry(fs, childPath, newName))}
                onDelete={() => onFsChange(deleteEntry(fs, childPath))}
                onUpdate={(updatedEntry) => onFsChange({ ...fs, [childPath]: updatedEntry })}
                storageAssets={storageAssets}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function FsFileRow({ path, entry, onRename, onDelete, onUpdate, storageAssets = [] }) {
  const [renaming, setRenaming] = useState(false)
  const [editingContents, setEditingContents] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (renaming && ref.current) ref.current.focus()
  }, [renaming])

  const ext = fileExtension(entryName(path))
  const isImage = IMAGE_EXTS.has(ext)
  const isText = TEXT_EXTS.has(ext)
  const hasContentsEditor = isImage || isText

  function commitRename(newName) {
    setRenaming(false)
    if (newName.trim() && newName.trim() !== entryName(path)) onRename(newName.trim())
  }

  return (
    <div style={{ marginLeft: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
        <span style={{ fontSize: '0.85rem' }}>📄</span>
        {renaming ? (
          <input
            ref={ref}
            defaultValue={entryName(path)}
            style={{ ...s.input, padding: '1px 4px', width: 140, fontSize: '0.8rem' }}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(e.target.value)
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-body)', flex: 1 }}>
            {entryName(path)}
          </span>
        )}
        {hasContentsEditor && (
          <button
            title={editingContents ? 'Hide contents' : 'Edit contents'}
            style={{ ...s.smallBtn, color: editingContents ? 'var(--colour-primary)' : undefined }}
            onClick={() => setEditingContents((v) => !v)}
          >
            {editingContents ? '▲' : 'contents'}
          </button>
        )}
        <button title="Rename" style={{ ...s.smallBtn }} onClick={() => setRenaming(true)}>
          ✏️
        </button>
        <button
          title="Delete"
          style={{ ...s.smallBtn, color: '#dc2626' }}
          onClick={() => {
            if (window.confirm(`Delete "${entryName(path)}"?`)) onDelete()
          }}
        >
          🗑
        </button>
      </div>

      {editingContents && isText && (
        <div style={{ paddingLeft: 18, paddingBottom: 4 }}>
          <textarea
            value={entry?.content ?? ''}
            onChange={(e) => onUpdate({ ...entry, content: e.target.value })}
            placeholder="File contents…"
            rows={3}
            style={{
              ...s.input,
              fontSize: '0.8rem',
              resize: 'vertical',
              minHeight: 52,
              fontFamily: 'var(--font-code)',
              padding: '4px 8px',
            }}
          />
        </div>
      )}

      {editingContents && isImage && (
        <div style={{ paddingLeft: 18, paddingBottom: 4 }}>
          {storageAssets.length > 0 ? (
            <select
              value={entry?.src ?? ''}
              onChange={(e) =>
                onUpdate({ type: 'file', ...(e.target.value ? { src: e.target.value } : {}) })
              }
              style={{ ...s.input, fontSize: '0.8rem' }}
            >
              <option value="">— select from Firebase Storage —</option>
              {storageAssets.map((a) => (
                <option key={a.url} value={a.url}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={entry?.src ?? ''}
              onChange={(e) =>
                onUpdate({ type: 'file', ...(e.target.value ? { src: e.target.value } : {}) })
              }
              placeholder="Image URL or path…"
              style={{ ...s.input, fontSize: '0.8rem' }}
            />
          )}
          {!storageAssets.length && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginTop: 3,
              }}
            >
              Upload images via Lesson Details → Storage Assets to enable the picker.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FsTreeEditor({ label, fs, onFsChange, storageAssets = [] }) {
  const safeFsValue = fs && typeof fs === 'object' ? fs : DEFAULT_FS

  return (
    <div>
      <div style={{ ...s.label, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          border: '1px solid var(--ui-border)',
          borderRadius: 6,
          padding: '8px 10px',
          background: '#fbf9ff',
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        <FsTreeEditorNode
          fs={safeFsValue}
          path="/"
          onFsChange={onFsChange}
          storageAssets={storageAssets}
          depth={0}
        />
      </div>
    </div>
  )
}

// ── Check editor for filesystem checks ───────────────────────────────────────

const COUNT_OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'greater_than_or_equal', label: 'at least' },
  { value: 'less_than', label: 'less than' },
  { value: 'less_than_or_equal', label: 'at most' },
]

const CONTENT_OPERATOR_OPTIONS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'matches_regex', label: 'matches regex' },
  { value: 'not_matches_regex', label: 'does not match regex' },
]

function preserveFsMeta(prev) {
  return {
    ...(prev.hint ? { hint: prev.hint } : {}),
    ...(prev.mode ? { mode: prev.mode } : {}),
    ...(prev.show ? { show: prev.show } : {}),
  }
}

// Legacy check types (fs_file_exists, fs_content_contains, ...) are resolved to their
// canonical form by the same `normalizeFsCheck` the runtime evaluator uses, instead of
// hand-maintaining a second type->UI mapping here that could drift from checks.js's alias
// table — see checks.js's FS_LEGACY_CHECK_ALIASES / normalizeFsCheck for the alias source.
function fsUiFromCheck(rawCheck) {
  const check = normalizeFsCheck(rawCheck)

  if (check.type === 'fs_path') {
    const subject =
      check.itemType === 'dir' ? 'folder_path' : check.itemType === 'any' ? 'any_path' : 'file_path'
    return { subject, aspect: 'path', operator: check.operator ?? 'exists' }
  }
  if (check.type === 'fs_file_content')
    return { subject: 'file', aspect: 'content', operator: check.operator ?? 'contains' }
  if (check.type === 'fs_file_line_count')
    return { subject: 'file', aspect: 'line_count', operator: check.operator ?? 'equals' }
  if (check.type === 'fs_file_location')
    return { subject: 'file', aspect: 'location', operator: 'in_folder' }
  if (check.type === 'fs_folder_count')
    return {
      subject: 'folder',
      aspect: check.itemType === 'dir' ? 'folder_count' : 'file_count',
      operator: check.operator ?? 'equals',
    }
  if (check.type === 'fs_opened')
    return {
      subject: 'opened',
      aspect: check.itemType === 'file' ? 'file' : 'folder',
      operator: 'is_open',
    }
  return { subject: 'file_path', aspect: 'path', operator: 'exists' }
}

function getFsSubjectOptions() {
  return [
    { value: 'file_path', label: 'File path' },
    { value: 'folder_path', label: 'Folder path' },
    { value: 'any_path', label: 'Any path' },
    { value: 'file', label: 'File' },
    { value: 'folder', label: 'Folder' },
    { value: 'opened', label: 'Opened' },
  ]
}

function getFsAspectOptions(subject) {
  if (subject === 'file_path' || subject === 'folder_path' || subject === 'any_path')
    return [{ value: 'path', label: 'Path' }]
  if (subject === 'file')
    return [
      { value: 'content', label: 'Content' },
      { value: 'line_count', label: 'Line count' },
      { value: 'location', label: 'Location' },
    ]
  if (subject === 'folder')
    return [
      { value: 'file_count', label: 'File count' },
      { value: 'folder_count', label: 'Subfolder count' },
    ]
  if (subject === 'opened')
    return [
      { value: 'file', label: 'File' },
      { value: 'folder', label: 'Folder' },
    ]
  return []
}

function defaultFsOperator(subject, aspect) {
  if (subject === 'file_path' || subject === 'folder_path') return 'exists'
  if (subject === 'any_path') return 'not_exists'
  if (subject === 'file' && aspect === 'content') return 'contains'
  if (subject === 'file' && aspect === 'location') return 'in_folder'
  if (subject === 'opened') return 'is_open'
  return 'equals'
}

function getFsOperatorOptions(subject, aspect) {
  if (subject === 'file_path' || subject === 'folder_path' || subject === 'any_path')
    return [
      { value: 'exists', label: 'exists' },
      { value: 'not_exists', label: 'does not exist' },
    ]
  if (subject === 'file' && aspect === 'content') return CONTENT_OPERATOR_OPTIONS
  if (subject === 'file' && aspect === 'location')
    return [{ value: 'in_folder', label: 'is inside' }]
  if (subject === 'opened') return [{ value: 'is_open', label: 'is open' }]
  return COUNT_OPERATOR_OPTIONS
}

function fsCheckFromUi(subject, aspect, operator, prev = {}) {
  const meta = preserveFsMeta(prev)
  const path = prev.path ?? ''

  if (subject === 'file_path' || subject === 'folder_path' || subject === 'any_path') {
    const itemType = subject === 'folder_path' ? 'dir' : subject === 'any_path' ? 'any' : 'file'
    return { type: 'fs_path', operator, itemType, path, ...meta }
  }
  if (subject === 'file' && aspect === 'content') {
    return {
      type: 'fs_file_content',
      operator,
      path,
      value: prev.value ?? '',
      ...(operator.includes('regex') && prev.flags ? { flags: prev.flags } : {}),
      ...meta,
    }
  }
  if (subject === 'file' && aspect === 'line_count') {
    return { type: 'fs_file_line_count', operator, path, value: prev.value ?? '', ...meta }
  }
  if (subject === 'file' && aspect === 'location') {
    return { type: 'fs_file_location', operator: 'in_folder', path, dir: prev.dir ?? '/', ...meta }
  }
  if (subject === 'folder') {
    return {
      type: 'fs_folder_count',
      operator,
      itemType: aspect === 'folder_count' ? 'dir' : 'file',
      path,
      value: prev.value ?? '',
      ...meta,
    }
  }
  if (subject === 'opened') {
    return {
      type: 'fs_opened',
      operator: 'is_open',
      itemType: aspect === 'folder' ? 'dir' : aspect,
      path,
      ...meta,
    }
  }
  return { type: 'fs_path', operator: 'exists', itemType: 'file', path, ...meta }
}

function FsSingleCheckEditor({ check, onChange, onRemove, feedbackEditor = false }) {
  const { subject, aspect, operator } = fsUiFromCheck(check)
  const aspectOptions = getFsAspectOptions(subject)
  const operatorOptions = getFsOperatorOptions(subject, aspect)
  const needsValue =
    (subject === 'file' && (aspect === 'content' || aspect === 'line_count')) ||
    subject === 'folder'
  const needsDir = subject === 'file' && aspect === 'location'
  const needsFlags = subject === 'file' && aspect === 'content' && operator.includes('regex')
  const valueLabel =
    subject === 'file' && aspect === 'content' ? 'Expected content' : 'Expected count'

  function setField(field, val) {
    onChange({ ...check, [field]: val })
  }

  function updateFromUi(nextSubject, nextAspect, nextOperator) {
    onChange(fsCheckFromUi(nextSubject, nextAspect, nextOperator, check))
  }

  return (
    <div
      style={{
        border: '1px solid var(--ui-border)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
        background: '#fff',
      }}
    >
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}
      >
        <select
          value={subject}
          onChange={(e) => {
            const nextSubject = e.target.value
            const nextAspect = getFsAspectOptions(nextSubject)[0]?.value ?? 'file'
            updateFromUi(nextSubject, nextAspect, defaultFsOperator(nextSubject, nextAspect))
          }}
          style={{ ...s.input, flex: '1 1 120px', fontSize: '0.82rem' }}
        >
          {getFsSubjectOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {aspectOptions.length > 1 && (
          <select
            value={aspect}
            onChange={(e) => {
              const nextAspect = e.target.value
              updateFromUi(subject, nextAspect, defaultFsOperator(subject, nextAspect))
            }}
            style={{ ...s.input, flex: '1 1 140px', fontSize: '0.82rem' }}
          >
            {aspectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <select
          value={operator}
          onChange={(e) => updateFromUi(subject, aspect, e.target.value)}
          style={{ ...s.input, flex: '1 1 140px', fontSize: '0.82rem' }}
        >
          {operatorOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#dc2626',
            fontSize: '1rem',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Path
          <input
            value={check.path ?? ''}
            onChange={(e) => setField('path', e.target.value)}
            placeholder={
              needsDir
                ? '/Documents/notes.txt'
                : subject === 'folder_path' || (subject === 'opened' && aspect === 'folder')
                  ? '/Documents/'
                  : '/file.txt'
            }
            style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
          />
        </label>

        {needsValue && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {valueLabel}
            <input
              value={check.value ?? ''}
              onChange={(e) => setField('value', e.target.value)}
              placeholder="Text the file should contain…"
              style={{ ...s.input, fontSize: '0.82rem' }}
            />
          </label>
        )}

        {needsFlags && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Regex flags (optional)
            <input
              value={check.flags ?? ''}
              onChange={(e) => setField('flags', e.target.value)}
              placeholder="e.g. i, m, s"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {needsDir && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Parent folder
            <input
              value={check.dir ?? '/'}
              onChange={(e) => setField('dir', e.target.value)}
              placeholder="/Documents/"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {feedbackEditor && <CheckFeedbackControls check={check} onChange={onChange} />}

        <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Hint (optional)
          <input
            value={check.hint ?? ''}
            onChange={(e) => setField('hint', e.target.value || undefined)}
            placeholder="Shown to the student when this check fails…"
            style={{ ...s.input, fontSize: '0.82rem' }}
          />
        </label>
      </div>
    </div>
  )
}

export function FsCheckListEditor({ checks, onChange, feedbackEditor = false }) {
  const safeChecks = Array.isArray(checks) ? checks : checks ? [checks] : []

  function handleChange(i, updated) {
    const next = [...safeChecks]
    next[i] = updated
    onChange(next)
  }

  function handleRemove(i) {
    const next = safeChecks.filter((_, idx) => idx !== i)
    onChange(next.length === 0 ? null : next)
  }

  function handleAdd() {
    const nextCheck = { type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }
    const next = [
      ...safeChecks,
      feedbackEditor ? { ...nextCheck, mode: 'blocking', show: 'after_attempt' } : nextCheck,
    ]
    onChange(next)
  }

  return (
    <div>
      {safeChecks.map((c, i) => (
        <FsSingleCheckEditor
          key={i}
          check={c}
          onChange={(updated) => handleChange(i, updated)}
          onRemove={() => handleRemove(i)}
          feedbackEditor={feedbackEditor}
        />
      ))}
      <button
        onClick={handleAdd}
        style={{ ...s.smallBtn, fontSize: '0.82rem', padding: '4px 10px' }}
      >
        + Add check
      </button>
    </div>
  )
}

export {
  fsUiFromCheck,
  fsCheckFromUi,
  getFsAspectOptions,
  getFsOperatorOptions,
  getFsSubjectOptions,
}
