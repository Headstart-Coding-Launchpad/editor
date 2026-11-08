import React, { useState } from 'react'
import StagePane from '../../../shared/stage/StagePane.jsx'
import { useElementSize } from '../../../shared/useElementSize'
import { GAP, TOGGLE_ROW, stageSizes } from './stageOutputSizes'

/**
 * StudentModal's right-hand column on a Python Stage task (sketch OK'd 8 Nov 2026): the
 * "Bigger picture" toggle, the student's Stage drawing as a square, then their Output, which
 * takes the height left and scrolls inside itself. The code gets the wide middle.
 */
export default function StageOutputColumn({ stageResult, output, after = null, style }) {
  const [ref, size] = useElementSize()
  const [big, setBig] = useState(false)
  // The column's width while small is its own (CSS) width; "Bigger picture" grows from that.
  const [smallWidth, setSmallWidth] = useState(0)
  if (!big && size.width > 0 && size.width !== smallWidth) setSmallWidth(size.width)
  const { stage } = stageSizes({ width: smallWidth, height: size.height, big })
  const measured = smallWidth > 0

  return (
    <div
      ref={ref}
      style={{ ...style, ...(big && measured ? { width: stage } : {}) }}
      data-testid="student-modal-output-column"
      data-stage="above-output"
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
      <div style={measured ? { ...s.stage, height: stage } : { ...s.stage, aspectRatio: '1' }}>
        <StagePane
          compact
          commands={stageResult.commands}
          truncated={stageResult.truncated}
          title="Student's stage"
          style={s.stagePane}
        />
      </div>
      <div style={s.output}>{output}</div>
      {after}
    </div>
  )
}

const s = {
  toggleRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexShrink: 0,
    height: TOGGLE_ROW - GAP,
  },
  toggle: { fontSize: '0.8rem', padding: '4px 10px' },
  // The Stage never gives up height to the Output.
  stage: { flexShrink: 0, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' },
  stagePane: { flex: 1, minHeight: 0 },
  output: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
}
