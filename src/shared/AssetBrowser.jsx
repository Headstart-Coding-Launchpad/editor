import React, { useRef } from 'react'
import { isImageFile, useImagePreview, ImagePreviewTooltip } from './AssetImagePreview'

function buildTree(assets) {
  const root = {}
  for (const assetPath of assets) {
    const parts = assetPath.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { _dir: true, _ch: {} }
      node = node[parts[i]]._ch
    }
    const name = parts[parts.length - 1]
    node[name] = { _dir: false, _path: assetPath }
  }
  return root
}

function DirNode({ name, childNodes, assetsPath, copyMode, mode, onSelect, depth }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div>
      <button
        style={{ ...s.dirBtn, paddingLeft: 8 + depth * 14 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={s.arrow}>{open ? '▾' : '▸'}</span>
        <span style={s.itemLabel}>📁 {name}</span>
      </button>
      {open && Object.entries(childNodes).map(([n, node]) =>
        node._dir
          ? <DirNode key={n} name={n} childNodes={node._ch} assetsPath={assetsPath} copyMode={copyMode} mode={mode} onSelect={onSelect} depth={depth + 1} />
          : <FileNode key={n} name={n} path={node._path} assetsPath={assetsPath} copyMode={copyMode} mode={mode} onSelect={onSelect} depth={depth + 1} />
      )}
    </div>
  )
}

function FileNode({ name, path, assetsPath, copyMode, mode, onSelect, depth }) {
  const [copied, setCopied] = React.useState(false)
  const rowRef = useRef(null)
  const { preview, showPreview, hidePreview } = useImagePreview()

  const staticUrl = assetsPath + path
  const copyValue = copyMode === 'full' ? staticUrl : path

  function handleCopy() {
    navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleSelect() {
    onSelect?.(path)
  }

  return (
    <div
      ref={rowRef}
      style={{ ...s.fileRow, paddingLeft: 8 + depth * 14 }}
      onMouseEnter={isImageFile(name) ? () => showPreview(staticUrl, rowRef.current) : undefined}
      onMouseLeave={isImageFile(name) ? hidePreview : undefined}
    >
      <span style={s.itemLabel}>{isImageFile(name) ? '🖼' : '📄'} {name}</span>
      {mode === 'select' ? (
        <button style={s.actionBtn} onClick={handleSelect}>
          Select
        </button>
      ) : (
        <button style={s.actionBtn} onClick={handleCopy}>
          {copied ? '✓' : 'Copy'}
        </button>
      )}
      <ImagePreviewTooltip preview={preview} />
    </div>
  )
}

function StorageFileNode({ name, url, copyMode, mode, onSelect }) {
  const [copied, setCopied] = React.useState(false)
  const rowRef = useRef(null)
  const { preview, showPreview, hidePreview } = useImagePreview()

  const copyValue = copyMode === 'relative' ? name : url

  function handleCopy() {
    navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      ref={rowRef}
      style={{ ...s.fileRow, paddingLeft: 8 }}
      onMouseEnter={isImageFile(name) ? () => showPreview(url, rowRef.current) : undefined}
      onMouseLeave={isImageFile(name) ? hidePreview : undefined}
    >
      <span style={s.itemLabel}>{isImageFile(name) ? '🖼' : '📄'} {name}</span>
      {mode === 'select' ? (
        <button style={s.actionBtn} onClick={() => onSelect?.(url)}>Select</button>
      ) : (
        <button style={s.actionBtn} onClick={handleCopy}>{copied ? '✓' : copyMode === 'relative' ? 'Copy' : 'Copy URL'}</button>
      )}
      <ImagePreviewTooltip preview={preview} />
    </div>
  )
}

/**
 * Renders a tree of lesson assets plus any Firebase Storage assets.
 *
 * assetsPath    – fully resolved URL base, e.g. "/headstart-repl/assets/web-intro/"
 * assets        – array of relative paths, e.g. ["images/logo.png", "fonts/x.woff2"]
 * storageAssets – array of {name, url} from Firebase Storage (absolute download URLs)
 * copyMode      – "relative" copies just the path; "full" copies assetsPath + path (browse mode only)
 * mode          – "browse" (default) shows Copy button; "select" shows Select button and calls onSelect
 * onSelect      – called with the path/URL when mode="select" and user clicks Select
 * style         – optional style overrides on the outer panel
 */
export default function AssetBrowser({ assetsPath, assets, storageAssets, copyMode = 'relative', mode = 'browse', onSelect, style }) {
  const hasStatic = assetsPath && assets?.length > 0
  const hasStorage = storageAssets?.length > 0
  if (!hasStatic && !hasStorage) return null

  const tree = hasStatic ? buildTree(assets) : {}

  return (
    <div style={{ ...s.panel, ...style }}>
      {hasStatic && Object.entries(tree).map(([name, node]) =>
        node._dir
          ? <DirNode key={name} name={name} childNodes={node._ch} assetsPath={assetsPath} copyMode={copyMode} mode={mode} onSelect={onSelect} depth={0} />
          : <FileNode key={name} name={name} path={node._path} assetsPath={assetsPath} copyMode={copyMode} mode={mode} onSelect={onSelect} depth={0} />
      )}
      {hasStorage && (
        <>
          {hasStatic && <div style={s.storageDivider}><span style={s.storageDividerLabel}>Firebase Storage</span></div>}
          {storageAssets.map(asset => (
            <StorageFileNode key={asset.name} name={asset.name} url={asset.url} copyMode={copyMode} mode={mode} onSelect={onSelect} />
          ))}
        </>
      )}
    </div>
  )
}

const s = {
  panel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  dirBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    padding: '5px 8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    boxSizing: 'border-box',
  },
  arrow: { fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, width: 10 },
  itemLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  storageDivider: {
    padding: '4px 8px',
    borderTop: '1px solid #e5e7eb',
    background: '#f0fdf4',
  },
  storageDividerLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  actionBtn: {
    flexShrink: 0,
    padding: '2px 8px',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
}
