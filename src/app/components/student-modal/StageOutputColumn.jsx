import React, { useCallback, useRef, useState } from 'react'
import StagePane from '../../../shared/stage/StagePane.jsx'
import { useElementSize } from '../../../shared/useElementSize'
import { GAP, TOGGLE_ROW, columnWidths, stageSizes } from './stageOutputSizes'

// The width the row has for the code column and this column together: the row's content
// width less its other in-flow children and the gaps. Read from the DOM, never during render.
function rowRoom(row, self) {
  const cs = getComputedStyle(row)
  const inner =
    row.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
  const kids = [...row.children].filter((kid) => {
    const position = getComputedStyle(kid).position
    return position !== 'absolute' && position !== 'fixed'
  })
  const code = self.previousElementSibling
  let others = 0
  for (const kid of kids) {
    if (kid !== self && kid !== code) others += kid.getBoundingClientRect().width
  }
  const gap = parseFloat(cs.columnGap) || 0
  return Math.max(0, Math.round(inner - others - gap * Math.max(0, kids.length - 1)))
}

/**
 * StudentModal's right-hand column on a Python Stage task (sketch OK'd 8 Nov 2026): the
 * "Bigger picture" toggle, the student's Stage drawing as a square, then their Output, which
 * takes the height left (at least OUTPUT_FLOOR) and scrolls inside itself. The code gets the
 * wide middle.
 */
export default function StageOutputColumn({ stageResult, output, after = null, style }) {
  const [sizeRef, size] = useElementSize()
  const [big, setBig] = useState(false)
  // The room in the ROW (code + this column), so both widths follow window resizes and the
  // instructions folding, big or small. Re-measured whenever the row or a child resizes.
  const [free, setFree] = useState(0)
  const observer = useRef(null)
  const ref = useCallback(
    (node) => {
      sizeRef(node)
      observer.current?.disconnect()
      observer.current = null
      const row = node?.parentElement
      if (!row || typeof ResizeObserver === 'undefined') return
      const obs = new ResizeObserver(() => {
        if (node.isConnected) setFree(rowRoom(row, node))
      })
      obs.observe(row)
      for (const kid of row.children) obs.observe(kid)
      observer.current = obs
    },
    [sizeRef]
  )
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const widths = columnWidths({ free, viewportWidth })
  const measured = size.height > 0 && free > 0
  const { stage } = stageSizes({
    width: widths.small,
    height: size.height,
    big,
    bigWidth: widths.big,
  })
  const columnWidth = big ? Math.max(widths.small, stage) : null

  return (
    <div
      ref={ref}
      style={{ ...style, ...(measured && columnWidth ? { width: columnWidth } : {}) }}
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
      <div
        style={
          measured
            ? { ...s.stage, width: stage, height: stage, alignSelf: 'center' }
            : { ...s.stage, aspectRatio: '1' }
        }
      >
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
  // A square, sized by stageSizes: the Output keeps its floor below it.
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
