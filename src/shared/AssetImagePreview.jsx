import React, { useState } from 'react'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

export function isImageFile(name) {
  if (!name) return false
  return IMAGE_EXTS.has(name.split('.').pop().toLowerCase())
}

export function useImagePreview() {
  const [preview, setPreview] = useState(null)

  function showPreview(src, anchorEl) {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const tipW = 192
    const tipH = 156
    const x = rect.right + 8 + tipW > window.innerWidth ? rect.left - tipW - 8 : rect.right + 8
    const y = Math.min(rect.top, window.innerHeight - tipH - 8)
    setPreview({ src, x, y })
  }

  function hidePreview() {
    setPreview(null)
  }

  return { preview, showPreview, hidePreview }
}

export function ImagePreviewTooltip({ preview }) {
  if (!preview) return null
  return (
    <div style={{ ...s.tooltip, left: preview.x, top: preview.y }}>
      <img src={preview.src} alt="" style={s.img} />
    </div>
  )
}

const s = {
  tooltip: {
    position: 'fixed',
    zIndex: 10000,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    pointerEvents: 'none',
  },
  img: {
    maxWidth: 180,
    maxHeight: 140,
    display: 'block',
    borderRadius: 4,
  },
}
