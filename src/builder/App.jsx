import React, { useState, useEffect, useCallback } from 'react'
import BuilderView from './views/BuilderView'

const LS_KEY = 'headstart_builder_current'

const blankLesson = type => ({
  id: '',
  type,
  title: '',
  description: '',
  tasks: [],
  ...(type === 'filesystem' ? { sandboxStarterFs: { '/': { type: 'dir' } } } : {}),
})

export default function BuilderApp() {
  const [lesson, setLesson] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [restorePrompt, setRestorePrompt] = useState(false)
  const [ready, setReady] = useState(false)

  // On mount - check localStorage for in-progress lesson.
  useEffect(() => {
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
          </div>
          <button className="btn-ghost" style={s.uploadBtn} onClick={handleUpload}>
            Upload existing JSON
          </button>
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
