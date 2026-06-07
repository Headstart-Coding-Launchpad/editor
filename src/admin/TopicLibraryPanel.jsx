import React, { useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, setDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { clearTopicCache, normalizeTopicLibrary, searchTopics } from '../shared/topicLibrary'
import { MarkdownFieldEditor } from '../builder/components/ExplainerEditor'

const LESSON_TYPES = ['python', 'html', 'scratch']
const ID_PATTERN   = /^[a-z0-9][a-z0-9._-]*$/

function emptyTopic() {
  return { id: '', title: '', types: [], category: '', summary: '', description: '', syntax: '', aliases: [], related: [] }
}

function primaryType(types) {
  if (types.length === 1) return types[0]
  return null
}

function arrayToCSV(arr) {
  return (arr ?? []).join(', ')
}

function csvToArray(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

export default function TopicLibraryPanel() {
  const [topics, setTopics]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing]     = useState(null)
  const [isNew, setIsNew]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [query, setQuery]         = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadRef                 = useRef(null)

  useEffect(() => {
    return onSnapshot(
      collection(firestore, 'topicLibrary'),
      snap => {
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTopics(normalizeTopicLibrary(raw))
        setLoading(false)
        setError(null)
      },
      err => { setError(err.message); setLoading(false) },
    )
  }, [])

  const filtered = useMemo(() => searchTopics(topics, query), [topics, query])

  function handleSelect(topic) {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
    setSelectedId(topic.id)
    setEditing({ ...topic })
    setIsNew(false)
    setDirty(false)
  }

  function handleNewTopic() {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
    setSelectedId(null)
    setEditing(emptyTopic())
    setIsNew(true)
    setDirty(false)
  }

  function update(field, value) {
    setEditing(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!editing.id.trim()) { alert('Topic ID is required.'); return }
    if (!ID_PATTERN.test(editing.id)) {
      alert('Topic ID must contain only lowercase letters, digits, dots, underscores, and hyphens, and must start with a letter or digit.')
      return
    }
    if (!editing.title.trim()) { alert('Title is required.'); return }
    if (isNew && topics.some(t => t.id === editing.id)) {
      alert(`A topic with ID "${editing.id}" already exists.`)
      return
    }
    setSaving(true)
    try {
      await setDoc(doc(firestore, 'topicLibrary', editing.id), editing)
      clearTopicCache()
      setSelectedId(editing.id)
      setIsNew(false)
      setDirty(false)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadJSON(e) {
    const file = e.target.files[0]
    uploadRef.current.value = ''
    if (!file) return

    let parsed
    try {
      const text = await file.text()
      parsed = JSON.parse(text)
    } catch (err) {
      alert('Failed to parse JSON: ' + err.message)
      return
    }

    const normalized = normalizeTopicLibrary(parsed)
    if (normalized.length === 0) {
      alert('No valid topics found in the file. The JSON must be an array of topic objects, or an object with a "topics" array. Each topic must have at least an "id" and "title".')
      return
    }

    if (!confirm(
      `This will replace all ${topics.length} existing topic${topics.length !== 1 ? 's' : ''} with ${normalized.length} topic${normalized.length !== 1 ? 's' : ''} from "${file.name}".\n\nThis cannot be undone. Continue?`
    )) return

    setUploading(true)
    try {
      const deleteRefs = topics.map(t => doc(firestore, 'topicLibrary', t.id))
      for (let i = 0; i < deleteRefs.length; i += 500) {
        const batch = writeBatch(firestore)
        deleteRefs.slice(i, i + 500).forEach(ref => batch.delete(ref))
        await batch.commit()
      }

      for (let i = 0; i < normalized.length; i += 500) {
        const batch = writeBatch(firestore)
        normalized.slice(i, i + 500).forEach(topic => {
          batch.set(doc(firestore, 'topicLibrary', topic.id), topic)
        })
        await batch.commit()
      }

      clearTopicCache()
      setSelectedId(null)
      setEditing(null)
      setDirty(false)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete topic "${editing.title || editing.id}"?\n\nThis cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteDoc(doc(firestore, 'topicLibrary', editing.id))
      clearTopicCache()
      setSelectedId(null)
      setEditing(null)
      setDirty(false)
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section style={s.section}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Topic Library</h2>
          <p style={s.subtitle}>{topics.length} topic{topics.length !== 1 ? 's' : ''} · stored in Firestore</p>
        </div>
        <div style={s.headerBtns}>
          <input
            ref={uploadRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleUploadJSON}
          />
          <button
            className="btn-ghost-outline"
            style={s.uploadBtn}
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            title="Replace all topics by uploading a JSON file"
          >
            {uploading ? 'Uploading…' : 'Upload JSON'}
          </button>
          <button className="btn-primary" style={s.newBtn} onClick={handleNewTopic} disabled={uploading}>
            + New Topic
          </button>
        </div>
      </div>

      <div style={s.body}>
        <aside style={s.listPane}>
          <input
            style={s.search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search topics…"
            aria-label="Search topics"
          />
          {loading && <p style={s.muted}>Loading…</p>}
          {error && <p style={s.errorText}>Error: {error}</p>}
          <div style={s.list}>
            {filtered.map(topic => (
              <button
                key={topic.id}
                style={{ ...s.listItem, ...(selectedId === topic.id && !isNew ? s.listItemActive : {}) }}
                onClick={() => handleSelect(topic)}
              >
                <span style={s.listTitle}>{topic.title}</span>
                <span style={s.listMeta}>
                  {[topic.category, ...topic.types].filter(Boolean).join(' · ') || topic.id}
                </span>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p style={s.muted}>{query ? 'No matching topics.' : 'No topics yet.'}</p>
            )}
          </div>
        </aside>

        <div style={s.editorPane}>
          {!editing ? (
            <p style={s.placeholder}>Select a topic to edit, or click + New Topic.</p>
          ) : (
            <TopicForm
              topic={editing}
              isNew={isNew}
              allTopics={topics}
              saving={saving}
              deleting={deleting}
              onChange={update}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function TopicForm({ topic, isNew, allTopics, saving, deleting, onChange, onSave, onDelete }) {
  const lessonType = primaryType(topic.types)

  return (
    <div style={f.form}>
      <div style={f.row}>
        <div style={f.field}>
          <label style={f.label}>ID <span style={f.required}>*</span></label>
          {isNew ? (
            <input
              style={f.input}
              value={topic.id}
              onChange={e => onChange('id', e.target.value.toLowerCase())}
              placeholder="e.g. for-loop"
              spellCheck={false}
            />
          ) : (
            <div style={f.idDisplay}>{topic.id}</div>
          )}
          <span style={f.hint}>Unique slug used in [[wiki-links]]. Lowercase letters, digits, dots, underscores, hyphens.</span>
        </div>

        <div style={f.field}>
          <label style={f.label}>Title <span style={f.required}>*</span></label>
          <input
            style={f.input}
            value={topic.title}
            onChange={e => onChange('title', e.target.value)}
            placeholder="e.g. For loops"
          />
        </div>
      </div>

      <div style={f.row}>
        <div style={f.field}>
          <label style={f.label}>Category</label>
          <input
            style={f.input}
            value={topic.category}
            onChange={e => onChange('category', e.target.value)}
            placeholder="e.g. Loop, Function, Concept"
          />
        </div>

        <div style={f.field}>
          <label style={f.label}>Lesson types</label>
          <div style={f.checkboxes}>
            <span style={f.checkboxHint}>Leave all unchecked to show for all types.</span>
            {LESSON_TYPES.map(type => (
              <label key={type} style={f.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={topic.types.includes(type)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...topic.types, type]
                      : topic.types.filter(t => t !== type)
                    onChange('types', next)
                  }}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={f.fieldFull}>
        <label style={f.label}>Summary <span style={f.hint}>(plain text — shown in hover card)</span></label>
        <textarea
          style={f.summaryTextarea}
          value={topic.summary}
          onChange={e => onChange('summary', e.target.value)}
          placeholder="One-sentence description shown in the hover card and detail pane lead-in."
          rows={2}
        />
      </div>

      <div style={f.fieldFull}>
        <label style={f.label}>Description <span style={f.hint}>(Markdown — full body text)</span></label>
        <div style={f.markdownWrap}>
          <MarkdownFieldEditor
            value={topic.description}
            onChange={val => onChange('description', val)}
            placeholder="Full description in Markdown…"
            height={260}
            minHeight={200}
            lessonType={lessonType}
            inlineCodeLanguages={['python', 'html', 'css', 'javascript', 'scratch']}
          />
        </div>
      </div>

      <div style={f.fieldFull}>
        <label style={f.label}>Syntax <span style={f.hint}>(Markdown — code example rendered below description)</span></label>
        <div style={f.markdownWrap}>
          <MarkdownFieldEditor
            value={topic.syntax}
            onChange={val => onChange('syntax', val)}
            placeholder="Syntax or usage example in Markdown…"
            height={180}
            minHeight={140}
            lessonType={lessonType}
            inlineCodeLanguages={['python', 'html', 'css', 'javascript', 'scratch']}
          />
        </div>
      </div>

      <div style={f.row}>
        <div style={f.field}>
          <label style={f.label}>Aliases</label>
          <input
            style={f.input}
            value={arrayToCSV(topic.aliases)}
            onChange={e => onChange('aliases', csvToArray(e.target.value))}
            placeholder="e.g. for loop, for loops, repeat"
          />
          <span style={f.hint}>Comma-separated. Used by search and auto-suggestion.</span>
        </div>

        <div style={f.field}>
          <label style={f.label}>Related topics</label>
          <RelatedPicker
            value={topic.related}
            allTopics={allTopics}
            currentId={topic.id}
            onChange={val => onChange('related', val)}
          />
          <span style={f.hint}>Topic IDs shown as clickable pills at the bottom of the detail pane.</span>
        </div>
      </div>

      <div style={f.actions}>
        <button
          className="btn-primary"
          style={f.saveBtn}
          onClick={onSave}
          disabled={saving || deleting}
        >
          {saving ? 'Saving…' : isNew ? 'Create topic' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            className="btn-danger"
            style={f.deleteBtn}
            onClick={onDelete}
            disabled={saving || deleting}
          >
            {deleting ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}

function RelatedPicker({ value, allTopics, currentId, onChange }) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)

  const available = useMemo(
    () => searchTopics(allTopics, query).filter(t => t.id !== currentId && !value.includes(t.id)),
    [allTopics, query, currentId, value],
  )

  function add(id) {
    onChange([...value, id])
    setQuery('')
  }

  function remove(id) {
    onChange(value.filter(v => v !== id))
  }

  return (
    <div style={rp.wrap}>
      <div style={rp.tags}>
        {value.map(id => {
          const topic = allTopics.find(t => t.id === id)
          return (
            <span key={id} style={rp.tag}>
              {topic ? topic.title : id}
              <button type="button" style={rp.tagRemove} onClick={() => remove(id)} title="Remove">×</button>
            </span>
          )
        })}
        <div style={rp.inputWrap}>
          <input
            style={rp.input}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={value.length ? '' : 'Search to add…'}
          />
          {open && available.length > 0 && (
            <div style={rp.dropdown}>
              {available.slice(0, 12).map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  style={rp.option}
                  onMouseDown={() => add(topic.id)}
                >
                  <span style={rp.optionTitle}>{topic.title}</span>
                  <span style={rp.optionId}>{topic.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  section:       { display: 'flex', flexDirection: 'column', gap: 20 },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  title:         { margin: 0, fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)' },
  subtitle:      { margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#9ca3af' },
  headerBtns:    { display: 'flex', gap: 8, alignItems: 'center' },
  uploadBtn:     { whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.86rem' },
  newBtn:        { whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.86rem' },
  body:          { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', minHeight: 600 },
  listPane:      { display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', background: '#f9fafb', minHeight: 0 },
  search:        { margin: 12, padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: '0.88rem', flexShrink: 0 },
  list:          { overflowY: 'auto', flex: 1, padding: '0 8px 12px' },
  listItem:      { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left', border: 'none', borderRadius: 7, background: 'none', padding: '9px 10px', cursor: 'pointer' },
  listItemActive:{ background: '#f0eafa' },
  listTitle:     { fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--colour-text)', fontSize: '0.88rem' },
  listMeta:      { fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#9ca3af' },
  editorPane:    { overflowY: 'auto', padding: '24px 28px' },
  placeholder:   { fontFamily: 'var(--font-body)', color: '#9ca3af', fontSize: '0.9rem', margin: 0 },
  muted:         { fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#9ca3af', margin: '8px 4px' },
  errorText:     { fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#dc2626', margin: '8px 4px' },
}

const f = {
  form:          { display: 'flex', flexDirection: 'column', gap: 18 },
  row:           { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field:         { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldFull:     { display: 'flex', flexDirection: 'column', gap: 5 },
  label:         { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.84rem', color: 'var(--colour-text)' },
  required:      { color: '#dc2626' },
  hint:          { fontFamily: 'var(--font-body)', fontSize: '0.74rem', color: '#9ca3af' },
  input:         { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--colour-text)' },
  idDisplay:     { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontFamily: 'var(--font-code)', fontSize: '0.84rem', color: '#6b7280', background: '#f9fafb' },
  summaryTextarea: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--colour-text)', resize: 'vertical', lineHeight: 1.5 },
  markdownWrap:  { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  checkboxes:    { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 },
  checkboxHint:  { fontFamily: 'var(--font-body)', fontSize: '0.74rem', color: '#9ca3af' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontSize: '0.86rem', color: 'var(--colour-text)', cursor: 'pointer' },
  actions:       { display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #f3f4f6' },
  saveBtn:       { padding: '9px 20px', fontSize: '0.9rem' },
  deleteBtn:     { padding: '9px 16px', fontSize: '0.9rem' },
}

const rp = {
  wrap:       { position: 'relative' },
  tags:       { display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', minHeight: 38 },
  tag:        { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0eafa', border: '1px solid #ded1f3', borderRadius: 999, padding: '2px 8px 2px 10px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--colour-primary)' },
  tagRemove:  { border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--colour-primary)', fontSize: '0.9rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' },
  inputWrap:  { position: 'relative', flex: 1, minWidth: 80 },
  input:      { border: 'none', outline: 'none', padding: '2px 0', fontFamily: 'var(--font-body)', fontSize: '0.86rem', width: '100%', background: 'transparent' },
  dropdown:   { position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 7, boxShadow: '0 4px 14px rgba(0,0,0,0.12)', minWidth: 220, marginTop: 4 },
  option:     { display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '7px 12px', cursor: 'pointer' },
  optionTitle:{ fontFamily: 'var(--font-body)', fontSize: '0.86rem', color: 'var(--colour-text)', fontWeight: 600 },
  optionId:   { fontFamily: 'var(--font-code)', fontSize: '0.76rem', color: '#9ca3af' },
}
