import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import OutputPanel from '../components/OutputPanel'
import PythonEditor from '../../modules/python/PythonEditor'
import { initPyodide, isPyodideReady, provideInput, runPython, stopPython } from '../../modules/python/pyodide'
import { createLaunchpadCodeFile, downloadLaunchpadCodeFile } from '../../shared/launchpadCodeFile'
import { useIsMobile } from '../../shared/useIsMobile'

export default function CodeFileWorkspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const codeFile = location.state?.codeFile
  const [tasks, setTasks] = useState(() => codeFile?.tasks ?? [])
  const [activeTaskId, setActiveTaskId] = useState(() => codeFile?.tasks?.[0]?.id ?? null)
  const [output, setOutput] = useState('')
  const [runStatus, setRunStatus] = useState(null)
  const [running, setRunning] = useState(false)
  const [inputPrompt, setInputPrompt] = useState(null)
  const [pythonStatus, setPythonStatus] = useState(() => isPyodideReady() ? 'ready' : 'loading')

  useEffect(() => {
    if (!codeFile) return
    if (isPyodideReady()) {
      setPythonStatus('ready')
      return
    }
    setPythonStatus('loading')
    initPyodide().then(() => setPythonStatus('ready')).catch(() => setPythonStatus('error'))
  }, [codeFile])

  const activeTask = useMemo(
    () => tasks.find(task => task.id === activeTaskId) ?? tasks[0] ?? null,
    [tasks, activeTaskId]
  )

  function updateActiveCode(code) {
    setTasks(current => current.map(task => task.id === activeTask?.id ? { ...task, code } : task))
  }

  async function handleRun() {
    if (!activeTask || running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)
    try {
      let nextOutput = ''
      const result = await runPython(activeTask.code, {
        onOutput: text => {
          nextOutput += text
          setOutput(nextOutput)
        },
        onInputRequired: prompt => setInputPrompt(prompt),
      })
      setRunStatus(result.status)
    } catch {
      setRunStatus('error')
    } finally {
      setInputPrompt(null)
      setRunning(false)
    }
  }

  function handleStop() {
    stopPython()
  }

  function handleInputSubmit(value) {
    setOutput(current => current + value + '\n')
    setInputPrompt(null)
    provideInput(value)
  }

  function handleDownload() {
    if (!tasks.length) return
    downloadLaunchpadCodeFile(createLaunchpadCodeFile(tasks), tasks.length === 1 ? tasks[0].title : 'my-python-code')
  }

  if (!codeFile || tasks.length === 0) {
    return (
      <div style={s.emptyPage}>
        <h1 style={s.emptyTitle}>Open your saved code</h1>
        <p style={s.emptyText}>Choose a LaunchPad file from the start screen to continue coding.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go to LaunchPad</button>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <TopBar
        lessonTitle={activeTask?.title || 'My Python code'}
        right={
          <div style={s.topActions}>
            <button className="btn-ghost" style={s.topButton} onClick={() => navigate('/')}>Open another file</button>
            <button className="btn-ghost" style={s.topButton} onClick={handleDownload}>Download code</button>
          </div>
        }
      />
      <div style={s.warning} role="status">
        <strong>Saved only on this device.</strong> Download your code after editing to keep an updated copy.
      </div>
      {tasks.length > 1 && (
        <div style={s.taskPicker} role="tablist" aria-label="Saved Python tasks">
          {tasks.map(task => (
            <button
              key={task.id}
              className={`ui-tab ${task.id === activeTask?.id ? 'is-active' : ''}`}
              role="tab"
              aria-selected={task.id === activeTask?.id}
              onClick={() => {
                setActiveTaskId(task.id)
                setOutput('')
                setRunStatus(null)
              }}
            >
              {task.title}
            </button>
          ))}
        </div>
      )}
      <main style={{ ...s.workspace, ...(isMobile ? s.workspaceMobile : {}) }}>
        <section style={s.editorPane} aria-label="Python editor">
          <div style={s.editorHeader} className="ui-tabs ui-tabs--editor">
            <span style={s.editorLabel}>Python code</span>
            <div style={s.editorActions}>
              <button
                className={running ? 'btn-danger' : 'btn-primary'}
                onClick={running ? handleStop : handleRun}
                disabled={!running && pythonStatus === 'loading'}
              >
                {running ? 'Stop' : pythonStatus === 'loading' ? 'Getting Python ready...' : 'Run'}
              </button>
            </div>
          </div>
          <PythonEditor
            code={activeTask?.code ?? ''}
            onChange={updateActiveCode}
            pyodideStatus={pythonStatus}
          />
        </section>
        <section style={s.outputPane} aria-label="Python output">
          <OutputPanel
            output={output}
            runStatus={runStatus}
            inputPrompt={inputPrompt}
            onInputSubmit={handleInputSubmit}
            running={running}
            fill
            collapsible={false}
          />
        </section>
      </main>
    </div>
  )
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ui-surface-soft)' },
  topActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  topButton: { fontSize: 13, padding: '5px 10px' },
  warning: { background: '#fef9c3', borderBottom: '1px solid #fde047', color: '#854d0e', padding: '8px 16px', fontFamily: 'var(--font-body)', fontSize: 13 },
  taskPicker: { display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 16px', background: 'var(--ui-surface)' },
  workspace: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 12, padding: 16 },
  workspaceMobile: { display: 'flex', flexDirection: 'column', overflow: 'auto' },
  editorPane: { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' },
  outputPane: { display: 'flex', minHeight: 0 },
  editorHeader: { flexShrink: 0 },
  editorLabel: { padding: '0 10px', color: 'var(--colour-primary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.86rem' },
  editorActions: { marginLeft: 'auto', padding: 6 },
  emptyPage: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center', background: 'var(--ui-surface-soft)' },
  emptyTitle: { margin: 0, fontFamily: 'var(--font-title)', color: 'var(--colour-primary)' },
  emptyText: { margin: 0, fontFamily: 'var(--font-body)', color: '#6b7280' },
}
