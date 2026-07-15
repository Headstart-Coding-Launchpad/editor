import React, { useState, useEffect, useRef } from 'react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import FileManager from './FileManager'
import ScratchWorkspace from '../../modules/scratch/ScratchWorkspace'
import { ScratchToolboxPicker, SpriteManager, BackdropManager } from './TaskEditor'
import { DEFAULT_SPRITES } from '../../modules/scratch/checks'
import { useAssets } from '../../shared/useAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import AssetBrowser from '../../shared/AssetBrowser'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { FsTreeEditor } from '../../modules/filesystem/filesystemEditors'
import ElectronicsWorkspace from '../../modules/electronics/ElectronicsWorkspace'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from '../../modules/electronics/circuit'
import { storage } from '../../shared/firebase'
import { useAuth } from '../../auth/useAuth'
import LessonTopicSummary from './LessonTopicSummary'

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }
const STAGE_ORDER = ['ideas', 'details', 'review', 'approved', 'published']

export default function LessonMetaPanel({ lesson, onUpdate, onCollapse, onSetStage, topicState }) {
  const [sandboxOpen, setSandboxOpen] = useState(false)
  const { lessonAssets, loading: assetsLoading } = useAssets()
  const { typeStorageAssets } = useTypeAssets(lesson.type === 'html' ? 'html' : null)
  const lastAutoKeyRef = useRef('')
  const { role } = useAuth()

  function set(field, value) {
    onUpdate(prev => ({ ...prev, [field]: value }))
  }

  // Keep assetsPath in sync with lesson ID for relative costume/backdrop resolution
  useEffect(() => {
    if (!lesson.id) return
    const newPath = `/assets/${lesson.id}/`
    if (lesson.assetsPath !== newPath) {
      onUpdate(prev => ({ ...prev, assetsPath: newPath }))
    }
  }, [lesson.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate assets list when manifest loads or ID/type changes
  useEffect(() => {
    if (assetsLoading || !lesson.id) return
    const key = `${lesson.id}__${lesson.type}`
    if (key === lastAutoKeyRef.current) return
    lastAutoKeyRef.current = key
    const merged = lessonAssets(lesson.id, lesson.type)
    if (merged.length > 0) {
      onUpdate(prev => ({ ...prev, assets: merged }))
    }
  }, [lesson.id, lesson.type, assetsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPython = lesson.type === 'python'
  const isScratch = lesson.type === 'scratch'
  const isFilesystem = lesson.type === 'filesystem'
  const isElectronics = lesson.type === 'electronics'
  const sandboxLineCount = (lesson.sandboxStarter ?? '').trim()
    ? (lesson.sandboxStarter ?? '').split('\n').length
    : 0
  const sandboxFileCount = lesson.sandboxStarterFiles?.length ?? 0
  const sandboxFsCount = lesson.sandboxStarterFs ? Object.keys(lesson.sandboxStarterFs).length - 1 : 0 // subtract root

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span>Lesson Details</span>
        {onCollapse && (
          <button type="button" style={s.collapseBtn} onClick={onCollapse} title="Collapse panel">
            ‹
          </button>
        )}
      </div>
      <div style={s.fields}>
        <Field label="Lesson type">
          <div style={s.typeBadge}>{isPython ? 'Python' : isScratch ? 'Scratch' : isFilesystem ? 'Files & Folders' : isElectronics ? 'Electronics' : 'Web'}</div>
        </Field>

        <Field label="Lesson ID" hint="e.g. python-intro">
          <input
            style={s.input}
            value={lesson.id}
            onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="python-intro"
          />
        </Field>

        <Field label="Lesson title">
          <input
            style={s.input}
            value={lesson.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Introduction to Python"
          />
        </Field>

        <Field label="Level" hint="optional, e.g. Level 1">
          <input
            style={s.input}
            value={lesson.level ?? ''}
            onChange={e => {
              const v = e.target.value
              set('level', v || undefined)
            }}
            placeholder="Level 1"
          />
        </Field>

        <Field label="Description">
          <textarea
            style={{ ...s.input, resize: 'vertical', minHeight: 60 }}
            value={lesson.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Short summary shown on entry screen."
          />
        </Field>

        <Field label="Stage">
          <div style={s.stageGrid}>
            {STAGE_ORDER.map(value => {
              const active = (lesson.stage ?? 'published') === value
              return (
                <button
                  key={value}
                  type="button"
                  style={{
                    ...s.stageBtn,
                    background: active ? STAGE_COLORS[value] : '#f9fafb',
                    color: active ? '#fff' : '#4b5563',
                    borderColor: active ? STAGE_COLORS[value] : '#d1d5db',
                    fontWeight: active ? 700 : 500,
                  }}
                  onClick={() => onSetStage?.(value)}
                >
                  {STAGE_LABELS[value]}
                </button>
              )
            })}
          </div>
        </Field>

        <LessonTopicSummary
          lesson={lesson}
          topics={topicState?.topics ?? []}
          loading={topicState?.loading ?? false}
          error={topicState?.error ?? null}
          onUpdate={onUpdate}
        />

        <AssetSummary lessonId={lesson.id} lessonType={lesson.type} assets={lesson.assets} assetsPath={resolveAssetsPath(lesson.assetsPath)} storageAssets={lesson.storageAssets ?? []} />

        {role === 'admin' && (
          <StorageAssetUploader
            lessonId={lesson.id}
            storageAssets={lesson.storageAssets ?? []}
            onUpdate={updater => onUpdate(prev => ({ ...prev, storageAssets: typeof updater === 'function' ? updater(prev.storageAssets ?? []) : updater }))}
          />
        )}

        {lesson.type === 'html' && typeStorageAssets.length > 0 && (
          <SharedAssetsSelector
            typeStorageAssets={typeStorageAssets}
            sharedAssetNames={lesson.sharedAssetNames ?? null}
            onChange={names => onUpdate(prev => ({ ...prev, sharedAssetNames: names }))}
          />
        )}

        <div style={s.divider} />

        <div style={s.sandboxSummary}>
          <div>
            <span style={s.fieldLabel}>Sandbox starter</span>
            <p style={s.summaryText}>
              {isPython
                ? (sandboxLineCount ? `${sandboxLineCount} lines configured` : 'No sandbox starter code set.')
                : isScratch
                  ? (lesson.sandboxStarter ? 'Scratch sandbox starter configured.' : 'No Scratch sandbox starter set.')
                  : isFilesystem
                    ? (sandboxFsCount ? `${sandboxFsCount} items configured` : 'No sandbox filesystem set.')
                    : isElectronics
                      ? (lesson.sandboxStarterCircuit ? 'Sandbox breadboard configured.' : 'No sandbox breadboard set.')
                      : (sandboxFileCount ? `${sandboxFileCount} starter files configured` : 'No sandbox starter files set.')}
            </p>
          </div>
          <button className="btn-ghost" style={s.secondaryBtn} onClick={() => setSandboxOpen(true)}>
            Edit
          </button>
        </div>

        {sandboxOpen && (
          <Modal title="Sandbox starter" onClose={() => setSandboxOpen(false)}>
            {isPython ? (
              <div style={s.modalEditor}>
                <CodeEditor
                  value={lesson.sandboxStarter ?? ''}
                  language="python"
                  onChange={v => set('sandboxStarter', v || undefined)}
                  style={s.modalCodeEditor}
                />
              </div>
            ) : isScratch ? (
              <ScratchSandboxStarter
                value={lesson.sandboxStarter}
                toolbox={lesson.sandboxToolbox ?? ''}
                sprites={lesson.sandboxSprites?.length > 0 ? lesson.sandboxSprites : DEFAULT_SPRITES}
                backdrops={lesson.sandboxBackdrops?.length > 0 ? lesson.sandboxBackdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
                assetsPath={lesson.assetsPath ?? ''}
                storageAssets={lesson.storageAssets ?? []}
                lessonId={lesson.id}
                lessonType={lesson.type}
                onChange={state => set('sandboxStarter', state ? JSON.stringify(state) : undefined)}
                onToolboxChange={v => set('sandboxToolbox', v || undefined)}
                onSpritesChange={sprites => set('sandboxSprites', sprites)}
                onBackdropsChange={backdrops => set('sandboxBackdrops', backdrops)}
              />
            ) : isFilesystem ? (
              <div style={{ padding: '12px 0' }}>
                <FsTreeEditor
                  label="Sandbox starting filesystem"
                  fs={lesson.sandboxStarterFs ?? { '/': { type: 'dir' } }}
                  onFsChange={newFs => set('sandboxStarterFs', newFs)}
                  storageAssets={lesson.storageAssets ?? []}
                />
              </div>
            ) : isElectronics ? (
              <div style={s.modalEditor}>
                <ElectronicsWorkspace
                  circuit={parseCircuit(lesson.sandboxStarterCircuit, DEFAULT_CIRCUIT)}
                  onChange={circuit => set('sandboxStarterCircuit', JSON.parse(serializeCircuit(circuit)))}
                  title="Sandbox breadboard"
                />
              </div>
            ) : (
              <SandboxStarterFiles
                files={lesson.sandboxStarterFiles ?? []}
                onChange={files => set('sandboxStarterFiles', files.length ? files : undefined)}
              />
            )}
          </Modal>
        )}
      </div>
    </div>
  )
}

function parseScratchStarter(value) {
  if (!value) return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

function cloneScratchStarter(value) {
  if (!value) return null
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function ScratchSandboxStarter({ value, toolbox, sprites, backdrops, assetsPath, storageAssets, lessonId, lessonType, onChange, onToolboxChange, onSpritesChange, onBackdropsChange }) {
  const [activeTab, setActiveTab] = useState('starter')
  const [testBlocks, setTestBlocks] = useState(() => cloneScratchStarter(parseScratchStarter(value)))
  const [syncNowKey, setSyncNowKey] = useState(0)
  const starterBlocksRef = React.useRef(parseScratchStarter(value))

  function handleTabChange(tab) {
    if (tab === activeTab) return
    if (tab === 'test') {
      setSyncNowKey(key => key + 1)
      requestAnimationFrame(() => {
        const snapshot = starterBlocksRef.current ?? parseScratchStarter(value)
        setTestBlocks(cloneScratchStarter(snapshot))
        setActiveTab('test')
      })
      return
    }
    setActiveTab('starter')
  }

  const resolvedAssets = assetsPath ? resolveAssetsPath(assetsPath) : ''
  const spriteIds = (sprites ?? []).map(sp => sp.id).join(',')

  return (
    <div style={s.scratchSandboxShell}>
      <div style={s.workspaceTabs} className="ui-tabs" role="tablist" aria-label="Sandbox starter workspace">
        <button
          type="button"
          className={`ui-tab${activeTab === 'starter' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'starter'}
          onClick={() => handleTabChange('starter')}
        >
          Starter Blocks
        </button>
        <button
          type="button"
          className={`ui-tab${activeTab === 'test' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'test'}
          onClick={() => handleTabChange('test')}
        >
          Test Code
        </button>
      </div>

      <div style={s.scratchSandboxEditor}>
        {activeTab === 'starter' && (
          <div style={s.scratchConfigSidebar}>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Toolbox blocks</span>
              <ScratchToolboxPicker toolbox={toolbox} onChange={onToolboxChange} />
            </div>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Sprites</span>
              <SpriteManager
                sprites={sprites}
                onChange={onSpritesChange}
                assetsPath={resolvedAssets}
                storageAssets={storageAssets}
                lessonId={lessonId}
                lessonType={lessonType}
              />
            </div>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Backdrops</span>
              <BackdropManager
                backdrops={backdrops}
                onChange={onBackdropsChange}
                assetsPath={resolvedAssets}
                storageAssets={storageAssets}
                lessonId={lessonId}
                lessonType={lessonType}
              />
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
          {activeTab === 'starter' ? (
            <ScratchWorkspace
              key={`scratch-sandbox-starter-${spriteIds}`}
              task={{ toolbox, check: null, sprites, backdrops }}
              hideStage
              assetsPath={resolvedAssets}
              initialState={parseScratchStarter(value)}
              onStateChange={state => {
                starterBlocksRef.current = state
                onChange(state)
              }}
              syncNowKey={syncNowKey}
            />
          ) : (
            <ScratchWorkspace
              key={`scratch-sandbox-test-${spriteIds}`}
              task={{ toolbox, check: null, sprites, backdrops }}
              assetsPath={resolvedAssets}
              initialState={testBlocks}
              onStateChange={setTestBlocks}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SandboxStarterFiles({ files, onChange }) {
  const [selectedFile, setSelectedFile] = useState(files[0]?.name ?? '')

  return (
    <SplitPane
      defaultSplit={34}
      style={{ flex: 1, minHeight: 0 }}
      left={
        <FileManager
          files={files}
          entryFile={files.find(f => f.type === 'html')?.name ?? files[0]?.name ?? ''}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onAddFile={f => { onChange([...files, f]); setSelectedFile(f.name) }}
          onSetFiles={(newFiles, newEntry) => { onChange(newFiles); setSelectedFile(newFiles[0]?.name ?? '') }}
          onDeleteFile={name => {
            const next = files.filter(f => f.name !== name)
            onChange(next)
            setSelectedFile(next[0]?.name ?? '')
          }}
          onChangeType={(name, type) => onChange(files.map(f => f.name === name ? { ...f, type } : f))}
          onChangeEntryFile={() => {}}
        />
      }
      right={
        <div style={s.modalEditor}>
          {selectedFile ? (
            <CodeEditor
              key={selectedFile}
              value={files.find(f => f.name === selectedFile)?.content ?? ''}
              language={files.find(f => f.name === selectedFile)?.type ?? 'html'}
              onChange={v => onChange(files.map(f => f.name === selectedFile ? { ...f, content: v } : f))}
              style={s.htmlCodeEditor}
            />
          ) : (
            <div style={s.noFile}>Select or add a file to edit.</div>
          )}
        </div>
      }
    />
  )
}

function SharedAssetsSelector({ typeStorageAssets, sharedAssetNames, onChange }) {
  const selected = sharedAssetNames !== null ? new Set(sharedAssetNames) : null

  function toggle(name) {
    if (selected === null) {
      onChange(typeStorageAssets.map(a => a.name).filter(n => n !== name))
    } else if (selected.has(name)) {
      onChange([...selected].filter(n => n !== name))
    } else {
      onChange([...selected, name])
    }
  }

  return (
    <div style={s.storageSection}>
      <span style={s.fieldLabel}>Shared assets in web editor</span>
      <p style={s.summaryText}>Choose which shared assets are available in this lesson&rsquo;s asset browser.</p>
      {typeStorageAssets.map(asset => {
        const checked = selected === null ? true : selected.has(asset.name)
        return (
          <label key={asset.name} style={s.showInEditorLabel}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(asset.name)}
            />
            {asset.name}
          </label>
        )
      })}
    </div>
  )
}

function StorageAssetUploader({ lessonId, storageAssets, onUpdate }) {
  const [uploads, setUploads] = useState({}) // filename → { progress, error }

  function handleFileSelect() {
    if (!lessonId) { alert('Set a lesson ID before uploading assets.'); return }
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,application/pdf,.svg'
    input.onchange = e => {
      for (const file of e.target.files) {
        uploadFile(file)
      }
    }
    input.click()
  }

  function uploadFile(file) {
    const storageRef = ref(storage, `lessons/${lessonId}/assets/${file.name}`)
    const task = uploadBytesResumable(storageRef, file)
    setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: null } }))
    task.on(
      'state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setUploads(prev => ({ ...prev, [file.name]: { progress: pct, error: null } }))
      },
      err => {
        setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: err.message } }))
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setUploads(prev => {
          const next = { ...prev }
          delete next[file.name]
          return next
        })
        onUpdate(prev => [...prev.filter(a => a.name !== file.name), { name: file.name, url, showInEditor: false }])
      }
    )
  }

  async function handleDelete(asset) {
    if (!confirm(`Delete "${asset.name}" from Firebase Storage?`)) return
    try {
      await deleteObject(ref(storage, `lessons/${lessonId}/assets/${asset.name}`))
    } catch (err) {
      if (err.code !== 'storage/object-not-found') {
        alert('Could not delete: ' + err.message)
        return
      }
    }
    onUpdate(prev => prev.filter(a => a.name !== asset.name))
  }

  const activeUploads = Object.entries(uploads)

  return (
    <div style={s.storageSection}>
      <div style={s.storageTitleRow}>
        <span style={s.fieldLabel}>Firebase Storage assets</span>
        <button className="btn-ghost" style={s.uploadAssetBtn} onClick={handleFileSelect}>
          Upload file
        </button>
      </div>
      {storageAssets.length === 0 && activeUploads.length === 0 && (
        <p style={s.summaryText}>No files uploaded. Use "Upload file" to add images or PDFs.</p>
      )}
      {activeUploads.map(([name, info]) => (
        <div key={name} style={s.storageRow}>
          <span style={s.assetPath}>{name}</span>
          {info.error
            ? <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>Error: {info.error}</span>
            : <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>{info.progress}%</span>
          }
        </div>
      ))}
      {storageAssets.map(asset => (
        <div key={asset.name} style={s.storageRow}>
          <a href={asset.url} target="_blank" rel="noopener noreferrer" style={s.assetPath} title={asset.url}>
            {asset.name}
          </a>
          <label style={s.showInEditorLabel}>
            <input
              type="checkbox"
              checked={!!asset.showInEditor}
              onChange={e => onUpdate(prev => prev.map(a => a.name === asset.name ? { ...a, showInEditor: e.target.checked } : a))}
            />
            Web editor
          </label>
          <button
            style={s.copyUrlBtn}
            onClick={() => navigator.clipboard.writeText(asset.url).catch(() => {})}
            title="Copy URL"
          >
            Copy URL
          </button>
          <button style={s.removeBtn} onClick={() => handleDelete(asset)} title="Delete">×</button>
        </div>
      ))}
    </div>
  )
}

function AssetSummary({ lessonId, lessonType, assets, assetsPath, storageAssets }) {
  const count = assets?.length ?? 0

  let text
  if (count > 0) {
    text = `${count} asset${count !== 1 ? 's' : ''} listed in lesson JSON`
  } else {
    text = 'No static assets listed. Upload files via Firebase Storage above.'
  }

  const showBrowser = (count > 0 && assetsPath) || storageAssets?.length > 0

  return (
    <div style={s.assetSummary}>
      <span style={s.fieldLabel}>Asset files</span>
      <p style={s.summaryText}>{text}</p>
      {showBrowser && (
        <AssetBrowser
          assetsPath={assetsPath}
          assets={assets}
          storageAssets={storageAssets}
          copyMode="relative"
          style={s.assetBrowserInPanel}
        />
      )}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>
        {label}
        {hint && <span style={s.fieldHint}> ({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div style={s.modalBackdrop} role="dialog" aria-modal="true">
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} title="Close">x</button>
        </div>
        <div style={s.modalBody}>
          {children}
        </div>
      </div>
    </div>
  )
}

const s = {
  panel: { borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseBtn: {
    width: 24,
    height: 24,
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: 4,
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
  fields: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
  },
  fieldHint: {
    fontWeight: 400,
    color: '#9ca3af',
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
  },
  typeBadge: {
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#f7f2ff',
    color: 'var(--colour-primary)',
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
  },
  addBtn: {
    padding: '7px 12px',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  assetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#f5f5f5',
    border: '1px solid #e5e7eb',
    borderRadius: 5,
    padding: '4px 8px',
  },
  assetPath: {
    flex: 1,
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  divider: {
    height: 1,
    background: '#e5e7eb',
    margin: '4px 0',
  },
  stageGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  stageBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    padding: '4px 8px',
    borderRadius: 5,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.1s',
    letterSpacing: '0.02em',
  },
  removeBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  assetSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  storageSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
  },
  storageTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  uploadAssetBtn: {
    color: '#16a34a',
    border: '1px solid #16a34a',
    padding: '4px 10px',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
  },
  storageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 5,
    padding: '4px 8px',
  },
  showInEditorLabel: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.72rem',
    color: '#374151',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  copyUrlBtn: {
    flexShrink: 0,
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    color: '#6b7280',
    fontSize: '0.72rem',
    cursor: 'pointer',
    padding: '2px 6px',
  },
  assetBrowserInPanel: {
    maxHeight: 180,
    overflowY: 'auto',
  },
  sandboxSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 14px',
    background: '#fff',
  },
  summaryText: {
    margin: '4px 0 0',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: 1.45,
  },
  secondaryBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '7px 12px',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: 'min(1120px, 94vw)',
    height: 'min(760px, 88vh)',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    height: 50,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-text)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    padding: 14,
  },
  modalEditor: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    display: 'flex',
  },
  htmlCodeEditor: {
    width: '100%',
    minWidth: 0,
    flex: '1 1 auto',
  },
  modalCodeEditor: {
    width: '100%',
    minWidth: 0,
    flex: '1 1 auto',
  },
  scratchSandboxShell: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  workspaceTabs: {
    display: 'inline-grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    alignSelf: 'flex-start',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 4,
    background: '#fff',
    flexShrink: 0,
  },
  scratchSandboxEditor: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    display: 'flex',
    overflow: 'hidden',
  },
  scratchConfigSidebar: {
    width: 300,
    flexShrink: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    borderRight: '1px solid #e5e7eb',
    background: '#fafafa',
    padding: '12px 10px',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sidebarSectionTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: 4,
    borderBottom: '1px solid #e5e7eb',
  },
  noFile: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
}
