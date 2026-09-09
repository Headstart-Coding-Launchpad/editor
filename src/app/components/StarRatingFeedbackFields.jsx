import React from 'react'

// Shared star-rating + "what worked / what didn't" fields, used by both the
// end-of-session lesson rating (TeacherReportModal) and the live per-task
// rating (TaskRatingPanel) so the two don't duplicate this UI.

export const STAR_VALUES = [1, 2, 3, 4, 5]

export function StarRatingInput({ value, onChange, ariaLabel = 'Rating' }) {
  return (
    <div style={styles.starsRow} role="radiogroup" aria-label={ariaLabel}>
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          style={styles.starBtn}
          onClick={() => onChange(value === star ? 0 : star)}
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

export function StarRatingDisplay({ value, size }) {
  if (value == null) return null
  return (
    <span
      style={size === 'small' ? styles.starsDisplaySmall : styles.starsDisplay}
      aria-label={`Rated ${value} out of 5 stars`}
    >
      {STAR_VALUES.map((star) => (
        <span key={star}>{star <= value ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

export function FeedbackFields({
  ratingLabel,
  rating,
  onRatingChange,
  whatWorkedWell,
  onWhatWorkedWellChange,
  whatDidntWork,
  onWhatDidntWorkChange,
}) {
  return (
    <>
      <div style={styles.field}>
        <span style={styles.label}>{ratingLabel}</span>
        <StarRatingInput value={rating} onChange={onRatingChange} ariaLabel={ratingLabel} />
      </div>
      <label style={styles.field}>
        <span style={styles.label}>What worked well?</span>
        <textarea
          style={styles.textarea}
          rows={2}
          value={whatWorkedWell}
          onChange={(e) => onWhatWorkedWellChange(e.target.value)}
        />
      </label>
      <label style={styles.field}>
        <span style={styles.label}>What didn't work, or was broken?</span>
        <textarea
          style={styles.textarea}
          rows={2}
          value={whatDidntWork}
          onChange={(e) => onWhatDidntWorkChange(e.target.value)}
        />
      </label>
    </>
  )
}

const styles = {
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  starsRow: { display: 'flex', gap: 4 },
  starBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem',
    lineHeight: 1,
    color: '#f59e0b',
    padding: 0,
  },
  starsDisplay: { fontSize: '1.1rem', color: '#f59e0b', letterSpacing: 2 },
  starsDisplaySmall: { fontSize: '0.85rem', color: '#f59e0b', letterSpacing: 1 },
  textarea: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 10px',
    resize: 'vertical',
    minHeight: 44,
  },
}
