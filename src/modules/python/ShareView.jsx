// Read-only share viewer (`/share/:id`) for a Python task: the code, its last output and, when
// the code drew on the Python Stage, the drawing. **Run** runs the shared code here, in the
// viewer's browser (Pyodide, nothing saved or sent), answering any input() in the output panel;
// the run's output and drawing replace the saved ones (Ryan, 2026-10-22: "it doesn't run it").
import { useEffect, useMemo, useRef, useState } from 'react'
import { ShareCode, ShareOutput, shareStyles } from '../../shared/exportWork/ShareParts.jsx'
import StagePane from '../../shared/stage/StagePane.jsx'
import { readStageResult } from '../../shared/stage/sync.js'
import OutputPanel from '../../app/components/OutputPanel'
import { initPyodide, provideInput, runPython, stopPython } from './pyodide'

// The share payload's `stageJson` (JSON text of compactStageForSync's shape), or null.
function readShareStage(payload) {
  if (typeof payload?.stageJson !== 'string' || !payload.stageJson) return null
  try {
    return readStageResult(JSON.parse(payload.stageJson))
  } catch {
    return null
  }
}

export default function PythonShareView({ payload }) {
  const savedStage = useMemo(() => readShareStage(payload), [payload])
  // null until the viewer presses Run; then this page's own run.
  const [run, setRun] = useState(null)
  const runningRef = useRef(false)

  useEffect(
    () => () => {
      if (runningRef.current) stopPython()
    },
    []
  )

  async function handleRun() {
    if (runningRef.current || typeof payload?.code !== 'string') return
    runningRef.current = true
    setRun({ status: 'loading', output: '', stage: null, prompt: null })
    const append = (text) => setRun((r) => ({ ...r, output: r.output + text }))
    try {
      await initPyodide()
      setRun((r) => ({ ...r, status: 'running' }))
      const result = await runPython(payload.code, {
        onOutput: (text) => append(text),
        onInputRequired: (prompt, { stage } = {}) =>
          setRun((r) => ({
            ...r,
            prompt: prompt ?? '',
            stage: stage ? readStageResult(stage) : r.stage,
          })),
      })
      setRun((r) => ({
        ...r,
        status: result?.status ?? 'error',
        prompt: null,
        stage: result?.stage ? readStageResult(result.stage) : r.stage,
      }))
    } catch {
      setRun((r) => ({ ...r, status: 'error', prompt: null }))
    } finally {
      runningRef.current = false
    }
  }

  function handleInput(value) {
    // The prompt is already in the output; echo the answer, as the classroom does.
    setRun((r) => ({ ...r, prompt: null, output: `${r.output}${value}\n` }))
    provideInput(value)
  }

  const busy = run?.status === 'loading' || run?.status === 'running'
  const stage = run ? run.stage : savedStage

  return (
    <div style={shareStyles.grid}>
      {stage && (
        <StagePane
          commands={stage.commands}
          ran
          compact
          truncated={stage.truncated}
          title="Stage drawing"
          style={s.stage}
        />
      )}
      <ShareCode code={payload?.code} language="python" />
      {/* Run and its output share one grid cell, so the output opens right under the
          button instead of dropping below the code, off-screen (#301). */}
      <div style={s.runColumn}>
        <div style={s.runRow}>
          <button
            type="button"
            className="btn-primary"
            style={s.runBtn}
            onClick={handleRun}
            disabled={busy || typeof payload?.code !== 'string'}
          >
            {run?.status === 'loading' ? 'Getting Python ready…' : '▶ Run'}
          </button>
          {busy && (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.runBtn}
              onClick={() => stopPython()}
            >
              Stop
            </button>
          )}
          <span style={s.note}>Runs here, in your browser. Nothing is saved.</span>
        </div>
        {run ? (
          <OutputPanel
            output={run.output}
            runStatus={busy ? null : run.status}
            running={busy}
            inputPrompt={run.prompt}
            onInputSubmit={handleInput}
            collapsible={false}
            defaultCollapsed={false}
          />
        ) : (
          <ShareOutput output={payload?.output} />
        )}
      </div>
    </div>
  )
}

const s = {
  stage: { width: '100%', maxWidth: 420, aspectRatio: '1 / 1' },
  runColumn: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  runRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  runBtn: { minHeight: 44, padding: '0 18px' },
  note: { fontSize: '0.85rem', color: 'var(--colour-text-muted, #6b7280)' },
}
