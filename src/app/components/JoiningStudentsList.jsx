import React, { useState } from 'react'
import { NAME_MAX_LENGTH, normaliseJoinName } from '../joiningStudents'

/**
 * Teacher grid list of students still on the name-entry screen: "Jamie (typing…)" or
 * "Someone (typing…)", each with a Pull in button that opens a small inline editor
 * prefilled with the typed name. Confirming calls onAdmit(tempId, name); the student's
 * own device then joins with that name exactly like a normal submit.
 *
 * Names show live as they are typed, which on a projected teacher screen can show a
 * half-typed or silly name to the room, so "Hide names" masks them (per teacher view,
 * not persisted).
 */
export default function JoiningStudentsList({ joiningStudents = [], onAdmit }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [hideNames, setHideNames] = useState(false)
  const [busyId, setBusyId] = useState(null)

  if (joiningStudents.length === 0) return null

  function startPullIn(student) {
    setEditingId(student.tempId)
    setDraft(student.typedName ?? '')
  }

  function cancel() {
    setEditingId(null)
    setDraft('')
  }

  async function confirm(e, tempId) {
    e.preventDefault()
    const name = normaliseJoinName(draft)
    if (!name || !onAdmit) return
    setBusyId(tempId)
    try {
      await onAdmit(tempId, name)
      cancel()
    } catch (err) {
      console.warn('Failed to pull student in:', err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section style={s.wrap} aria-label="Students joining">
      <div style={s.titleRow}>
        <span style={s.title}>Joining ({joiningStudents.length})</span>
        <button
          type="button"
          style={s.linkBtn}
          aria-pressed={hideNames}
          onClick={() => setHideNames((v) => !v)}
          title="Hide the names students are typing (e.g. while the screen is projected)"
        >
          {hideNames ? 'Show names' : 'Hide names'}
        </button>
      </div>
      <ul style={s.list}>
        {joiningStudents.map((student) => {
          const label = !hideNames && student.typedName ? student.typedName : 'Someone'
          const editing = editingId === student.tempId
          return (
            <li key={student.tempId} style={s.row}>
              {editing ? (
                <form style={s.form} onSubmit={(e) => confirm(e, student.tempId)}>
                  <input
                    style={s.input}
                    autoFocus
                    aria-label="Name to join with"
                    value={draft}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancel()
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={s.smallBtn}
                    disabled={!normaliseJoinName(draft) || busyId === student.tempId}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    style={s.smallBtn}
                    onClick={cancel}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span style={s.name}>
                    {label} <span style={s.typing}>(typing…)</span>
                  </span>
                  {onAdmit && (
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      style={s.smallBtn}
                      onClick={() => startPullIn(student)}
                      aria-label={`Pull in ${label}`}
                      title="Join this student to the session with a name you choose"
                    >
                      Pull in
                    </button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const s = {
  wrap: {
    flexShrink: 0,
    maxHeight: 180,
    overflowY: 'auto',
    padding: '6px 10px',
    background: '#fffbeb',
    borderBottom: '1px solid #fde68a',
    fontFamily: 'var(--font-body)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: { fontSize: '0.78rem', fontWeight: 700, color: '#92400e' },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: '#92400e',
    fontSize: '0.74rem',
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 28,
  },
  name: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  typing: { fontWeight: 400, color: '#92400e' },
  form: { display: 'flex', alignItems: 'center', gap: 6, width: '100%' },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
  },
  smallBtn: { fontSize: 12, padding: '3px 10px', flexShrink: 0 },
}
