// Slow-mo state for one ScratchWorkspace (docs/authoring/scratch.md "Slow-mo"): the gate
// (./gate.js), the running-block glow (./glow.js), the timeline (./timeline.js) and the live
// shape (./live.js). ScratchWorkspace owns the run itself (handleRun) and calls in here:
//
//   begin({ paused })   a slow-mo run is starting (a new gate; the timeline starts again)
//   attach(signal)      hang the gate on a run signal (every signal created while slow-mo runs,
//                       so key presses and sprite clicks go slowly too)
//   finish()            the run ended by itself: blocks stop, the last glow stays
//   cancel({ clear })   Stop, Reset Stage / Restart, or a normal green flag
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isRunContextActive } from '../scratch.js'
import { createSlowMoGate, clampSlowMoSpeed } from './gate.js'
import { applySlowMoGlow, sameSlowMoGlow } from './glow.js'
import { appendSlowMoSnapshot, captureSlowMoSnapshot } from './timeline.js'
import { buildSlowMoLive, readSlowMoLive } from './live.js'

const IDLE_VIEW = Object.freeze({ mode: 'idle', step: 0, glow: [] })

function nextFrame() {
  return new Promise((resolve) => {
    const raf = globalThis.requestAnimationFrame
    if (typeof raf === 'function') raf(() => resolve())
    else setTimeout(resolve, 16)
  })
}

// A C block (repeat, forever, if) ends after its inner blocks; their snapshots already show it.
function hasSubstack(block) {
  try {
    return !!block?.getInput?.('SUBSTACK')
  } catch {
    return false
  }
}

