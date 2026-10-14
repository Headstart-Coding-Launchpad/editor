// Read-only share viewer (`/share/:id`) for a Turtle task: the code and its drawing.
import { useEffect, useMemo, useRef } from 'react'
import { ShareCode, SharePanel, shareStyles } from '../../shared/exportWork/ShareParts.jsx'
import { drawTurtleCommands, sizeCanvasToDisplay } from './draw.js'
import { createTurtleState } from './engine.js'

export default function TurtleShareView({ payload }) {
  const canvasRef = useRef(null)
  const result = payload?.turtleResult ?? null
  const commands = useMemo(() => result?.commands ?? [], [result])
  const turtle = useMemo(() => ({ ...createTurtleState(), ...(result?.state ?? {}) }), [result])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    function redraw() {
      sizeCanvasToDisplay(canvas)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawTurtleCommands(ctx, commands, {
          background: result?.state?.background ?? '#ffffff',
          turtle,
        })
      }
    }
    redraw()
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [commands, turtle, result])

  return (
    <div style={shareStyles.grid}>
      {commands.length > 0 && (
        <SharePanel title="Drawing">
          <canvas ref={canvasRef} style={s.canvas} aria-label="Turtle drawing" />
        </SharePanel>
      )}
      <ShareCode code={payload?.code} language="python" />
    </div>
  )
}

const s = {
  canvas: {
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'block',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
  },
}
