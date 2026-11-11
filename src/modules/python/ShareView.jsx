// Read-only share viewer (`/share/:id`) for a Python task: the code, its last output and, when
// the code drew on the Python Stage, the drawing. **Run** runs the shared code here, in the
// viewer's browser (Pyodide, nothing saved or sent), answering any input() in the output panel;
// the run's output and drawing replace the saved ones (Ryan, 2026-10-22: "it doesn't run it").
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { useIsMobile } from '../../shared/useIsMobile'
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
  // Matches the 720px phone layout in index.css (.share-py).
  const phone = useIsMobile(721)
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
    // A run starts with the drawing already shown and swaps it only when it draws its own, so a
    // run that ends without drawing (an error, Stop, Python asleep) keeps it and nothing flips.
    setRun((prev) => ({
      status: 'loading',
      output: '',
      stage: prev?.stage ?? savedStage,
      prompt: null,
    }))
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
  const stage = run ? run.stage : savedStage
  const bar = 'sv-editor-header ui-tabs ui-tabs--editor ui-tabs--code-row share-py-bar'

  // The classroom panel before and after Run (the saved output shown at once, only a run's
  // output types in), so the page does not jump; it fills the right column when there is no
  // Stage. On a phone it opens right under the Run bar, not below the code (#301).
  const output = (
    <section className="share-py-output" aria-label="Output">
      <OutputPanel
        output={run ? run.output : (payload?.output ?? '')}
        typewriter={!!run}
        runStatus={busy ? null : run?.status}
        hideStatus={!run}
        running={busy}
        inputPrompt={run?.prompt ?? null}
        onInputSubmit={handleInput}
        collapsible={false}
        defaultCollapsed={false}
        fill={!stage && !phone}
        drew={!!stage}
      />
    </section>
  )

  // Laid out like the classroom editor (Ryan, 11 Nov 2026); the grid is .share-py in index.css:
  // Code left, Stage then Output right; on a phone Stage, then Code with the Output under Run.
  return (
    <div className={stage ? 'share-py share-py--stage' : 'share-py'}>
      <section className="card share-py-card share-py-code" aria-label="Code">
        <div className={bar}>
          <h2 className="sv-editor-title share-py-title">Code</h2>
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
        {phone && output}
        <div className="share-py-editor">
          <CodeEditor value={payload?.code ?? ''} language="python" readOnly />
        </div>
      </section>
      {stage && (
        <section className="card share-py-card share-py-stage" aria-label="Stage">
          <div className={bar}>
            <h2 className="sv-editor-title share-py-title">Stage</h2>
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
      {!phone && output}
    </div>
  )
}

const s = {
  stage: {
    width: 'calc(100% - 20px)',
    maxWidth: 'min(420px, 42vh)',
    aspectRatio: '1 / 1',
    margin: '10px auto 0',
  },
}
