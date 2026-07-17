import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { updatePassword } from 'firebase/auth'
import { useAuth } from './useAuth'

export default function AccountSettings() {
  const { user, role } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await updatePassword(user, password)
      setPassword('')
      setConfirmPassword('')
      setStatus('Password updated.')
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please sign out, sign back in, and try changing your password again.')
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.page}>
      <main style={s.card}>
        <div style={s.header}>
          <span style={s.brand}>Headstart Coding - Account</span>
          <Link style={s.backLink} to={role === 'admin' ? '/admin/accounts' : '/login'}>Back</Link>
        </div>
        <form style={s.body} onSubmit={handleSubmit}>
          <div>
            <h1 style={s.title}>Change Password</h1>
            <p style={s.email}>{user?.email}</p>
          </div>
          <label style={s.field}>
            <span style={s.label}>New password</span>
            <input
              style={s.input}
              type="password"
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label style={s.field}>
            <span style={s.label}>Confirm password</span>
            <input
              style={s.input}
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p style={s.error}>{error}</p>}
          {status && <p style={s.status}>{status}</p>}
          <button className="btn-primary" style={s.submit} disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#f5f5f5',
  },
  card: {
    width: 'min(440px, 100%)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 18px 60px rgba(17, 24, 39, 0.12)',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: '#fff',
    fontSize: '0.98rem',
  },
  backLink: {
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.84rem',
    textDecoration: 'none',
  },
  body: {
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontSize: '1.2rem',
    color: 'var(--colour-text)',
  },
  email: {
    margin: '4px 0 0',
    fontFamily: 'var(--font-body)',
    color: '#6b7280',
    fontSize: '0.88rem',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.84rem', color: 'var(--colour-text)' },
  input: { padding: '9px 11px', border: '1.5px solid #d1d5db', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: '0.92rem' },
  error: { margin: 0, color: '#dc2626', fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
  status: { margin: 0, color: '#15803d', fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
  submit: { alignSelf: 'flex-start', padding: '8px 18px', fontSize: '0.9rem' },
}
