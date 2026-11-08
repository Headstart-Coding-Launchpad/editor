import React, { useEffect, useState } from 'react'
import StagePane from '../../../shared/stage/StagePane.jsx'
import { getCachedStageTarget, loadStageTarget } from '../../../modules/python/stageTarget.js'

/**
 * The picture a right answer draws, for the teacher view's Answer panel on a Python Stage task.
 * `code` is the task's stageTarget (or the model answer when it draws on the Stage). It is drawn
 * once in the shared Pyodide worker and cached by code (modules/python/stageTarget.js), the same
 * cache the students' ghost and the stage_matches_target check use.
 */
export default function StageTargetPreview({ code }) {
  const [result, setResult] = useState(() => getCachedStageTarget(code))
  const [state, setState] = useState(() => (getCachedStageTarget(code) ? 'ready' : 'drawing'))

  useEffect(() => {
    let cancelled = false
    const cached = getCachedStageTarget(code)
    if (cached) {
      setResult(cached)
      setState('ready')
      return undefined
    }
    setResult(null)
    setState('drawing')
    loadStageTarget(code).then((drawn) => {
      if (cancelled) return
      setResult(drawn)
      setState(drawn ? 'ready' : 'failed')
    })
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div style={s.wrap} data-testid="teacher-stage-target">
      <span style={s.label}>Target picture (what a right answer draws)</span>
      {state === 'ready' && Array.isArray(result?.commands) ? (
        <StagePane commands={result.commands} compact title="Target picture" style={s.stage} />
      ) : (
        <div style={s.placeholder}>
          {state === 'drawing'
            ? 'Drawing the target picture…'
            : 'The picture could not be drawn just now. It shows on the students’ Stage.'}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#166534',
  },
  stage: { width: '100%', aspectRatio: '1 / 1', maxHeight: 260 },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    padding: 12,
    border: '1px dashed #d1d5db',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--colour-muted)',
    textAlign: 'center',
  },
}
