import React from 'react'
import { AskForHelpButton } from './CheckFeedbackBanner'
import { useHelpRequest } from './peerHelp/helpRequestContext'

/**
 * The calm code screen's hint (Python; LessonTaskContent): always in view, docked under the task
 * card (or under the editor on a narrow layout), never a popup. Before a check result it is a
 * gentle nudge; once there is one it shows the docked CheckFeedbackBanner (`banner`): amber with
 * the specific hint after a failed Run, green after a pass, blue for the tutor's sent hint. It is
 * never dismissed on its own: a failed check's hint turns gentle (blue, tone 'nudge', the hint
 * still readable) once the code changes or a new Run starts; the tutor's hint stays until the next
 * check or the student's "Got it". Its height is capped by `style` and it scrolls inside.
 * '✋ Ask for help' shows on the nudge and a failed check, only with a tutor to ask, never on the
 * tutor's own hint.
 *
 * `tone`: 'nudge' | 'fail' | 'pass' | 'tutor', for its colour and data-tone.
 */
export default function TaskHintBox({ banner = null, tone = 'nudge', nudge, style }) {
  const help = useHelpRequest()
  return (
    <div data-testid="task-hint" data-tone={tone} style={{ ...s.dock, ...style }}>
      {banner ?? (
        <div style={s.nudge}>
          <div style={s.row}>
            <span aria-hidden="true" style={s.icon}>
              💡
            </span>
            <span>{nudge}</span>
          </div>
          {help && <AskForHelpButton help={help} style={s.action} />}
        </div>
      )}
    </div>
  )
}

const s = {
  dock: {
    flexShrink: 0,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  nudge: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #93c5fd',
    background: '#eff6ff',
    color: '#1e3a8a',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 1.35,
  },
  row: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 20, lineHeight: 1.1, flexShrink: 0 },
  action: {
    alignSelf: 'flex-start',
    minHeight: 44,
    padding: '6px 12px',
    border: '1px solid #93c5fd',
    borderRadius: 8,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 14,
    color: '#1e3a8a',
    cursor: 'pointer',
  },
}
