import { useEffect, useMemo, useRef } from 'react'
import { activeTileHighlights, staleTileHighlightIds } from '../../shared/tutorTileHighlights.js'

const NONE = Object.freeze({})

/**
 * Tutor tile highlights on the student's own drag-and-drop board (src/shared/tutorTileHighlights.js).
 *
 * - `highlights`: the task's highlights (cs.tileHighlights, already filtered to the current task).
 * - `state`: the board's `{ [targetId]: tileId }` map as the student sees it now.
 * - `taskId`: the board's task; a change of task never counts as the student moving a tile.
 * - `onDismiss(ids)`: removes highlights (cs.dismissTileHighlights).
 * - `enabled`: false for a read-only board (review, Go Live viewer, leaving slide) — it draws and
 *   dismisses nothing.
 *
 * Returns `{ [targetId]: { id, tileId, note } }` for the highlights still on their tile. When the
 * student changes what a highlighted blank holds, the highlight is removed for good.
 */
export function useBoardTileHighlights({ highlights, state, taskId, onDismiss, enabled = true }) {
  const active = useMemo(
    () => (enabled && highlights?.length ? activeTileHighlights(highlights, state) : NONE),
    [enabled, highlights, state]
  )

  const previousRef = useRef({ taskId, state })
  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = { taskId, state }
    if (!enabled || !highlights?.length) return
    if (String(previous.taskId) !== String(taskId) || previous.state === state) return
    const stale = staleTileHighlightIds(highlights, previous.state, state)
    if (stale.length > 0) onDismiss?.(stale)
    // Only a change of the board (or task) is a move; a new highlight arriving is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, taskId, enabled])

  return active
}
