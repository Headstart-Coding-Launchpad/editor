// The tutor's Support and Complete tabs (tutor-tabs sketch, OK'd 16 Nov 2026): the stage shown
// exactly as a student sees it (SupportStagePanel: the green change view, or the reference panel),
// under a SUPPORT or COMPLETE label, with a "Student view / Raw code" switch that keeps the
// read-only editor one click away. Read-only: it shows authored stages and never writes. The change
// view is the lesson's step (stageChangeBases), so every student sees exactly this.
import { useState } from 'react'
import SupportStagePanel from '../../components/SupportStagePanel'
import { stageChangeBases } from '../../../shared/stageChange'
import { getStageLineHints } from '../../../shared/lineHints'
import { getTaskLockSets } from '../../../shared/lockedLines'

const ROLE_TEXT = {
  support: {
    badge: 'Support',
    line: 'A hint. Opens when a student asks for it, or when you reveal it.',
  },
  complete: {
    badge: 'Complete',
    line: 'The finished answer. Students see it only after they open it or you reveal it.',
  },
}

export default function TeacherStageStudentView({
  found,
  definition,
  task,
  lessonTasks,
  action = null,
  // Shown under the student view as well (the expected output); the raw view has its own.
  extra = null,
  children,
}) {
  const [mode, setMode] = useState('student')
  const { stage, index, role } = found
  const text = ROLE_TEXT[role]
  // Told by the panel itself, so a fall-back (the whole program) never claims a change view.
  const [showsChange, setShowsChange] = useState(false)
  return (
    <div style={s.wrap} data-testid="teacher-stage-student-view">
      <div style={{ ...s.bar, ...s.barRole[role] }}>
        <span style={{ ...s.badge, ...s.badgeRole[role] }}>{text.badge}</span>
        <span style={s.line}>{text.line}</span>
        <div role="group" aria-label="Show" style={s.switch}>
          {[
            ['student', 'Student view'],
            ['raw', 'Raw code'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              style={mode === value ? s.switchOn : s.switchOff}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {action}
      </div>
      {mode === 'raw' ? (
        children
      ) : (
        <div style={s.body} data-testid="teacher-stage-student-body">
          <div style={s.heading}>
            What the student sees{' '}
            <span style={s.headingNote}>
              {showsChange ? 'exactly this: the same change view, green and red' : 'exactly this'}
            </span>
          </div>
          <SupportStagePanel
            // One panel per task and stage: the change view reads its base once.
            key={`${task?.id}:${index}`}
            stage={stage}
            lessonType={definition?.type}
            revealed
            calm={!!definition?.capabilities?.calmCodeScreen}
            changeBase={stageChangeBases(task, index, lessonTasks)}
            onChangeViewShown={setShowsChange}
            lineHintsFor={(file) => getStageLineHints(task, index, file)}
            lockSets={getTaskLockSets(task)}
          />
          <p style={s.foot}>
            {showsChange
              ? "Compared with the lesson's step before it, the same for every student. "
              : ''}
            Raw code is one click away. Edit it in Edit Lesson or the sandbox.
          </p>
          {extra}
        </div>
      )}
    </div>
  )
}

const switchBtn = {
  minHeight: 30,
  padding: '0 12px',
  border: 'none',
  fontFamily: 'var(--font-body)',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', minHeight: 'auto' },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 12px',
    flexShrink: 0,
    fontFamily: 'var(--font-body)',
  },
  barRole: {
    support: { background: '#eff6ff', borderBottom: '1px solid #bfdbfe' },
    complete: { background: '#ecfdf5', borderBottom: '1px solid #bbf7d0' },
  },
  badge: {
    flexShrink: 0,
    padding: '2px 10px',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  badgeRole: {
    support: { background: '#1d4ed8' },
    complete: { background: '#166534' },
  },
  line: { flex: 1, minWidth: 0, fontSize: '0.82rem', color: '#334155' },
  switch: {
    display: 'inline-flex',
    flexShrink: 0,
    border: '1px solid #c4b5fd',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#ffffff',
  },
  switchOn: { ...switchBtn, background: 'var(--colour-primary)', color: '#ffffff' },
  switchOff: { ...switchBtn, background: '#ffffff', color: 'var(--colour-primary)' },
  body: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' },
  heading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--colour-primary)',
  },
  headingNote: { fontWeight: 500, color: '#6b7280' },
  foot: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },
}
