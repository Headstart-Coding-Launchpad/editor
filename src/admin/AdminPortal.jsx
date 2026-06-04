import React, { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import AccountManagement from './AccountManagement'
import LessonManagement from './LessonManagement'

export default function AdminPortal() {
  const { user } = useAuth()
  const [tab, setTab] = useState('lessons')

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

      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(tab === 'lessons' ? s.tabActive : {}) }}
          onClick={() => setTab('lessons')}
        >
          Lessons
        </button>
        <button
          style={{ ...s.tab, ...(tab === 'accounts' ? s.tabActive : {}) }}
          onClick={() => setTab('accounts')}
        >
          Accounts
        </button>
      </div>

      <main style={s.main}>
        {tab === 'lessons' && <LessonManagement />}
        {tab === 'accounts' && <AccountManagement />}
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
  tabs: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 32px',
    display: 'flex',
    gap: 0,
    flexShrink: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '12px 16px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#6b7280',
    cursor: 'pointer',
    marginBottom: -1,
  },
  tabActive: {
    color: 'var(--colour-primary)',
    borderBottomColor: 'var(--colour-primary)',
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
