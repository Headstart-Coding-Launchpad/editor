import React, { useEffect, useRef, useState } from 'react'
import { entryName, parentPath } from '../../../filesystem/filesystem.js'
import { openWindow, isWindowDirty } from '../../desktopState.js'
import FileDialog from '../shared/FileDialog.jsx'

const PALETTE = ['#1f2937', '#dc2626', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']
const BRUSH_SIZES = [{ label: 'S', size: 3 }, { label: 'M', size: 8 }, { label: 'L', size: 16 }]
const MAX_UNDO = 20

// A freehand canvas paint app. Like Text Editor, edits are explicit-save: the canvas is
// captured to a PNG data: URL on each stroke and stored as this window's `draftContent`
// (so the generic isWindowDirty/confirm-before-close guard applies for free), and only
// written into `fs` on Save/Save As. Saved files carry their image data directly on
// `content` as a data: URL — see FilesystemTask.jsx's imagePreviewSrc, which Image Viewer
// and File Manager's thumbnail both already read that from.
export default function PaintApp({ win, state, onStateChange, disabled, onInteraction }) {
  const { fs } = state
  const filePath = win.filePath ?? null
  const dirty = isWindowDirty(win, fs)
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const undoStackRef = useRef([])

  const [color, setColor] = useState(PALETTE[0])
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].size)
  const [tool, setTool] = useState('brush')
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [openError, setOpenError] = useState('')
  const [canUndo, setCanUndo] = useState(false)

  // Load the window's current image (its saved content, or an unsaved draft) into the
  // canvas whenever the window switches to a different file — but never while the
  // student is mid-stroke on this same canvas.
  useEffect(() => {
    fillWhite(canvasRef.current)
    const source = win.draftContent || (filePath ? fs[filePath]?.content : null)
    if (source) loadDataUrlIntoCanvas(canvasRef.current, source)
    undoStackRef.current = []
    setCanUndo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.id, filePath])

  function updateWindow(patch) {
    onStateChange({ ...state, windows: state.windows.map(w => w.id === win.id ? { ...w, ...patch } : w) })
  }

  function captureDraft() {
    updateWindow({ draftContent: canvasRef.current.toDataURL('image/png') })
  }

  function pushUndoSnapshot() {
    const canvas = canvasRef.current
    if (!canvas) return
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), canvas.toDataURL('image/png')]
    setCanUndo(true)
  }

  function handlePointerDown(e) {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d')
    if (!ctx) return
    pushUndoSnapshot()
    drawingRef.current = true
    lastPointRef.current = pointFromEvent(canvas, e)
    drawDot(ctx, lastPointRef.current, tool === 'eraser' ? '#ffffff' : color, brushSize)
  }

  function handlePointerMove(e) {
    if (disabled || !drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d')
    if (!ctx) return
    const point = pointFromEvent(canvas, e)
    drawLine(ctx, lastPointRef.current, point, tool === 'eraser' ? '#ffffff' : color, brushSize)
    lastPointRef.current = point
  }

  function handlePointerUp() {
    if (disabled || !drawingRef.current) return
    drawingRef.current = false
    captureDraft()
  }

  function handleUndo() {
    if (disabled) return
    const snapshot = undoStackRef.current.pop()
    setCanUndo(undoStackRef.current.length > 0)
    if (snapshot === undefined) return
    loadDataUrlIntoCanvas(canvasRef.current, snapshot)
    captureDraft()
  }

  function handleClear() {
    if (disabled) return
    pushUndoSnapshot()
    fillWhite(canvasRef.current)
    captureDraft()
  }

  function commitSave(path, dataUrl) {
    onStateChange({
      ...state,
      fs: { ...fs, [path]: { type: 'file', content: dataUrl } },
      windows: state.windows.map(w => w.id === win.id ? { ...w, filePath: path, draftContent: dataUrl } : w),
    })
    onInteraction?.({ currentDir: parentPath(path), openFile: path })
  }

  function handleSave() {
    if (disabled) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    if (filePath) commitSave(filePath, dataUrl)
    else setShowSaveDialog(true)
  }

  function handleOpenConfirm(path) {
    const content = fs[path]?.content
    if (typeof content !== 'string' || !content.startsWith('data:image/')) {
      setOpenError(`"${entryName(path)}" isn't a drawing Paint can open.`)
      return
    }
    setShowOpenDialog(false)
    setOpenError('')
    if (!dirty) {
      updateWindow({ filePath: path, draftContent: content })
      onInteraction?.({ currentDir: parentPath(path), openFile: path })
    } else {
      onStateChange(openWindow(state, 'paint', { filePath: path, draftContent: content }))
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={() => setShowOpenDialog(true)}>📂 Open</button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={handleSave}>💾 Save</button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={() => setShowSaveDialog(true)}>Save As…</button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled || !canUndo} onClick={handleUndo}>↶ Undo</button>
        <button className="btn-ghost-outline" style={s.toolbarBtn} disabled={disabled} onClick={handleClear}>🧹 Clear</button>
        <span style={s.fileLabel}>{filePath ? entryName(filePath) : 'Untitled'}{dirty ? ' •' : ''}</span>
      </div>
      <div style={s.subToolbar}>
        <button
          className="btn-ghost-outline"
          style={{ ...s.toolBtn, background: tool === 'brush' ? 'var(--colour-primary)' : undefined, color: tool === 'brush' ? '#fff' : undefined }}
          disabled={disabled}
          onClick={() => setTool('brush')}
        >
          🖌 Brush
        </button>
        <button
          className="btn-ghost-outline"
          style={{ ...s.toolBtn, background: tool === 'eraser' ? 'var(--colour-primary)' : undefined, color: tool === 'eraser' ? '#fff' : undefined }}
          disabled={disabled}
          onClick={() => setTool('eraser')}
        >
          🧽 Eraser
        </button>
        <div style={s.swatches}>
          {PALETTE.map(swatch => (
            <button
              key={swatch}
              aria-label={`Colour ${swatch}`}
              disabled={disabled}
              onClick={() => { setColor(swatch); setTool('brush') }}
              style={{ ...s.swatch, background: swatch, outline: color === swatch && tool === 'brush' ? '2px solid var(--colour-primary)' : '1px solid var(--ui-border)' }}
            />
          ))}
          <input
            type="color"
            aria-label="Custom colour"
            value={color}
            disabled={disabled}
            onChange={e => { setColor(e.target.value); setTool('brush') }}
            style={s.colorInput}
          />
        </div>
        <div style={s.sizes}>
          {BRUSH_SIZES.map(({ label, size }) => (
            <button
              key={label}
              className="btn-ghost-outline"
              style={{ ...s.sizeBtn, background: brushSize === size ? 'var(--colour-primary)' : undefined, color: brushSize === size ? '#fff' : undefined }}
              disabled={disabled}
              onClick={() => setBrushSize(size)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={s.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={640}
          height={420}
          role="img"
          aria-label="Paint canvas"
          style={{ ...s.canvas, cursor: disabled ? 'default' : 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      {openError && <div style={s.error}>{openError}</div>}
      {showOpenDialog && (
        <FileDialog
          fs={fs}
          mode="open"
          title="Open Drawing"
          filterExtensions={['.png']}
          onConfirm={handleOpenConfirm}
          onCancel={() => setShowOpenDialog(false)}
        />
      )}
      {showSaveDialog && (
        <FileDialog
          fs={fs}
          mode="saveAs"
          title="Save As"
          defaultFileName={filePath ? entryName(filePath) : 'Untitled.png'}
          initialDir={filePath ? parentPath(filePath) : '/'}
          onFsChange={nextFs => onStateChange({ ...state, fs: nextFs })}
          onConfirm={path => { commitSave(path, canvasRef.current.toDataURL('image/png')); setShowSaveDialog(false) }}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}

function pointFromEvent(canvas, e) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / (rect.width || canvas.width)
  const scaleY = canvas.height / (rect.height || canvas.height)
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
}

function drawDot(ctx, point, strokeColor, size) {
  ctx.fillStyle = strokeColor
  ctx.beginPath()
  ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawLine(ctx, from, to, strokeColor, size) {
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

function fillWhite(canvas) {
  const ctx = canvas?.getContext?.('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function loadDataUrlIntoCanvas(canvas, dataUrl) {
  const ctx = canvas?.getContext?.('2d')
  if (!ctx) return
  const img = new Image()
  img.onload = () => {
    fillWhite(canvas)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = dataUrl
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--ui-border)', flexWrap: 'wrap' },
  toolbarBtn: { fontSize: '0.78rem', padding: '3px 10px' },
  fileLabel: { marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280', fontFamily: 'var(--font-body)' },
  subToolbar: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderBottom: '1px solid var(--ui-border)', flexWrap: 'wrap' },
  toolBtn: { fontSize: '0.78rem', padding: '3px 10px' },
  swatches: { display: 'flex', alignItems: 'center', gap: 4 },
  swatch: { width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer' },
  colorInput: { width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' },
  sizes: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  sizeBtn: { fontSize: '0.75rem', padding: '3px 9px' },
  canvasWrap: { flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 12 },
  canvas: { background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', touchAction: 'none', maxWidth: '100%' },
  error: { padding: '4px 10px', fontSize: '0.76rem', color: '#dc2626', fontFamily: 'var(--font-body)' },
}
