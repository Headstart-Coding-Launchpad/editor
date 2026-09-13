import React, { useState, useRef, useEffect } from 'react'
import { useAssets } from './useAssets'
import { fileExtension } from './textUtils'
import { isImageFile, useImagePreview, ImagePreviewTooltip } from './AssetImagePreview'

const MANUAL_VALUE = '__manual__'

function optionLabel(filename) {
  const ext = fileExtension(filename)
  return ext ? `${filename}  [${ext}]` : filename
}

export default function AssetPicker({
  lessonId,
  lessonType,
  value,
  onChange,
  placeholder,
  assetsPath,
}) {
  const { lessonFolderAssets, sharedAssets, loading } = useAssets()
  const [showManual, setShowManual] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState(null)
  const [hoveredKey, setHoveredKey] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const { preview, showPreview, hidePreview } = useImagePreview()

  const lessonItems = lessonFolderAssets(lessonId)
  const typeItems = lessonType ? sharedAssets(lessonType) : []
  const commonItems = sharedAssets('common')
  const hasManifestEntries =
    lessonItems.length > 0 || typeItems.length > 0 || commonItems.length > 0

  const allManifestFiles = [...lessonItems, ...typeItems, ...commonItems]
  const valueInManifest = value && allManifestFiles.includes(value)
  const isManualMode = showManual || (value && !valueInManifest && !loading)

  const groups = [
    lessonItems.length > 0 ? { label: 'Lesson assets', items: lessonItems } : null,
    typeItems.length > 0 && lessonType
      ? { label: `Shared (${lessonType})`, items: typeItems }
      : null,
    commonItems.length > 0 ? { label: 'Shared (common)', items: commonItems } : null,
  ].filter(Boolean)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    function close() {
      closeDropdown()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function openDropdown() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropPos({ left: rect.left, top: rect.bottom + 2, width: rect.width })
    setOpen(true)
  }

  function closeDropdown() {
    setOpen(false)
    setHoveredKey(null)
    hidePreview()
  }

  function handleSelect(v) {
    setShowManual(false)
    onChange(v)
    closeDropdown()
  }

  function handleManualClick() {
    setShowManual(true)
    closeDropdown()
  }

  function switchToDropdown() {
    setShowManual(false)
    onChange('')
  }

  function handleItemEnter(f, e) {
    setHoveredKey(f)
    if (isImageFile(f) && assetsPath) {
      showPreview(assetsPath.replace(/\/$/, '') + '/' + f, e.currentTarget)
    }
  }

  function handleItemLeave() {
    setHoveredKey(null)
    hidePreview()
  }

  if (!hasManifestEntries || loading) {
    return (
      <input
        style={s.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'e.g. images/photo.png'}
      />
    )
  }

  if (isManualMode) {
    return (
      <div style={s.wrap}>
        <div style={s.manualRow}>
          <input
            style={{ ...s.input, flex: 1 }}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? 'e.g. images/photo.png'}
            autoFocus
          />
          <button
            type="button"
            style={s.browseBtn}
            onClick={switchToDropdown}
            title="Back to asset browser"
          >
            Browse
          </button>
        </div>
      </div>
    )
  }

  const displayLabel = value ? optionLabel(value) : '— select asset —'

  return (
    <div style={s.wrap}>
      <button
        ref={triggerRef}
        type="button"
        style={s.trigger}
        onClick={open ? closeDropdown : openDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={s.triggerText}>{displayLabel}</span>
        <span style={s.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && dropPos && (
        <div
          ref={panelRef}
          role="listbox"
          style={{ ...s.panel, left: dropPos.left, top: dropPos.top, minWidth: dropPos.width }}
        >
          <div
            role="option"
            aria-selected={!value}
            style={{
              ...s.option,
              ...s.optionPlaceholder,
              ...(hoveredKey === '' ? s.optionHover : {}),
            }}
            onMouseEnter={() => setHoveredKey('')}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => handleSelect('')}
          >
            — select asset —
          </div>

          {groups.map((group) => (
            <React.Fragment key={group.label}>
              <div style={s.groupLabel}>{group.label}</div>
              {group.items.map((f) => (
                <div
                  key={f}
                  role="option"
                  aria-selected={f === value}
                  style={{
                    ...s.option,
                    ...(f === value ? s.optionActive : hoveredKey === f ? s.optionHover : {}),
                  }}
                  onClick={() => handleSelect(f)}
                  onMouseEnter={(e) => handleItemEnter(f, e)}
                  onMouseLeave={handleItemLeave}
                >
                  {isImageFile(f) ? '🖼 ' : '📄 '}
                  {optionLabel(f)}
                </div>
              ))}
            </React.Fragment>
          ))}

          <div
            role="option"
            style={{
              ...s.option,
              ...s.optionManual,
              ...(hoveredKey === MANUAL_VALUE ? s.optionHover : {}),
            }}
            onMouseEnter={() => setHoveredKey(MANUAL_VALUE)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={handleManualClick}
          >
            — enter path manually —
          </div>
        </div>
      )}

      <ImagePreviewTooltip preview={preview} />
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    background: '#fff',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    boxSizing: 'border-box',
  },
  triggerText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginRight: 4,
  },
  chevron: {
    flexShrink: 0,
    fontSize: '0.7rem',
    color: '#9ca3af',
  },
  panel: {
    position: 'fixed',
    zIndex: 1000,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    maxHeight: 280,
    overflowY: 'auto',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
  },
  option: {
    padding: '6px 12px',
    cursor: 'pointer',
    color: 'var(--colour-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  optionHover: {
    background: '#f3f4f6',
  },
  optionActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  optionPlaceholder: {
    color: '#9ca3af',
  },
  optionManual: {
    color: '#9ca3af',
    borderTop: '1px solid #f3f4f6',
  },
  groupLabel: {
    padding: '4px 12px 2px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: '#f9fafb',
  },
  input: {
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  manualRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  browseBtn: {
    padding: '6px 10px',
    border: '1px solid var(--colour-primary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
}
