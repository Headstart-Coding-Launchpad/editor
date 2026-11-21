import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getProgressItems } from '../../shared/taskUtils'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'
import { useIsMobile } from '../../shared/useIsMobile'

const DOT_WIDTH = 32
const DOT_GAP = 6
// `compact` (the student top bar's one-row layout): smaller dots, and when they don't all fit
// the row scrolls sideways (the current dot kept in view) rather than wrapping the bar.
const COMPACT_DOT_WIDTH = 26
const COMPACT_DOT_GAP = 4
// On a touch device (a tablet) the compact dots stay finger-sized.
const TOUCH_DOT_WIDTH = 34
const TOUCH_DOT_GAP = 6
// Compact row padding (room for the current dot's scale(1.15) inside a clipping row).
const COMPACT_PAD = 3
// Width of the fade at a scrolling row's edge: the sign that there are more dots that way.
const FADE_PX = 18
// Below this many dots' worth of room, scrolling stops being useful: show the "x/y" counter.
const MIN_SCROLL_DOTS = 5
// Calm screens (21 Nov 2026): under NARROW_BELOW px wide a compact row that does not fit shows a
// window of WINDOW_DOTS whole dots round the current one, and a 44px "+N" chip (.task-dots-chip)
// on each side that hides dots; a chip pages the window. No scrolling, no fade.
const NARROW_BELOW = 900
const WINDOW_DOTS = 5
const CHIP = 44

