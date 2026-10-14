import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useClassRoster } from '../app/hooks/useClassRoster'
import { ROSTER_NAME_MAX } from '../shared/roster/rosterModel'
import {
  addRosterEntry,
  deleteRosterEntry,
  listTyping,
  renameRosterEntry,
} from '../shared/roster/rosterService'
import { TYPING_HISTORY_LOAD_MAX } from '../shared/typingHistory'
import { TypingHistoryTable } from '../app/components/student-modal/TypingHistoryPanel'

// One student's saved typing scores (classes/{classId}/roster/{rosterId}/typing, newest first),
// for progress conversations with parents. Loaded when opened.
function RosterTypingHistory({ classId, entry }) {
  const [state, setState] = useState({ loading: true, entries: [], error: null })
  useEffect(() => {
    let cancelled = false
    listTyping(classId, entry.id, { max: TYPING_HISTORY_LOAD_MAX })
      .then((entries) => {
        if (!cancelled) setState({ loading: false, entries, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, entries: [], error })
      })
    return () => {
      cancelled = true
    }
  }, [classId, entry.id])
  let body
  if (state.loading) body = <p style={s.muted}>Loading typing scores…</p>
  else if (state.error) {
    body = <p style={s.error}>Couldn&rsquo;t load typing scores: {state.error.message}</p>
  } else if (state.entries.length === 0) {
    body = (
      <p style={s.muted}>
        No typing scores yet. They are saved from Keyboard typing tasks once the tutor matches{' '}
        {entry.displayName} in a session.
      </p>
    )
  } else body = <TypingHistoryTable entries={state.entries} />
  return (
    <div style={s.typing} data-testid={`roster-typing-${entry.id}`}>
      {body}
    </div>
  )
}

// Admin → Classes: one class's roster (first name and initial, e.g. "Jamie B."). Tutors match
// joined students to these names in a session; each matched student's work and typing scores are
// saved under their entry. Deleting an entry deletes everything saved for it.
export default function ClassRosterEditor({ cls }) {
  const { user } = useAuth()
  const { roster, loading, error } = useClassRoster(cls.id)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [typingId, setTypingId] = useState(null)

  async function run(action, success) {
    setStatus(null)
    setBusy(true)
    try {
      await action()
      if (success) setStatus({ type: 'success', message: success })
    } catch (err) {
      setStatus({ type: 'error', message: err?.message ?? String(err) })
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    run(async () => {
      const entry = await addRosterEntry(cls.id, newName, user?.uid ?? null)
      setNewName('')
      return entry
    }, null)
  }

  function handleRename(e, entry) {
    e.preventDefault()
    run(async () => {
      await renameRosterEntry(cls.id, entry.id, editName)
      setEditingId(null)
    }, null)
  }

  function handleDelete(entry) {
    if (
      !window.confirm(
        `Delete "${entry.displayName}" from ${cls.name}? This also deletes their saved work and typing scores. It can't be undone.`
      )
    )
      return
    run(() => deleteRosterEntry(cls.id, entry.id), `Deleted ${entry.displayName}.`)
  }

  return (
    <div style={s.wrap} data-testid={`roster-editor-${cls.id}`}>
      <p style={s.note}>
        First name and initial only (e.g. &ldquo;Jamie B.&rdquo;). Tutors match students to these
        names during a session; only tutors and admins see them.
      </p>
      <form style={s.row} onSubmit={handleAdd}>
        <input
          style={s.input}
          value={newName}
          maxLength={ROSTER_NAME_MAX}
          placeholder="Jamie B."
          aria-label={`New student for ${cls.name}`}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button type="submit" className="btn-secondary" style={s.btn} disabled={busy}>
          Add student
        </button>
      </form>
      {status && (
        <p style={status.type === 'error' ? s.error : s.success} role="status">
          {status.message}
        </p>
      )}
      {error ? (
        <p style={s.error}>Couldn&rsquo;t load the class list: {error.message}</p>
      ) : loading ? (
        <p style={s.muted}>Loading students…</p>
      ) : roster.length === 0 ? (
        <p style={s.muted}>No students on this class list yet.</p>
      ) : (
        <ul style={s.list}>
          {roster.map((entry) => (
            <li key={entry.id} style={s.item}>
              {editingId === entry.id ? (
                <form style={s.row} onSubmit={(e) => handleRename(e, entry)}>
                  <input
                    style={s.input}
                    value={editName}
                    maxLength={ROSTER_NAME_MAX}
                    autoFocus
                    aria-label={`Rename ${entry.displayName}`}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-secondary" style={s.btn} disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    style={s.btn}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span style={s.name}>{entry.displayName}</span>
                  <span style={s.actions}>
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      style={s.btn}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(entry.id)
                        setEditName(entry.displayName)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      style={s.btn}
                      aria-expanded={typingId === entry.id}
                      onClick={() => setTypingId(typingId === entry.id ? null : entry.id)}
                    >
                      Typing
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      style={s.btn}
                      disabled={busy}
                      onClick={() => handleDelete(entry)}
                    >
                      Delete
                    </button>
                  </span>
                </>
              )}
              {typingId === entry.id && editingId !== entry.id && (
                <RosterTypingHistory classId={cls.id} entry={entry} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 4px' },
  note: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-muted)' },
  row: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '6px 8px', borderRadius: 6, minWidth: 160, flex: '1 1 160px' },
  btn: { padding: '5px 10px', fontSize: '0.82rem' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 0',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    flexWrap: 'wrap',
  },
  name: { fontWeight: 600 },
  typing: { flexBasis: '100%', overflowX: 'auto' },
  actions: { display: 'flex', gap: 6 },
  muted: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-muted)' },
  error: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-error-text)' },
  success: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-success-text)' },
}
