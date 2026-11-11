// Read-only share viewer (`/share/:id`) for a Python task: the code, its last output and, when
// the code drew on the Python Stage, the drawing. **Run** runs the shared code here, in the
// viewer's browser (Pyodide, nothing saved or sent), answering any input() in the output panel;
// the run's output and drawing replace the saved ones (Ryan, 2026-10-22: "it doesn't run it").
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import StagePane from '../../shared/stage/StagePane.jsx'
import { readStageResult } from '../../shared/stage/sync.js'
import OutputPanel from '../../app/components/OutputPanel'
import { initPyodide, provideInput, runPython, stopPython } from './pyodide'
import { asleepNote } from './pythonHealth'

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
    } catch (err) {
      // Python stuck ("Python fell asleep", R3): say so in the output, not just "Error".
      const note = asleepNote(err)
      setRun((r) => ({ ...r, status: 'error', prompt: null, output: r.output + note }))
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
  // A run's own drawing once it has one; the saved one stays up until then, so nothing jumps.
  const stage = run && (run.stage || !busy) ? run.stage : savedStage
  const bar = 'sv-editor-header ui-tabs ui-tabs--editor ui-tabs--code-row share-py-bar'

  // Laid out like the classroom editor (Ryan, 11 Nov 2026); the grid is .share-py in index.css:
  // Code left, Stage then Output right; on a phone Stage, Code, Output.
  return (
    <div className={stage ? 'share-py share-py--stage' : 'share-py'}>
      <section className="card share-py-card share-py-code" aria-label="Code">
        <div className={bar}>
          <span className="sv-editor-title">Code</span>
          <div className="sv-editor-actions">
            {busy && (
              <button type="button" className="btn-ghost-outline" onClick={() => stopPython()}>
                Stop
              </button>
            )}
            <button
              type="button"
              className="btn-primary sv-editor-primary-btn"
              onClick={handleRun}
              disabled={busy || typeof payload?.code !== 'string'}
            >
              {run?.status === 'loading' ? 'Getting Python ready…' : '▶ Run'}
            </button>
          </div>
        </div>
        <p className="share-py-note">Runs here, in your browser. Nothing is saved.</p>
        <div className="share-py-editor">
          <CodeEditor value={payload?.code ?? ''} language="python" readOnly />
        </div>
      </section>
      {stage && (
        <section className="card share-py-card share-py-stage" aria-label="Stage">
          <div className={bar}>
            <span className="sv-editor-title">Stage</span>
          </div>
          {/* compact, no saveTitle or target: no Save my picture or Target buttons here. */}
          <StagePane
            commands={stage.commands}
            ran
            compact
            truncated={stage.truncated}
            title="Stage drawing"
            style={s.stage}
          />
        </section>
      )}
      {/* The classroom panel before and after Run (read-only saved output first), so the
          page does not jump; it fills the right column when there is no Stage. */}
      <div className="share-py-output">
        <OutputPanel
          output={run ? run.output : (payload?.output ?? '')}
          runStatus={busy ? null : run?.status}
          hideStatus={!run}
          running={busy}
          inputPrompt={run?.prompt ?? null}
          onInputSubmit={handleInput}
          collapsible={false}
          defaultCollapsed={false}
          fill={!stage}
          drew={!!stage}
        />
      </div>
    </div>
  )
}

const s = {
  stage: {
    width: '100%',
    maxWidth: 'min(420px, 42vh)',
    aspectRatio: '1 / 1',
    margin: '10px auto 0',
  },
}