function blockText(block) {
  try {
    return String(block?.toString?.() ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  } catch {
    return ''
  }
}

function rootBlockId(block) {
  try {
    return block?.getRootBlock?.()?.id ?? block?.id ?? ''
  } catch {
    return block?.id ?? ''
  }
}

export function useScratchSlowMo({
  config, // normalizeSlowMo(task.slowMo): { speed, timeline } | null
  readOnly = false,
  externalLive = null, // a mirror's received spriteState.slowMo
  status,
  workspaceRefs,
  spritesRef,
  spriteStatesRef,
  clonesRef,
  backdropNameRef,
  onUse = null, // ({ kind: 'run' | 'step' }) for the session report
}) {
  const enabled = !!config
  const [view, setView] = useState(IDLE_VIEW)
  const [speed, setSpeedState] = useState(() => clampSlowMoSpeed(config?.speed))
  const [snapshots, setSnapshots] = useState([])
  const [capped, setCapped] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(null)
  const gateRef = useRef(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const glowByKeyRef = useRef(new Map())
  const stepByKeyRef = useRef(new Map())
  const glowElsRef = useRef([])
  const snapshotsRef = useRef([])
  const onUseRef = useRef(onUse)
  onUseRef.current = onUse

  const spriteIdForWorkspace = useCallback(
    (workspace) =>
      Object.entries(workspaceRefs.current ?? {}).find(([, ws]) => ws === workspace)?.[0] ?? null,
    [workspaceRefs]
  )

  const scriptKey = useCallback(
    (block, context) => {
      const owner = context?.spriteId ?? spriteIdForWorkspace(context?.workspace) ?? '?'
      return `${owner}|${rootBlockId(block)}`
    },
    [spriteIdForWorkspace]
  )

  const resetTimeline = useCallback(() => {
    snapshotsRef.current = []
    setSnapshots([])
    setCapped(false)
    setPreviewIndex(null)
  }, [])

  const disposeGate = useCallback(() => {
    gateRef.current?.dispose()
    gateRef.current = null
  }, [])

  const begin = useCallback(
    ({ paused = false } = {}) => {
      if (!enabled) return null
      disposeGate()
      glowByKeyRef.current = new Map()
      stepByKeyRef.current = new Map()
      resetTimeline()
      const gate = createSlowMoGate({
        speed: speedRef.current,
        paused,
        onRelease: ({ key, payload, step }) => {
          const { block, context } = payload ?? {}
          const spriteId = spriteIdForWorkspace(context?.workspace)
          if (spriteId && block?.id) glowByKeyRef.current.set(key, { spriteId, blockId: block.id })
          stepByKeyRef.current.set(key, step)
          const glow = [...glowByKeyRef.current.values()]
          setView(() => ({ mode: gate.mode === 'paused' ? 'paused' : 'playing', step, glow }))
        },
      })
      gateRef.current = gate
      setView({ mode: paused ? 'paused' : 'playing', step: 0, glow: [] })
      onUseRef.current?.({ kind: 'run' })
      return gate
    },
    [enabled, disposeGate, resetTimeline, spriteIdForWorkspace]
  )

  const captureAfterBlock = useCallback(
    async (block, context) => {
      if (hasSubstack(block)) return
      // Redraw after every block: blocks that change no sprite (a variable, a broadcast) still
      // get their own frame, so two quick switches show both.
      try {
        context.onUpdate?.({ ...context.state })
      } catch {}
      const key = scriptKey(block, context)
      const baseSpriteId = spriteIdForWorkspace(context.workspace)
      const sprite = spritesRef.current?.find((sp) => sp.id === baseSpriteId)
      const isClone = !!context.spriteId && context.spriteId !== baseSpriteId
      const snapshot = captureSlowMoSnapshot({
        step: stepByKeyRef.current.get(key) ?? gateRef.current?.stepCount ?? 0,
        spriteId: context.spriteId ?? baseSpriteId,
        baseSpriteId,
        spriteName:
          baseSpriteId === '__stage__'
            ? 'Stage'
            : `${sprite?.name ?? baseSpriteId ?? ''}${isClone ? ' (clone)' : ''}`,
        blockId: block?.id ?? null,
        blockText: blockText(block),
        spriteStates: spriteStatesRef.current,
        cloneStates: clonesRef.current,
        actorState: baseSpriteId === '__stage__' ? null : context.state,
        backdropName: context.signal?.backdrop ?? backdropNameRef.current,
        variables: context.signal?.variables ?? {},
      })
      const { snapshots: next, capped: full } = appendSlowMoSnapshot(snapshotsRef.current, snapshot)
      if (full) setCapped(true)
      else {
        snapshotsRef.current = next
        setSnapshots(next)
      }
      // Let React paint the new stage before the next block may run.
      await nextFrame()
      await nextFrame()
    },
    [scriptKey, spriteIdForWorkspace, spritesRef, spriteStatesRef, clonesRef, backdropNameRef]
  )

  const attach = useCallback(
    (signal) => {
      const gate = gateRef.current
      if (!gate || !signal) return signal
      signal.onBlockStart = (block, context) =>
        gate.wait(scriptKey(block, context), { block, context }, () => isRunContextActive(context))
      signal.onBlockEnd = (block, context) =>
        gateRef.current === gate ? captureAfterBlock(block, context) : undefined
      return signal
    },
    [scriptKey, captureAfterBlock]
  )

  const finish = useCallback(() => {
    if (!gateRef.current) return
    disposeGate()
    setView((prev) => ({ ...prev, mode: 'finished' }))
  }, [disposeGate])

  const cancel = useCallback(
    ({ clear = false } = {}) => {
      disposeGate()
      glowByKeyRef.current = new Map()
      setView(IDLE_VIEW)
      if (clear) resetTimeline()
    },
    [disposeGate, resetTimeline]
  )

  const pause = useCallback(() => {
    if (gateRef.current?.mode !== 'playing') return
    gateRef.current.pause()
    setView((prev) => ({ ...prev, mode: 'paused' }))
  }, [])

  const resume = useCallback(() => {
    if (gateRef.current?.mode !== 'paused') return false
    gateRef.current.play()
    setPreviewIndex(null)
    setView((prev) => ({ ...prev, mode: 'playing' }))
    return true
  }, [])

  const step = useCallback(() => {
    const gate = gateRef.current
    if (!gate) return false
    setPreviewIndex(null)
    gate.step()
    onUseRef.current?.({ kind: 'step' })
    setView((prev) => ({ ...prev, mode: 'paused' }))
    return true
  }, [])

  const setSpeed = useCallback((value) => {
    const next = clampSlowMoSpeed(value)
    setSpeedState(next)
    gateRef.current?.setSpeed(next)
  }, [])

  const selectSnapshot = useCallback(
    (index) => {
      if (index == null || index < 0 || index >= snapshotsRef.current.length) {
        setPreviewIndex(null)
        return
      }
      pause()
      setPreviewIndex(index)
    },
    [pause]
  )

  // The gate never outlives the workspace.
  useEffect(() => () => gateRef.current?.dispose(), [])

  const receivedLive = readOnly ? readSlowMoLive(externalLive) : null
  const glow = readOnly ? (receivedLive?.glow ?? []) : view.glow
  const glowKey = JSON.stringify(glow)

  // Paint the glow onto the Blockly blocks (own run, or the broadcast's in a mirror).
  const lastGlowRef = useRef([])
  useEffect(() => {
    if (status !== 'ready') return
    if (sameSlowMoGlow(lastGlowRef.current, glow) && glowElsRef.current.length === glow.length)
      return
    lastGlowRef.current = glow
    glowElsRef.current = applySlowMoGlow(workspaceRefs.current, glow, glowElsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey, status])

  const active = view.mode === 'playing' || view.mode === 'paused'
  const live = useMemo(
    () => (enabled && !readOnly ? buildSlowMoLive({ ...view, speed }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, readOnly, view.mode, view.step, JSON.stringify(view.glow), speed]
  )

  return {
    enabled,
    view,
    active,
    speed,
    setSpeed,
    snapshots,
    capped,
    previewIndex,
    preview: previewIndex == null ? null : (snapshots[previewIndex] ?? null),
    selectSnapshot,
    backToNow: () => setPreviewIndex(null),
    begin,
    attach,
    finish,
    cancel,
    pause,
    resume,
    step,
    isRunning: () => !!gateRef.current,
    live,
    receivedLive,
  }
}
