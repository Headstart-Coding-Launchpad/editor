import React, { useEffect, useRef, useState } from 'react'
import Banner from '../../shared/Banner.jsx'
import EntryScreenCard, { ghostLink } from './EntryScreenCard'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import {
  applyNameSuffix as applySuffix,
  NAME_MAX_LENGTH,
  normaliseJoinName,
  TYPED_NAME_THROTTLE_MS,
} from '../joiningStudents'

export default function NameEntry({
  lessonTitle,
  existingNames = [],
  onSubmit,
  onNameTyping,
  onGoSolo,
  waitingForSession = false,
  joinError = null,
}) {
  const [value, setValue] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Shares the (trimmed) name being typed so the teacher can see who is joining:
  // at most one write per TYPED_NAME_THROTTLE_MS, and the last value always lands.
  const onNameTypingRef = useRef(onNameTyping)
  onNameTypingRef.current = onNameTyping
  const lastSharedRef = useRef('')
  const typingWriterRef = useRef(null)
  if (!typingWriterRef.current) {
    typingWriterRef.current = createThrottledMirrorWriter({
      intervalMs: TYPED_NAME_THROTTLE_MS,
      write: (name) => onNameTypingRef.current?.(name),
    })
  }
  useEffect(() => () => typingWriterRef.current?.cancel(), [])

  function handleChange(e) {
    setValue(e.target.value)
    const shared = normaliseJoinName(e.target.value)
    if (shared === lastSharedRef.current) return
    lastSharedRef.current = shared
    typingWriterRef.current.push(shared)
  }

  async function submit(name) {
    typingWriterRef.current?.cancel()
    setSubmitting(true)
    try {
      await onSubmit(name)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    const trimmed = value.trim()
    if (!trimmed) return
    const final = applySuffix(trimmed, existingNames)
    if (final !== trimmed && !confirmed) {
      setConfirmed(final)
      return
    }
    submit(confirmed ?? final)
  }

  return (
    <EntryScreenCard title={lessonTitle} titleStyle={s.title} bodyStyle={s.body}>
      {joinError && (
        <Banner accent="#dc2626" color="#991b1b" style={{ borderRadius: 8 }}>
          {joinError}
        </Banner>
      )}
      {confirmed ? (
        <>
          <p style={s.note}>
            The name <strong>{value.trim()}</strong> is already taken. You&apos;ll join as{' '}
            <strong>{confirmed}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" disabled={submitting} onClick={() => submit(confirmed)}>
              {submitting ? 'Joining…' : `Join as ${confirmed}`}
            </button>
            <button
              className="btn-ghost-outline"
              style={{
                color: 'var(--colour-primary)',
                border: '1px solid var(--colour-primary)',
              }}
              disabled={submitting}
              onClick={() => setConfirmed(null)}
            >
              Choose a different name
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {waitingForSession && (
            <p style={s.waitNote}>
              Enter your name and we&apos;ll put you in the waiting room until your teacher starts.
            </p>
          )}
          <label style={s.label}>
            What&apos;s your name?
            <input
              style={s.input}
              autoFocus
              type="text"
              placeholder="e.g. Jamie"
              value={value}
              onChange={handleChange}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="new-password"
            />
          </label>
          <button className="btn-primary" type="submit" disabled={!value.trim() || submitting}>
            {submitting ? 'Joining…' : waitingForSession ? 'Join Waiting Room' : 'Join'}
          </button>
          {onGoSolo && (
            <button
              type="button"
              onClick={onGoSolo}
              style={{ ...ghostLink, textAlign: 'center' }}
              disabled={submitting}
            >
              Work Solo instead
            </button>
          )}
        </form>
      )}
    </EntryScreenCard>
  )
}

const s = {
  // NameEntry's title is a size up from the shared default, and its body keeps the
  // default left-aligned layout with slightly tighter padding.
  title: { fontSize: '1.6rem' },
  body: { padding: '24px 28px' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1.05rem',
    color: 'var(--colour-text)',
  },
  input: {
    padding: '12px 14px',
    border: '2px solid #e5e7eb',
    borderRadius: 12,
    fontFamily: 'var(--font-body)',
    fontSize: '1.05rem',
    outline: 'none',
  },
  note: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  waitNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#6b7280',
    lineHeight: 1.5,
    margin: 0,
    textAlign: 'center',
  },
}
