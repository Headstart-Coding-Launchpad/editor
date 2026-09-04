import React, { useState } from 'react'
import Banner from '../../shared/Banner.jsx'

function applySuffix(name, existing) {
  if (!existing.includes(name)) return name
  let n = 2
  while (existing.includes(`${name}-${n}`)) n++
  return `${name}-${n}`
}

export default function NameEntry({
  lessonTitle,
  existingNames = [],
  onSubmit,
  onGoSolo,
  waitingForSession = false,
  joinError = null,
}) {
  const [value, setValue] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(name) {
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
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.header}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
          <h1 style={s.title}>{lessonTitle}</h1>
        </div>
        <div style={s.body}>
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
                <button
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => submit(confirmed)}
                >
                  {submitting ? 'Joining…' : `Join as ${confirmed}`}
                </button>
                <button
                  className="btn-ghost"
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
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {waitingForSession && (
                <p style={s.waitNote}>
                  Enter your name and we&apos;ll put you in the waiting room until your teacher
                  starts.
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
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={30}
                  autoComplete="new-password"
                />
              </label>
              <button className="btn-primary" type="submit" disabled={!value.trim() || submitting}>
                {submitting ? 'Joining…' : waitingForSession ? 'Join Waiting Room' : 'Join'}
              </button>
              {onGoSolo && (
                <button type="button" onClick={onGoSolo} style={s.soloLink} disabled={submitting}>
                  Work Solo instead
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'linear-gradient(135deg, #d3c0f9 0%, #b89df5 100%)',
  },
  card: {
    width: 400,
    overflow: 'hidden',
    borderRadius: 18,
    boxShadow: '0 8px 30px rgba(98, 34, 204, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06)',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '24px 28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--colour-secondary)',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.6rem',
    color: '#fff',
  },
  body: {
    padding: '24px 28px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
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
  soloLink: {
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#9ca3af',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
    textAlign: 'center',
  },
}
