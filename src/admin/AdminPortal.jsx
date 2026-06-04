import React from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import AccountManagement from './AccountManagement'

export default function AdminPortal() {
  const { user } = useAuth()

  async function handleLogout() {
    await signOut(auth)
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.brand}>Headstart Coding — Admin</span>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{user?.email}</span>
          <button className="btn-ghost-outline" style={s.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main style={s.main}>
        <AccountManagement />
      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100%',
    background: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  brand: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#fff',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userEmail: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.8)',
  },
  logoutBtn: {
    padding: '5px 14px',
    fontSize: '0.82rem',
  },
  main: {
    flex: 1,
    padding: '28px 32px',
    maxWidth: 1100,
    width: '100%',
    margin: '0 auto',
  },
}
