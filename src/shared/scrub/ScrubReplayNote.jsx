import React from 'react'
import { scrubReplayNoteText } from './replay.js'

/**
 * "Using your last answers: Ada, Mars, teal" — shown near the result while a live scrub preview
 * of a program with input() replays the answers from the student's last Run (P6-21;
 * useScrubPreview's scrubReplayAnswers). Nothing when no preview is replaying.
 */
export default function ScrubReplayNote({ answers, style }) {
  const text = scrubReplayNoteText(answers)
  if (!text) return null
  return (
    <p role="status" data-testid="scrub-replay-note" style={{ ...s.note, ...style }}>
      <span aria-hidden="true" style={s.icon}>
        ↻
      </span>
      {text}
    </p>
  )
}

const s = {
  note: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: 0,
    padding: '4px 10px',
    flexShrink: 0,
    borderRadius: 8,
    background: '#f5f3ff',
    border: '1px solid #d8c4f5',
    color: '#4c1d95',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  icon: { flexShrink: 0 },
}
