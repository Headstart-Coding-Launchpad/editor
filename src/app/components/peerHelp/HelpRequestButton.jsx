import React from 'react'

/**
 * The student's ✋ Help: one tap tells the teacher (PeerHelpAskBubble may then follow). Once
 * asked it stays bright ("✋ Help requested") rather than greying out, so it reads as "on", not
 * "broken": it is aria-disabled, not disabled, and a second tap does nothing.
 */
export default function HelpRequestButton({ requested, onAskTeacher, style }) {
  return (
    <button
      type="button"
      className={requested ? 'btn-danger' : 'btn-ghost'}
      style={requested ? { ...style, cursor: 'default' } : style}
      onClick={requested ? undefined : onAskTeacher}
      aria-disabled={requested ? 'true' : undefined}
      title={requested ? 'Your tutor knows you need help' : 'Ask your tutor for help'}
      aria-label={requested ? 'Help requested' : 'Need Help'}
    >
      {requested ? '✋ Help requested' : '✋ Help'}
    </button>
  )
}
