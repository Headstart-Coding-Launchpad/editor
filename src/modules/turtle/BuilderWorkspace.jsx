import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { CodeWorkspaceTabs, StageMetadataEditor } from '../../builder/components/task-editor/TaskEditorFields'
import { getStageRole } from '../../shared/taskUtils'
import { initPyodide, runPython, stopPython } from '../python/pyodide'
import { buildTurtleProgram } from './shim.js'
import { drawTurtleCommands, sizeCanvasToDisplay } from './draw.js'

// Self-contained preview, same approach as Arcade's BuilderWorkspace: the shared
// builder run flow (useTaskEditorState.js) is hardcoded to the `python` module for
// its "Test checks" preview, so a visual task type runs its own preview instead.
export default function BuilderWorkspace({
  task,
  onUpdate,
  codeTab,
  codeStages,
  activePythonCode,
  handleCodeTabChange,
  handleAddStage,
  handleRemoveStage,
  resetToStarterBtn,
}) {
  const canvasRef = useRef(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState(null)
  const [output, setOutput] = useState('')
  const [commands, setCommands] = useState([])

  const match = codeTab.match(/^stage_(\d+)$/)
  const stageIndex = match ? Number(match[1]) : null
  const stage = stageIndex == null ? null : codeStages[stageIndex]
  const isSupportStage = stage != null && getStageRole(stage) === 'support'
  const complete = codeTab === 'complete'

  function updateStage(updates) {
    onUpdate({
      ...task,
      codeStages: (task.codeStages ?? []).map((item, index) =>
        index === stageIndex ? { ...item, ...updates } : item
      ),
    })
  }
  function change(code) {
    if (complete) onUpdate({ ...task, completeCode: code })
    else if (stageIndex != null) updateStage({ code })
    else onUpdate({ ...task, starterCode: code })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    sizeCanvasToDisplay(canvas)
    const ctx = canvas.getContext('2d')
    // jsdom (unit tests) has no real canvas 2D context and returns null.
    if (ctx) drawTurtleCommands(ctx, commands)
  }, [commands])

  async function handleRunPreview() {
    if (running) {
      stopPython()
      setRunning(false)
      return
    }
    setRunning(true)
    setStatus(null)
    setOutput('')
    setCommands([])
    await initPyodide()
    const result = await runPython(buildTurtleProgram(activePythonCode), {
      onOutput: (text) => setOutput((prev) => prev + text),
    })
    setRunning(false)
    if (result.status === 'stopped') return
    setStatus(result.status)
    setCommands(result.turtle?.commands ?? [])
  }

  return (
    <div style={s.wrap}>
      <div
        className="te-code-workspace-stack"
        style={{ minHeight: 300, gridColumn: isSupportStage ? '1 / -1' : undefined }}
      >
        <CodeWorkspaceTabs
          activeTab={codeTab}
          onChange={handleCodeTabChange}
          stages={codeStages}
          onAddStage={handleAddStage}
          onRemoveStage={handleRemoveStage}
          rightAction={resetToStarterBtn}
          unifiedStages
        />
        {stage && (
          <div style={s.stage}>
            <input
              className="te-input"
              value={stage.label ?? ''}
              onChange={(event) => updateStage({ label: event.target.value })}
              placeholder={`Stage ${stageIndex + 1}`}
            />
            <StageMetadataEditor stage={stage} showRevealable onChange={(next) => updateStage(next)} />
          </div>
        )}
        <CodeEditor
          value={activePythonCode}
          language="python"
          onChange={change}
          style={{ flex: 1, minHeight: 260, borderRadius: '0 0 8px 8px' }}
        />
      </div>
      {!isSupportStage && (
        <div style={s.preview}>
          <div style={s.previewHeader}>
            <strong>Turtle preview</strong>
            <button
              className={running ? 'btn-danger' : 'btn-primary'}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={handleRunPreview}
            >
              {running ? 'Stop' : 'Run'}
            </button>
          </div>
          <div style={s.canvasWrap}>
            <canvas ref={canvasRef} style={s.canvas} />
          </div>
          {(output || status === 'error') && (
            <pre style={{ ...s.output, color: status === 'error' ? '#b91c1c' : '#334155' }}>
              {output || 'The script raised an error.'}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, .8fr)',
    gap: 10,
    minHeight: 360,
  },
  stage: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff' },
  preview: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    color: 'var(--colour-primary)',
    background: '#f8fafc',
  },
  canvasWrap: { display: 'flex', flex: '1 1 auto', minHeight: 200, background: '#fff' },
  canvas: { width: '100%', height: '100%', display: 'block' },
  output: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-mono, monospace)',
    background: '#f8fafc',
    borderTop: '1px solid #e5e7eb',
    maxHeight: 100,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
}