// Fitting the dots is a two-phase measurement, not something CSS can decide alone:
// a flex item's "natural" size (used to divide space with its siblings, e.g. the
// lesson title) is based on its content, so an invisible-but-still-present row of
// dots would keep claiming its full width forever and the title would never get
// that space back. So instead: mount the (possibly-too-wide) row hidden to measure
// it via a synchronous layout read (no ResizeObserver — an async measurement could
// fire after we've already swapped away from the probing row's DOM, acting on stale
// data and getting stuck), then commit to either the dots or the compact counter —
// dropping the dots from layout in counter mode, so the title can reclaim the freed
// space. A window resize (or the task count changing) reopens the probe, since the
// answer may no longer hold. In `compact` mode there's a middle answer: when the row has room for
// at least MIN_SCROLL_DOTS dots but not all of them, it stays mounted and scrolls sideways.
export default function TaskProgressDots({
  tasks,
  currentTaskId,
  viewingTaskId,
  onDotClick,
  isSolo,
  canSelectTask,
  compact = false,
}) {
  const rowRef = useRef(null)
  const touch = useIsTouchDevice()
  const dotWidth = compact ? (touch ? TOUCH_DOT_WIDTH : COMPACT_DOT_WIDTH) : DOT_WIDTH
  const dotGap = compact ? (touch ? TOUCH_DOT_GAP : COMPACT_DOT_GAP) : DOT_GAP
  const step = dotWidth + dotGap
  const items = getProgressItems(tasks)
  const pad = compact ? COMPACT_PAD * 2 : 0
  const naturalWidth = items.length * step - dotGap + pad
  const minScrollWidth = Math.min(naturalWidth, MIN_SCROLL_DOTS * step - dotGap)
  const narrow = useIsMobile(NARROW_BELOW) && compact && items.length > WINDOW_DOTS
  const windowWidth = WINDOW_DOTS * step + 2 * (CHIP + dotGap) - dotGap + pad
  const [mode, setMode] = useState('probing') // 'probing' | 'fits' | 'window' | 'scroll' | 'collapsed'
  // Scroll mode: the row is narrowed to a whole number of dots, so none is cut in half.
  const [scrollWidth, setScrollWidth] = useState(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useLayoutEffect(() => {
    if (mode !== 'probing') return
    const width = rowRef.current?.getBoundingClientRect().width ?? 0
    if (width >= naturalWidth) setMode('fits')
    else if (narrow && width >= windowWidth) setMode('window')
    else if (compact && width >= minScrollWidth) {
      const wholeDots = Math.max(1, Math.floor((width - pad + dotGap) / step))
      setScrollWidth(wholeDots * step - dotGap + pad)
      setMode('scroll')
    } else setMode('collapsed')
  }, [mode, naturalWidth, minScrollWidth, compact, pad, dotGap, step, narrow, windowWidth])

  useEffect(() => {
    setMode('probing')
  }, [naturalWidth, narrow])

  useEffect(() => {
    const reopen = () => setMode('probing')
    window.addEventListener('resize', reopen)
    return () => window.removeEventListener('resize', reopen)
  }, [])

  const currentIndex = items.findIndex((item) => item.taskIds.includes(currentTaskId))
  const currentNumber = Math.max(1, currentIndex + 1)
  // The dot to keep in view: the one being looked at (solo browsing, the explainer entry), else
  // the current task.
  const viewingIndex =
    viewingTaskId != null ? items.findIndex((item) => item.taskIds.includes(viewingTaskId)) : -1
  const focusIndex = viewingIndex !== -1 ? viewingIndex : currentIndex
  // Window mode: the first dot shown, centred on the focus dot until a chip pages it.
  const [paged, setPaged] = useState(null)
  useEffect(() => setPaged(null), [focusIndex])
  const lastStart = Math.max(0, items.length - WINDOW_DOTS)
  const start = paged ?? Math.min(lastStart, Math.max(0, focusIndex - 2))
  const shown = mode === 'window' ? [start, start + WINDOW_DOTS] : [0, items.length]
  const chip = (side, hidden, to) => (
    <button
      key={side}
      type="button"
      className="task-dots-chip"
      aria-label={`Show ${hidden} ${side} tasks`}
      onClick={() => setPaged(Math.min(lastStart, Math.max(0, to)))}
    >
      {side === 'earlier' ? `‹+${hidden}` : `+${hidden}›`}
    </button>
  )

  const updateEdges = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    const max = row.scrollWidth - row.clientWidth
    const next = { left: row.scrollLeft > 1, right: row.scrollLeft < max - 1 }
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  // Scrolling row: keep the focus dot in view (centred where possible), on entering scroll mode
  // and whenever the task changes. The dot's position is measured against the row itself (an
  // earlier version used offsetLeft, which is relative to the nearest positioned ancestor, not
  // the row, so it scrolled to the far end). The offset is rounded to whole dots so the row
  // never shows half a dot.
  useLayoutEffect(() => {
    if (mode !== 'scroll') return
    const row = rowRef.current
    const dot = row?.children?.[focusIndex]
    if (!row || !dot) return
    const dotLeft =
      dot.getBoundingClientRect().left -
      row.getBoundingClientRect().left +
      row.scrollLeft -
      (compact ? COMPACT_PAD : 0)
    const centred = dotLeft - (row.clientWidth - dotWidth) / 2
    const max = Math.max(0, row.scrollWidth - row.clientWidth)
    row.scrollLeft = Math.min(max, Math.max(0, Math.round(centred / step) * step))
    updateEdges()
  }, [mode, focusIndex, scrollWidth, step, dotWidth, compact, updateEdges])

  if (mode === 'collapsed') {
    return (
      <span className="task-dots-counter" title="Task progress">
        {currentNumber}/{items.length}
      </span>
    )
  }

  return (
    <div
      ref={rowRef}
      style={{
        ...s.row,
        gap: dotGap,
        ...(compact ? s.rowCompact : null),
        ...(mode === 'scroll' ? s.rowScroll : null),
        ...(mode === 'scroll' && scrollWidth != null ? { maxWidth: scrollWidth } : null),
        ...(mode === 'scroll' ? fadeMask(edges) : null),
        visibility: mode === 'probing' ? 'hidden' : 'visible',
      }}
      title="Task progress"
      data-mode={mode}
      data-fade-left={mode === 'scroll' && edges.left ? 'true' : undefined}
      data-fade-right={mode === 'scroll' && edges.right ? 'true' : undefined}
      onScroll={mode === 'scroll' ? updateEdges : undefined}
    >
      {mode === 'window' && start > 0 && chip('earlier', start, start - WINDOW_DOTS)}
      {items.slice(...shown).map((item, i) => {
        const index = i + shown[0]
        const isCurrent = item.taskIds.includes(currentTaskId)
        const isViewing = viewingTaskId != null && item.taskIds.includes(viewingTaskId)
        const isPast = item.taskIds.every((id) => id < currentTaskId)
        const isFuture = item.taskIds.every((id) => id > currentTaskId)
        const firstTaskId = item.taskIds[0]
        const clickable = isPast || (isSolo && (canSelectTask ? canSelectTask(firstTaskId) : true))
        const isGroup = item.type === 'group'

        return (
          <button
            key={item.id}
            className="task-dot"
            style={{
              ...(compact ? compactDot(dotWidth, touch) : null),
              ...(mode === 'scroll' ? s.dotSnap : null),
              ...(isGroup ? (compact ? { borderRadius: 7, width: dotWidth + 4 } : s.dotGroup) : {}),
              ...(isCurrent ? s.dotCurrent : {}),
              ...(isViewing ? s.dotViewing : {}),
              ...(isPast ? s.dotPast : {}),
              ...(!isSolo && isFuture ? s.dotFuture : {}),
              cursor: clickable ? 'pointer' : 'default',
            }}
            onClick={() => clickable && onDotClick?.(firstTaskId)}
            title={item.title}
            aria-label={item.title}
            disabled={!clickable}
          >
            {isPast ? '✓' : index + 1}
          </button>
        )
      })}
      {mode === 'window' &&
        shown[1] < items.length &&
        chip('later', items.length - shown[1], start + WINDOW_DOTS)}
    </div>
  )
}

function compactDot(width, touch) {
  return { width, height: width, fontSize: touch ? '0.85rem' : '0.72rem' }
}

// Fades the edge(s) of a scrolling row that have more dots beyond them.
function fadeMask({ left, right }) {
  if (!left && !right) return null
  const start = left ? `transparent 0, #000 ${FADE_PX}px` : '#000 0'
  const end = right ? `#000 calc(100% - ${FADE_PX}px), transparent 100%` : '#000 100%'
  const mask = `linear-gradient(to right, ${start}, ${end})`
  return { maskImage: mask, WebkitMaskImage: mask }
}

const s = {
  row: {
    display: 'flex',
    gap: DOT_GAP,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
    flexShrink: 1,
  },
  rowCompact: {
    // Room for the current dot's scale(1.15) inside a row that may clip (scroll mode).
    padding: `${COMPACT_PAD}px ${COMPACT_PAD}px`,
  },
  rowScroll: {
    overflowX: 'auto',
    overflowY: 'hidden',
    justifyContent: 'flex-start',
    scrollbarWidth: 'none',
    // Swiping lands on a whole dot, never half of one.
    scrollSnapType: 'x mandatory',
    scrollPaddingLeft: COMPACT_PAD,
  },
  dotSnap: {
    scrollSnapAlign: 'start',
  },
  dotGroup: {
    borderRadius: 8,
    width: 36,
  },
  dotCurrent: {
    background: 'var(--colour-secondary)',
    borderColor: 'var(--colour-secondary)',
    color: '#fff',
    transform: 'scale(1.15)',
  },
  dotViewing: {
    background: 'rgba(239,68,68,0.5)',
    borderColor: '#ef4444',
  },
  dotPast: {
    background: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  dotFuture: {
    opacity: 0.4,
  },
}
