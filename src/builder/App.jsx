import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { decodeLessonFromFirestore } from '../shared/lessonBlocksCodec'
import { useAuth } from '../auth/useAuth'
import BuilderView from './views/BuilderView'

const LS_KEY = 'headstart_builder_current'

const blankLesson = () => ({
  id: '',
  type: 'composed',
  title: '',
  description: '',
  draft: false,
  version: 0,
  tasks: [],
})

const normalizeLoadedLesson = (lesson) => ({
  ...lesson,
  draft: lesson.draft === true,
  version: lesson.version ?? 0,
})

export default function BuilderApp() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loadIdOnMount = useRef(searchParams.get('load'))
  // Hand-building tools in the editor (module set-up, the task module picker, Upload file) stay
  // hidden unless the URL carries ?advanced=1. Admin's + New Lesson links here with ?advanced=1 and
  // no load, which opens a blank lesson; there is no start screen (Ryan, 9 Nov 2026).
  const advanced = searchParams.get('advanced') === '1'
  const newLessonOnMount = useRef(advanced && !loadIdOnMount.current)
  const [lesson, setLesson] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [restorePrompt, setRestorePrompt] = useState(false)
  const [ready, setReady] = useState(false)

  // On mount - check for ?load=<id> (from admin "Edit" link), then localStorage.
  useEffect(() => {
    const loadId = loadIdOnMount.current
    if (loadId) {
      getDoc(doc(firestore, 'lessons', loadId))
        .then((snap) => {
          if (snap.exists()) {
            setLesson(normalizeLoadedLesson(decodeLessonFromFirestore(snap.data())))
          } else {
            alert(`Lesson "${loadId}" not found in Firestore.`)
          }
        })
        .catch((err) => alert('Could not load lesson: ' + err.message))
        .finally(() => setReady(true))
      return
    }
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      try {
        const saved = JSON.parse(raw)
        if (saved?.id != null) {
          setRestorePrompt(true)
          return
        }
      } catch {
        /* ignore */
      }
    }
    if (newLessonOnMount.current) setLesson(blankLesson())
    setReady(true)
  }, [])

  // Auto-save on every change.
  const updateLesson = useCallback((updater) => {
    setLesson((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save lesson draft to localStorage', err)
      }
      setDirty(true)
      return next
    })
  }, [])

  useEffect(() => {
    function handler(e) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = 'You have unsaved changes - download your lesson first.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (restorePrompt) {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    return (
      <div style={s.centreScreen}>
        <div style={s.card} className="card">
          <div style={s.cardHeader}>
            <span style={s.logo}>Head Start Coding - LaunchPad | Lesson Builder</span>
          </div>
          <div style={s.cardBody}>
            <p style={s.message}>
              You have an unsaved lesson in progress:{' '}
              <strong>{saved.title || saved.id || 'Untitled'}</strong>. Do you want to restore it?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setLesson(normalizeLoadedLesson(saved))
                  setDirty(true)
                  setRestorePrompt(false)
                  setReady(true)
                }}
              >
                Restore
              </button>
              <button
                className="btn-ghost-outline"
                style={{
                  color: 'var(--colour-primary)',
                  border: '1px solid var(--colour-primary)',
                }}
                onClick={() => {
                  localStorage.removeItem(LS_KEY)
                  setLesson(newLessonOnMount.current ? blankLesson() : null)
                  setDirty(false)
                  setRestorePrompt(false)
                  setReady(true)
                }}
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!ready && !lesson) return null

  if (!lesson) return <NoLesson />

  return (
    <BuilderView
      lesson={lesson}
      dirty={dirty}
      advanced={advanced}
      onUpdate={updateLesson}
      // All lessons (admins only, as only Admin lists lessons): back to Admin > Lessons.
      onNew={
        role === 'admin'
          ? () => {
              if (
                dirty &&
                !confirm(
                  'You have unsaved changes - download your lesson first.\n\nAre you sure you want to leave this lesson?'
                )
              )
                return
              localStorage.removeItem(LS_KEY)
              setDirty(false)
              navigate('/admin/lessons')
            }
          : undefined
      }
      onMarkSaved={() => setDirty(false)}
    />
  )
}

// No lesson to open (Ryan, 9 Nov 2026): there is no start screen. Admin > Lessons has + New Lesson,
// Upload JSON and Edit, so an admin goes there (replacing history, so Back does not loop here).
// Non-admins never use the Builder: a one-line note with a way home.
function NoLesson() {
  const { role, loading } = useAuth()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  useEffect(() => {
    if (!loading && isAdmin) navigate('/admin/lessons', { replace: true })
  }, [loading, isAdmin, navigate])

  if (loading || isAdmin) return null
  return (
    <div style={s.centreScreen}>
      <p style={s.note}>
        Lessons are made in Admin. <Link to="/">Go to the home page</Link>
      </p>
    </div>
  )
}

const s = {
  centreScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'linear-gradient(135deg, #d3c0f9 0%, #b89df5 100%)',
  },
  card: {
    width: 440,
    overflow: 'hidden',
    borderRadius: 12,
    boxShadow: '0 8px 30px rgba(98, 34, 204, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06)',
  },
  cardHeader: {
    background: 'var(--colour-primary)',
    padding: '20px 24px 16px',
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-secondary)',
    fontSize: '1rem',
  },
  cardBody: {
    padding: '20px 24px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  message: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: 'var(--colour-text)',
  },
  note: {
    margin: 0,
    padding: '14px 20px',
    background: '#fff',
    borderRadius: 10,
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
  },
}
