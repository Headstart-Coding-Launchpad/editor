import React, { useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { firestore, storage } from '../shared/firebase'

const LESSON_TYPES = [
  { id: 'python', label: 'Python' },
  { id: 'scratch', label: 'Scratch' },
  { id: 'html', label: 'HTML / Web' },
  { id: 'filesystem', label: 'Files & Folders' },
]

const SPRITE_TYPES = ['cat', 'ball', 'star', 'arrow', 'bat', 'parrot']

function storagePath(type, filename) {
  return `shared/${type}/assets/${filename}`
}

export default function SharedAssetsPanel() {
  const [activeType, setActiveType] = useState('python')

  return (
    <section style={s.section}>
      <div style={s.titleRow}>
        <h2 style={s.title}>Shared Assets</h2>
        <p style={s.subtitle}>
          Files uploaded here are available to all lessons of that type in the builder.
          Scratch default sprites are used as the starting sprite config for new Scratch tasks.
        </p>
      </div>

      <div style={s.typeTabs}>
        {LESSON_TYPES.map(t => (
          <button
            key={t.id}
            style={{ ...s.typeTab, ...(activeType === t.id ? s.typeTabActive : {}) }}
            onClick={() => setActiveType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TypeAssetsEditor key={activeType} lessonType={activeType} />
    </section>
  )
}

function TypeAssetsEditor({ lessonType }) {
  const [typeData, setTypeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState({})
  const isScratch = lessonType === 'scratch'

  useEffect(() => {
    return onSnapshot(
      doc(firestore, 'lessonTypeAssets', lessonType),
      snap => { setTypeData(snap.exists() ? snap.data() : {}); setLoading(false) },
      () => setLoading(false),
    )
  }, [lessonType])

  const storageAssets = typeData?.storageAssets ?? []
  const defaultSprites = typeData?.defaultSprites ?? []

  async function ensureDoc() {
    const ref = doc(firestore, 'lessonTypeAssets', lessonType)
    if (!typeData || Object.keys(typeData).length === 0) {
      await setDoc(ref, {})
    }
  }

  async function updateField(field, value) {
    await ensureDoc()
    await updateDoc(doc(firestore, 'lessonTypeAssets', lessonType), { [field]: value })
  }

  function handleFileSelect() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,application/pdf,.svg'
    input.onchange = e => {
      for (const file of e.target.files) uploadFile(file)
    }
    input.click()
  }

  function uploadFile(file) {
    const storageRef = ref(storage, storagePath(lessonType, file.name))
    const task = uploadBytesResumable(storageRef, file)
    setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: null } }))
    task.on(
      'state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setUploads(prev => ({ ...prev, [file.name]: { progress: pct, error: null } }))
      },
      err => setUploads(prev => ({ ...prev, [file.name]: { progress: 0, error: err.message } })),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setUploads(prev => { const next = { ...prev }; delete next[file.name]; return next })
        const current = typeData?.storageAssets ?? []
        await updateField('storageAssets', [...current.filter(a => a.name !== file.name), { name: file.name, url, showInEditor: false }])
      },
    )
  }

  async function handleDelete(asset) {
    if (!confirm(`Delete "${asset.name}" from shared ${lessonType} assets?`)) return
    try {
      await deleteObject(ref(storage, storagePath(lessonType, asset.name)))
    } catch (err) {
      if (err.code !== 'storage/object-not-found') { alert('Could not delete: ' + err.message); return }
    }
    await updateField('storageAssets', storageAssets.filter(a => a.name !== asset.name))
  }

  async function handleToggleShowInEditor(asset) {
    await updateField('storageAssets', storageAssets.map(a => a.name === asset.name ? { ...a, showInEditor: !a.showInEditor } : a))
  }

  const activeUploads = Object.entries(uploads)

  return (
    <div style={s.typeEditor}>
      <div style={s.sectionCard}>
        <div style={s.cardTitleRow}>
          <span style={s.cardTitle}>Shared files</span>
          <button className="btn-ghost" style={s.uploadBtn} onClick={handleFileSelect}>
            Upload file
          </button>
        </div>
        {loading && <p style={s.muted}>Loading…</p>}
        {!loading && storageAssets.length === 0 && activeUploads.length === 0 && (
          <p style={s.muted}>No shared files uploaded for this lesson type.</p>
        )}
        {activeUploads.map(([name, info]) => (
          <div key={name} style={s.assetRow}>
            <span style={s.assetName}>{name}</span>
            {info.error
              ? <span style={s.errorText}>Error: {info.error}</span>
              : <span style={s.mutedSmall}>{info.progress}%</span>}
          </div>
        ))}
        {storageAssets.map(asset => (
          <div key={asset.name} style={s.assetRow}>
            <a href={asset.url} target="_blank" rel="noopener noreferrer" style={s.assetName} title={asset.url}>
              {asset.name}
            </a>
            {lessonType !== 'html' && (
              <label style={s.showInEditorLabel}>
                <input
                  type="checkbox"
                  checked={!!asset.showInEditor}
                  onChange={() => handleToggleShowInEditor(asset)}
                />
                Web editor
              </label>
            )}
            <button style={s.copyUrlBtn} onClick={() => navigator.clipboard.writeText(asset.url).catch(() => {})}>
              Copy URL
            </button>
            <button style={s.removeBtn} onClick={() => handleDelete(asset)} title="Delete">×</button>
          </div>
        ))}
      </div>

      {isScratch && (
        <DefaultSpritesEditor
          sprites={defaultSprites}
          storageAssets={storageAssets}
          onChange={sprites => updateField('defaultSprites', sprites)}
        />
      )}
    </div>
  )
}

