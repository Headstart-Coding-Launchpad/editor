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

// Stops watching the row (the ResizeObserver and the MutationObserver).
function stop(watching) {
  watching.current?.resize.disconnect()
  watching.current?.mutation?.disconnect()
  watching.current = null
}

/**
 * StudentModal's right-hand column on a Python code task (sketch OK'd 8 Nov 2026). When the
 * last run drew (`stageResult`): the "Bigger picture" toggle, the student's Stage drawing as a
 * square, then their Output, which takes the height left (at least OUTPUT_FLOOR) and scrolls
 * inside itself. With no drawing it is the Output only. The same element either way, so the
 * Output and the name tags (`after`) keep their state when a drawing comes or goes.
 */
export default function StageOutputColumn({ stageResult = null, output, after = null, style }) {
  const [sizeRef, size] = useElementSize()
  const [big, setBig] = useState(false)
  // The room in the ROW (code + this column), so both widths follow window resizes and the
  // instructions folding, big or small. Re-measured whenever the row or a child resizes, and
  // when the row gains or loses a child (a hint, the instructions rail).
  const [free, setFree] = useState(0)
  // The height the name tags want (their content, not their capped box).
  const [afterHeight, setAfterHeight] = useState(0)
  const afterRef = useRef(null)
  const watching = useRef(null)
  const ref = useCallback(
    (node) => {
      sizeRef(node)
      if (!node) {
        // React passes null without saying which node left: only stop once the watched node
        // has really gone (as useElementSize does), not when a second copy unmounts.
        queueMicrotask(() => {
          if (watching.current && !watching.current.node.isConnected) stop(watching)
        })
        return
      }
      stop(watching)
      const row = node.parentElement
      if (!row || typeof ResizeObserver === 'undefined') return
      const measure = () => {
        if (!node.isConnected) return
        setFree(rowRoom(row, node))
        setAfterHeight(afterRef.current?.offsetHeight ?? 0)
      }
      const resize = new ResizeObserver(measure)
      const observeAll = () => {
        resize.disconnect()
        resize.observe(row)
        for (const kid of row.children) resize.observe(kid)
        if (afterRef.current) resize.observe(afterRef.current)
      }
      observeAll()
      const mutation =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver(() => {
              observeAll()
              measure()
            })
      mutation?.observe(row, { childList: true })
      watching.current = { node, resize, mutation }
    },
    [sizeRef]
  )
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const widths = columnWidths({ free, viewportWidth })
  const measured = !!stageResult && size.height > 0 && free > 0
  const { stage, afterMax } = stageSizes({
    width: widths.small,
    height: size.height,
    big,
    bigWidth: widths.big,
    after: after ? GAP + afterHeight : 0,
  })
  const columnWidth = stageResult && big ? Math.max(widths.small, stage) : null
  const afterStyle =
    measured && afterMax != null ? { ...s.after, maxHeight: Math.max(0, afterMax - GAP) } : s.after

  return (
    <div
      ref={ref}
      style={{ ...style, ...(measured && columnWidth ? { width: columnWidth } : {}) }}
      data-testid="student-modal-output-column"
      data-stage={stageResult ? 'above-output' : undefined}
    >
      {stageResult && (
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
      )}
      {stageResult && (
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
      )}
      <div style={s.output}>{output}</div>
      {after && (
        // Scrolls inside itself once the Stage is at its minimum, so the Output keeps its floor.
        <div style={afterStyle}>
          <div ref={afterRef} style={s.afterContent}>
            {after}
          </div>
        </div>
      )}
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
  after: { flexShrink: 0, minHeight: 0, overflowY: 'auto' },
  // A block formatting context, so the panel's own margin counts in the measured height.
  afterContent: { display: 'flow-root' },
}
