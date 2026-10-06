import React from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import { describeHintOffer, readHintOffer, readStudentHint } from '../../studentHints.js'

/**
 * The hint on this student's check-feedback banner, mirrored read-only for the teacher above
 * the StudentModal workspace: the same Markdown the student sees, how many times in a row
 * they have failed, and any "Want a hint?" reference offered but not opened. Unlike the
 * student's popup it does not auto-dismiss; it stays until they pass or the task changes
 * (src/app/studentHints.js).
 */
export default function StudentHintPanel({ student, session, isSessionSandbox = false }) {
  if (isSessionSandbox) return null
  const hint = readStudentHint(student, session?.currentTaskId)
  const offer = readHintOffer(student, session?.currentTaskId)
  if (!hint && !offer) return null
  const name = student?.displayName || 'This student'
  const isOverride = hint?.source === 'override'
  return (
    <div style={s.panel} role="status" data-testid="student-hint-panel">
      <span style={s.icon} aria-hidden="true">
        💬
      </span>
      <div style={s.body}>
        {hint && (
          <>
            <div style={s.heading}>
              {isOverride ? `Your hint to ${name}` : `${name} sees`}
              {isOverride && <span style={s.tag}>your hint</span>}
            </div>
            <MarkdownRenderer content={hint.text} style={s.markdown} />
          </>
        )}
        {(hint?.failStreak > 1 || offer) && (
          <div style={s.meta}>
            {hint?.failStreak > 1 && <span>Failed {hint.failStreak} times in a row</span>}
            {offer && <span>{describeHintOffer(offer)}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  panel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    flexShrink: 0,
    maxHeight: '22vh',
    overflowY: 'auto',
    margin: '8px 12px',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
  },
  icon: {
    flexShrink: 0,
    lineHeight: 1.4,
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 700,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    opacity: 0.85,
  },
  tag: {
    padding: '0 6px',
    borderRadius: 999,
    border: '1px solid #ef4444',
    color: '#dc2626',
    fontSize: '0.72rem',
    textTransform: 'none',
    letterSpacing: 0,
  },
  markdown: {
    color: 'inherit',
    fontSize: 'inherit',
    fontWeight: 600,
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: '0.8rem',
    fontWeight: 600,
    opacity: 0.85,
  },
}