function DefaultSpritesEditor({ sprites, storageAssets, onChange }) {
  const [expandedCostumes, setExpandedCostumes] = useState({})

  function addSprite() {
    const next = sprites.length + 1
    let id = `sprite${next}`
    while (sprites.some(sp => sp.id === id)) { id = `sprite${parseInt(id.replace('sprite', '')) + 1}` }
    onChange([...sprites, { id, name: `Sprite ${next}`, type: 'cat', x: 0, y: 0, size: 100, direction: 90, costumes: [] }])
  }

  function removeSprite(id) {
    if (sprites.length <= 1) return
    onChange(sprites.filter(sp => sp.id !== id))
    setExpandedCostumes(prev => { const next = { ...prev }; delete next[id]; return next })
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
    onChange(sprites.map(s => s.id === spriteId
      ? { ...s, costumes: [...(s.costumes ?? []), { name: `costume${next}`, image: '' }] }
      : s
    ))
  }

  function removeCostume(spriteId, idx) {
    onChange(sprites.map(s => s.id === spriteId
      ? { ...s, costumes: (s.costumes ?? []).filter((_, i) => i !== idx) }
      : s
    ))
  }

  function updateCostume(spriteId, idx, field, value) {
    onChange(sprites.map(s => s.id === spriteId
      ? { ...s, costumes: (s.costumes ?? []).map((c, i) => i === idx ? { ...c, [field]: value } : c) }
      : s
    ))
  }

  const imageAssets = (storageAssets ?? []).filter(a => /\.(png|jpe?g|gif|svg|webp)$/i.test(a.name))

  return (
    <div style={s.sectionCard}>
      <div style={s.cardTitleRow}>
        <span style={s.cardTitle}>Default sprites</span>
        <button className="btn-ghost" style={s.uploadBtn} onClick={addSprite}>
          + Add sprite
        </button>
      </div>
      <p style={s.muted}>
        These sprites appear in the &ldquo;Add sprite&rdquo; picker in the lesson builder.
        Teachers can add any of them to a task. New tasks always start with a single Cat sprite;
        these are additional options teachers can choose from. Add costumes to give sprites
        custom images from the shared Scratch assets above.
      </p>

      {sprites.length === 0 && (
        <p style={s.muted}>No default sprites configured. A single Cat sprite will be used.</p>
      )}

      {sprites.map((sp, i) => (
        <div key={sp.id} style={s.spriteBlock}>
          <div style={s.spriteRow}>
            <span style={s.spriteIndex}>{i + 1}</span>
            <input
              style={s.spriteInput}
              value={sp.name}
              onChange={e => update(sp.id, 'name', e.target.value)}
              placeholder="Name"
            />
            <select
              style={s.spriteSelect}
              value={sp.type ?? 'cat'}
              onChange={e => update(sp.id, 'type', e.target.value)}
            >
              {SPRITE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button
              style={s.costumeToggleBtn}
              onClick={() => toggleCostumes(sp.id)}
              title="Edit costumes"
            >
              Costumes ({(sp.costumes ?? []).length})
            </button>
            <button
              style={s.removeBtn}
              onClick={() => removeSprite(sp.id)}
              disabled={sprites.length <= 1}
              title="Remove sprite"
            >×</button>
          </div>

          {expandedCostumes[sp.id] && (
            <div style={s.costumeSection}>
              {(sp.costumes ?? []).length === 0 && (
                <p style={s.mutedSmall}>No costumes — sprite uses its built-in shape. Add costumes to use images from the shared assets above.</p>
              )}
              {(sp.costumes ?? []).map((c, idx) => (
                <div key={idx} style={s.costumeRow}>
                  {idx === 0 && <span style={s.costumeTag}>Default</span>}
                  <input
                    style={s.spriteInput}
                    value={c.name}
                    onChange={e => updateCostume(sp.id, idx, 'name', e.target.value)}
                    placeholder="Costume name"
                  />
                  {imageAssets.length > 0 ? (
                    <select
                      style={{ ...s.spriteSelect, flex: '2 1 160px' }}
                      value={c.image ?? ''}
                      onChange={e => updateCostume(sp.id, idx, 'image', e.target.value)}
                    >
                      <option value="">Select image…</option>
                      {imageAssets.map(a => <option key={a.name} value={a.url}>{a.name}</option>)}
                    </select>
                  ) : (
                    <input
                      style={{ ...s.spriteInput, flex: '2 1 160px', fontFamily: 'var(--font-code)', fontSize: '0.78rem' }}
                      value={c.image ?? ''}
                      onChange={e => updateCostume(sp.id, idx, 'image', e.target.value)}
                      placeholder="Image URL (upload files above first)"
                    />
                  )}
                  <button style={s.removeBtn} onClick={() => removeCostume(sp.id, idx)} title="Remove costume">×</button>
                </div>
              ))}
              <button className="btn-ghost" style={{ ...s.uploadBtn, alignSelf: 'flex-start', marginTop: 4 }} onClick={() => addCostume(sp.id)}>
                + Add costume
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const s = {
  section: { display: 'flex', flexDirection: 'column', gap: 20 },
  titleRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  subtitle: { fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#6b7280', margin: 0 },
  typeTabs: { display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb' },
  typeTab: {
    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
    padding: '10px 18px', border: 'none', borderBottom: '3px solid transparent',
    background: 'none', color: '#6b7280', cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
    marginBottom: -2,
  },
  typeTabActive: { color: 'var(--colour-primary)', borderBottomColor: 'var(--colour-primary)' },
  typeEditor: { display: 'flex', flexDirection: 'column', gap: 20 },
  sectionCard: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '16px 18px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
  },
  cardTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--colour-text)' },
  uploadBtn: { color: '#16a34a', border: '1px solid #16a34a', padding: '4px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' },
  assetRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, padding: '6px 10px',
  },
  assetName: {
    flex: 1, fontFamily: 'var(--font-code)', fontSize: '0.82rem', color: 'var(--colour-text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none',
  },
  showInEditorLabel: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' },
  copyUrlBtn: { flexShrink: 0, background: 'none', border: '1px solid #d1d5db', borderRadius: 4, color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer', padding: '2px 6px' },
  removeBtn: { flexShrink: 0, background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  muted: { fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#9ca3af', margin: 0 },
  mutedSmall: { fontSize: '0.78rem', color: '#6b7280' },
  errorText: { color: '#ef4444', fontSize: '0.78rem' },
  spriteBlock: { display: 'flex', flexDirection: 'column', gap: 0, borderBottom: '1px solid #f3f4f6', paddingBottom: 6, marginBottom: 4 },
  spriteRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  spriteIndex: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem', color: '#9ca3af', width: 18, textAlign: 'right', flexShrink: 0 },
  spriteInput: { flex: '1 1 100px', minWidth: 80, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-text)', outline: 'none' },
  spriteSelect: { flex: '0 0 auto', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-text)', outline: 'none', cursor: 'pointer' },
  costumeToggleBtn: { flexShrink: 0, background: 'none', border: '1px solid #d1d5db', borderRadius: 4, color: '#374151', fontSize: '0.72rem', cursor: 'pointer', padding: '2px 7px', whiteSpace: 'nowrap' },
  costumeSection: { display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 26, paddingBottom: 4 },
  costumeRow: { display: 'flex', alignItems: 'center', gap: 6 },
  costumeTag: { flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 3, padding: '1px 5px' },
}
