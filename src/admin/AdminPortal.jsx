import React, { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import AccountManagement from './AccountManagement'
import LessonPanel from './LessonPanel'

const TABS = [
  { id: 'lessons', label: 'Lessons' },
  { id: 'accounts', label: 'Accounts' },
]

export default function AdminPortal() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('lessons')

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

      <nav style={s.nav}>
        <div style={s.tabs}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={s.main}>
        {activeTab === 'lessons' && <LessonPanel />}
        {activeTab === 'accounts' && <AccountManagement />}
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
  nav: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 32px',
    flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    maxWidth: 1100,
    margin: '0 auto',
  },
  tab: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    padding: '12px 20px',
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--colour-primary)',
    borderBottomColor: 'var(--colour-primary)',
  },
  main: {
    flex: 1,
    padding: '28px 32px',
    maxWidth: 1100,
    width: '100%',
    margin: '0 auto',
  },
}
