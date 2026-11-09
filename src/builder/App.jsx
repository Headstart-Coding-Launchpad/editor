import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  // hidden unless the URL carries ?advanced=1. The start screen always offers New and Upload.
  const advanced = searchParams.get('advanced') === '1'
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
            <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
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
                  setLesson(null)
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

  if (!lesson) {
    return (
      <StartScreen
        onNew={() => {
          setLesson(blankLesson())
          setDirty(false)
        }}
        onUpload={(uploaded) => {
          setLesson(uploaded)
          setDirty(false)
        }}
      />
    )
  }

  return (
    <BuilderView
      lesson={lesson}
      dirty={dirty}
      advanced={advanced}
      onUpdate={updateLesson}
      onNew={() => {
        if (
          dirty &&
          !confirm(
            'You have unsaved changes - download your lesson first.\n\nAre you sure you want to leave this lesson?'
          )
        )
          return
        localStorage.removeItem(LS_KEY)
        setDirty(false)
        // All lessons: admins go back to Admin > Lessons (the Builder no longer lists lessons);
        // anyone else returns to the start screen.
        if (role === 'admin') navigate('/admin/lessons')
        else setLesson(null)
      }}
      onMarkSaved={() => setDirty(false)}
    />
  )
}

// The Builder's start screen (Ryan, 9 Nov 2026): just New lesson and Upload lesson file. Existing
// lessons open from Admin > Lessons > Edit, which links here with ?load=<id>.
function StartScreen({ onNew, onUpload }) {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  // A way back (HSC Audit, Visual Review 27): to the page the tutor came from, or, when the
  // Builder opened in its own tab, the Admin Portal (admins) or the home page.
  function handleBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate(role === 'admin' ? '/admin' : '/')
  }

  function handleUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result)
          if (!parsed.id || !parsed.tasks || !parsed.type) throw new Error('Unrecognised format')
          onUpload(normalizeLoadedLesson(parsed))
        } catch (err) {
          alert('Could not load file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div style={s.centreScreen}>
      <div style={{ ...s.card, ...s.startCard }} className="card">
        <div style={{ ...s.cardHeader, ...s.cardHeaderRow }}>
          <button type="button" style={s.backBtn} onClick={handleBack} aria-label="Back">
            ← Back
          </button>
          <span style={{ ...s.logo, flex: 1, minWidth: 0 }}>
            Headstart Coding - LaunchPad | Lesson Builder
          </span>
          {user && (
            <button type="button" style={s.backBtn} onClick={() => navigate('/account')}>
              Account
            </button>
          )}
        </div>
        <div style={s.cardBody}>
          <div>
            <h1 style={s.choiceTitle}>Lesson Builder</h1>
            <p style={s.choiceText}>Start a new lesson, or upload a lesson file.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" style={s.startBtn} onClick={onNew}>
              New lesson
            </button>
            <button className="btn-ghost-outline" style={s.uploadBtn} onClick={handleUpload}>
              Upload lesson file
            </button>
          </div>
          <p style={s.startNote}>
            To edit an existing lesson, open it from Admin &gt; Lessons &gt; Edit.
          </p>
        </div>
      </div>
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
  startCard: { width: 640, maxWidth: '94vw' },
  cardHeader: {
    background: 'var(--colour-primary)',
    padding: '20px 24px 16px',
  },
  cardHeaderRow: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    padding: '6px 12px',
    minHeight: 36,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    flexShrink: 0,
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
  choiceTitle: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    color: 'var(--colour-text)',
    fontSize: '1.35rem',
  },
  choiceText: {
    margin: '6px 0 0',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  startBtn: { padding: '10px 18px', fontSize: '0.95rem' },
  uploadBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '10px 18px',
    fontSize: '0.95rem',
  },
  startNote: {
    margin: 0,
    paddingTop: 14,
    borderTop: '1px solid #e5e7eb',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#6b7280',
  },
}
