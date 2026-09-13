import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../shared/firebase'
import { useAuth } from '../../auth/useAuth'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const pendingRedirect = useRef(null)

  // Navigate only after onAuthStateChanged has confirmed the sign-in.
  // Navigating immediately after signInWithEmailAndPassword races the auth
  // state update and causes LessonRoute/ProtectedRoute to see user=null and
  // redirect back to login before the user object is available.
  useEffect(() => {
    if (user && pendingRedirect.current) {
      const redirect = pendingRedirect.current
      pendingRedirect.current = null
      navigate(redirect, { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      const rawRedirect = searchParams.get('redirect') ?? '/'
      const redirect = rawRedirect.startsWith('/') ? rawRedirect : '/'
      if (user) {
        // User context is already populated (persistent session re-login). The same
        // user object reference won't trigger a state change in AuthContext, so the
        // useEffect below won't re-run. Navigate directly — no race risk because
        // user is already confirmed in context.
        navigate(redirect, { replace: true })
      } else {
        // Fresh login — defer navigation until onAuthStateChanged confirms the
        // sign-in, to avoid ProtectedRoute seeing user=null and bouncing back.
        pendingRedirect.current = redirect
      }
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.brand}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
        </div>

        <h1 style={s.heading}>Sign in</h1>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              style={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button className="btn-primary" style={s.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  page: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  brand: {
    display: 'flex',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: 'var(--colour-text)',
    textAlign: 'center',
    marginTop: -4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    padding: '9px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
    color: 'var(--colour-text)',
    background: '#fff',
    transition: 'border-color 0.15s',
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-error, #dc2626)',
    margin: 0,
  },
  submitBtn: {
    padding: '10px 0',
    fontSize: '0.95rem',
    width: '100%',
    marginTop: 4,
  },
}
