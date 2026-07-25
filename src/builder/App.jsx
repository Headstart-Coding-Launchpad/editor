import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { fetchLessonList } from '../shared/lessonService'
import { decodeLessonBlocksFromFirestore } from '../shared/lessonBlocksCodec'
import { useAuth } from '../auth/useAuth'
import BuilderView from './views/BuilderView'
import { DEFAULT_CIRCUIT, cloneCircuit } from '../modules/electronics/circuit'

export const LS_KEY = 'headstart_builder_current'

const blankLesson = type => ({
  id: '',
  type,
  title: '',
  description: '',
  tasks: [],
  ...(type === 'filesystem' ? { sandboxStarterFs: { '/': { type: 'dir' } } } : {}),
  ...(type === 'electronics' ? { sandboxStarterCircuit: cloneCircuit(DEFAULT_CIRCUIT) } : {}),
})

export default function BuilderApp() {
  const [searchParams] = useSearchParams()
  const loadIdOnMount = useRef(searchParams.get('load'))
  const [lesson, setLesson] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [restorePrompt, setRestorePrompt] = useState(false)
  const [ready, setReady] = useState(false)

  // On mount - check for ?load=<id> (from admin "Edit" link), then localStorage.
  useEffect(() => {
    const loadId = loadIdOnMount.current
    if (loadId) {
      getDoc(doc(firestore, 'lessons', loadId))
        .then(snap => {
          if (snap.exists()) {
            setLesson(decodeLessonBlocksFromFirestore(snap.data()))
          } else {
            alert(`Lesson "${loadId}" not found in Firestore.`)
          }
        })
        .catch(err => alert('Could not load lesson: ' + err.message))
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
      } catch { /* ignore */ }
    }
    setReady(true)
  }, [])

  // Auto-save on every change.
  const updateLesson = useCallback((updater) => {
    setLesson(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(LS_KEY, JSON.stringify(next))
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
              You have an unsaved lesson in progress: <strong>{saved.title || saved.id || 'Untitled'}</strong>.
              Do you want to restore it?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" onClick={() => { setLesson(saved); setDirty(true); setRestorePrompt(false); setReady(true) }}>
                Restore
              </button>
              <button
                className="btn-ghost"
                style={{ color: 'var(--colour-primary)', border: '1px solid var(--colour-primary)' }}
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
      <LessonTypeChooser
        onChoose={type => {
          setLesson(blankLesson(type))
          setDirty(false)
        }}
        onUpload={uploaded => {
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
      onUpdate={updateLesson}
      onNew={() => {
        if (dirty && !confirm('You have unsaved changes - download your lesson first.\n\nAre you sure you want to start a new lesson?')) return
        localStorage.removeItem(LS_KEY)
        setLesson(null)
        setDirty(false)
      }}
      onMarkSaved={() => setDirty(false)}
    />
  )
}

function LessonTypeChooser({ onChoose, onUpload }) {
  const { role } = useAuth()
  const [firestoreOpen, setFirestoreOpen] = useState(false)

  function handleUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result)
          if (!parsed.id || !parsed.tasks || !parsed.type) throw new Error('Unrecognised format')
          onUpload(parsed)
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
      <div style={{ ...s.card, ...s.choiceCard }} className="card">
        <div style={s.cardHeader}>
          <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
        </div>
        <div style={s.cardBody}>
          <div>
            <h1 style={s.choiceTitle}>Choose a lesson type</h1>
            <p style={s.choiceText}>This sets the editor, runner, and starter-code format for the lesson.</p>
          </div>
          <div style={s.choiceGrid}>
            <button style={s.choiceButton} onClick={() => onChoose('python')}>
              <span style={s.choiceName}>Python</span>
              <span style={s.choiceDescription}>Single-file Python tasks with output checks and Pyodide execution.</span>
            </button>
            <button style={s.choiceButton} onClick={() => onChoose('arcade')}>
              <span style={s.choiceName}>Arcade Kit</span>
              <span style={s.choiceDescription}>Single-file Python pixel games with a browser canvas, keyboard controls, and assets.</span>
            </button>
            <button style={s.choiceButton} onClick={() => onChoose('html')}>
              <span style={s.choiceName}>Web</span>
              <span style={s.choiceDescription}>HTML, CSS, and JavaScript tasks with files, assets, and iframe preview.</span>
            </button>
            <button style={s.choiceButton} onClick={() => onChoose('scratch')}>
              <span style={s.choiceName}>Scratch</span>
              <span style={s.choiceDescription}>Block-based tasks with a Scratch workspace, stage, toolbox limits, and block checks.</span>
            </button>
            <button style={s.choiceButton} onClick={() => onChoose('filesystem')}>
              <span style={s.choiceName}>Files/Folders</span>
              <span style={s.choiceDescription}>Virtual filesystem tasks — create, rename, move, and organise files and folders.</span>
            </button>
            <button style={s.choiceButton} onClick={() => onChoose('electronics')}>
              <span style={s.choiceName}>Electronics</span>
              <span style={s.choiceDescription}>Editable breadboard tasks with LEDs, motors, switches, pots, and future MicroPython support.</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost" style={s.uploadBtn} onClick={handleUpload}>
              Upload existing JSON
            </button>
            {role === 'admin' && (
              <button className="btn-ghost" style={s.uploadBtn} onClick={() => setFirestoreOpen(true)}>
                Open from Firestore
              </button>
            )}
          </div>
        </div>
      </div>
      {firestoreOpen && (
        <FirestoreLessonPicker onLoad={onUpload} onClose={() => setFirestoreOpen(false)} />
      )}
    </div>
  )
}

function FirestoreLessonPicker({ onLoad, onClose }) {
  const [lessons, setLessons] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    fetchLessonList()
      .then(items => setLessons(items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSelect(lessonId) {
    setLoadingId(lessonId)
    try {
      const snap = await getDoc(doc(firestore, 'lessons', lessonId))
      if (!snap.exists()) { alert('Lesson not found.'); return }
      onLoad(decodeLessonBlocksFromFirestore(snap.data()))
    } catch (err) {
      alert('Could not load lesson: ' + err.message)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={fp.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={fp.modal} className="card">
        <div style={fp.header}>
          <span style={fp.title}>Open from Firestore</span>
          <button style={fp.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={fp.body}>
          {loading && <p style={fp.hint}>Loading lessons…</p>}
          {error && <p style={{ ...fp.hint, color: '#ef4444' }}>Error: {error}</p>}
          {lessons && lessons.length === 0 && <p style={fp.hint}>No lessons found in Firestore.</p>}
          {lessons && lessons.map(lesson => (
            <button
              key={lesson.id}
              style={fp.row}
              onClick={() => handleSelect(lesson.id)}
              disabled={loadingId === lesson.id}
            >
              <span style={fp.rowTitle}>{lesson.title || lesson.id}</span>
              <span style={fp.rowMeta}>{lesson.id} · {lesson.type}</span>
              {loadingId === lesson.id && <span style={fp.rowLoading}>Loading…</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const fp = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(17, 24, 39, 0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 'min(560px, 92vw)',
    maxHeight: '80vh',
    background: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: '#fff',
    fontSize: '0.95rem',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#fff',
    fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
  },
  body: {
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#6b7280',
    margin: 0,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  rowTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.92rem',
    color: 'var(--colour-text)',
  },
  rowMeta: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: '#9ca3af',
  },
  rowLoading: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: 'var(--colour-primary)',
  },
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
  choiceCard: { width: 740 },
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
  choiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  choiceButton: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    textAlign: 'left',
    padding: 16,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '8px 12px',
    fontSize: '0.86rem',
  },
  choiceName: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-primary)',
    fontSize: '1rem',
  },
  choiceDescription: {
    fontFamily: 'var(--font-body)',
    color: '#4b5563',
    fontSize: '0.86rem',
    lineHeight: 1.45,
  },
}
