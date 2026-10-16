import React from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingScreen from '../app/components/LoadingScreen'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking sign-in…" />

  if (!user) {
    console.warn(`ProtectedRoute: redirecting ${location.pathname} to /login (no signed-in user).`)
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (requiredRole && role !== requiredRole && role !== 'admin') {
    // Signed in, but without the role this page needs (e.g. a tutor opening the Admin Portal):
    // say so, with a way back, rather than dropping them on a bare sign-in form (HSC Audit,
    // Visual Review 28).
    console.warn(
      `ProtectedRoute: ${location.pathname} needs another account (role "${role ?? 'none'}" does not satisfy required role "${requiredRole}").`
    )
    return <NeedsRole requiredRole={requiredRole} />
  }

  return children
}

function NeedsRole({ requiredRole }) {
  const navigate = useNavigate()
  const accountName = requiredRole === 'admin' ? 'an admin account' : 'a tutor account'
  return (
    <div style={s.screen}>
      <div style={s.card} role="alert">
        <h1 style={s.title}>You need {accountName} to see this page</h1>
        <p style={s.text}>
          You&apos;re signed in, but this account can&apos;t open it. Ask an admin if you think you
          should have access.
        </p>
        <div style={s.actions}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            ← Go back
          </button>
          <Link to="/login" style={s.link}>
            Sign in with a different account
          </Link>
        </div>
      </div>
    </div>
  )
}

const s = {
  screen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'var(--ui-surface-tint)',
  },
  card: {
    width: 'min(480px, 100%)',
    background: '#fff',
    borderRadius: 10,
    padding: '24px 24px 20px',
    boxShadow: 'var(--ui-shadow)',
    fontFamily: 'var(--font-body)',
  },
  title: {
    margin: '0 0 8px',
    fontFamily: 'var(--font-title)',
    fontSize: '1.25rem',
    color: 'var(--colour-primary-dark)',
  },
  text: { margin: '0 0 16px', color: 'var(--colour-text)', lineHeight: 1.5 },
  actions: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  link: { color: 'var(--colour-primary)', fontWeight: 600 },
}
