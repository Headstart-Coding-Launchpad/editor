import React from 'react'
import AssetBrowser from '../../../shared/AssetBrowser'
import { useAssets } from '../../../shared/useAssets'
import { useTypeAssets } from '../../../shared/useTypeAssets'
import { resolveAssetFileUrl } from '../../../shared/assetPaths'
import { SPRITE_TYPES } from '../../../app/components/ScratchWorkspace'
import { createSpriteFromPreset } from '../../spritePresets'
import { DEFAULT_FS } from '../../../shared/filesystem'
import { flattenTasks } from '../../../shared/taskUtils'

function CodeWorkspaceTabs({ activeTab, onChange, starterLabel = 'Starter code', testLabel = 'Complete code', rightAction = null, stages = [], onAddStage = null, onRemoveStage = null }) {
  return (
    <div className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Code workspace">
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'starter'}
        onClick={() => onChange('starter')}
      >
        {starterLabel}
      </button>
      {stages.map((stage, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="ui-tab"
            role="tab"
            aria-selected={activeTab === `stage_${i}`}
            onClick={() => onChange(`stage_${i}`)}
          >
            {stage.label || `Stage ${i + 1}`}
          </button>
          {onRemoveStage && (
            <button
              type="button"
              className="te-stage-remove-btn"
              title="Remove this stage"
              onClick={e => { e.stopPropagation(); onRemoveStage(i) }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {onAddStage && (
        <button
          type="button"
          className="ui-tab te-workspace-tab-add"
          onClick={onAddStage}
          title="Add a code stage"
        >
          + Stage
        </button>
      )}
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'complete'}
        onClick={() => onChange('complete')}
      >
        {testLabel}
      </button>
      {rightAction && <div className="te-workspace-tab-actions">{rightAction}</div>}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="te-modal-backdrop" role="dialog" aria-modal="true">
      <div className="te-modal">
        <div className="te-modal__header">
          <span className="te-modal__title">{title}</span>
          <button className="te-modal__close" onClick={onClose} title="Close">x</button>
        </div>
        <div className="te-modal__body">
          {children}
        </div>
      </div>
    </div>
  )
}

function CarryThroughPicker({ task, lesson, onUpdate, isScratch, isPython, isFilesystem }) {
  const flatTasks = flattenTasks(lesson.tasks)
  const taskIndex = flatTasks.findIndex(t => t.id === task.id)
  const prevTask = taskIndex > 0 ? flatTasks[taskIndex - 1] : null
  const otherTasks = flatTasks.filter(t => t.id !== task.id)

  const carryField = isScratch ? 'carryBlocksFrom' : isFilesystem ? 'carryFsFrom' : 'carryCodeFrom'
  const carryFrom = isScratch ? task.carryBlocksFrom : isFilesystem ? task.carryFsFrom : task.carryCodeFrom

  const mode = carryFrom == null
    ? 'new'
    : (prevTask && carryFrom === prevTask.id ? 'last' : 'other')

  function copyCompleteCode(sourceTask) {
    const updates = { [carryField]: sourceTask.id }
    if (isPython) {
      updates.starterCode = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    } else if (isScratch) {
      updates.starterBlocks = sourceTask.completeBlocks ?? sourceTask.starterBlocks ?? null
    } else if (isFilesystem) {
      updates.starterFs = sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS
    } else {
      updates.starterFiles = (sourceTask.completeFiles ?? sourceTask.starterFiles ?? []).map(f => ({ ...f }))
      const newEntry = sourceTask.completeEntryFile ?? sourceTask.entryFile
      if (newEntry) updates.entryFile = newEntry
    }
    onUpdate({ ...task, ...updates })
  }

  function handleNewStarterCode() {
    const updates = { [carryField]: null }
    if (isPython) {
      updates.starterCode = ''
    } else if (isScratch) {
      updates.starterBlocks = null
    } else if (isFilesystem) {
      updates.starterFs = DEFAULT_FS
    } else {
      updates.starterFiles = (task.starterFiles ?? []).map(f => ({ ...f, content: '' }))
    }
    onUpdate({ ...task, ...updates })
  }

  function handleOther() {
    const defaultTask = otherTasks.find(t => t.id !== prevTask?.id) ?? otherTasks[0]
    if (defaultTask) copyCompleteCode(defaultTask)
  }

  const radioName = `carry-${task.id}`

  return (
    <Field label={isScratch ? 'Carry blocks from task' : isFilesystem ? 'Carry filesystem from task' : 'Carry code from task'}>
      <div className="te-carry-radio-group">
        <label className={`te-option-choice-card${mode === 'last' ? ' te-option-choice-card--active' : ''}${!prevTask ? ' te-option-choice-card--disabled' : ''}`}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'last'}
            disabled={!prevTask}
            onChange={() => prevTask && copyCompleteCode(prevTask)}
            className="te-option-choice-input"
          />
          <span className="te-option-choice-title">Carry from last task</span>
          <span className={mode === 'last' ? 'te-option-choice-text te-option-choice-text--active' : 'te-option-choice-text'}>
            {prevTask ? `${prevTask.id}. ${prevTask.title || 'Untitled'}` : 'No previous task'}
          </span>
        </label>

        <label className={`te-option-choice-card${mode === 'new' ? ' te-option-choice-card--active' : ''}`}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'new'}
            onChange={handleNewStarterCode}
            className="te-option-choice-input"
          />
          <span className="te-option-choice-title">New starter code</span>
          <span className={mode === 'new' ? 'te-option-choice-text te-option-choice-text--active' : 'te-option-choice-text'}>
            Start this task from its own starter content.
          </span>
        </label>

        <label className={`te-option-choice-card${mode === 'other' ? ' te-option-choice-card--active' : ''}${otherTasks.length === 0 ? ' te-option-choice-card--disabled' : ''}`}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'other'}
            disabled={otherTasks.length === 0}
            onChange={handleOther}
            className="te-option-choice-input"
          />
          <span className="te-option-choice-title">From other task</span>
          <span className={mode === 'other' ? 'te-option-choice-text te-option-choice-text--active' : 'te-option-choice-text'}>
            Copy complete code from a chosen task.
          </span>
        </label>

        {mode === 'other' && (
          <select
            className="te-select"
            value={carryFrom ?? ''}
            onChange={e => {
              const sourceTask = flatTasks.find(t => t.id === parseInt(e.target.value, 10))
              if (sourceTask) copyCompleteCode(sourceTask)
            }}
          >
            {otherTasks.map(t => (
              <option key={t.id} value={t.id}>{t.id}. {t.title || 'Untitled'}</option>
            ))}
          </select>
        )}
      </div>
    </Field>
  )
}

function TaskFormatIcon({ type }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'scratch') return (
    <svg {...common}>
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  )
  if (type === 'information') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
  if (type === 'quiz') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
  return (
    <svg {...common}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function QuizTypeIcon({ type }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'match') return (
    <svg {...common}>
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
      <path d="M17 7h.01" />
      <path d="M17 17h.01" />
      <path d="M8 7h8" />
      <path d="M8 17h8" />
    </svg>
  )
  if (type === 'blank') return (
    <svg {...common}>
      <path d="M4 7h16" />
      <path d="M4 12h6" />
      <path d="M14 12h6" />
      <path d="M4 17h16" />
    </svg>
  )
  if (type === 'answer') return (
    <svg {...common}>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <path d="M15 18l2 2 4-5" />
    </svg>
  )
  if (type === 'confidence') return (
    <svg {...common}>
      <rect x="3" y="14" width="3" height="6" rx="1" />
      <rect x="8" y="10" width="3" height="10" rx="1" />
      <rect x="13" y="6" width="3" height="14" rx="1" />
      <rect x="18" y="2" width="3" height="18" rx="1" />
    </svg>
  )
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="2" />
      <path d="M11 7h8" />
      <circle cx="7" cy="17" r="2" />
      <path d="M11 17h8" />
    </svg>
  )
}

