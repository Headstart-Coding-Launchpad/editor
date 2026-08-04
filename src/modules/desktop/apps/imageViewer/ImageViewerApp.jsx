import React, { useMemo, useState } from 'react'
import { listChildren, parentPath, entryName } from '../../../filesystem/filesystem.js'
import { isImage, imagePreviewSrc } from '../../../filesystem/FilesystemTask.jsx'
import FileDialog from '../shared/FileDialog.jsx'

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

// A read-only image window: zoom controls plus Previous/Next across sibling images in the
// same folder. Never carries `draftContent`, so it's never "dirty" and closes without
// confirmation (see WindowManager's generic isWindowDirty guard).
export default function ImageViewerApp({ win, state, onStateChange, disabled, onInteraction, assetsPath, assets = [] }) {
  const { fs } = state
  const filePath = win.filePath ?? null
  const [zoom, setZoom] = useState(1)
  const [showOpenDialog, setShowOpenDialog] = useState(false)

  const siblings = useMemo(() => {
    if (!filePath) return []
    return listChildren(fs, parentPath(filePath))
      .filter(p => !p.endsWith('/') && isImage(p))
      .sort((a, b) => entryName(a).localeCompare(entryName(b), undefined, { sensitivity: 'base' }))
  }, [fs, filePath])

  const currentIndex = filePath ? siblings.indexOf(filePath) : -1

  function openPath(path) {
    onStateChange({ ...state, windows: state.windows.map(w => w.id === win.id ? { ...w, filePath: path } : w) })
    setZoom(1)
    onInteraction?.({ currentDir: parentPath(path), openFile: path })
  }

  function goTo(offset) {
    if (currentIndex < 0 || siblings.length === 0) return
    const next = siblings[(currentIndex + offset + siblings.length) % siblings.length]
    openPath(next)
  }

  const entry = filePath ? fs[filePath] : null
  const src = entry ? imagePreviewSrc(filePath, entry, assetsPath, assets) : ''

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={() => setShowOpenDialog(true)}>
          📂 Open
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled || siblings.length < 2} onClick={() => goTo(-1)}>
          ◀ Prev
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled || siblings.length < 2} onClick={() => goTo(1)}>
          Next ▶
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={!filePath} onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.25))}>
          −
        </button>
        <span style={s.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={!filePath} onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.25))}>
          +
        </button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={!filePath} onClick={() => setZoom(1)}>
          Reset
        </button>
        {filePath && <span style={s.fileLabel}>{entryName(filePath)}</span>}
      </div>
      <div style={s.viewport}>
        {!filePath ? (
          <div style={s.empty}>
            <p>No image open</p>
            <button className="btn-ghost-outline" disabled={disabled} onClick={() => setShowOpenDialog(true)}>
              📂 Open an image
            </button>
          </div>
        ) : src ? (
          <img src={src} alt={entryName(filePath)} style={{ ...s.image, transform: `scale(${zoom})` }} />
        ) : (
          <span style={s.empty}>No preview source configured for this image</span>
        )}
      </div>
      {showOpenDialog && (
        <FileDialog
          fs={fs}
          mode="open"
          title="Open Image"
          filterExtensions={IMAGE_EXTS}
          onConfirm={path => { setShowOpenDialog(false); openPath(path) }}
          onCancel={() => setShowOpenDialog(false)}
        />
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--ui-border)', flexWrap: 'wrap' },
  toolbarBtn: { fontSize: '0.78rem', padding: '3px 10px' },
  zoomLabel: { fontSize: '0.78rem', color: '#6b7280', fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'center' },
  fileLabel: { marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280', fontFamily: 'var(--font-body)' },
  viewport: { flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' },
  image: { maxWidth: '100%', maxHeight: '100%', transition: 'transform 0.1s ease' },
  empty: { color: '#9ca3af', fontSize: '0.85rem', fontFamily: 'var(--font-body)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' },
}
