import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getProgressItems } from '../../shared/taskUtils'

const DOT_WIDTH = 32
const DOT_GAP = 6

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
// answer may no longer hold.
export default function TaskProgressDots({ tasks, currentTaskId, viewingTaskId, onDotClick, isSolo, canSelectTask, pseudoTask }) {
  const rowRef = useRef(null)
  const baseItems = getProgressItems(tasks)
  const pseudoIndex = pseudoTask ? baseItems.findIndex(item => item.taskIds.includes(pseudoTask.beforeTaskId)) : -1
  const items = pseudoIndex === -1 ? baseItems : [
    ...baseItems.slice(0, pseudoIndex),
    { type: 'task', id: pseudoTask.id, title: pseudoTask.title, taskIds: [pseudoTask.id], isPseudo: true },
    ...baseItems.slice(pseudoIndex),
  ]
  const naturalWidth = items.length * (DOT_WIDTH + DOT_GAP) - DOT_GAP
  const [mode, setMode] = useState('probing') // 'probing' | 'fits' | 'collapsed'

  useLayoutEffect(() => {
    if (mode !== 'probing') return
    const width = rowRef.current?.getBoundingClientRect().width ?? 0
    setMode(width >= naturalWidth ? 'fits' : 'collapsed')
  }, [mode, naturalWidth])

  useEffect(() => {
    setMode('probing')
  }, [naturalWidth])

  useEffect(() => {
    const reopen = () => setMode('probing')
    window.addEventListener('resize', reopen)
    return () => window.removeEventListener('resize', reopen)
  }, [])

  const currentIndex = items.findIndex(item => item.taskIds.includes(currentTaskId))
  const currentNumber = Math.max(1, currentIndex + 1)

  if (mode === 'collapsed') {
    return (
      <span style={s.counter} title="Task progress">
        {currentNumber}/{items.length}
      </span>
    )
  }

  return (
    <div ref={rowRef} style={{ ...s.row, visibility: mode === 'fits' ? 'visible' : 'hidden' }} title="Task progress">
      {items.map((item, index) => {
        // A pseudo item (the "explainer shrunk" nav entry) has a synthetic id that
        // doesn't participate in the real task-id ordering the past/future checks
        // below rely on, and it's always freely viewable (read-only content for a
        // task the student already unlocked), so it skips both.
        if (item.isPseudo) {
          const isViewing = viewingTaskId != null && item.taskIds.includes(viewingTaskId)
          return (
            <button
              key={item.id}
              style={{ ...s.dot, ...s.dotPseudo, ...(isViewing ? s.dotViewing : {}), cursor: 'pointer' }}
              onClick={() => onDotClick?.(item.id)}
              title={`Explainer: ${item.title}`}
              aria-label={`Explainer: ${item.title}`}
            >
              ⓘ
            </button>
          )
        }

        const isCurrent = item.taskIds.includes(currentTaskId)
        const isViewing = viewingTaskId != null && item.taskIds.includes(viewingTaskId)
        const isPast = item.taskIds.every(id => id < currentTaskId)
        const isFuture = item.taskIds.every(id => id > currentTaskId)
        const firstTaskId = item.taskIds[0]
        const clickable = isPast || (isSolo && (canSelectTask ? canSelectTask(firstTaskId) : true))
        const isGroup = item.type === 'group'

        return (
          <button
            key={item.id}
            style={{
              ...s.dot,
              ...(isGroup ? s.dotGroup : {}),
              ...(isCurrent  ? s.dotCurrent  : {}),
              ...(isViewing  ? s.dotViewing  : {}),
              ...(isPast     ? s.dotPast     : {}),
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
    </div>
  )
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
  counter: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#fff',
    opacity: 0.9,
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.5)',
    background: 'transparent',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.8rem',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
  },
  dotGroup: {
    borderRadius: 8,
    width: 36,
  },
  dotPseudo: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.08)',
    fontSize: '1rem',
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
