import { useEffect, useMemo, useState } from 'react'
import { createTurtleState } from './engine.js'
import { describeTurtleDrawing } from './describe.js'
import { useTurtlePlayback } from './useTurtlePlayback.js'

const DEFAULT_TURTLE_STATE = createTurtleState()

/**
 * The Turtle picture: a canvas showing a run's drawing, which plays (the 🐢 moving, turning and
 * drawing) when a new Run arrives, with Skip while it plays and, under reduced motion, Play to
 * watch it. Self-contained so workspace layouts can place it anywhere (see useTurtlePlayback.js
 * for when it plays).
 *
 * - `result`: { state, commands, runId? } (a run's turtle result), or null for an empty canvas.
 * - `animate`: false for views that only show finished drawings.
 * - `onPlayingChange(playing)`: the workspace holds the check result back while it plays.
 * - `drawMarker`, `timelineOptions`, `onFrame`: see useTurtlePlayback.js.
 * - `children`: drawn over the picture (e.g. a course mode's own labels).
 */
export default function TurtlePicture({
  result,
  animate = true,
  onPlayingChange,
  drawMarker,
  timelineOptions,
  onFrame,
  style,
  canvasStyle,
  children,
}) {
  const [canvas, setCanvas] = useState(null)
  const commands = useMemo(() => result?.commands ?? [], [result])
  const background = result?.state?.background ?? '#ffffff'
  // Before any run the 🐢 sits at the origin facing east, like real turtle.
  const finalPose = useMemo(
    () => ({ ...DEFAULT_TURTLE_STATE, ...(result?.state ?? {}) }),
    [result?.state]
  )
  const playback = useTurtlePlayback({
    canvas,
    commands,
    background,
    finalPose,
    runId: result?.runId ?? null,
    animate,
    drawMarker,
    timelineOptions,
    onFrame,
  })
  const { playing } = playback

  useEffect(() => {
    onPlayingChange?.(playing)
  }, [playing, onPlayingChange])
  // Unmounting mid-playback (a layout switch) must not leave the result held back.
  useEffect(() => () => onPlayingChange?.(false), [onPlayingChange])

  const description = useMemo(
    () => describeTurtleDrawing({ commands, state: finalPose }),
    [commands, finalPose]
  )

  return (
    <div style={{ ...s.wrap, ...style }} className="turtle-picture">
      <canvas
        ref={setCanvas}
        style={{ ...s.canvas, ...canvasStyle }}
        role="img"
        aria-label={description}
      />
      {children}
      {(playing || playback.canPlay) && (
        <div style={s.controls}>
          {playing ? (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.button}
              onClick={playback.skip}
              title="Skip to the finished drawing"
            >
              <span aria-hidden="true">⏭</span> Skip
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.button}
              onClick={playback.play}
              title="Watch the turtle draw it"
            >
              <span aria-hidden="true">▶</span> Play
            </button>
          )}
        </div>
      )}
      <span style={s.srOnly} aria-live="polite">
        {playing ? 'The turtle is drawing.' : ''}
      </span>
    </div>
  )
}

const s = {
  wrap: { position: 'relative', display: 'flex', flex: '1 1 0', minHeight: 0, minWidth: 0 },
  canvas: { width: '100%', height: '100%', display: 'block' },
  controls: { position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 8 },
  button: {
    minHeight: 44,
    minWidth: 44,
    padding: '8px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'var(--font-body)',
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
}
