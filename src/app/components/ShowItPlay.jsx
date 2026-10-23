// Show it "▶ Play" (presentation window only). Each player is a separate, self-contained runner
// for one tile, mounted only while that tile plays: it runs or replays the build's STORED work
// locally and never touches the presenter's editor state, the session or Firebase (no useSession,
// no cs.* writes, no logAttempt, no badge or typing signals). Unmounting stops it, and the tile
// goes back to the still result.
//   - Python (+ Stage): the module's own runtime.run (Pyodide worker), input() answered in the tile.
//   - HTML: a live sandboxed IframePreview of the saved files, so clicks and buttons work.
//   - Turtle: the saved drawing replayed animated by the shared turtle player.
import { useEffect, useRef, useState } from 'react'
import IframePreview from './IframePreview'
import OutputPanel from './OutputPanel'
import StagePane from '../../shared/stage/StagePane.jsx'
import { readStageResult } from '../../shared/stage/sync.js'
import { createTurtlePlayer } from '../../modules/turtle/turtlePlayer.js'
import { sizeCanvasToDisplay } from '../../modules/turtle/draw.js'
import { describeTurtleDrawing } from '../../modules/turtle/describe.js'
import { createTurtleState } from '../../modules/turtle/engine.js'

export function PythonPlay({ code: liveCode, task: liveTask, runtime }) {
  // The build as it was when Play was pressed: a later sync of the student's record never
  // restarts or changes a run in progress.
  const [{ code, task }] = useState({ code: liveCode, task: liveTask })
  const [run, setRun] = useState({ status: 'loading', output: '', stage: null, prompt: null })
  useEffect(() => {
    let cancelled = false
    const live = (fn) => {
      if (!cancelled) fn()
    }
    ;(async () => {
      try {
        await runtime.init?.()
        live(() => setRun((r) => ({ ...r, status: 'running' })))
        const result = await runtime.run(code, task, {
          freePlay: false,
          onOutput: (text) => live(() => setRun((r) => ({ ...r, output: r.output + text }))),
          onInputRequired: (prompt, { stage } = {}) =>
            live(() =>
              setRun((r) => ({
                ...r,
                prompt: prompt ?? '',
                stage: stage ? readStageResult(stage) : r.stage,
              }))
            ),
        })
        live(() =>
          setRun((r) => ({
            ...r,
            status: result?.status ?? 'error',
            prompt: null,
            stage: result?.stage ? readStageResult(result.stage) : r.stage,
          }))
        )
      } catch {
        live(() => setRun((r) => ({ ...r, status: 'error', prompt: null })))
      }
    })()
    return () => {
      cancelled = true
      runtime.stop?.()
    }
    // One run per mount: Stop unmounts, Play mounts a fresh one.
  }, [code, task, runtime])

  const busy = run.status === 'loading' || run.status === 'running'
  return (
    <div style={s.stack} data-testid="show-it-play">
      {run.stage && (
        <StagePane
          compact
          ran
          commands={run.stage.commands}
          truncated={run.stage.truncated}
          title="Stage"
          style={s.stage}
        />
      )}
      {(!run.stage || run.output) && (
        <OutputPanel
          output={run.output}
          runStatus={busy ? null : run.status}
          hideStatus
          running={busy}
          inputPrompt={run.prompt}
          onInputSubmit={(value) => {
            setRun((r) => ({ ...r, prompt: null, output: `${r.output}${value}\n` }))
            runtime.provideInput?.(value)
          }}
          collapsible={false}
          defaultCollapsed={false}
          fill={!run.stage}
          large={!run.stage}
        />
      )}
    </div>
  )
}

export function HtmlPlay({ src }) {
  return (
    <div style={s.stack} data-testid="show-it-play">
      <IframePreview src={src} fill />
    </div>
  )
}

export function TurtlePlay({ result: liveResult }) {
  const [result] = useState(liveResult)
  const canvasRef = useRef(null)
  const commands = result?.commands ?? []
  const state = { ...createTurtleState(), ...(result?.state ?? {}) }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const player = createTurtlePlayer({ canvas })
    player.load({
      commands: result?.commands ?? [],
      background: result?.state?.background ?? '#ffffff',
      finalPose: result?.finalPose ?? null,
    })
    sizeCanvasToDisplay(canvas)
    player.play()
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => player.resize()) : null
    observer?.observe(canvas)
    return () => {
      observer?.disconnect()
      player.destroy()
    }
  }, [result])
  return (
    <div style={s.stack} data-testid="show-it-play">
      <canvas
        ref={canvasRef}
        style={s.canvas}
        role="img"
        aria-label={describeTurtleDrawing({ commands, state })}
      />
    </div>
  )
}

const s = {
  stack: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  stage: { width: '100%', maxWidth: 520, aspectRatio: '1 / 1', alignSelf: 'center' },
  canvas: { width: '100%', flex: 1, minHeight: 0, display: 'block', background: '#fff' },
}
