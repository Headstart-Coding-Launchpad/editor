import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { flattenTasks } from '../../shared/taskUtils'
import { useReviewNotes } from '../reviewNotes/useReviewNotes'
import {
  addReviewNote,
  deleteReviewNote,
  updateReviewNote,
} from '../reviewNotes/reviewNotesService'
import {
  CHIP_COLOURS,
  REVIEW_NOTE_MAX_LENGTH,
  REVIEW_NOTE_TAGS,
  canChangeReviewNote,
  checkReviewNoteText,
  latestReviewNoteStatus,
  notesForTask,
  reviewNoteStatusLabel,
  reviewNoteTagLabel,
} from '../reviewNotes/reviewNotes'

// Preview review notes (platform request #127): the Feedback button on the blue preview strip
// and its one-line note box. Admins only, in the Classroom preview (?preview=true), never in the
// Builder's preview pane and never for a student. See docs/authoring/feedback-cli.md.

function formatTime(ms) {
  if (!ms) return 'just now'
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ReviewNotesControl({ lessonId, lesson, task }) {
  const { user, role } = useAuth() ?? {}
  const isAdmin = role === 'admin' && !!user
  const taskId = task?.id
  const { notes, error: loadError } = useReviewNotes(lessonId, taskId, isAdmin)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // A new task starts with a fresh, closed box.
    setOpen(false)
    setText('')
    setTag('')
    setEditingId(null)
    setMenuId(null)
    setError(null)
  }, [taskId])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, editingId])

  if (!isAdmin || taskId == null) return null

  const taskNotes = notesForTask(notes, taskId)
  const status = latestReviewNoteStatus(taskNotes)
  const position = flattenTasks(lesson?.tasks ?? []).findIndex((t) => t.id === taskId)
  const taskNumber = position >= 0 ? position + 1 : taskId
  const uid = user.uid

  function resetForm() {
    setText('')
    setTag('')
    setEditingId(null)
    setError(null)
  }

  // Close, Escape and a second tap on Feedback all drop an unsaved draft the same way.
  function close() {
    resetForm()
    setMenuId(null)
    setOpen(false)
  }

  async function save() {
    const checked = checkReviewNoteText(text)
    if (checked.error) {
      setError(checked.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await updateReviewNote(lessonId, editingId, { text: checked.text, tag: tag || null })
      } else {
        await addReviewNote(lessonId, {
          taskId,
          lessonVersion: lesson?.version ?? 0,
          text: checked.text,
          tag: tag || null,
          createdBy: uid,
        })
      }
      resetForm()
    } catch (err) {
      setError(`Could not save: ${err?.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  async function remove(noteId) {
    setMenuId(null)
    if (editingId === noteId) resetForm()
    try {
      await deleteReviewNote(lessonId, noteId)
    } catch (err) {
      setError(`Could not delete: ${err?.message ?? err}`)
    }
  }

  function startEdit(note) {
    setMenuId(null)
    setEditingId(note.id)
    setText(note.text)
    setTag(note.tag ?? '')
    setError(null)
  }

  return (
    <div style={s.wrap}>
      <button
        type="button"
        className="btn-ghost-outline"
        style={s.trigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{taskNotes.length ? `Feedback (${taskNotes.length})` : 'Feedback'}</span>
        {status && (
          <span data-testid="review-notes-chip" style={{ ...s.chip, ...CHIP_COLOURS[status] }}>
            {reviewNoteStatusLabel(status)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Feedback on task ${taskNumber}`}
          style={s.box}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
        >
          {loadError && <p style={s.error}>Notes could not load: {loadError}</p>}
          {taskNotes.length > 0 && (
            <ul style={s.list}>
              {taskNotes.map((note) => {
                const changeable = canChangeReviewNote(note, uid)
                const tagLabel = reviewNoteTagLabel(note.tag)
                return (
                  <li key={note.id} style={s.note}>
                    <div style={s.noteMain}>
                      <span style={s.noteText}>{note.text}</span>
                      <span style={s.noteMeta}>
                        {tagLabel ? `${tagLabel} · ` : ''}
                        {formatTime(note.createdAt)}
                        {!changeable && note.status !== 'new' ? ' · read-only' : ''}
                      </span>
                    </div>
                    <span style={{ ...s.chip, ...CHIP_COLOURS[note.status] }}>
                      {reviewNoteStatusLabel(note.status)}
                    </span>
                    {changeable && (
                      <button
                        type="button"
                        className="btn-ghost-outline"
                        style={s.menuBtn}
                        aria-label="Note options"
                        aria-expanded={menuId === note.id}
                        onClick={() => setMenuId((id) => (id === note.id ? null : note.id))}
                      >
                        …
                      </button>
                    )}
                    {changeable && menuId === note.id && (
                      <div style={s.menu}>
                        <button
                          type="button"
                          className="btn-ghost-outline"
                          style={s.menuItem}
                          onClick={() => startEdit(note)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          style={s.menuItem}
                          onClick={() => remove(note.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <input
            ref={inputRef}
            type="text"
            aria-label="Note"
            placeholder="One line: what should change?"
            maxLength={REVIEW_NOTE_MAX_LENGTH}
            value={text}
            style={s.input}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter while an IME is composing picks a character; it must not save.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && !saving) save()
            }}
          />
          <div style={s.row}>
            <label style={s.tagLabel}>
              Tag
              <select
                aria-label="Tag"
                value={tag}
                style={s.select}
                onChange={(e) => setTag(e.target.value)}
              >
                <option value="">None</option>
                {REVIEW_NOTE_TAGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-ghost-outline" style={s.action} onClick={close}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary"
              style={s.action}
              disabled={saving}
              onClick={save}
            >
              Save
            </button>
          </div>
          {editingId && <p style={s.hint}>Editing your note. Save to change it.</p>}
          {error && (
            <p role="alert" style={s.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  // The trigger is 44px tall on a 5px-padded strip: the negative margin keeps the strip 44px.
  // The open box sits in the flow under the trigger, so the strip grows and pushes the task
  // down instead of covering the Run button and the editor's top-right corner.
  wrap: {
    marginLeft: 'auto',
    marginTop: -5,
    marginBottom: -5,
    paddingLeft: 12,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  trigger: {
    minHeight: 44,
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 8,
  },
  chip: {
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  box: {
    margin: '6px 0 10px',
    width: 360,
    maxWidth: 'calc(100vw - 24px)',
    boxSizing: 'border-box',
    background: '#fff',
    color: 'var(--colour-text, #1f2937)',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontWeight: 400,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 220,
    overflowY: 'auto',
  },
  note: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 8,
    background: '#f8fafc',
  },
  noteMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  noteText: { fontSize: 13, overflowWrap: 'anywhere' },
  noteMeta: { fontSize: 11, color: '#64748b' },
  menuBtn: { minWidth: 44, minHeight: 44, padding: 0, fontSize: 18, borderRadius: 8 },
  menu: {
    position: 'absolute',
    right: 8,
    top: 'calc(100% - 4px)',
    zIndex: 1,
    display: 'flex',
    gap: 6,
    padding: 6,
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.15)',
  },
  menuItem: { minHeight: 44, padding: '0 14px', fontSize: 13, borderRadius: 8 },
  input: {
    minHeight: 44,
    padding: '0 10px',
    fontSize: 14,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    width: '100%',
    boxSizing: 'border-box',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  tagLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 },
  select: { minHeight: 44, padding: '0 8px', fontSize: 13, borderRadius: 8 },
  action: { minHeight: 44, padding: '0 16px', fontSize: 14, borderRadius: 8 },
  hint: { margin: 0, fontSize: 12, color: '#475569' },
  error: { margin: 0, fontSize: 12, color: '#b91c1c' },
}
