import React, { useEffect, useRef, useState } from 'react'
import { needsYouEntries, needsYouState, nextErrorRuns, waitWords } from '../needsYou.js'

const KIND = {
  help: {
    icon: '✋',
    word: 'Help',
    colour: 'var(--colour-warning-text)',
    bg: 'var(--colour-warning-bg)',
  },
  error: {
    icon: '⚠',
    word: 'Error loop',
    colour: 'var(--colour-error-text)',
    bg: 'var(--colour-error-bg)',
  },
  stuck: {
    icon: '⏳',
    word: 'Stuck',
    colour: 'var(--colour-info-text)',
    bg: 'var(--colour-info-bg)',
  },
}
const MAX_ROWS = 6

/**
 * "Needs you" above the student grid (Hub #224; src/app/needsYou.js): the students who asked for
 * help, are in an error loop or are stuck, longest wait first, each with why and for how long,
 * then one line naming who has finished (ready for a stretch). A row opens that student; "I'm on
 * it" hides it until the student's state changes. Everyone else stays quiet in the grid.
 * Renders nothing when no one needs the tutor. Tutor screen only; writes nothing.
 */
export default function NeedsYouStrip({ students, taskId, hasCheck, names, onOpen }) {
  const errorRunsRef = useRef({})
  const seenAtRef = useRef({})
  const [snoozed, setSnoozed] = useState(() => new Set())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Advance the tutor-side counters from this render's data. Both are idempotent for the same
  // data, so a repeated render changes nothing.
  const errorRuns = {}
  const live = new Set()
  for (const student of students ?? []) {
    const id = student?.anonymousId
    if (!id) continue
    errorRuns[id] = nextErrorRuns(errorRunsRef.current[id], student)
    const state = needsYouState(student, { taskId, hasCheck, errorRuns: errorRuns[id] })
    if (state) {
      const key = `${id}:${state.kind}`
      live.add(key)
      if (seenAtRef.current[key] == null) seenAtRef.current[key] = Date.now()
    }
  }
  errorRunsRef.current = errorRuns
  for (const key of Object.keys(seenAtRef.current)) {
    if (!live.has(key)) delete seenAtRef.current[key]
  }

  const entries = needsYouEntries(students, {
    taskId,
    hasCheck,
    errorRuns,
    seenAt: seenAtRef.current,
    snoozed,
  })
  const urgent = entries.filter((entry) => entry.kind !== 'finished')
  const finished = entries.filter((entry) => entry.kind === 'finished')
  if (urgent.length === 0 && finished.length === 0) return null

  const byId = Object.fromEntries((students ?? []).map((st) => [st.anonymousId, st]))
  const shown = urgent.slice(0, MAX_ROWS)
  const more = urgent.length - shown.length
  const open = (studentId) => byId[studentId] && onOpen?.(byId[studentId])

  return (
    <div style={s.wrap} data-testid="needs-you" role="region" aria-label="Students who need you">
      {urgent.length > 0 && <div style={s.title}>Needs you ({urgent.length})</div>}
      {shown.map((entry) => {
        const kind = KIND[entry.kind]
        const name = names?.[entry.studentId] ?? 'A student'
        return (
          <div
            key={`${entry.studentId}:${entry.kind}`}
            style={{ ...s.row, background: kind.bg }}
            data-testid={`needs-you-${entry.kind}-${entry.studentId}`}
          >
            <button
              type="button"
              style={s.open}
              onClick={() => open(entry.studentId)}
              title={`Open ${name}`}
            >
              <span style={{ ...s.kind, color: kind.colour }}>
                <span aria-hidden="true">{kind.icon}</span> {kind.word}
              </span>
              <span style={s.name}>{name}</span>
              <span style={s.reason}>{entry.reason}</span>
              <span style={s.wait}>{waitWords(entry.since, now)}</span>
            </button>
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.snooze}
              onClick={() =>
                setSnoozed((prev) =>
                  new Set(prev).add(`${entry.studentId}:${entry.kind}:${entry.since}`)
                )
              }
              title="Hide this until something changes for this student"
            >
              I&apos;m on it
            </button>
          </div>
        )
      })}
      {more > 0 && <div style={s.more}>+{more} more in the grid</div>}
      {finished.length > 0 && (
        <div style={s.finished} data-testid="needs-you-finished">
          <span style={s.finishedLabel}>
            <span aria-hidden="true">✓</span> Finished, ready for a stretch ({finished.length}):
          </span>{' '}
          {finished.map((entry, i) => (
            <React.Fragment key={entry.studentId}>
              {i > 0 && ', '}
              <button type="button" style={s.nameLink} onClick={() => open(entry.studentId)}>
                {names?.[entry.studentId] ?? 'A student'}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 8px 8px' },
  title: { fontSize: 12, fontWeight: 700, color: 'var(--colour-ink-strong)' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    padding: '2px 4px 2px 0',
  },
  open: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: '2px 8px',
    padding: '6px 8px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: 12,
    cursor: 'pointer',
    minHeight: 36,
  },
  kind: { fontWeight: 800, whiteSpace: 'nowrap' },
  name: { fontWeight: 700, color: 'var(--colour-ink-strong)' },
  reason: { color: 'var(--colour-ink-strong)', minWidth: 0, overflowWrap: 'anywhere' },
  wait: { color: 'var(--colour-muted)', whiteSpace: 'nowrap', marginLeft: 'auto' },
  snooze: { flex: 'none', fontSize: 12, padding: '4px 8px', minHeight: 32 },
  more: { fontSize: 12, color: 'var(--colour-muted)', paddingLeft: 8 },
  finished: { fontSize: 12, color: 'var(--colour-success-text)', padding: '4px 8px' },
  finishedLabel: { fontWeight: 700 },
  nameLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    fontWeight: 600,
    color: 'var(--colour-success-text)',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
}
