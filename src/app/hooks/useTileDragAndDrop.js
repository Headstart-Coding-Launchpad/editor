import { useState } from 'react'

const DRAG_MIME = 'application/x-headstart-quiz-tile'

export function readDraggedTileId(event) {
  return event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain')
}

export function writeDraggedTileId(event, tileId) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(DRAG_MIME, tileId)
  event.dataTransfer.setData('text/plain', tileId)
}

export function setLiftedDragImage(event, label) {
  const dragImage = document.createElement('div')
  dragImage.textContent = label
  Object.assign(dragImage.style, {
    position: 'fixed',
    top: '-1000px',
    left: '-1000px',
    maxWidth: '280px',
    padding: '12px 22px',
    border: '3px solid var(--colour-primary)',
    borderRadius: '8px',
    background: 'var(--colour-primary)',
    color: '#fff',
    boxShadow: '0 18px 42px rgba(35, 18, 76, 0.36), 0 0 0 5px rgba(251, 165, 4, 0.25)',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: '700',
    lineHeight: '1.35',
    transform: 'rotate(-3deg) scale(1.08)',
    zIndex: '99999',
    pointerEvents: 'none',
    whiteSpace: 'normal',
  })
  document.body.appendChild(dragImage)
  const rect = dragImage.getBoundingClientRect()
  event.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2)
  window.setTimeout(() => dragImage.remove(), 0)
}

export function removeTileFromState(state, tileId) {
  const next = { ...state }
  const existingSlot = Object.keys(next).find(k => next[k] === tileId)
  if (existingSlot) delete next[existingSlot]
  return next
}

/**
 * Shared drag-and-drop + tap-to-place logic for MatchQuiz and FillBlankQuiz.
 *
 * @param {object} config
 * @param {boolean} config.blocked        - Whether all interaction is locked (disabled || checkPassed)
 * @param {boolean} [config.dragEnabled]  - False in fill-blank type mode; defaults to true
 * @param {function} config.getLabelForTile - Returns display text for a tile ID (used for drag image)
 *
 * Returns state and handlers. Handlers that mutate the slot map require `state`
 * and `publishState` passed at call time (handleTargetClick, handleTargetDrop,
 * handlePoolDrop) so they always operate on the freshest values.
 */
export function useTileDragAndDrop({ blocked, dragEnabled = true, getLabelForTile, onDragStart, onDragEnd }) {
  const [draggingTile, setDraggingTile] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null)
  const [touchSelectedTile, setTouchSelectedTile] = useState(null)

  function handleDragStart(event, tileId) {
    if (!dragEnabled || blocked) return
    setTouchSelectedTile(null)
    writeDraggedTileId(event, tileId)
    setLiftedDragImage(event, getLabelForTile(tileId))
    setDraggingTile(tileId)
    onDragStart?.(event, tileId)
  }

  function handleDragEnd() {
    setDraggingTile(null)
    setDragOverTarget(null)
    onDragEnd?.()
  }

  function handleTileClick(tileId) {
    if (!dragEnabled || blocked) return
    setTouchSelectedTile(prev => (prev === tileId ? null : tileId))
  }

  function handleTargetClick(targetId, state, publishState) {
    if (!dragEnabled || blocked) return
    if (touchSelectedTile) {
      const next = removeTileFromState(state, touchSelectedTile)
      next[targetId] = touchSelectedTile
      setTouchSelectedTile(null)
      publishState(next)
    } else {
      const placedId = state[targetId]
      if (placedId) {
        setTouchSelectedTile(placedId)
        publishState(removeTileFromState(state, placedId))
      }
    }
  }

  function handleTargetDragOver(event, targetId) {
    if (!dragEnabled || blocked) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetId)
  }

  function clearDragOver() {
    setDragOverTarget(null)
  }

  function handleTargetDrop(event, targetId, state, publishState) {
    event.preventDefault()
    if (!dragEnabled || blocked) return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    const next = removeTileFromState(state, tileId)
    next[targetId] = tileId
    setDraggingTile(null)
    setDragOverTarget(null)
    publishState(next)
  }

  function handlePoolDragOver(event) {
    if (!dragEnabled || blocked) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handlePoolDrop(event, state, publishState) {
    event.preventDefault()
    if (!dragEnabled || blocked) return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    setDraggingTile(null)
    setDragOverTarget(null)
    publishState(removeTileFromState(state, tileId))
  }

  return {
    draggingTile,
    dragOverTarget,
    touchSelectedTile,
    handleDragStart,
    handleDragEnd,
    handleTileClick,
    handleTargetClick,
    handleTargetDragOver,
    clearDragOver,
    handleTargetDrop,
    handlePoolDragOver,
    handlePoolDrop,
  }
}
