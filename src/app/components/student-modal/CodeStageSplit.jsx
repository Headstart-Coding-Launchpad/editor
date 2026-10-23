import React, { useState } from 'react'
import StagePane from '../../../shared/stage/StagePane.jsx'
import { useElementSize } from '../../../shared/useElementSize'

// Wide enough to put the code and the Stage side by side (request #92: the tutor couldn't read
// the code with a 240 px drawing stacked under it).
export const SIDE_BY_SIDE_MIN_WIDTH = 640

// Share of the row the Stage takes side by side, small and big.
const SIDE_SHARE = { small: 0.4, big: 0.58 }
// Stage height when stacked (narrow modal), small and big.
const STACKED_HEIGHT = { small: 240, big: 380 }
// Height of the row holding the size toggle above the Stage.
const TOGGLE_ROW = 40

/**
 * The student's code with their last run's Stage drawing, in StudentModal. Side by side when
 * the body is wide (the code keeps its full height), stacked when narrow. "Bigger picture"
 * gives the drawing more room either way. Without a drawing the code fills the space.
 */
export default function CodeStageSplit({ editor, stageResult, fitCode = false }) {
  const [ref, size] = useElementSize()
  const [big, setBig] = useState(false)

  if (!stageResult) {
    return <div style={fitCode ? { ...s.editorOnly, ...s.editorFit } : s.editorOnly}>{editor}</div>
  }

  const sideBySide = size.width >= SIDE_BY_SIDE_MIN_WIDTH
  const scale = big ? 'big' : 'small'
  // Side by side the Stage is a square: never taller than the row, never wider than its share.
  const sideStage = Math.max(
    200,
    Math.min(size.width * SIDE_SHARE[scale], size.height - TOGGLE_ROW)
  )

  return (
    <div
      ref={ref}
      style={{ ...s.split, flexDirection: sideBySide ? 'row' : 'column' }}
      data-testid="code-stage-split"
      data-layout={sideBySide ? 'side' : 'stacked'}
    >
      <div style={s.editor}>{editor}</div>
      <div
        style={
          sideBySide
            ? { ...s.stageColumn, width: sideStage }
            : { ...s.stageColumn, height: STACKED_HEIGHT[scale] }
        }
      >
        <div style={s.toggleRow}>
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.toggle}
            aria-pressed={big}
            onClick={() => setBig((on) => !on)}
          >
            {big ? 'Smaller picture' : 'Bigger picture'}
          </button>
        </div>
        <StagePane
          compact
          commands={stageResult.commands}
          truncated={stageResult.truncated}
          title="Student's stage"
          style={s.stagePane}
        />
      </div>
    </div>
  )
}

const s = {
  // Show it: the code takes the height of its lines (up to a share), the output the rest.
  editorFit: { flex: '0 1 auto', maxHeight: '55%' },
  editorOnly: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  split: { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', gap: 8 },
  editor: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  stageColumn: {
    flexShrink: 0,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  toggleRow: { display: 'flex', justifyContent: 'flex-end', flexShrink: 0, height: TOGGLE_ROW - 4 },
  toggle: { fontSize: '0.8rem', padding: '4px 10px' },
  stagePane: { flex: 1, minHeight: 0 },
}
