import React, { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import { MarkdownRenderer } from '../shared/markdown'
import {
  addDraftReviewNote,
  deleteDraftReviewNote,
  updateDraftStage,
  updateDraftReviewNote,
  upsertDraft,
} from '../shared/lessonService'

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }
const STAGE_FILTERS = ['all', 'ideas', 'details', 'review', 'approved', 'published']
const DECISION_LABELS = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' }
const DECISION_COLORS = { pending: '#d97706', accepted: '#16a34a', rejected: '#dc2626' }

function StageBadge({ stage, style }) {
  return (
    <span style={{
      background: STAGE_COLORS[stage] ?? '#6b7280',
      color: '#fff',
      fontFamily: 'var(--font-body)',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      borderRadius: 4,
      padding: '2px 8px',
      ...style,
    }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

function DecisionBadge({ decision }) {
  return (
    <span style={{
      background: DECISION_COLORS[decision] ?? '#6b7280',
      color: '#fff',
      fontFamily: 'var(--font-body)',
      fontSize: '0.7rem',
      fontWeight: 700,
      borderRadius: 4,
      padding: '2px 7px',
    }}>
      {DECISION_LABELS[decision] ?? decision}
    </span>
  )
}

function slugifySection(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

function parseSections(content) {
  if (!content) return []
  const lines = content.split('\n')
  const sections = []
  let preamble = []
  let current = null

  for (const line of lines) {
    const match = line.match(/^###\s+(.+)$/)
    if (match) {
      if (current) sections.push({ ...current, content: current.lines.join('\n') })
      current = { id: slugifySection(match[1]), title: match[1], lines: [line] }
    } else if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }
  }
  if (current) sections.push({ ...current, content: current.lines.join('\n') })
  const preambleText = preamble.join('\n').trim()
  if (preambleText) {
    sections.unshift({ id: '_preamble', title: '(Preamble)', content: preambleText })
  }
  return sections
}

function NoteDrawer({ section, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    suggestedChange: existing?.suggestedChange ?? '',
    extraNote: existing?.extraNote ?? '',
    decision: existing?.decision ?? 'pending',
  })

  return (
    <div style={s.drawer}>
      <div style={s.drawerHeader}>
        <strong style={s.drawerTitle}>Note: {section.title}</strong>
        <button style={s.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={s.drawerBody}>
        <label style={s.label}>Decision</label>
        <select style={s.select} value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value }))}>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <label style={s.label}>Suggested change</label>
        <textarea
          style={s.textarea}
          rows={4}
          value={form.suggestedChange}
          onChange={e => setForm(f => ({ ...f, suggestedChange: e.target.value }))}
          placeholder="Describe the change needed…"
        />
        <label style={s.label}>Extra note (optional)</label>
        <textarea
          style={s.textarea}
          rows={2}
          value={form.extraNote}
          onChange={e => setForm(f => ({ ...f, extraNote: e.target.value }))}
          placeholder="Any additional context…"
        />
        <div style={s.drawerActions}>
          <button className="btn-ghost-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave({ ...form, sectionId: section.id, sectionTitle: section.title })}>
            Save note
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanTab({ draft, onEditNote }) {
  const sections = parseSections(draft.content)
  const noteMap = Object.fromEntries((draft.reviewNotes ?? []).map(n => [n.sectionId, n]))

  if (sections.length === 0) {
    return <p style={s.empty}>No content yet. Use the CLI to add content to this draft.</p>
  }

  return (
    <div style={s.planContent}>
      {sections.map(section => {
        const note = noteMap[section.id]
        return (
          <div key={section.id} style={s.section}>
            <div style={s.sectionBar}>
              {note ? (
                <button style={s.noteBadge(note.decision)} onClick={() => onEditNote(section)}>
                  {DECISION_LABELS[note.decision] ?? 'Note'}: {note.suggestedChange.slice(0, 60)}{note.suggestedChange.length > 60 ? '…' : ''}
                </button>
              ) : (
                <button style={s.addNoteBtn} onClick={() => onEditNote(section)}>
                  + Add note
                </button>
              )}
            </div>
            <MarkdownRenderer content={section.content} />
          </div>
        )
      })}
    </div>
  )
}

function ContextTab({ draft, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(draft.context ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={s.contextEdit}>
        <textarea style={{ ...s.textarea, minHeight: 300 }} value={value} onChange={e => setValue(e.target.value)} />
        <div style={s.contextActions}>
          <button className="btn-ghost-outline" onClick={() => { setEditing(false); setValue(draft.context ?? '') }}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={s.contextHeader}>
        <button className="btn-ghost-outline" style={{ fontSize: '0.8rem' }} onClick={() => setEditing(true)}>Edit context</button>
      </div>
      {draft.context ? (
        <MarkdownRenderer content={draft.context} />
      ) : (
        <p style={s.empty}>No context set. Use the CLI (<code>lessons draft context &lt;id&gt;</code>) or click Edit to add AI working notes.</p>
      )}
    </div>
  )
}

function NotesTab({ draft, sections, onEdit, onDelete }) {
  const notes = draft.reviewNotes ?? []

  if (notes.length === 0) {
    return (
      <div style={s.notesEmpty}>
        <p style={s.empty}>No review notes yet.</p>
        <p style={s.emptyHint}>Switch to the Plan tab and click &ldquo;+ Add note&rdquo; next to any section.</p>
      </div>
    )
  }

  return (
    <div style={s.notesList}>
      {notes.map(note => (
        <div key={note.sectionId} style={s.noteCard}>
          <div style={s.noteCardTop}>
            <span style={s.noteSectionTitle}>{note.sectionTitle}</span>
            <DecisionBadge decision={note.decision} />
            <div style={s.noteCardActions}>
              <button style={s.editNoteBtn} onClick={() => onEdit(sections.find(sec => sec.id === note.sectionId) ?? { id: note.sectionId, title: note.sectionTitle })}>
                Edit
              </button>
              <button style={s.deleteNoteBtn} onClick={() => onDelete(note.sectionId)}>
                ×
              </button>
            </div>
          </div>
          {note.suggestedChange && <p style={s.noteText}>{note.suggestedChange}</p>}
          {note.extraNote && <p style={s.noteExtra}>{note.extraNote}</p>}
        </div>
      ))}
    </div>
  )
}

export default function AuthoringPanel() {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [subTab, setSubTab] = useState('plan')
  const [editingSection, setEditingSection] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    const q = query(collection(firestore, 'lessonDrafts'), orderBy('updatedAt', 'desc'))
    return onSnapshot(q,
      snap => {
        setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoadingList(false)
      },
      () => setLoadingList(false),
    )
  }, [])

  useEffect(() => {
    if (!selectedId) { setDraft(null); return }
    const found = drafts.find(d => d.id === selectedId)
    setDraft(found ?? null)
  }, [selectedId, drafts])

  const filtered = stageFilter === 'all' ? drafts : drafts.filter(d => d.stage === stageFilter)

  const sections = draft ? parseSections(draft.content) : []

  async function handleAddOrEditNote(note) {
    try {
      await addDraftReviewNote(selectedId, note)
      setEditingSection(null)
    } catch (e) {
      alert('Failed to save note: ' + e.message)
    }
  }

  async function handleUpdateExistingNote(sectionId, fields) {
    try {
      await updateDraftReviewNote(selectedId, sectionId, fields)
      setEditingSection(null)
    } catch (e) {
      alert('Failed to update note: ' + e.message)
    }
  }

  async function handleDeleteNote(sectionId) {
    if (!confirm('Delete this review note?')) return
    try {
      await deleteDraftReviewNote(selectedId, sectionId)
    } catch (e) {
      alert('Failed to delete note: ' + e.message)
    }
  }

  async function handleSaveContext(context) {
    await upsertDraft({ id: selectedId, context })
  }

  async function handleStageAction(action) {
    setActionBusy(true)
    try {
      if (action === 'request-changes') {
        if (!confirm('Return this draft to Details stage? The author will need to revise it.')) return
        await updateDraftStage(selectedId, 'details')
      } else if (action === 'approve') {
        if (!confirm('Approve this draft? The lesson is ready to publish.')) return
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

  function openNoteEditor(section) {
    setEditingSection(section)
    setSubTab('plan')
  }

  const existingNote = editingSection ? (draft?.reviewNotes ?? []).find(n => n.sectionId === editingSection.id) : null

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Authoring</h2>
      <div style={s.layout}>
        {/* Sidebar: draft list */}
        <div style={s.sidebar}>
          <div style={s.filterRow}>
            {STAGE_FILTERS.map(f => (
              <button
                key={f}
                style={s.filterChip(f === stageFilter)}
                onClick={() => setStageFilter(f)}
              >
                {f === 'all' ? 'All' : STAGE_LABELS[f] ?? f}
              </button>
            ))}
          </div>
          {loadingList ? (
            <p style={s.empty}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={s.empty}>No drafts{stageFilter !== 'all' ? ` at stage "${stageFilter}"` : ''}.</p>
          ) : (
            <div style={s.draftList}>
              {filtered.map(d => (
                <button
                  key={d.id}
                  style={s.draftRow(d.id === selectedId)}
                  onClick={() => { setSelectedId(d.id); setSubTab('plan'); setEditingSection(null) }}
                >
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

        {/* Right panel: review */}
        {draft ? (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <div style={s.panelTitle}>
                <StageBadge stage={draft.stage} />
                <strong style={s.panelName}>{draft.title || draft.id}</strong>
                {draft.type && <span style={s.panelType}>{draft.type}</span>}
                {draft.level && <span style={s.panelLevel}>Level {draft.level}</span>}
                <span style={s.panelId}>{draft.id}</span>
              </div>
              {(draft.reviewNotes?.length ?? 0) > 0 && (
                <span style={s.notesCount}>{draft.reviewNotes.length} note{draft.reviewNotes.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            <div className="ui-tabs" style={{ marginBottom: 16 }}>
              <button className={`ui-tab${subTab === 'plan' ? ' is-active' : ''}`} onClick={() => setSubTab('plan')}>Plan</button>
              <button className={`ui-tab${subTab === 'context' ? ' is-active' : ''}`} onClick={() => setSubTab('context')}>Context</button>
              <button className={`ui-tab${subTab === 'notes' ? ' is-active' : ''}`} onClick={() => setSubTab('notes')}>
                Notes {(draft.reviewNotes?.length ?? 0) > 0 ? `(${draft.reviewNotes.length})` : ''}
              </button>
            </div>

            <div style={s.panelBody}>
              {subTab === 'plan' && (
                <PlanTab draft={draft} onEditNote={openNoteEditor} />
              )}
              {subTab === 'context' && (
                <ContextTab draft={draft} onSave={handleSaveContext} />
              )}
              {subTab === 'notes' && (
                <NotesTab
                  draft={draft}
                  sections={sections}
                  onEdit={openNoteEditor}
                  onDelete={handleDeleteNote}
                />
              )}
            </div>

            <div style={s.actionBar}>
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
          <div style={s.noSelection}>
            <p style={s.empty}>Select a draft to review.</p>
          </div>
        )}
      </div>

      {/* Note editor drawer */}
      {editingSection && (
        <div style={s.overlay} onClick={() => setEditingSection(null)}>
          <div style={s.drawerWrap} onClick={e => e.stopPropagation()}>
            <NoteDrawer
              section={editingSection}
              existing={existingNote}
              onSave={handleAddOrEditNote}
              onClose={() => setEditingSection(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  layout: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
    minHeight: 500,
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  filterChip: active => ({
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: active ? 700 : 500,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid',
    borderColor: active ? 'var(--colour-primary)' : '#d1d5db',
    background: active ? 'var(--colour-primary)' : '#fff',
    color: active ? '#fff' : '#4b5563',
    cursor: 'pointer',
  }),
  draftList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
  },
  draftRow: selected => ({
    width: '100%',
    textAlign: 'left',
    background: selected ? '#eff6ff' : '#fff',
    border: '1px solid',
    borderColor: selected ? '#bfdbfe' : '#e5e7eb',
    borderRadius: 6,
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }),
  draftTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    lineHeight: 1.3,
  },
  draftMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  draftType: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: '#6b7280',
    background: '#f3f4f6',
    borderRadius: 4,
    padding: '1px 5px',
  },
  panel: {
    flex: 1,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  panelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  panelName: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--colour-text)',
  },
  panelType: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#6b7280',
    background: '#f3f4f6',
    borderRadius: 4,
    padding: '2px 7px',
  },
  panelLevel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#4b5563',
  },
  panelId: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.73rem',
    color: '#9ca3af',
    background: '#f9fafb',
    borderRadius: 4,
    padding: '1px 6px',
    border: '1px solid #f3f4f6',
  },
  notesCount: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#d97706',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 4,
    padding: '2px 8px',
  },
  panelBody: {
    flex: 1,
    padding: '0 20px 20px',
    overflowY: 'auto',
    maxHeight: '65vh',
  },
  actionBar: {
    padding: '12px 20px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  noSelection: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fafafa',
    border: '1px dashed #e5e7eb',
    borderRadius: 8,
  },
  empty: {
    fontFamily: 'var(--font-body)',
    color: '#6b7280',
    fontSize: '0.9rem',
    margin: 0,
  },
  emptyHint: {
    fontFamily: 'var(--font-body)',
    color: '#9ca3af',
    fontSize: '0.82rem',
    margin: '6px 0 0',
  },
  planContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  section: {
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: 8,
    marginBottom: 4,
  },
  sectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 8,
  },
  noteBadge: decision => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid',
    borderColor: DECISION_COLORS[decision] ?? '#d1d5db',
    background: '#fff',
    color: DECISION_COLORS[decision] ?? '#4b5563',
    cursor: 'pointer',
    maxWidth: '100%',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  addNoteBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px dashed #d1d5db',
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  drawerWrap: {
    width: '100%',
    maxWidth: 700,
  },
  drawer: {
    background: '#fff',
    borderTop: '3px solid var(--colour-primary)',
    borderRadius: '8px 8px 0 0',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #f3f4f6',
  },
  drawerTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: '1.3rem',
    lineHeight: 1,
    padding: '0 4px',
  },
  drawerBody: {
    padding: '16px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
  },
  select: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    padding: '6px 10px',
    background: '#fff',
    color: 'var(--colour-text)',
    width: '100%',
  },
  textarea: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    padding: '8px 10px',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
    color: 'var(--colour-text)',
    lineHeight: 1.5,
  },
  drawerActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  contextHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  contextEdit: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  contextActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  notesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  notesEmpty: {
    paddingTop: 24,
  },
  noteCard: {
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  noteCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  noteSectionTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--colour-text)',
    flex: 1,
  },
  noteCardActions: {
    display: 'flex',
    gap: 4,
    marginLeft: 'auto',
  },
  editNoteBtn: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#4b5563',
    cursor: 'pointer',
  },
  deleteNoteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '0 3px',
  },
  noteText: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  noteExtra: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    fontStyle: 'italic',
  },
}
