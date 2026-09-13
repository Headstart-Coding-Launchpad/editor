import React, { useState, useRef, useEffect } from 'react'

export const HTML_ONLY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
</head>
<body>

</body>
</html>`

const HTML_WITH_CSS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

</body>
</html>`

const HTML_WITH_CSS_JS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <script src="script.js"></script>
</body>
</html>`

const TEMPLATES = [
  {
    label: 'HTML',
    files: [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
    entry: 'index.html',
  },
  {
    label: 'HTML + CSS',
    files: [
      { name: 'index.html', type: 'html', content: HTML_WITH_CSS },
      { name: 'style.css', type: 'css', content: '' },
    ],
    entry: 'index.html',
  },
  {
    label: 'HTML + CSS + JS',
    files: [
      { name: 'index.html', type: 'html', content: HTML_WITH_CSS_JS },
      { name: 'style.css', type: 'css', content: '' },
      { name: 'script.js', type: 'javascript', content: '' },
    ],
    entry: 'index.html',
  },
]

export default function FileManager({
  files = [],
  entryFile,
  onAddFile,
  onDeleteFile,
  onRenameFile,
  onChangeType,
  onChangeEntryFile,
  onSetFiles,
  selectedFile,
  onSelectFile,
  attachedTop = false,
}) {
  const [generateOpen, setGenerateOpen] = useState(false)
  const generateRef = useRef(null)

  useEffect(() => {
    if (!generateOpen) return
    function onPointerDown(e) {
      if (generateRef.current && !generateRef.current.contains(e.target)) {
        setGenerateOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [generateOpen])

  function handleAdd() {
    const name = prompt('Filename (e.g. about.html, style.css, script.js):')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    if (files.some((f) => f.name === trimmed)) {
      alert(`A file named "${trimmed}" already exists.`)
      return
    }
    const type = trimmed.endsWith('.css') ? 'css' : trimmed.endsWith('.js') ? 'javascript' : 'html'
    onAddFile({ name: trimmed, type, content: '' })
  }

  function handleGenerate(template) {
    setGenerateOpen(false)
    onSetFiles?.(template.files, template.entry)
  }

  return (
    <div style={{ ...s.wrap, ...(attachedTop ? s.wrapAttachedTop : {}) }}>
      <div style={{ ...s.header, ...(attachedTop ? s.headerAttachedTop : {}) }}>
        <span style={s.label}>Files</span>
        <div style={s.headerBtns}>
          <div ref={generateRef} style={s.generateWrap}>
            <button style={s.generateBtn} onClick={() => setGenerateOpen((o) => !o)}>
              Generate ▾
            </button>
            {generateOpen && (
              <div style={s.generateDropdown} className="ui-popover">
                {TEMPLATES.map((t) => (
                  <button key={t.label} style={s.generateOption} onClick={() => handleGenerate(t)}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-primary" style={s.addBtn} onClick={handleAdd}>
            + File
          </button>
        </div>
      </div>

      {files.map((f) => (
        <div
          key={f.name}
          style={{
            ...s.row,
            ...(f.name === selectedFile ? s.rowActive : {}),
          }}
          onClick={() => onSelectFile?.(f.name)}
        >
          <span style={s.filename}>{f.name}</span>
          <select
            style={s.typeSelect}
            value={f.type}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChangeType?.(f.name, e.target.value)}
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="javascript">JS</option>
          </select>
          <button
            style={s.deleteBtn}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteFile?.(f.name)
            }}
            title="Delete file"
          >
            ✕
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <div style={s.entryRow}>
          <label style={s.entryLabel}>
            Entry file:
            <select
              style={s.typeSelect}
              value={entryFile ?? files[0]?.name ?? ''}
              onChange={(e) => onChangeEntryFile?.(e.target.value)}
            >
              {files
                .filter((f) => f.type === 'html' || f.name.endsWith('.html'))
                .map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  wrapAttachedTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  header: {
    background: '#f0f0f0',
    padding: '6px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb',
    borderRadius: '7px 7px 0 0',
  },
  headerAttachedTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  headerBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  generateWrap: {
    position: 'relative',
  },
  generateBtn: {
    fontSize: 11,
    padding: '3px 8px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    border: '1px solid var(--colour-primary)',
    borderRadius: 5,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  generateDropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    zIndex: 20,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 7,
    boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
    minWidth: 160,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  generateOption: {
    padding: '9px 14px',
    border: 0,
    background: 'transparent',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6',
  },
  addBtn: { fontSize: 11, padding: '3px 8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #f5f5f5',
  },
  rowActive: { background: '#f0eafa' },
  filename: {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
  },
  typeSelect: {
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: '0.78rem',
    padding: '2px 4px',
    fontFamily: 'var(--font-body)',
    background: '#fff',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 4,
    opacity: 0.7,
  },
  entryRow: {
    padding: '6px 10px',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  entryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#6b7280',
  },
}
