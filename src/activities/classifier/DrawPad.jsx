import { useMemo, useRef, useState } from 'react'
import { GRID, decodeGrid } from './classifier.js'

// The drawing pieces shared by the student view and the Builder editor (test drawings): a
// pad drawn on with Pointer Events, and a small picture of a drawing grid.

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

// A drawing grid as one small picture: darker cells are solid, lighter ones faint.
export function GridThumb({ grid, title }) {
  const { solid, faint } = useMemo(() => {
    const cells = decodeGrid(grid)
    let solidPath = ''
    let faintPath = ''
    cells.forEach((v, i) => {
      const x = i % GRID
      const y = Math.floor(i / GRID)
      const square = `M${x} ${y}h1v1h-1z`
      if (v >= 0.5) solidPath += square
      else if (v >= 0.2) faintPath += square
    })
    return { solid: solidPath, faint: faintPath }
  }, [grid])
  return (
    <svg viewBox={`0 0 ${GRID} ${GRID}`} role="img" aria-label={title} shapeRendering="crispEdges">
      <path d={faint} fill="currentColor" fillOpacity="0.35" />
      <path d={solid} fill="currentColor" />
    </svg>
  )
}

const pointsOf = (stroke) => stroke.map((p) => `${p[0] * 100},${p[1] * 100}`).join(' ')

// A square pad you draw on with a mouse, finger or pen (Pointer Events). Finished strokes are
// owned by the parent (`strokes` / `onStrokes`); the stroke in progress is drawn here and only
// handed over when the pointer lifts.
export function DrawPad({ strokes, onStrokes, disabled = false, label }) {
  const active = useRef(null)
  const [, redraw] = useState(0)

  function pointOf(event) {
    const box = event.currentTarget.getBoundingClientRect()
    return [
      clamp01((event.clientX - box.left) / (box.width || 1)),
      clamp01((event.clientY - box.top) / (box.height || 1)),
    ]
  }

  function down(event) {
    if (disabled) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    active.current = [pointOf(event)]
    redraw((n) => n + 1)
  }
  function move(event) {
    if (!active.current) return
    active.current.push(pointOf(event))
    redraw((n) => n + 1)
  }
  function up() {
    const stroke = active.current
    if (!stroke) return
    active.current = null
    onStrokes([...strokes, stroke])
  }

  const shown = active.current ? [...strokes, active.current] : strokes
  return (
    <div
      className={`act-cls-pad${disabled ? ' act-cls-pad--off' : ''}`}
      data-testid="classifier-pad"
      role="img"
      aria-label={`${label}. Drawing needs a mouse, finger or pen.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {shown.map((stroke, i) =>
          stroke.length === 1 ? (
            <circle
              key={i}
              cx={stroke[0][0] * 100}
              cy={stroke[0][1] * 100}
              r="1.6"
              fill="currentColor"
            />
          ) : (
            <polyline
              key={i}
              points={pointsOf(stroke)}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        )}
      </svg>
    </div>
  )
}
