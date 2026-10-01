import React, { useEffect, useRef, useState } from 'react'
import { useLiveInkConfig } from './liveInkContext'
import LiveInkOverlay from './LiveInkOverlay'
import {
  anchorElementAtPoint,
  anchorElementFor,
  anchorNameOf,
  describeSelection,
  encodeInkPoint,
  highlightAtPoint,
  pointsToSvgPath,
  simplifyStrokePoints,
  strokeToInkPoints,
} from './geometry'
import { INK_COLOUR } from './liveInkData'

// Marks a block of rendered content (an information task body, a recap column, a code task's
// explainer) as a place the teacher can annotate from the Presentation window. `id` names the
// content, e.g. `info:3` or `explainer:7` (see surfaceId in liveInkData.js).
//
// Outside a live lesson / the Presentation window (no LiveInkProvider config) this renders its
// children as they are, so the Builder and solo study are untouched.
export default function InkSurface({ id, style, children }) {
  const config = useLiveInkConfig()
  if (!config || !id) return children
  return (
    <ActiveInkSurface id={id} config={config} style={style}>
      {children}
    </ActiveInkSurface>
  )
}

function ActiveInkSurface({ id, config, style, children }) {
  const surfaceRef = useRef(null)
  const { role, tool, writer, registerSurface, noteAnnotate, getInk } = config
  const isTeacher = role === 'teacher' && !!writer
  const pointerMode = isTeacher && tool === 'pointer'
  const highlightMode = isTeacher && tool === 'highlight'
  const inkMode = isTeacher && tool === 'ink'

  useEffect(() => registerSurface(id), [registerSurface, id])

  // ─── Pointer mode: follow the mouse without blocking clicks ─────────────────
  // The first move after the pointer arrives on this content counts as "annotating" it (which
  // opens a code task's explainer for students); moving around inside it doesn't re-announce.
  const pointerAnnouncedRef = useRef(false)
  useEffect(() => {
    if (!pointerMode) pointerAnnouncedRef.current = false
  }, [pointerMode])

  function handlePointerMove(event) {
    if (!pointerMode) return
    if (!pointerAnnouncedRef.current) {
      pointerAnnouncedRef.current = true
      noteAnnotate(id)
    }
    const surfaceEl = surfaceRef.current
    if (!surfaceEl?.contains(event.target)) return
    const anchorEl = anchorElementFor(event.target, surfaceEl)
    // Over text: the character under the pointer (so the dot stays on that word at any
    // width); elsewhere: fractions of the anchor element's box.
    const position = encodeInkPoint(anchorEl, { x: event.clientX, y: event.clientY })
    if (!position) return
    writer.movePointer({ surface: id, anchor: anchorNameOf(anchorEl, surfaceEl), ...position })
  }

  function handlePointerLeave() {
    pointerAnnouncedRef.current = false
    if (pointerMode) writer.hidePointer()
  }

  // ─── Highlight mode: select text to highlight it; click a highlight to remove it ────
  function handleMouseUp(event) {
    if (!highlightMode) return
    const surfaceEl = surfaceRef.current
    const mine = getInk().highlights.filter((highlight) => highlight.surface === id)
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const described = describeSelection(selection.getRangeAt(0), surfaceEl)
      selection.removeAllRanges()
      if (!described) return
      const existing = mine.find(
        (highlight) =>
          highlight.anchor === described.anchor &&
          highlight.quote === described.quote &&
          highlight.occurrence === described.occurrence
      )
      if (existing) {
        writer.removeHighlight(existing.id)
        return
      }
      writer.addHighlight({ surface: id, ...described })
      noteAnnotate(id)
      return
    }
    const hit = highlightAtPoint(surfaceEl, mine, event.clientX, event.clientY)
    if (hit) writer.removeHighlight(hit.id)
  }

  const className = [
    'live-ink-surface',
    pointerMode ? 'live-ink-surface--pointer' : '',
    highlightMode ? 'live-ink-surface--highlight' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={surfaceRef}
      className={className}
      style={style}
      data-ink-surface={id}
      onPointerMove={pointerMode ? handlePointerMove : undefined}
      onPointerLeave={pointerMode ? handlePointerLeave : undefined}
      onMouseUp={highlightMode ? handleMouseUp : undefined}
    >
      {children}
      <LiveInkOverlay surfaceId={id} surfaceRef={surfaceRef} role={role} />
      {inkMode && (
        <InkCaptureLayer
          surfaceId={id}
          surfaceRef={surfaceRef}
          writer={writer}
          onAnnotate={() => noteAnnotate(id)}
        />
      )}
    </div>
  )
}

// Ink mode only: sits over the content and takes the pointer, so a drag draws instead of
// selecting text or clicking links. The stroke is written once, on pointer-up, anchored on the
// content element under its first point; each point is pinned to the character under it where
// there is text (see strokeToInkPoints).
function InkCaptureLayer({ surfaceId, surfaceRef, writer, onAnnotate }) {
  const layerRef = useRef(null)
  const drawingRef = useRef(null)
  const [draft, setDraft] = useState(null)

  function relativePoints(points) {
    const rect = surfaceRef.current.getBoundingClientRect()
    return points.map((point) => ({ x: point.x - rect.left, y: point.y - rect.top }))
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const surfaceEl = surfaceRef.current
    if (!surfaceEl) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const start = { x: event.clientX, y: event.clientY }
    drawingRef.current = {
      anchorEl: anchorElementAtPoint(surfaceEl, start.x, start.y),
      points: [start],
    }
    setDraft(relativePoints([start]))
  }

  function handlePointerMove(event) {
    const drawing = drawingRef.current
    if (!drawing) return
    drawing.points.push({ x: event.clientX, y: event.clientY })
    setDraft(relativePoints(drawing.points))
  }

  function finish() {
    const drawing = drawingRef.current
    drawingRef.current = null
    setDraft(null)
    const surfaceEl = surfaceRef.current
    if (!drawing || !surfaceEl) return
    // The caret lookups hit-test, so this layer (on top of the text) steps aside meanwhile.
    const layer = layerRef.current
    const previousPointerEvents = layer?.style.pointerEvents ?? ''
    if (layer) layer.style.pointerEvents = 'none'
    let points
    try {
      points = strokeToInkPoints(simplifyStrokePoints(drawing.points), drawing.anchorEl)
    } finally {
      if (layer) layer.style.pointerEvents = previousPointerEvents
    }
    if (!points.length) return
    writer.addStroke({
      surface: surfaceId,
      anchor: anchorNameOf(drawing.anchorEl, surfaceEl),
      points,
    })
    onAnnotate()
  }

  return (
    <div
      ref={layerRef}
      className="live-ink-capture"
      data-live-ink-layer=""
      data-testid="live-ink-capture"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {draft && (
        <svg className="live-ink-strokes">
          <path
            className="live-ink-stroke"
            d={pointsToSvgPath(draft)}
            style={{ stroke: INK_COLOUR }}
          />
        </svg>
      )}
    </div>
  )
}
