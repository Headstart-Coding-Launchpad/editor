import React from 'react'
import { staggerStyle } from '../../../shared/motion'

// The answers the teacher picked to show on the presentation window, for an open short-answer
// task authored with `showResponses: teacher_picks` (src/shared/shownResponses.js). Each answer
// is anonymous unless its `name` is set. Presentation only: students never see this.
export default function ShownResponsesWall({ responses }) {
  if (!responses.length) {
    return (
      <p style={emptyStyle} role="status">
        Your teacher will pick some answers to show here.
      </p>
    )
  }
  return (
    <ul style={listStyle} aria-label="Answers from the class" aria-live="polite">
      {responses.map((response, index) => (
        <li
          key={response.responseId}
          className="motion-rise-in motion-stagger motion-now"
          style={{ ...itemStyle, ...staggerStyle(index) }}
        >
          <span style={textStyle}>{response.text}</span>
          {response.name && <span style={nameStyle}>— {response.name}</span>}
        </li>
      ))}
    </ul>
  )
}

const listStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
  gap: 12,
}

const itemStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '14px 18px',
  borderRadius: 12,
  background: 'var(--ui-surface-tint)',
  border: '1px solid var(--ui-border-strong)',
  fontFamily: 'var(--font-body)',
}

const textStyle = {
  fontSize: '1.35rem',
  lineHeight: 1.4,
  color: 'var(--colour-text)',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
}

const nameStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--colour-primary-dark)',
}

const emptyStyle = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: '1.1rem',
  color: 'var(--colour-muted)',
}
