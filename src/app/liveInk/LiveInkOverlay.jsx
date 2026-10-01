import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { prefersReducedMotion } from '../../shared/motion'
import { useLiveInkData } from './liveInkContext'
import {
  findAnchorElement,
  findScrollContainer,
  offscreenDirection,
  rangeClientRects,
  resolveHighlightRange,
  resolveInkPoint,
  resolveInkStroke,
  segmentsToSvgPath,
} from './geometry'
import { RECENT_MARK_MS, STROKE_FADE_MS, STROKE_HOLD_MS, inkForSurface } from './liveInkData'

const HIGHLIGHT_NAME = 'live-ink-highlight'
const POINTER_EASE = 0.35

// ─── CSS Custom Highlight API registry ────────────────────────────────────────
// One named highlight for the whole page; each surface contributes its ranges. It paints
// straight onto the text (so it follows reflow) without touching React's DOM.
const highlightRegistry = new Map()

function supportsHighlightApi() {
  return (
    typeof CSS !== 'undefined' &&
    !!CSS.highlights &&
    typeof CSS.highlights.set === 'function' &&
    typeof globalThis.Highlight === 'function'
  )
}

function syncHighlightRegistry() {
  if (!supportsHighlightApi()) return
  const ranges = [...highlightRegistry.values()].flat()
  if (ranges.length) CSS.highlights.set(HIGHLIGHT_NAME, new globalThis.Highlight(...ranges))
  else CSS.highlights.delete(HIGHLIGHT_NAME)
}

// Bumps a counter whenever the surface's size or content changes (images loading, reflow,
// a re-render swapping text nodes), so positions are measured again.
function useLayoutTick(surfaceRef) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const surfaceEl = surfaceRef.current
    if (!surfaceEl) return
    let frame = 0
    const bump = () => {
      if (frame) return
      const schedule =
        typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout
      frame = schedule(() => {
        frame = 0
        setTick((value) => value + 1)
      })
    }
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(bump) : null
    resizeObserver?.observe(surfaceEl)
    // The annotation layers live inside the surface too; their own changes are not content.
    const onMutations = (records) => {
      const contentChanged = records.some((record) => {
        const el = record.target.nodeType === 1 ? record.target : record.target.parentElement
        return !el?.closest?.('[data-live-ink-layer]')
      })
      if (contentChanged) bump()
    }
    const mutationObserver =
      typeof MutationObserver === 'function' ? new MutationObserver(onMutations) : null
    mutationObserver?.observe(surfaceEl, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', bump)
    return () => {
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', bump)
      if (frame)
        (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout)(frame)
    }
  }, [surfaceRef])
  return tick
}

