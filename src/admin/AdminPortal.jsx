import React, { Suspense, lazy } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { auth } from '../shared/firebase'
import { useAuth } from '../auth/useAuth'
import LoadingScreen from '../app/components/LoadingScreen'

const AccountManagement = lazy(() => import('./AccountManagement'))
const FeedbackPanel = lazy(() => import('./FeedbackPanel'))
const LessonPanel = lazy(() => import('./LessonPanel'))
const SessionsPanel = lazy(() => import('./SessionsPanel'))
const SharedAssetsPanel = lazy(() => import('./SharedAssetsPanel'))
const TopicLibraryPanel = lazy(() => import('./TopicLibraryPanel'))

const TABS = [
  { id: 'lessons', label: 'Lessons' },
  { id: 'levels', label: 'Levels' },
  { id: 'classes', label: 'Classes' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'topics', label: 'Topic Library' },
  { id: 'shared-assets', label: 'Shared Assets' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'feedback', label: 'Feedback' },
]

export default function AdminPortal() {
  const { user } = useAuth()
  const { tab, subtab } = useParams()
  const navigate = useNavigate()
  const activeTab = TABS.some((t) => t.id === tab) ? tab : 'lessons'

  function handleSubtabChange(sub) {
    navigate(`/admin/${activeTab}/${sub}`)
  }

  async function handleLogout() {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.brand}>Headstart Coding — Admin</span>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{user?.email}</span>
          <button
            className="btn-ghost-outline"
            style={s.logoutBtn}
            onClick={() => navigate('/account')}
          >
            Account
          </button>
          <button className="btn-ghost-outline" style={s.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      <nav style={s.nav}>
        <div style={s.tabs} role="tablist" aria-label="Admin sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`ui-tab${activeTab === tab.id ? ' is-active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => navigate(`/admin/${tab.id}`)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={s.main}>
        <Suspense fallback={<LoadingScreen compact message="Loading panel..." />}>
          {activeTab === 'lessons' && <LessonPanel />}
          {activeTab === 'levels' && <LessonPanel view="levels" />}
          {activeTab === 'classes' && <LessonPanel view="classes" />}
          {activeTab === 'sessions' && <SessionsPanel />}
          {activeTab === 'topics' && <TopicLibraryPanel />}
          {activeTab === 'shared-assets' && (
            <SharedAssetsPanel subtab={subtab} onSubtabChange={handleSubtabChange} />
          )}
          {activeTab === 'accounts' && <AccountManagement />}
          {activeTab === 'feedback' && (
            <FeedbackPanel subtab={subtab} onSubtabChange={handleSubtabChange} />
          )}
        </Suspense>
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
    padding: '8px 32px',
    flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    maxWidth: 1100,
    margin: '0 auto',
    alignItems: 'center',
  },
  main: {
    flex: 1,
    padding: '28px 32px',
    maxWidth: 1100,
    width: '100%',
    margin: '0 auto',
  },
}
