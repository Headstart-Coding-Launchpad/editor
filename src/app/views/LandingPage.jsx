import React, { useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { createLaunchpadCodeFile, parseLaunchpadCodeFile } from '../../shared/launchpadCodeFile'

export default function LandingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isTeacher = searchParams.get('teacher') === 'true'

  const [lessonCode, setLessonCode] = useState('')
  const [openCodeError, setOpenCodeError] = useState('')
  const [playgroundPickerOpen, setPlaygroundPickerOpen] = useState(false)
  const fileInputRef = useRef(null)

  function handleGo(e) {
    e.preventDefault()
    const id = lessonCode.trim()
    if (!id) return
    navigate(`/lesson/${id}${isTeacher ? '?teacher=true' : ''}`)
  }

  async function handleOpenCode(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const codeFile = parseLaunchpadCodeFile(await file.text())
      navigate('/code', { state: { codeFile } })
    } catch (error) {
      setOpenCodeError(error.message)
    }
  }

  function handleOpenPlayground(type) {
    navigate(`/playground/${type}`)
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.brand}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
        </div>

        <h1 style={s.heading}>{isTeacher ? 'Teacher Dashboard' : 'Join a lesson'}</h1>

        <form onSubmit={handleGo} style={s.form}>
          <label style={s.label} htmlFor="lesson-code">
            {isTeacher ? 'Lesson code' : 'Enter your lesson code'}
          </label>
          <div style={s.row}>
            <input
              id="lesson-code"
              style={s.input}
              type="text"
              value={lessonCode}
              onChange={(e) => setLessonCode(e.target.value)}
              placeholder="e.g. python-intro"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn-primary" style={s.goBtn} type="submit">
              Go
            </button>
          </div>
        </form>
        {!isTeacher && (
          <div style={s.openCode}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".launchpad,application/json"
              onChange={handleOpenCode}
              style={s.fileInput}
              aria-label="Choose a LaunchPad code file"
            />
            <button
              className="btn-ghost-outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Open saved code
            </button>
            <p style={s.openCodeText}>Open a LaunchPad file to continue your Python code.</p>
            <button
              className="btn-ghost-outline"
              type="button"
              onClick={() => setPlaygroundPickerOpen(true)}
            >
              Open playgrounds
            </button>
            <p style={s.openCodeText}>Start a fresh coding space and choose its type.</p>
            {openCodeError && (
              <p style={s.error} role="alert">
                {openCodeError}
              </p>
            )}
          </div>
        )}
      </div>
      {playgroundPickerOpen && (
        <div
          style={s.dialogBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="playground-picker-title"
        >
          <div style={s.dialog}>
            <h2 id="playground-picker-title" style={s.dialogTitle}>
              Choose a playground
            </h2>
            <p style={s.dialogText}>Pick the type of code you want to work on.</p>
            <button
              className="btn-primary"
              type="button"
              onClick={() => handleOpenPlayground('python')}
            >
              Python
            </button>
            <button
              className="btn-ghost-outline"
              type="button"
              onClick={() => handleOpenPlayground('arcade')}
            >
              Arcade Kit
            </button>
            <button
              className="btn-ghost-outline"
              type="button"
              onClick={() => handleOpenPlayground('electronics')}
            >
              Electronics
            </button>
            <button
              className="btn-ghost-outline"
              type="button"
              onClick={() => setPlaygroundPickerOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
    gap: 8,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  row: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'var(--font-code)',
    fontSize: '0.95rem',
    padding: '9px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
    color: 'var(--colour-text)',
    background: '#fff',
    transition: 'border-color 0.15s',
  },
  goBtn: {
    flexShrink: 0,
    padding: '9px 22px',
    fontSize: '0.95rem',
  },
  openCode: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    borderTop: '1px solid var(--ui-border)',
  },
  fileInput: { display: 'none' },
  openCodeText: {
    margin: 0,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  error: {
    margin: 0,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#991b1b',
  },
  dialogBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'rgba(0,0,0,0.5)',
  },
  dialog: {
    width: 'min(360px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 24,
    borderRadius: 'var(--ui-radius)',
    background: 'var(--ui-surface)',
    boxShadow: 'var(--ui-shadow)',
  },
  dialogTitle: {
    margin: 0,
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-title)',
    fontSize: '1.2rem',
  },
  dialogText: { margin: 0, color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem' },
}