function PointerDot({ x, y, reduced }) {
  const elRef = useRef(null)
  const posRef = useRef(null)
  const targetRef = useRef({ x, y })
  const frameRef = useRef(0)

  useLayoutEffect(() => {
    targetRef.current = { x, y }
    const el = elRef.current
    if (!el) return
    const apply = (point) => {
      el.style.transform = `translate(${point.x}px, ${point.y}px)`
    }
    // Light smoothing between the ~12Hz updates; reduced motion (and the first position) jumps.
    if (reduced || !posRef.current || typeof requestAnimationFrame !== 'function') {
      posRef.current = { x, y }
      apply(posRef.current)
      return
    }
    if (frameRef.current) return
    const step = () => {
      const target = targetRef.current
      const pos = posRef.current
      const next = {
        x: pos.x + (target.x - pos.x) * POINTER_EASE,
        y: pos.y + (target.y - pos.y) * POINTER_EASE,
      }
      if (Math.hypot(target.x - next.x, target.y - next.y) < 0.5) {
        posRef.current = target
        apply(target)
        frameRef.current = 0
        return
      }
      posRef.current = next
      apply(next)
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [x, y, reduced])

  useEffect(
    () => () => {
      if (frameRef.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameRef.current)
      }
    },
    []
  )

  return (
    <div
      ref={elRef}
      className="live-ink-pointer"
      data-testid="live-ink-pointer"
      data-x={Math.round(x)}
      data-y={Math.round(y)}
    />
  )
}

function EdgeChip({ chip, onJump }) {
  if (!chip || typeof document === 'undefined') return null
  const { direction, view } = chip
  const style = {
    left: view.left + view.width / 2,
    ...(direction === 'above'
      ? { top: view.top + 8 }
      : { top: Math.max(view.top + 8, view.bottom - 46) }),
  }
  return createPortal(
    <button
      type="button"
      className="live-ink-chip"
      style={style}
      onClick={onJump}
      data-testid="live-ink-chip"
    >
      <span aria-hidden="true">👆</span> Teacher is pointing here{' '}
      <span aria-hidden="true">{direction === 'above' ? '↑' : '↓'}</span>
    </button>,
    document.body
  )
}

const EMPTY_LAYOUT = Object.freeze({
  pointer: null,
  strokes: [],
  highlightRects: [],
  chipTarget: null,
  chipExpiresAt: null,
})

// Draws the live annotations that belong to one surface, over its content. Pointer-events
// pass straight through, so students (and the teacher outside ink mode) click the content as
// normal. `role === 'student'` adds the off-screen edge chip.
export default function LiveInkOverlay({ surfaceId, surfaceRef, role }) {
  const ink = useLiveInkData()
  const mine = useMemo(() => inkForSurface(ink, surfaceId), [ink, surfaceId])
  const layoutTick = useLayoutTick(surfaceRef)
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const useHighlightApi = useMemo(() => supportsHighlightApi(), [])

  // Fades run on each screen's own clock, from when the mark first arrived here, so clock
  // differences between the teacher's and students' machines don't matter.
  const seenRef = useRef(new Map())
  const firstSeen = (id) => {
    if (!seenRef.current.has(id)) seenRef.current.set(id, Date.now())
    return seenRef.current.get(id)
  }
  const [now, setNow] = useState(() => Date.now())
  const strokeLife = STROKE_HOLD_MS + STROKE_FADE_MS
  const visibleStrokes = mine.strokes.filter((stroke) => firstSeen(stroke.id) + strokeLife > now)
  mine.highlights.forEach((highlight) => firstSeen(highlight.id))
  const visibleStrokeKey = visibleStrokes.map((stroke) => stroke.id).join(',')

  // Wake up when the next visible stroke is due to disappear.
  useEffect(() => {
    if (!visibleStrokes.length) return
    const nextExpiry = Math.min(
      ...visibleStrokes.map((stroke) => seenRef.current.get(stroke.id) + strokeLife)
    )
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 20)
    return () => clearTimeout(timer)
    // visibleStrokeKey stands in for visibleStrokes, rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStrokeKey, now])

  // Resolved strokes (surface-relative segments), per stroke id. Strokes never change once
  // written, so an entry only goes stale when the layout does (layoutTick: resize, reflow,
  // content changes) - not on every ~12Hz pointer update.
  const strokeCacheRef = useRef({ tick: -1, byId: new Map() })

  const [layout, setLayout] = useState(EMPTY_LAYOUT)
  useLayoutEffect(() => {
    const surfaceEl = surfaceRef.current
    if (!surfaceEl) return
    const surfaceRect = surfaceEl.getBoundingClientRect()
    const relative = (point) => ({ x: point.x - surfaceRect.left, y: point.y - surfaceRect.top })

    let pointer = null
    if (mine.pointer) {
      const anchorEl = findAnchorElement(surfaceEl, mine.pointer.anchor)
      const point =
        anchorEl && resolveInkPoint(anchorEl, anchorEl.getBoundingClientRect(), mine.pointer)
      if (point) pointer = relative(point)
    }

    const cache = strokeCacheRef.current
    if (cache.tick !== layoutTick) {
      cache.tick = layoutTick
      cache.byId = new Map()
    }
    const strokes = []
    const liveIds = new Set()
    for (const stroke of visibleStrokes) {
      liveIds.add(stroke.id)
      let resolved = cache.byId.get(stroke.id)
      if (!resolved) {
        const anchorEl = findAnchorElement(surfaceEl, stroke.anchor)
        // Text-anchored points follow their words; a stroke whose words now wrap onto two
        // lines is drawn as separate segments rather than a line across the paragraph.
        const segments = anchorEl
          ? resolveInkStroke(anchorEl, stroke.points).map((segment) => segment.map(relative))
          : []
        resolved = { segments, points: segments.flat(), d: segmentsToSvgPath(segments) }
        // An anchor that isn't rendered yet is retried on the next pass.
        if (anchorEl) cache.byId.set(stroke.id, resolved)
      }
      if (!resolved.points.length) continue
      strokes.push({ id: stroke.id, colour: stroke.colour, d: resolved.d, points: resolved.points })
    }
    for (const id of cache.byId.keys()) if (!liveIds.has(id)) cache.byId.delete(id)

    const highlightRects = []
    const ranges = []
    const highlightTops = new Map()
    for (const highlight of mine.highlights) {
      const range = resolveHighlightRange(surfaceEl, highlight)
      if (!range) continue
      ranges.push(range)
      const rects = rangeClientRects(range)
      if (rects.length)
        highlightTops.set(highlight.id, relative({ x: rects[0].left, y: rects[0].top }))
      if (!useHighlightApi) {
        rects.forEach((rect, index) => {
          const topLeft = relative({ x: rect.left, y: rect.top })
          highlightRects.push({
            key: `${highlight.id}-${index}`,
            highlightId: highlight.id,
            left: topLeft.x,
            top: topLeft.y,
            width: rect.width,
            height: rect.height,
          })
        })
      }
    }
    if (useHighlightApi) {
      if (ranges.length) highlightRegistry.set(surfaceId, ranges)
      else highlightRegistry.delete(surfaceId)
      syncHighlightRegistry()
    }

    // The off-screen chip follows the live pointer, else the newest recent stroke/highlight.
    let chipTarget = pointer
    let chipExpiresAt = null
    if (!chipTarget) {
      const recentCutoff = Date.now() - RECENT_MARK_MS
      const recent = [
        ...strokes.map((stroke) => ({ id: stroke.id, point: stroke.points[0] })),
        ...[...highlightTops].map(([id, point]) => ({ id, point })),
      ]
        .map((mark) => ({ ...mark, seen: seenRef.current.get(mark.id) ?? 0 }))
        .filter((mark) => mark.seen >= recentCutoff)
        .sort((a, b) => b.seen - a.seen)
      chipTarget = recent[0]?.point ?? null
      chipExpiresAt = recent[0] ? recent[0].seen + RECENT_MARK_MS : null
    }

    setLayout({ pointer, strokes, highlightRects, chipTarget, chipExpiresAt })
    // mine/visibleStrokeKey/layoutTick/now are the inputs that matter; visibleStrokes is derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, visibleStrokeKey, layoutTick, now, surfaceId, useHighlightApi])

  // A chip pointing at a recent mark (not the live pointer) goes once the mark stops being recent.
  const chipExpiresAt = layout.chipExpiresAt
  useEffect(() => {
    if (chipExpiresAt == null) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, chipExpiresAt - Date.now()) + 20)
    return () => clearTimeout(timer)
  }, [chipExpiresAt])

  useEffect(
    () => () => {
      if (highlightRegistry.delete(surfaceId)) syncHighlightRegistry()
    },
    [surfaceId]
  )

  // ─── Off-screen edge chip (students only; never auto-scrolls) ───────────────
  const [chip, setChip] = useState(null)
  const chipY = layout.chipTarget ? Math.round(layout.chipTarget.y) : null
  const containerRef = useRef(null)
  useEffect(() => {
    const surfaceEl = surfaceRef.current
    if (role !== 'student' || chipY == null || !surfaceEl) {
      setChip(null)
      return
    }
    const container = findScrollContainer(surfaceEl)
    containerRef.current = container
    const update = () => {
      const surfaceRect = surfaceEl.getBoundingClientRect()
      const y = surfaceRect.top + chipY
      const viewRect = container
        ? container.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight, left: 0, width: window.innerWidth }
      const view = {
        top: viewRect.top,
        bottom: viewRect.bottom,
        left: viewRect.left,
        width: viewRect.width,
      }
      const direction = offscreenDirection({ top: y, bottom: y }, view)
      setChip((current) => {
        if (direction === 'visible') return null
        if (
          current &&
          current.direction === direction &&
          current.y === y &&
          current.view.top === view.top &&
          current.view.bottom === view.bottom &&
          current.view.left === view.left &&
          current.view.width === view.width
        ) {
          return current
        }
        return { direction, view, y }
      })
    }
    update()
    const scrollTarget = container ?? window
    scrollTarget.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      scrollTarget.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [role, chipY, layoutTick, surfaceRef])

  function handleJump() {
    if (!chip) return
    const container = containerRef.current
    const offset = chip.y - (chip.view.top + (chip.view.bottom - chip.view.top) / 3)
    const behavior = reduced ? 'auto' : 'smooth'
    if (container) container.scrollBy?.({ top: offset, behavior })
    else window.scrollBy?.({ top: offset, behavior })
  }

  return (
    <>
      <div className="live-ink-overlay" data-live-ink-layer="" aria-hidden="true">
        {layout.highlightRects.map((rect) => (
          <div
            key={rect.key}
            className="live-ink-highlight-rect"
            data-highlight-id={rect.highlightId}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        ))}
        {layout.strokes.length > 0 && (
          <svg className="live-ink-strokes">
            {layout.strokes.map((stroke) => (
              <path
                key={stroke.id}
                d={stroke.d}
                data-stroke-id={stroke.id}
                className={reduced ? 'live-ink-stroke' : 'live-ink-stroke live-ink-stroke--fading'}
                style={{ stroke: stroke.colour }}
              />
            ))}
          </svg>
        )}
        {layout.pointer && (
          <PointerDot x={layout.pointer.x} y={layout.pointer.y} reduced={reduced} />
        )}
      </div>
      {role === 'student' && <EdgeChip chip={chip} onJump={handleJump} />}
    </>
  )
}