const SPRITE_TYPE_OPTIONS = SPRITE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

const SHAPE_ICONS = { cat: '🐱', ball: '🔵', star: '⭐', arrow: '➡️', bat: '🦇', parrot: '🦜' }

export function SpriteManager({ sprites, onChange, assetsPath = '', storageAssets, lessonId, lessonType, focusedSpriteId = null, hideAdd = false, hidePosRow = false, bare = false }) {
  const [expandedCostumes, setExpandedCostumes] = React.useState({})
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const pickerWrapRef = React.useRef(null)
  const { defaultSprites: typeDefaultSprites, loading: typesLoading } = useTypeAssets(lessonType === 'scratch' ? 'scratch' : null)
  const displayedSprites = focusedSpriteId ? sprites.filter(sp => sp.id === focusedSpriteId) : sprites
  const hasLibrarySprites = !typesLoading && typeDefaultSprites.length > 0

  React.useEffect(() => {
    if (!pickerOpen) return
    function onPointerDown(e) {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [pickerOpen])

  function addSprite(preset = null) {
    onChange([...sprites, createSpriteFromPreset(sprites, preset)])
    setPickerOpen(false)
  }

  function removeSprite(id) {
    if (sprites.length <= 1) return
    onChange(sprites.filter(sp => sp.id !== id))
  }

  function update(id, field, value) {
    onChange(sprites.map(sp => sp.id === id ? { ...sp, [field]: value } : sp))
  }

  function toggleCostumes(id) {
    setExpandedCostumes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function addCostume(spriteId) {
    const sp = sprites.find(s => s.id === spriteId)
    const next = (sp?.costumes ?? []).length + 1
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: [...(s.costumes ?? []), { name: `costume${next}`, image: '' }] } : s))
  }

  function removeCostume(spriteId, idx) {
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: (s.costumes ?? []).filter((_, i) => i !== idx) } : s))
  }

  function updateCostume(spriteId, idx, field, value) {
    onChange(sprites.map(s => {
      if (s.id !== spriteId) return s
      return { ...s, costumes: (s.costumes ?? []).map((c, i) => i === idx ? { ...c, [field]: value } : c) }
    }))
  }

  const entries = displayedSprites.map(sp => (
    <div key={sp.id} className="te-sprite-entry">
      <div className="te-sprite-entry__thumb">
        {sp.costumes?.[0]?.image
          ? <img src={sp.costumes[0].image} alt="" className="te-sprite-card__thumb" onError={e => { e.target.style.display = 'none' }} />
          : <span className="te-sprite-card__shape">{SHAPE_ICONS[sp.type] ?? SHAPE_ICONS.cat}</span>
        }
        <button
          type="button"
          className="te-sprite-remove-circle"
          onClick={() => removeSprite(sp.id)}
          disabled={sprites.length <= 1}
          title="Remove sprite"
        >✕</button>
      </div>
      <div className="te-sprite-entry__fields">
        <div className="te-sprite-row">
          <input
            className="te-input"
            style={{ flex: '1 1 80px', minWidth: 0 }}
            value={sp.name}
            onChange={e => update(sp.id, 'name', e.target.value)}
            placeholder="Name"
          />
          <select className="te-select" style={{ flex: '0 0 auto' }} value={sp.type ?? 'cat'} onChange={e => update(sp.id, 'type', e.target.value)}>
            {SPRITE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {!hidePosRow && (
          <div className="te-sprite-row">
            <label className="te-sprite-field">
              <span className="te-sprite-field__label">X</span>
              <input className="te-input" style={{ width: 52 }} type="number" value={sp.x ?? 0} onChange={e => update(sp.id, 'x', Number(e.target.value))} />
            </label>
            <label className="te-sprite-field">
              <span className="te-sprite-field__label">Y</span>
              <input className="te-input" style={{ width: 52 }} type="number" value={sp.y ?? 0} onChange={e => update(sp.id, 'y', Number(e.target.value))} />
            </label>
            <label className="te-sprite-field">
              <span className="te-sprite-field__label">Size</span>
              <input className="te-input" style={{ width: 52 }} type="number" min="10" max="500" value={sp.size ?? 100} onChange={e => update(sp.id, 'size', Number(e.target.value))} />
            </label>
            <label className="te-sprite-field">
              <span className="te-sprite-field__label">Dir</span>
              <input className="te-input" style={{ width: 52 }} type="number" value={sp.direction ?? 90} onChange={e => update(sp.id, 'direction', Number(e.target.value))} />
            </label>
          </div>
        )}
        <button
          type="button"
          className="te-costume-toggle-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => toggleCostumes(sp.id)}
        >
          Costumes ({(sp.costumes ?? []).length})
        </button>
        {expandedCostumes[sp.id] && (
          <CostumeManager
            costumes={sp.costumes ?? []}
            assetsPath={assetsPath}
            storageAssets={storageAssets}
            lessonId={lessonId}
            lessonType={lessonType}
            onAdd={() => addCostume(sp.id)}
            onRemove={idx => removeCostume(sp.id, idx)}
            onUpdate={(idx, field, value) => updateCostume(sp.id, idx, field, value)}
          />
        )}
      </div>
    </div>
  ))

  const addButton = hasLibrarySprites ? (
    <div className="te-sprite-picker-wrap" ref={pickerWrapRef}>
      <button
        type="button"
        className="btn-ghost te-add-sprite-btn"
        onClick={() => setPickerOpen(p => !p)}
        aria-expanded={pickerOpen}
      >
        + Add sprite {pickerOpen ? '▴' : '▾'}
      </button>
      {pickerOpen && (
        <div className="te-sprite-picker" role="listbox" aria-label="Choose a sprite to add">
          <button type="button" className="te-sprite-card" role="option" onClick={() => addSprite(null)}>
            <span className="te-sprite-card__shape">{SHAPE_ICONS.cat}</span>
            <span className="te-sprite-card__name">Blank</span>
          </button>
          {typeDefaultSprites.map(sp => {
            const imageUrl = sp.costumes?.[0]?.image || null
            return (
              <button key={sp.id} type="button" className="te-sprite-card" role="option" onClick={() => addSprite(sp)}>
                {imageUrl
                  ? <img src={imageUrl} alt="" className="te-sprite-card__thumb" onError={e => { e.target.style.display = 'none' }} />
                  : <span className="te-sprite-card__shape">{SHAPE_ICONS[sp.type] ?? SHAPE_ICONS.cat}</span>
                }
                <span className="te-sprite-card__name">{sp.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  ) : (
    <button type="button" className="btn-ghost te-add-sprite-btn" onClick={() => addSprite(null)}>
      + Add sprite
    </button>
  )

  return (
    <>
      {bare
        ? entries
        : <div className="te-sprite-manager">{entries}</div>
      }
      {!hideAdd && addButton}
    </>
  )
}

function CostumeManager({ costumes, assetsPath, storageAssets, lessonId, lessonType, onAdd, onRemove, onUpdate }) {
  const [browsingIdx, setBrowsingIdx] = React.useState(null)
  const { lessonAssets } = useAssets()
  const { typeStorageAssets } = useTypeAssets(lessonType)
  const assets = lessonAssets(lessonId, lessonType)
  const mergedStorageAssets = [...(storageAssets ?? []), ...typeStorageAssets.filter(a => !(storageAssets ?? []).some(b => b.name === a.name))]
  const hasAnyAssets = assets.length > 0 || mergedStorageAssets.length > 0

  return (
    <div className="te-costume-manager">
      {costumes.length === 0 && (
        <p className="te-costume-empty">No costumes — sprite uses its built-in shape. Add a costume to use an image from the assets folder.</p>
      )}
      {costumes.map((c, idx) => {
        const resolvedUrl = resolveAssetFileUrl(assetsPath, c.image)
        const isBrowsing = browsingIdx === idx
        return (
          <div key={idx} className="te-costume-block">
            <div className="te-costume-row">
              {idx === 0 && <span className="te-costume-tag">Default</span>}
              <input
                className="te-input"
                style={{ flex: '1 1 100px', minWidth: 0 }}
                value={c.name}
                onChange={e => onUpdate(idx, 'name', e.target.value)}
                placeholder="Costume name"
              />
              <input
                className="te-input"
                style={{ flex: '2 1 120px', minWidth: 0, fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}
                value={c.image ?? ''}
                onChange={e => onUpdate(idx, 'image', e.target.value)}
                placeholder="e.g. sprites/cat1.png"
              />
              {hasAnyAssets && (
                <button
                  type="button"
                  className={isBrowsing ? 'te-browse-toggle-btn te-browse-toggle-btn--active' : 'te-browse-toggle-btn'}
                  onClick={() => setBrowsingIdx(isBrowsing ? null : idx)}
                  title="Browse assets"
                >
                  Browse
                </button>
              )}
              {resolvedUrl && (
                <img
                  src={resolvedUrl}
                  alt=""
                  className="te-costume-thumb"
                  onError={e => { e.target.style.display = 'none' }}
                  onLoad={e => { e.target.style.display = 'block' }}
                />
              )}
              <button
                type="button"
                className="te-remove-btn"
                onClick={() => onRemove(idx)}
                title="Remove costume"
              >✕</button>
            </div>
            {isBrowsing && hasAnyAssets && (
              <div className="te-inline-browser">
                <AssetBrowser
                  assetsPath={assetsPath}
                  assets={assets}
                  storageAssets={mergedStorageAssets}
                  mode="select"
                  onSelect={path => { onUpdate(idx, 'image', path); setBrowsingIdx(null) }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button type="button" className="btn-ghost te-add-sprite-btn" onClick={onAdd}>
        + Add costume
      </button>
    </div>
  )
}

export function BackdropManager({ backdrops, onChange, assetsPath, storageAssets, lessonId, lessonType }) {
  const [browsingId, setBrowsingId] = React.useState(null)
  const { lessonAssets } = useAssets()
  const { typeStorageAssets } = useTypeAssets(lessonType)
  const assets = lessonAssets(lessonId, lessonType)
  const mergedStorageAssets = [...(storageAssets ?? []), ...typeStorageAssets.filter(a => !(storageAssets ?? []).some(b => b.name === a.name))]
  const hasAnyAssets = assets.length > 0 || mergedStorageAssets.length > 0

  function add() {
    const next = backdrops.length + 1
    onChange([...backdrops, { id: `backdrop${next}`, name: `Backdrop ${next}`, colour: '#87CEEB' }])
  }
  function remove(id) {
    if (backdrops.length <= 1) return
    onChange(backdrops.filter(b => b.id !== id))
  }
  function update(id, updates) {
    onChange(backdrops.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  return (
    <div className="te-backdrop-manager">
      {backdrops.map((b, i) => {
        const isImage = b.image !== undefined
        const resolvedUrl = isImage ? resolveAssetFileUrl(assetsPath, b.image) : ''
        const isBrowsing = browsingId === b.id
        return (
          <div key={b.id} className="te-backdrop-block">
            {/* Row 1: Default tag + name + type toggle + remove */}
            <div className="te-backdrop-row">
              {i === 0 && <span className="te-backdrop-tag">Default</span>}
              <input
                className="te-input"
                style={{ flex: '1 1 110px', minWidth: 0 }}
                value={b.name}
                onChange={e => update(b.id, { name: e.target.value })}
                placeholder="Name"
              />
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={isImage ? 'image' : 'colour'}
                onChange={e => {
                  if (e.target.value === 'image') update(b.id, { image: '', colour: undefined })
                  else update(b.id, { colour: b.colour ?? '#ffffff', image: undefined })
                }}
              >
                <option value="colour">Colour</option>
                <option value="image">Image</option>
              </select>
              <button
                type="button"
                className="te-remove-btn"
                onClick={() => remove(b.id)}
                disabled={backdrops.length <= 1}
                title="Remove backdrop"
              >✕</button>
            </div>
            {/* Row 2: colour picker or image path */}
            <div className="te-backdrop-row" style={{ paddingTop: 4 }}>
              {isImage ? (
                <>
                  <input
                    className="te-input"
                    style={{ flex: '2 1 120px', minWidth: 0, fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}
                    value={b.image ?? ''}
                    onChange={e => update(b.id, { image: e.target.value })}
                    placeholder="e.g. backdrops/sky.png"
                  />
                  {hasAnyAssets && (
                    <button
                      type="button"
                      className={isBrowsing ? 'te-browse-toggle-btn te-browse-toggle-btn--active' : 'te-browse-toggle-btn'}
                      onClick={() => setBrowsingId(isBrowsing ? null : b.id)}
                      title="Browse assets"
                    >
                      Browse
                    </button>
                  )}
                  {resolvedUrl && (
                    <img
                      src={resolvedUrl}
                      alt=""
                      className="te-backdrop-thumb"
                      onError={e => { e.target.style.display = 'none' }}
                      onLoad={e => { e.target.style.display = 'block' }}
                    />
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={b.colour ?? '#ffffff'}
                    onChange={e => update(b.id, { colour: e.target.value })}
                    className="te-color-input"
                    style={{ width: 48, height: 32, padding: 2, cursor: 'pointer' }}
                  />
                  <div className="te-backdrop-swatch" style={{ background: b.colour ?? '#ffffff', width: 32, height: 32, borderRadius: 4, border: '1px solid #e5e7eb' }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280' }}>{b.colour ?? '#ffffff'}</span>
                </div>
              )}
            </div>
            {isBrowsing && hasAnyAssets && (
              <div className="te-inline-browser">
                <AssetBrowser
                  assetsPath={assetsPath}
                  assets={assets}
                  storageAssets={mergedStorageAssets}
                  mode="select"
                  onSelect={path => { update(b.id, { image: path }); setBrowsingId(null) }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button type="button" className="btn-ghost te-add-sprite-btn" onClick={add}>
        + Add backdrop
      </button>
    </div>
  )
}

export { Field, TaskFormatIcon, QuizTypeIcon, CodeWorkspaceTabs, Modal, CarryThroughPicker }
