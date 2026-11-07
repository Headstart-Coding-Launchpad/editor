import React from 'react'
import { AskForHelpButton } from './CheckFeedbackBanner'

/**
 * The calm Scratch screen's hint (LessonTaskContent): always in view, docked under the explainer
 * card, never a popup. Before a check result it is a gentle nudge; once there is one it shows the
 * docked CheckFeedbackBanner (`banner`): amber with the specific hint after a failed run, green
 * after a pass, blue for the tutor's sent hint. Its height is capped by `style`; it scrolls inside.
 *
 * `tone`: 'nudge' | 'fail' | 'pass' | 'tutor', for its colour and data-tone.
 * `help`: { onAsk, requested } only where the top-bar Help shows (a tutor is there), else null.
 */
export default function ScratchHintDock({ banner = null, tone = 'nudge', nudge, help, style }) {
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
  action: { border: '1px solid #93c5fd', color: '#1e3a8a' },
}
