import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import { MarkdownRenderer } from '../shared/markdown'
import { getLessonModules } from '../modules/registry'
import {
  addDraftEntry,
  deleteDraft,
  deleteDraftEntry,
  deleteGuideline,
  fetchGuidelineList,
  fetchLessonFeedbackItems,
  reorderDraftEntries,
  updateDraftEntry,
  updateDraftStage,
  updateEntryReviewNote,
  upsertDraft,
  upsertGuideline,
} from '../shared/lessonService'

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }
const STAGE_FILTERS = ['all', 'ideas', 'details', 'review', 'approved', 'published']
const DECISION_LABELS = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' }
const DECISION_COLORS = { pending: '#d97706', accepted: '#16a34a', rejected: '#dc2626' }
const ENTRY_TYPES = ['information', 'code', 'quiz']
const LESSON_MODULE_OPTIONS = getLessonModules().map(module => ({ value: module.type, label: module.label }))
const APPLIES_TO_OPTIONS = [{ value: 'all', label: 'All' }, ...LESSON_MODULE_OPTIONS]

// ── Small shared components ────────────────────────────────────────────────────

function StageBadge({ stage, style }) {
  return (
    <span style={{
      background: STAGE_COLORS[stage] ?? '#6b7280', color: '#fff',
      fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      borderRadius: 4, padding: '2px 8px', ...style,
    }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

function DecisionBadge({ decision }) {
  return (
    <span style={{
      background: DECISION_COLORS[decision] ?? '#6b7280', color: '#fff',
      fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700,
      borderRadius: 4, padding: '2px 7px',
    }}>
      {DECISION_LABELS[decision] ?? decision}
    </span>
  )
}

function TypeBadge({ type }) {
  const colors = { information: '#0891b2', code: '#7c3aed', quiz: '#d97706' }
  return (
    <span style={{
      background: colors[type] ?? '#6b7280', color: '#fff',
      fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 600,
      borderRadius: 4, padding: '2px 6px', textTransform: 'capitalize',
    }}>
      {type ?? 'code'}
    </span>
  )
}

// ── Entry drawer ──────────────────────────────────────────────────────────────

function EntryDrawer({ entry, draftId, lessonId, onClose, onSaved, onDeleted, initialTab = 'edit' }) {
  const isNew = !entry.id
  const [form, setForm] = useState({
    title: entry.title ?? '',
    entryType: entry.entryType ?? 'code',
    purpose: entry.purpose ?? '',
    body: entry.body ?? '',
    expectedOutcome: entry.expectedOutcome ?? '',
    pitfalls: entry.pitfalls ?? '',
  })
  const [note, setNote] = useState({
    decision: entry.reviewNote?.decision ?? 'pending',
    suggestedChange: entry.reviewNote?.suggestedChange ?? '',
    extraNote: entry.reviewNote?.extraNote ?? '',
  })
  const [feedback, setFeedback] = useState([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    if (!entry.id || !lessonId) return
    setLoadingFeedback(true)
    fetchLessonFeedbackItems(lessonId)
      .then(items => {
        const taskId = String(entry.order)
        setFeedback(items.filter(f => String(f.taskId) === taskId))
      })
      .catch(() => {})
      .finally(() => setLoadingFeedback(false))
  }, [entry.id, entry.order, lessonId])

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        await addDraftEntry(draftId, { ...form, reviewNote: note })
      } else {
        await updateDraftEntry(draftId, entry.id, { ...form })
        await updateEntryReviewNote(draftId, entry.id, note)
      }
      onSaved()
      onClose()
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    try {
      await deleteDraftEntry(draftId, entry.id)
      onDeleted()
      onClose()
    } catch (e) {
      alert('Failed to delete: ' + e.message)
    }
  }

  const hasNote = note.suggestedChange.trim() || note.extraNote.trim()
  const hasFeedback = feedback.length > 0

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.drawerWrap} onClick={e => e.stopPropagation()}>
        <div style={s.drawer}>
          <div style={s.drawerHeader}>
            <strong style={s.drawerTitle}>
              {isNew ? 'New entry' : `Entry ${entry.order}: ${entry.title || '—'}`}
            </strong>
            <button style={s.closeBtn} onClick={onClose}>×</button>
          </div>

          <div style={{ ...s.tabRow, padding: '0 20px', borderBottom: '1px solid #f3f4f6', margin: 0 }}>
            <div className="ui-tabs">
              <button className={`ui-tab${tab === 'edit' ? ' is-active' : ''}`} onClick={() => setTab('edit')}>Edit</button>
              <button className={`ui-tab${tab === 'review' ? ' is-active' : ''}`} onClick={() => setTab('review')}>
                Review {hasNote && <DecisionBadge decision={note.decision} />}
                {hasFeedback && <span style={s.feedbackCount}>{feedback.length}</span>}
              </button>
            </div>
          </div>

          <div style={s.drawerBody}>
            {tab === 'edit' && (
              <>
                <label style={s.label}>Title</label>
                <input style={s.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title…" autoFocus />

                <label style={s.label}>Type</label>
                <select style={s.select} value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))}>
                  {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>

                <label style={s.label}>Purpose</label>
                <textarea style={{ ...s.textarea, minHeight: 100 }} rows={5} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="What this entry achieves…" />

                <label style={s.label}>Content <span style={s.hint}>(Markdown)</span></label>
                <textarea style={{ ...s.textarea, minHeight: 160, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem' }} rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="User-facing content, starter code, instructions…" />

                <label style={s.label}>Expected outcome</label>
                <textarea style={{ ...s.textarea, minHeight: 100 }} rows={5} value={form.expectedOutcome} onChange={e => setForm(f => ({ ...f, expectedOutcome: e.target.value }))} placeholder="What students should be able to do…" />

                <label style={s.label}>Known pitfalls <span style={s.hint}>(optional)</span></label>
                <textarea style={{ ...s.textarea, minHeight: 100 }} rows={5} value={form.pitfalls} onChange={e => setForm(f => ({ ...f, pitfalls: e.target.value }))} placeholder="Common mistakes or implementation notes…" />
              </>
            )}

            {tab === 'review' && (
              <>
                <div style={s.reviewSection}>
                  <p style={s.reviewSectionLabel}>Review note</p>
                  <label style={s.label}>Decision</label>
                  <select style={s.select} value={note.decision} onChange={e => setNote(n => ({ ...n, decision: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <label style={s.label}>Suggested change</label>
                  <textarea style={s.textarea} rows={3} value={note.suggestedChange} onChange={e => setNote(n => ({ ...n, suggestedChange: e.target.value }))} placeholder="Describe the change needed…" />
                  <label style={s.label}>Extra note <span style={s.hint}>(optional)</span></label>
                  <textarea style={s.textarea} rows={2} value={note.extraNote} onChange={e => setNote(n => ({ ...n, extraNote: e.target.value }))} placeholder="Any additional context…" />
                </div>

                <div style={s.feedbackSection}>
                  <p style={s.reviewSectionLabel}>
                    Teacher feedback
                    {!isNew && <span style={s.hint}> — task {entry.order} in published lesson</span>}
                  </p>
                  {isNew && <p style={s.empty}>Save the entry first to see linked feedback.</p>}
                  {!isNew && loadingFeedback && <p style={s.empty}>Loading…</p>}
                  {!isNew && !loadingFeedback && feedback.length === 0 && (
                    <p style={s.empty}>No feedback yet for this task.</p>
                  )}
                  {feedback.map(f => (
                    <div key={f.id} style={s.feedbackCard}>
                      <p style={s.feedbackText}>{f.text}</p>
                      <div style={s.feedbackMeta}>
                        <span>{f.teacherEmail || 'Anonymous'}</span>
                        {f.submittedAt && <span>{new Date(f.submittedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={s.drawerActions}>
            {!isNew && (
              <button className="btn-ghost-outline" style={{ color: '#dc2626', borderColor: '#dc2626', marginRight: 'auto' }} onClick={handleDelete}>
                Delete
              </button>
            )}
            <button className="btn-ghost-outline" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving || !form.title.trim()} onClick={handleSave}>
              {saving ? 'Saving…' : isNew ? 'Add entry' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Entries tab ───────────────────────────────────────────────────────────────

const REVIEW_NOTE_COLORS = {
  pending:  { bg: '#fffbeb', border: '#fde68a', label: '#92400e' },
  accepted: { bg: '#f0fdf4', border: '#bbf7d0', label: '#166534' },
  rejected: { bg: '#fef2f2', border: '#fecaca', label: '#991b1b' },
}

function EntriesTab({ draft, draftId, onOpenEntry, onUpdateDecision }) {
  const entries = (draft.entries ?? []).slice().sort((a, b) => a.order - b.order)
  const [busyId, setBusyId] = useState(null)

  async function handleDecision(entry, decision) {
    setBusyId(entry.id)
    try {
      const note = entry.reviewNote ?? {}
      await onUpdateDecision(entry.id, decision, note)
    } finally {
      setBusyId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div style={s.emptyState}>
        <p style={s.empty}>No entries yet.</p>
        <p style={s.emptyHint}>Click &ldquo;+ Add entry&rdquo; to build the lesson plan step by step.</p>
      </div>
    )
  }

  return (
    <div style={s.entryList}>
      {entries.map(entry => {
        const note = entry.reviewNote
        const decision = note?.decision ?? 'pending'
        const hasNoteText = note?.suggestedChange?.trim() || note?.extraNote?.trim()
        const noteColors = REVIEW_NOTE_COLORS[decision] ?? REVIEW_NOTE_COLORS.pending
        const busy = busyId === entry.id

        return (
          <div key={entry.id} style={s.entryCard}>
            <div style={s.entryCardHeader}>
              <div style={s.entryCardMeta}>
                <span style={s.entryOrder}>{entry.order}</span>
                <TypeBadge type={entry.entryType} />
                <span style={s.entryTitle}>{entry.title || '(untitled)'}</span>
              </div>
              <DecisionBadge decision={decision} />
            </div>

            {(entry.purpose || entry.expectedOutcome || entry.pitfalls) && (
              <div style={s.entryCardBody}>
                {entry.purpose && (
                  <div style={s.entrySection}>
                    <span style={s.entrySectionLabel}>Purpose</span>
                    <p style={s.entrySectionText}>{entry.purpose}</p>
                  </div>
                )}
                {entry.expectedOutcome && (
                  <div style={s.entrySection}>
                    <span style={s.entrySectionLabel}>Expected outcome</span>
                    <p style={s.entrySectionText}>{entry.expectedOutcome}</p>
                  </div>
                )}
                {entry.pitfalls && (
                  <div style={s.entrySection}>
                    <span style={s.entrySectionLabel}>Known pitfalls</span>
                    <p style={s.entrySectionText}>{entry.pitfalls}</p>
                  </div>
                )}
              </div>
            )}

            {hasNoteText && (
              <div style={{ ...s.reviewNoteBox, background: noteColors.bg, borderColor: noteColors.border }}>
                <span style={{ ...s.entrySectionLabel, color: noteColors.label }}>Review note</span>
                {note.suggestedChange?.trim() && (
                  <p style={s.reviewNoteText}><strong>Suggested change:</strong> {note.suggestedChange}</p>
                )}
                {note.extraNote?.trim() && (
                  <p style={s.reviewNoteText}><strong>Note:</strong> {note.extraNote}</p>
                )}
              </div>
            )}

            <div style={s.entryCardActions}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ ...s.entryActionBtn, ...s.entryActionReject }}
                  disabled={busy || decision === 'rejected'}
                  onClick={() => handleDecision(entry, 'rejected')}
                >
                  Reject
                </button>
                <button
                  style={{ ...s.entryActionBtn, ...s.entryActionApprove }}
                  disabled={busy || decision === 'accepted'}
                  onClick={() => handleDecision(entry, 'accepted')}
                >
                  Approve
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={s.entryActionBtn} onClick={() => onOpenEntry(entry, 'review')}>Review</button>
                <button style={{ ...s.entryActionBtn, ...s.entryActionEdit }} onClick={() => onOpenEntry(entry, 'edit')}>Edit</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Context tab ───────────────────────────────────────────────────────────────

function ContextTab({ draft, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(draft.context ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(value); setEditing(false) }
    finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div style={s.contextEdit}>
        <textarea style={{ ...s.textarea, minHeight: 300 }} value={value} onChange={e => setValue(e.target.value)} />
        <div style={s.rowEnd}>
          <button className="btn-ghost-outline" onClick={() => { setEditing(false); setValue(draft.context ?? '') }}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={s.rowEnd}>
        <button className="btn-ghost-outline" style={{ fontSize: '0.8rem' }} onClick={() => setEditing(true)}>Edit context</button>
      </div>
      {draft.context
        ? <MarkdownRenderer content={draft.context} />
        : <p style={s.empty}>No context set. Add AI working notes or background for this draft.</p>}
    </div>
  )
}

// ── New draft modal ───────────────────────────────────────────────────────────

function NewDraftModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ id: '', title: '', type: 'python', description: '', module: '', lessonNumber: '', targetAudience: '', duration: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    const id = form.id.trim()
    const title = form.title.trim()
    if (!id) { setError('ID is required.'); return }
    if (!/^[a-z0-9-]+$/.test(id)) { setError('ID must be lowercase letters, numbers, and hyphens only.'); return }
    if (!title) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      await upsertDraft({
        id, title, type: form.type,
        description: form.description.trim(),
        module: form.module.trim() || null,
        lessonNumber: form.lessonNumber ? Number(form.lessonNumber) : null,
        targetAudience: form.targetAudience.trim() || null,
        duration: form.duration ? Number(form.duration) : null,
        stage: 'ideas', entries: [], context: '',
      })
      onCreated(id)
      onClose()
    } catch (e) {
      setError('Failed to create draft: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, props = {}) => (
    <>
      <label style={s.label}>{label}</label>
      <input style={s.input} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} {...props} />
    </>
  )

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalWrap} onClick={e => e.stopPropagation()}>
        <div style={s.modal}>
          <div style={s.modalHeader}>
            <strong style={s.drawerTitle}>New Draft</strong>
            <button style={s.closeBtn} onClick={onClose}>×</button>
          </div>
          <div style={s.modalBody}>
            {field('ID', 'id', { placeholder: 'python-for-loops', autoFocus: true })}
            {field('Title', 'title', { placeholder: 'Python For Loops' })}
            <label style={s.label}>Type</label>
            <select style={s.select} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {LESSON_MODULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {field('Module', 'module', { placeholder: 'Python Level 3' })}
            {field('Lesson number', 'lessonNumber', { type: 'number', placeholder: '9' })}
            <label style={s.label}>Description <span style={s.hint}>(optional)</span></label>
            <textarea style={s.textarea} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
            {field('Target audience', 'targetAudience', { placeholder: 'Groups of up to 8 children (optional)' })}
            {field('Duration (minutes)', 'duration', { type: 'number', placeholder: '45 (optional)' })}
            {error && <p style={s.formError}>{error}</p>}
            <div style={s.rowEnd}>
              <button className="btn-ghost-outline" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={handleCreate}>{saving ? 'Creating…' : 'Create draft'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Guidelines section ────────────────────────────────────────────────────────

function GuidelinesSection() {
  const [guidelines, setGuidelines] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ id: '', title: '', appliesTo: 'all', body: '' })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGuidelineList()
      .then(g => { setGuidelines(g); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? guidelines : guidelines.filter(g => g.appliesTo === filter || g.appliesTo === 'all')
  const selected = guidelines.find(g => g.id === selectedId) ?? null

  function startNew() {
    setIsNew(true)
    setEditing(true)
    setSelectedId(null)
    setForm({ id: '', title: '', appliesTo: 'all', body: '' })
    setError('')
  }

  function startEdit(g) {
    setIsNew(false)
    setEditing(true)
    setForm({ id: g.id, title: g.title ?? '', appliesTo: g.appliesTo ?? 'all', body: g.body ?? '' })
    setError('')
  }

  async function handleSave() {
    const id = form.id.trim()
    if (!id) { setError('ID is required.'); return }
    if (!/^[a-z0-9-]+$/.test(id)) { setError('ID must be lowercase, numbers, and hyphens only.'); return }
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      await upsertGuideline({ id, title: form.title.trim(), appliesTo: form.appliesTo, body: form.body })
      const updated = await fetchGuidelineList()
      setGuidelines(updated)
      setSelectedId(id)
      setEditing(false)
    } catch (e) {
      setError('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this guideline?')) return
    try {
      await deleteGuideline(id)
      setGuidelines(g => g.filter(x => x.id !== id))
      if (selectedId === id) { setSelectedId(null); setEditing(false) }
    } catch (e) {
      alert('Failed to delete: ' + e.message)
    }
  }

  return (
    <div style={s.layout}>
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <span style={s.sidebarHeading}>Guidelines</span>
          <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '3px 10px' }} onClick={startNew}>+ New</button>
        </div>
        <div style={s.filterRow}>
          {APPLIES_TO_OPTIONS.map(o => (
            <button key={o.value} style={s.filterChip(o.value === filter)} onClick={() => setFilter(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        {loading ? <p style={s.empty}>Loading…</p> : filtered.length === 0 ? <p style={s.empty}>No guidelines.</p> : (
          <div style={s.draftList}>
            {filtered.map(g => (
              <button key={g.id} style={s.draftRow(g.id === selectedId)} onClick={() => { setSelectedId(g.id); setEditing(false) }}>
                <div style={s.draftTitle}>{g.title || g.id}</div>
                <div style={s.draftMeta}>
                  <span style={s.draftType}>{g.appliesTo ?? 'all'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <strong style={s.panelName}>{isNew ? 'New guideline' : `Edit: ${form.title || form.id}`}</strong>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
            {isNew && (
              <>
                <label style={s.label}>ID <span style={s.hint}>(slug)</span></label>
                <input style={s.input} value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder="python-style-guide" autoFocus />
              </>
            )}
            <label style={s.label}>Title</label>
            <input style={s.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Python Style Guide" autoFocus={!isNew} />
            <label style={s.label}>Applies to</label>
            <select style={s.select} value={form.appliesTo} onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value }))}>
              {APPLIES_TO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={s.label}>Body <span style={s.hint}>(Markdown)</span></label>
            <textarea
              style={{ ...s.textarea, minHeight: 300, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.82rem' }}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="## Heading&#10;&#10;Guideline content…"
            />
            {error && <p style={s.formError}>{error}</p>}
          </div>
          <div style={s.actionBar}>
            <button className="btn-ghost-outline" onClick={() => { setEditing(false); setIsNew(false) }}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : selected ? (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <div style={s.panelTitle}>
              <strong style={s.panelName}>{selected.title || selected.id}</strong>
              <span style={s.draftType}>{selected.appliesTo ?? 'all'}</span>
              <span style={s.panelId}>{selected.id}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost-outline" style={{ fontSize: '0.8rem' }} onClick={() => startEdit(selected)}>Edit</button>
              <button className="btn-ghost-outline" style={{ fontSize: '0.8rem', color: '#dc2626', borderColor: '#dc2626' }} onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </div>
          <div style={s.panelBody}>
            {selected.body
              ? <MarkdownRenderer content={selected.body} />
              : <p style={s.empty}>No content yet.</p>}
          </div>
        </div>
      ) : (
        <div style={s.noSelection}><p style={s.empty}>Select a guideline to view.</p></div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

const VALID_TOP_TABS = ['drafts', 'guidelines']

export default function AuthoringPanel({ subtab, onSubtabChange }) {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [subTab, setSubTab] = useState('entries')
  const [openEntry, setOpenEntry] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [showNewDraft, setShowNewDraft] = useState(false)
  const topTab = VALID_TOP_TABS.includes(subtab) ? subtab : 'drafts'
  const setTopTab = onSubtabChange

  useEffect(() => {
    const q = query(collection(firestore, 'lessonDrafts'), orderBy('updatedAt', 'desc'))
    return onSnapshot(q,
      snap => { setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingList(false) },
      () => setLoadingList(false),
    )
  }, [])

  useEffect(() => {
    if (!selectedId) { setDraft(null); return }
    setDraft(drafts.find(d => d.id === selectedId) ?? null)
  }, [selectedId, drafts])

  const filtered = stageFilter === 'all' ? drafts : drafts.filter(d => d.stage === stageFilter)

  async function handleSaveContext(context) {
    await upsertDraft({ id: selectedId, context })
  }

  async function handleStageAction(action) {
    setActionBusy(true)
    try {
      if (action === 'advance-to-details') {
        if (!confirm('Move this draft from Ideas to Details?')) return
        await updateDraftStage(selectedId, 'details')
      } else if (action === 'submit-for-review') {
        if (!confirm('Submit this draft for review?')) return
        await updateDraftStage(selectedId, 'review')
      } else if (action === 'request-changes') {
        if (!confirm('Return this draft to Details stage?')) return
        await updateDraftStage(selectedId, 'details')
      } else if (action === 'approve') {
        if (!confirm('Approve this draft?')) return
        await updateDraftStage(selectedId, 'approved', user?.email)
      } else if (action === 'publish') {
        if (!confirm('Mark as published? Make sure you have already run the CLI publish command.')) return
        await updateDraftStage(selectedId, 'published')
      }
    } catch (e) {
      alert('Action failed: ' + e.message)
    } finally {
      setActionBusy(false)
    }
  }

  async function handleEntryDecision(entryId, decision, existingNote) {
    await updateEntryReviewNote(selectedId, entryId, {
      decision,
      suggestedChange: existingNote.suggestedChange ?? '',
      extraNote: existingNote.extraNote ?? '',
    })
  }

  async function handleDeleteDraft() {
    if (!confirm(`Delete draft "${draft?.title || selectedId}"? This cannot be undone.`)) return
    try {
      await deleteDraft(selectedId)
      setSelectedId(null)
    } catch (e) {
      alert('Failed to delete draft: ' + e.message)
    }
  }

  const entryCount = draft?.entries?.length ?? 0
  const noteCount = (draft?.entries ?? []).filter(e => e.reviewNote?.suggestedChange?.trim()).length

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Authoring</h2>
      <div className="ui-tabs">
        <button className={`ui-tab${topTab === 'drafts' ? ' is-active' : ''}`} onClick={() => setTopTab('drafts')}>Drafts</button>
        <button className={`ui-tab${topTab === 'guidelines' ? ' is-active' : ''}`} onClick={() => setTopTab('guidelines')}>Guidelines</button>
      </div>

      {topTab === 'guidelines' && <GuidelinesSection />}

      {topTab === 'drafts' && (
        <div style={s.layout}>
          {/* Sidebar */}
          <div style={s.sidebar}>
            <div style={s.sidebarHeader}>
              <span style={s.sidebarHeading}>Drafts</span>
              <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '3px 10px' }} onClick={() => setShowNewDraft(true)}>
                + New
              </button>
            </div>
            <div style={s.filterRow}>
              {STAGE_FILTERS.map(f => (
                <button key={f} style={s.filterChip(f === stageFilter)} onClick={() => setStageFilter(f)}>
                  {f === 'all' ? 'All' : STAGE_LABELS[f] ?? f}
                </button>
              ))}
            </div>
            {loadingList ? (
              <p style={s.empty}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p style={s.empty}>No drafts{stageFilter !== 'all' ? ` at "${stageFilter}"` : ''}.</p>
            ) : (
              <div style={s.draftList}>
                {filtered.map(d => (
                  <button key={d.id} style={s.draftRow(d.id === selectedId)}
                    onClick={() => { setSelectedId(d.id); setSubTab('entries'); setOpenEntry(null) }}>
                    <div style={s.draftTitle}>{d.title || d.id}</div>
                    <div style={s.draftMeta}>
                      <StageBadge stage={d.stage} />
                      {d.type && <span style={s.draftType}>{d.type}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          {draft ? (
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <div style={s.panelTitle}>
                  <StageBadge stage={draft.stage} />
                  <strong style={s.panelName}>{draft.title || draft.id}</strong>
                  {draft.type && <span style={s.draftType}>{draft.type}</span>}
                  {draft.module && <span style={s.panelLevel}>{draft.module}{draft.lessonNumber ? ` · L${draft.lessonNumber}` : ''}</span>}
                  <span style={s.panelId}>{draft.id}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {noteCount > 0 && <span style={s.notesCount}>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>}
                  {entryCount > 0 && <span style={s.entryCount}>{entryCount} entr{entryCount !== 1 ? 'ies' : 'y'}</span>}
                </div>
              </div>

              <div style={s.tabRow}>
                <div className="ui-tabs">
                  <button className={`ui-tab${subTab === 'entries' ? ' is-active' : ''}`} onClick={() => setSubTab('entries')}>Entries</button>
                  <button className={`ui-tab${subTab === 'context' ? ' is-active' : ''}`} onClick={() => setSubTab('context')}>Context</button>
                </div>
                {subTab === 'entries' && (
                  <button className="btn-ghost-outline" style={{ fontSize: '0.8rem' }}
                    onClick={() => setOpenEntry({ entry: { order: (draft.entries?.length ?? 0) + 1 }, tab: 'edit' })}>
                    + Add entry
                  </button>
                )}
              </div>

              <div style={s.panelBody}>
                {subTab === 'entries' && (
                  <EntriesTab
                    draft={draft}
                    draftId={draft.id}
                    onOpenEntry={(entry, tab) => setOpenEntry({ entry, tab: tab ?? 'edit' })}
                    onUpdateDecision={handleEntryDecision}
                  />
                )}
                {subTab === 'context' && (
                  <ContextTab draft={draft} onSave={handleSaveContext} />
                )}
              </div>

              <div style={s.actionBar}>
                <button
                  className="btn-ghost-outline"
                  style={{ color: '#dc2626', borderColor: '#dc2626', marginRight: 'auto' }}
                  disabled={actionBusy}
                  onClick={handleDeleteDraft}
                >
                  Delete draft
                </button>
                {draft.stage === 'ideas' && (
                  <button className="btn-primary" disabled={actionBusy} onClick={() => handleStageAction('advance-to-details')}>
                    Move to Details
                  </button>
                )}
                {draft.stage === 'details' && (
                  <button className="btn-ghost-outline" disabled={actionBusy} onClick={() => handleStageAction('submit-for-review')}>
                    Submit for Review
                  </button>
                )}
                {draft.stage === 'review' && (
                  <button className="btn-ghost-outline" disabled={actionBusy} onClick={() => handleStageAction('request-changes')}>
                    Request Changes
                  </button>
                )}
                {(draft.stage === 'review' || draft.stage === 'details') && (
                  <button className="btn-primary" disabled={actionBusy} onClick={() => handleStageAction('approve')}>
                    Approve
                  </button>
                )}
                {draft.stage === 'approved' && (
                  <button className="btn-primary" disabled={actionBusy} onClick={() => handleStageAction('publish')}>
                    Mark Published
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={s.noSelection}><p style={s.empty}>Select a draft to review.</p></div>
          )}
        </div>
      )}

      {openEntry && draft && (
        <EntryDrawer
          entry={openEntry.entry}
          initialTab={openEntry.tab}
          draftId={draft.id}
          lessonId={draft.id}
          onClose={() => setOpenEntry(null)}
          onSaved={() => {}}
          onDeleted={() => {}}
        />
      )}

      {showNewDraft && (
        <NewDraftModal
          onClose={() => setShowNewDraft(false)}
          onCreated={id => { setSelectedId(id); setSubTab('entries') }}
        />
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  heading: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 500 },
  sidebar: { width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sidebarHeading: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--colour-text)' },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  filterChip: active => ({
    fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: active ? 700 : 500,
    padding: '3px 8px', borderRadius: 4, border: '1px solid',
    borderColor: active ? 'var(--colour-primary)' : '#d1d5db',
    background: active ? 'var(--colour-primary)' : '#fff',
    color: active ? '#fff' : '#4b5563', cursor: 'pointer',
  }),
  draftList: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 },
  draftRow: selected => ({
    width: '100%', textAlign: 'left',
    background: selected ? '#eff6ff' : '#fff',
    border: '1px solid', borderColor: selected ? '#bfdbfe' : '#e5e7eb',
    borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 6,
  }),
  draftTitle: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)', lineHeight: 1.3 },
  draftMeta: { display: 'flex', alignItems: 'center', gap: 6 },
  draftType: { fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 5px' },
  panel: { flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', flexDirection: 'column' },
  panelHeader: { padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  panelTitle: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  panelName: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', color: 'var(--colour-text)' },
  panelLevel: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#4b5563' },
  panelId: { fontFamily: 'var(--font-mono, monospace)', fontSize: '0.73rem', color: '#9ca3af', background: '#f9fafb', borderRadius: 4, padding: '1px 6px', border: '1px solid #f3f4f6' },
  notesCount: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 8px' },
  entryCount: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 8px' },
  panelBody: { padding: '0 20px 20px' },
  actionBar: { padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' },
  noSelection: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', border: '1px dashed #e5e7eb', borderRadius: 8 },
  tabRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 0, borderBottom: '1px solid #f3f4f6' },
  empty: { fontFamily: 'var(--font-body)', color: '#6b7280', fontSize: '0.9rem', margin: 0 },
  emptyHint: { fontFamily: 'var(--font-body)', color: '#9ca3af', fontSize: '0.82rem', margin: '6px 0 0' },
  emptyState: { paddingTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  entryList: { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 },
  entryCard: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  entryCardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '12px 14px 10px', flexWrap: 'wrap',
  },
  entryCardMeta: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  entryOrder: { fontFamily: 'var(--font-mono, monospace)', fontSize: '0.78rem', color: '#9ca3af', minWidth: 18 },
  entryTitle: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--colour-text)', flex: 1 },
  entryCardBody: {
    padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10,
    borderBottom: '1px solid #f3f4f6',
  },
  entrySection: { display: 'flex', flexDirection: 'column', gap: 3 },
  entrySectionLabel: {
    fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700,
    color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  entrySectionText: {
    margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem',
    color: '#374151', lineHeight: 1.5,
  },
  entryCardActions: {
    display: 'flex', gap: 8, padding: '8px 14px', background: '#fafafa',
    justifyContent: 'space-between', alignItems: 'center',
    borderTop: '1px solid #f3f4f6',
  },
  entryActionBtn: {
    fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600,
    color: '#4b5563', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: 5, padding: '4px 12px', cursor: 'pointer', display: 'flex',
    alignItems: 'center', gap: 6,
  },
  entryActionEdit: { color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' },
  entryActionApprove: { color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4' },
  entryActionReject: { color: '#991b1b', borderColor: '#fecaca', background: '#fef2f2' },
  reviewNoteBox: {
    margin: '0 14px 12px', padding: '10px 12px', borderRadius: 6,
    border: '1px solid', display: 'flex', flexDirection: 'column', gap: 4,
  },
  reviewNoteText: {
    margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.83rem',
    color: '#374151', lineHeight: 1.5,
  },
  contextEdit: { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 },
  rowEnd: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  drawerWrap: { width: '100%', maxWidth: 760, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' },
  drawer: { background: '#fff', border: '1px solid #e5e7eb', borderTop: '3px solid var(--colour-primary)', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  drawerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  drawerTitle: { fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--colour-text)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.3rem', lineHeight: 1, padding: '0 4px' },
  drawerBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' },
  drawerActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  label: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  hint: { color: '#9ca3af', fontWeight: 400 },
  select: { fontFamily: 'var(--font-body)', fontSize: '0.88rem', border: '1px solid #d1d5db', borderRadius: 5, padding: '6px 10px', background: '#fff', color: 'var(--colour-text)', width: '100%' },
  textarea: { fontFamily: 'var(--font-body)', fontSize: '0.88rem', border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 10px', resize: 'vertical', width: '100%', boxSizing: 'border-box', color: 'var(--colour-text)', lineHeight: 1.5 },
  input: { fontFamily: 'var(--font-body)', fontSize: '0.88rem', border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', width: '100%', boxSizing: 'border-box', color: 'var(--colour-text)' },
  formError: { margin: 0, color: '#dc2626', fontSize: '0.83rem', fontFamily: 'var(--font-body)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalWrap: { width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' },
  modal: { background: '#fff', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  modalBody: { padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' },
  reviewSection: { display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16, borderBottom: '1px solid #f3f4f6', marginBottom: 16 },
  reviewSectionLabel: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' },
  feedbackSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  feedbackCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px' },
  feedbackText: { margin: '0 0 6px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--colour-text)', lineHeight: 1.5 },
  feedbackMeta: { display: 'flex', gap: 12, fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af' },
  feedbackCount: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', color: '#1d4ed8', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, padding: '0 5px', marginLeft: 4, minWidth: 16, height: 16 },
}
