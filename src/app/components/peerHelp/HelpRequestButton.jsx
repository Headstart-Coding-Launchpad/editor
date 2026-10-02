import React from 'react'

/** The student's ✋ Help: one tap tells the teacher (PeerHelpAskBubble may then follow). */
export default function HelpRequestButton({ requested, onAskTeacher, style }) {
  return (
    <button
      type="button"
      className={requested ? 'btn-danger' : 'btn-ghost'}
      style={style}
      onClick={requested ? undefined : onAskTeacher}
      disabled={requested}
      title={requested ? 'Your teacher has been notified' : 'Ask your teacher for help'}
      aria-label={requested ? 'Help requested' : 'Need Help'}
    >
      {requested ? '✋ Help requested' : '✋ Help'}
    </button>
  )
}
