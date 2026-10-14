import React, { useState } from 'react'
import { ROSTER_NAME_MAX } from '../../../shared/roster/rosterModel'

// The tutor's "Match students" panel (Ryan, 2026-10-14): pick the session's class (stock lessons
// only; a class fork always uses its own class), then match each joined student to a roster entry
// by hand. No auto-match and no suggestions: the joined students keep their join order and the
// roster stays alphabetical. "New student" adds a roster entry and matches it in one go.
// Roster names are tutor-only: they never reach students, reports or the CLI.
export default function MatchStudentsDialog({
  onClose,
  classInfo, // resolveSessionClass(lesson, session)
  classes = [], // active class records, for a stock lesson's picker
  className = null, // the session class's name, when known
  roster = [],
  rosterLoading = false,
  students = [], // joined students, in grid order
  matches = {}, // { anonymousId: rosterId } (activeRosterMatches)
  onPickClass, // (classId | null) => Promise
  onMatch, // (anonymousId, rosterId) => Promise
  onUnmatch, // (anonymousId) => Promise
  onAddStudent, // (displayName) => Promise<{ id }>
  // Cross-lesson carry: students held on the current task until their earlier-lesson work is
  // found, and the "Use the starter" override ((anonymousIds) => Promise).
  carryWaitingIds = [],
  onUseCarryStarter = null,
}) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [newFor, setNewFor] = useState(null) // anonymousId whose "New student" box is open
  const [newName, setNewName] = useState('')
  const isFork = classInfo?.source === 'fork'
  const classId = classInfo?.classId ?? null
  const matchedBy = new Map(Object.entries(matches).map(([anon, rosterId]) => [rosterId, anon]))
  const namesById = new Map(students.map((st) => [st.anonymousId, st.displayName]))
  const unmatchedRoster = roster.filter((entry) => !matchedBy.has(entry.id))
  const waiting = new Set(carryWaitingIds)
  // Held students no match will release: unmatched ones (a match fills their inbox) and, with
  // no class chosen yet, everyone held.
  const blockedIds = students
    .map((student) => student.anonymousId)
    .filter((id) => waiting.has(id) && !matches[id])

  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  function handlePickClass(value) {
    const next = value === '__none__' ? null : value
    if (!value) return
    const hasMatches = Object.keys(matches).length > 0
    if (hasMatches && !window.confirm('Changing class clears the matches made so far. Continue?')) {
      return
    }
    run(() => onPickClass(next))
  }

  function handleSelect(anonymousId, rosterId) {
    if (!rosterId) run(() => onUnmatch(anonymousId))
    else run(() => onMatch(anonymousId, rosterId))
  }

  function handleAdd(event, anonymousId) {
    event.preventDefault()
    run(async () => {
      const entry = await onAddStudent(newName)
      await onMatch(anonymousId, entry.id)
      setNewFor(null)
      setNewName('')
    })
  }

  const pickerValue =
    classInfo?.source === 'session' ? classId : classInfo?.source === 'none' ? '__none__' : ''

  return (
    <div
      className="ui-modal-backdrop"
      style={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Match students"
      onClick={onClose}
    >
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Match students</h2>
          <button type="button" style={s.close} aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={s.body}>
          <div style={s.classRow}>
            <span style={s.label}>Class</span>
            {isFork ? (
              <strong>{className ?? classId}</strong>
            ) : (
              <select
                style={s.select}
                value={pickerValue}
                disabled={busy}
                onChange={(e) => handlePickClass(e.target.value)}
                aria-label="Class for this session"
              >
                <option value="" disabled>
                  Choose a class…
                </option>
                <option value="__none__">No class (nothing is saved)</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p style={s.hint}>
            {classId
              ? 'Match each student to their name on the class list. Their work is saved to that name each time they run or submit, so later lessons can pick it up. Only you see these names.'
              : isFork
                ? null
                : 'Pick the class you are teaching to save students’ work to the class list.'}
          </p>

          {error && (
            <p style={s.error} role="alert">
              {error}
            </p>
          )}

          {blockedIds.length > 0 && (
            <div style={s.carryBox} data-testid="carry-blocked">
              <p style={s.carryText}>
                ⏳ {blockedIds.length} {blockedIds.length === 1 ? 'student is' : 'students are'}{' '}
                waiting for their work from an earlier lesson.{' '}
                {classId
                  ? 'Match them to find it, or start them from the starter.'
                  : 'Pick the class to find it, or start them from the starter.'}
              </p>
              {onUseCarryStarter && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => run(() => onUseCarryStarter(blockedIds))}
                >
                  Use the starter for all unmatched
                </button>
              )}
            </div>
          )}

          {classId && (
            <>
              {rosterLoading ? (
                <p style={s.muted}>Loading the class list…</p>
              ) : students.length === 0 ? (
                <p style={s.muted}>No students have joined yet.</p>
              ) : (
                <ul style={s.list}>
                  {students.map((student) => {
                    const rosterId = matches[student.anonymousId] ?? ''
                    const blocked = blockedIds.includes(student.anonymousId)
                    return (
                      <li
                        key={student.anonymousId}
                        style={blocked ? { ...s.row, ...s.blockedRow } : s.row}
                        data-carry-blocked={blocked ? 'true' : undefined}
                      >
                        <span style={s.joined} title="The name they typed">
                          {blocked && (
                            <span title="Waiting for their earlier lesson work" aria-hidden="true">
                              ⏳{' '}
                            </span>
                          )}
                          {student.displayName}
                        </span>
                        <span aria-hidden="true" style={s.arrow}>
                          →
                        </span>
                        {newFor === student.anonymousId ? (
                          <form
                            style={s.newForm}
                            onSubmit={(e) => handleAdd(e, student.anonymousId)}
                          >
                            <input
                              style={s.input}
                              value={newName}
                              autoFocus
                              maxLength={ROSTER_NAME_MAX}
                              placeholder="First name and initial"
                              aria-label="New student's name"
                              onChange={(e) => setNewName(e.target.value)}
                            />
                            <button type="submit" className="btn-secondary" disabled={busy}>
                              Add
                            </button>
                            <button
                              type="button"
                              className="btn-ghost-outline"
                              onClick={() => setNewFor(null)}
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <select
                              style={s.select}
                              value={rosterId}
                              disabled={busy}
                              aria-label={`Class list name for ${student.displayName}`}
                              onChange={(e) => handleSelect(student.anonymousId, e.target.value)}
                            >
                              <option value="">— Not matched —</option>
                              {roster.map((entry) => {
                                const other = matchedBy.get(entry.id)
                                const takenByOther = other && other !== student.anonymousId
                                return (
                                  <option key={entry.id} value={entry.id} disabled={takenByOther}>
                                    {entry.displayName}
                                    {takenByOther
                                      ? ` (matched to ${namesById.get(other) ?? 'someone who left'})`
                                      : ''}
                                  </option>
                                )
                              })}
                            </select>
                            <button
                              type="button"
                              className="btn-ghost-outline"
                              style={s.newBtn}
                              disabled={busy}
                              onClick={() => {
                                setNewFor(student.anonymousId)
                                setNewName('')
                              }}
                            >
                              New student
                            </button>
                            {blocked && onUseCarryStarter && (
                              <button
                                type="button"
                                className="btn-ghost-outline"
                                style={s.newBtn}
                                disabled={busy}
                                onClick={() => run(() => onUseCarryStarter([student.anonymousId]))}
                              >
                                Use the starter
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {!rosterLoading && unmatchedRoster.length > 0 && (
                <p style={s.muted}>
                  Not matched yet: {unmatchedRoster.map((entry) => entry.displayName).join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--colour-surface, #fff)',
    color: 'var(--colour-text)',
    width: 'min(560px, 100%)',
    maxHeight: '86vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
  },
  title: { margin: 0, fontSize: 18 },
  close: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    fontSize: 18,
    cursor: 'pointer',
  },
  body: { padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  classRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontWeight: 600 },
  hint: { margin: 0, fontSize: 13, color: 'var(--colour-muted)' },
  muted: { margin: 0, fontSize: 13, color: 'var(--colour-muted)' },
  error: { margin: 0, fontSize: 13, color: 'var(--colour-error-text)' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  joined: {
    minWidth: 110,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  arrow: { color: 'var(--colour-muted)' },
  blockedRow: {
    background: 'var(--colour-warning-bg, #fef3c7)',
    borderRadius: 6,
    padding: '4px 6px',
  },
  carryBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    background: 'var(--colour-warning-bg, #fef3c7)',
    color: 'var(--colour-warning-text, #92400e)',
    borderRadius: 8,
    padding: '8px 10px',
  },
  carryText: { margin: 0, fontSize: 13, flex: '1 1 240px' },
  select: { padding: '6px 8px', borderRadius: 6, minWidth: 180, maxWidth: '100%' },
  newBtn: { padding: '6px 10px', fontSize: 13 },
  newForm: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '6px 8px', borderRadius: 6, minWidth: 160 },
}
