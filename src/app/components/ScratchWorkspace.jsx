import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  loadBlocklyModules,
  DEFAULT_TOOLBOX,
  STAGE_TOOLBOX,
  DEFAULT_SPRITES,
  buildAlwaysOpenToolbox,
  addPredefinedBlocksToToolbox,
  createRunSignal,
  runAllSprites,
  runAllSpritesEvent,
  runBlockInContext,
  normalizeKey,
  saveWorkspace,
  loadWorkspace,
  evaluateScratchCheck,
  setSpriteContext,
  setBackdropContext,
  setCostumeContext,
  setVariableContext,
} from '../../shared/scratch'
import { resolveAssetFileUrl } from '../../shared/assetPaths'

const STAGE_W = 480
const STAGE_H = 360
const SYNC_DEBOUNCE = 1000
const MIN_STAGE_SCALE = 0.35
const MIN_EDITOR_WIDTH = 420
const MIN_EDITOR_WIDTH_COMPACT = 320
const STAGE_VERTICAL_CHROME = 112
const PAGE_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '])
const STAGE_RUNTIME_STATE = {
  x: 0,
  y: 0,
  direction: 90,
  size: 100,
  visible: true,
  bubble: '',
  bubbleType: 'say',
  rotationStyle: 'all around',
  costume: null,
}

const toCanvasX = x => STAGE_W / 2 + x
const toCanvasY = y => STAGE_H / 2 - y

export const SPRITE_TYPES = ['cat', 'ball', 'star', 'arrow', 'bat', 'parrot']

const SPRITE_TYPE_COLOR = { cat: '#FFA500', ball: '#4C97FF', star: '#FFD700', arrow: '#9966FF', bat: '#374151', parrot: '#22c55e' }

const ROT_STYLES = [
  { val: 'all around',  icon: '↺', title: 'Rotate all around' },
  { val: 'left-right',  icon: '↔', title: 'Flip left-right only' },
  { val: "don't rotate", icon: '↑', title: "Don't rotate" },
]

function normaliseInitialStates(raw, sprites) {
  if (!raw) return {}
  if (sprites[0] && Object.prototype.hasOwnProperty.call(raw, sprites[0].id)) return raw
  return sprites[0] ? { [sprites[0].id]: raw } : {}
}

function defaultSpriteState(sp) {
  return { x: sp.x ?? 0, y: sp.y ?? 0, size: sp.size ?? 100, direction: sp.direction ?? 90, visible: sp.visible ?? true, bubble: '', bubbleType: 'say', rotationStyle: sp.rotationStyle ?? 'all around', costume: sp.costume ?? sp.costumes?.[0]?.name ?? null }
}

function initSpriteStates(sprites) {
  const out = {}
  for (const sp of sprites) out[sp.id] = defaultSpriteState(sp)
  return out
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

function drawScratchSpriteAtOrigin(ctx, type, r) {
  switch (type) {
    case 'ball':
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#4C97FF'; ctx.fill()
      ctx.strokeStyle = '#2244aa'; ctx.lineWidth = 1.5; ctx.stroke()
      break
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2
        const rad = i % 2 === 0 ? r : r * 0.42
        i === 0 ? ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
      }
      ctx.closePath(); ctx.fillStyle = '#FFD700'; ctx.fill()
      ctx.strokeStyle = '#CC9900'; ctx.lineWidth = 1.5; ctx.stroke()
      break
    }
    case 'arrow':
      ctx.beginPath()
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.65, r * 0.5); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.65, r * 0.5)
      ctx.closePath(); ctx.fillStyle = '#9966FF'; ctx.fill()
      ctx.strokeStyle = '#6633cc'; ctx.lineWidth = 1.5; ctx.stroke()
      break
    case 'bat':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = '#374151'; ctx.fill()
      ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.1, r * 0.55, r * 0.3, -0.3, 0, Math.PI * 2)
      ctx.fillStyle = '#374151'; ctx.fill()
      ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.1, r * 0.55, r * 0.3, 0.3, 0, Math.PI * 2)
      ctx.fillStyle = '#374151'; ctx.fill()
      break
    case 'parrot':
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#22c55e'; ctx.fill()
      ctx.strokeStyle = '#166534'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.1); ctx.lineTo(r * 0.8, r * 0.1); ctx.lineTo(r * 0.3, r * 0.25)
      ctx.closePath(); ctx.fillStyle = '#FBA504'; ctx.fill()
      break
    default: { // cat
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#FFA500'; ctx.fill(); ctx.strokeStyle = '#cc6600'; ctx.lineWidth = 1.5; ctx.stroke()
      const er = Math.max(2, r * 0.18)
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, er, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.2, er, 0, Math.PI * 2)
      ctx.fillStyle = '#222'; ctx.fill()
      ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.35, 0, Math.PI)
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.stroke()
      break
    }
  }
}

function drawSpriteShape(ctx, s, type) {
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const dir = Number.isFinite(Number(s.direction)) ? Number(s.direction) : 90
  const rs  = s.rotationStyle ?? 'all around'
  const rot = rs === "don't rotate" ? 0 : rs === 'left-right' ? (dir > 90 && dir < 270 ? Math.PI : 0) : (dir - 90) * (Math.PI / 180)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  drawScratchSpriteAtOrigin(ctx, type, r)
  ctx.restore()
}

function drawBubble(ctx, s) {
  if (!s.bubble) return
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const fontSize = Math.max(11, r * 0.6)
  ctx.font = `${fontSize}px Quicksand, sans-serif`
  const bw = Math.min(ctx.measureText(s.bubble).width + 20, 200)
  const bh = Math.max(fontSize + 16, 30)
  const bx = Math.min(STAGE_W - bw - 4, cx + r + 6)
  const by = Math.max(4, cy - bh - r - 6)
  const isThink = s.bubbleType === 'think'
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10)
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5; ctx.stroke()
  if (isThink) {
    const dotEndX = bx + bw * 0.25; const dotEndY = by + bh
    const dotStartX = cx + r * 0.5; const dotStartY = cy - r * 0.6
    for (let i = 0; i < 3; i++) {
      const t = i / 2
      const dx = dotStartX + (dotEndX - dotStartX) * t; const dy = dotStartY + (dotEndY - dotStartY) * t
      ctx.beginPath(); ctx.arc(dx, dy, 2 + i * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5; ctx.stroke()
    }
  } else {
    const tailX = bx + Math.min(18, bw * 0.2); const tailY = by + bh
    const tipX = cx + r * 0.4; const tipY = cy - r * 0.2
    ctx.beginPath(); ctx.moveTo(tailX - 6, tailY); ctx.lineTo(tailX + 6, tailY); ctx.lineTo(tipX, tipY)
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.beginPath(); ctx.moveTo(tailX - 6, tailY); ctx.lineTo(tipX, tipY); ctx.lineTo(tailX + 6, tailY)
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(tailX - 5, tailY); ctx.lineTo(tailX + 5, tailY)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
  }
  ctx.fillStyle = '#222'; ctx.font = `${fontSize}px Quicksand, sans-serif`
  ctx.fillText(s.bubble, bx + 10, by + bh / 2 + fontSize * 0.35)
}

function drawSpriteImage(ctx, s, img) {
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const dir = Number.isFinite(Number(s.direction)) ? Number(s.direction) : 90
  const rs  = s.rotationStyle ?? 'all around'
  const rot = rs === "don't rotate" ? 0 : rs === 'left-right' ? (dir > 90 && dir < 270 ? Math.PI : 0) : (dir - 90) * (Math.PI / 180)
  const drawSize = r * 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

function spriteRadius(s) { return Math.max(4, (s.size / 100) * 24) }

function hitTest(s, canvasX, canvasY) {
  const cx = toCanvasX(s.x); const cy = toCanvasY(s.y)
  return Math.hypot(canvasX - cx, canvasY - cy) <= spriteRadius(s) + 8
}

// ── Sprite thumbnail ──────────────────────────────────────────────────────────

function drawSpriteThumb(ctx, sprite, state, imageCache, assetsPath, size) {
  const cx = size / 2
  const cy = size / 2
  const r  = Math.max(4, size * 0.35)
  const dir = Number.isFinite(Number(state?.direction)) ? Number(state.direction) : 90
  const rs  = state?.rotationStyle ?? 'all around'
  const rot = rs === "don't rotate" ? 0 : rs === 'left-right' ? (dir > 90 && dir < 270 ? Math.PI : 0) : (dir - 90) * (Math.PI / 180)

  const costumeEntry = sprite.costumes?.length > 0
    ? (sprite.costumes.find(c => c.name === state?.costume) ?? sprite.costumes[0])
    : null
  if (costumeEntry?.image && imageCache) {
    const url = resolveAssetFileUrl(assetsPath, costumeEntry.image)
    const img = imageCache[url]
    if (img) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
      ctx.drawImage(img, -r, -r, r * 2, r * 2)
      ctx.restore(); return
    }
  }

  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  drawScratchSpriteAtOrigin(ctx, sprite.type ?? 'cat', r)
  ctx.restore()
}

function SpriteThumb({ sprite, state, imageCache, assetsPath, size = 52, imageVersion }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    if (state) drawSpriteThumb(ctx, sprite, state, imageCache, assetsPath, size)
  }, [sprite, state, imageCache, assetsPath, size, imageVersion])
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block' }} />
}

function PropField({ label, value, onChange, readOnly, min, max }) {
  return (
    <div style={s.spritePropField}>
      <span style={s.spritePropLabel}>{label}</span>
      <input
        type="number"
        step="1"
        min={min}
        max={max}
        style={s.spritePropInput}
        value={value}
        readOnly={readOnly}
        onChange={readOnly ? undefined : e => { const v = e.target.valueAsNumber; if (!isNaN(v)) onChange(v) }}
      />
    </div>
  )
}

// ── Check helpers ─────────────────────────────────────────────────────────────

function evalSingleCheck(check, spriteWorkspaces, signal, preRunSpriteStates = {}) {
  if (!check?.type) return false
  try {
    if (check.type === 'block_used') {
      return spriteWorkspaces.some(sp => sp.workspace?.getAllBlocks(false).some(b => b.type === check.opcode))
    }
    if (check.type === 'variable_equals') {
      return evaluateScratchCheck(check, null, null, signal)
    }
    // sprite_property / sprite_property_delta / sprite_property_changed: match by name or fall back to first
    const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
    if (!target) return false
    const preRunState = preRunSpriteStates[target.id] ?? null
    return evaluateScratchCheck(check, target.workspace, target.state, signal, preRunState)
  } catch { return false }
}

function normalizeScratchChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter(c => c?.type)
  if (check.type) return [check]
  return []
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScratchWorkspace({
  task,
  readOnly = false,
  unrestricted = false,
  assetsPath = '',
  initialStates = null,
  initialState  = null,      // legacy single-sprite alias
  initialSpriteStates = null,
  onStateChange,
  onSpriteStatesChange,
  onCheckResult,
  externalStates = null,
  externalState  = null,     // legacy alias
  syncNowKey = null,
  hideStage = false,
  selectedSpriteId: controlledSpriteId = null,
  onSpriteSelect = null,
  spritePanelTarget = null,
  onAddSprite = null,
  spritePanelEditor = null,
  predefinedBlocks = null,   // PredefinedBlock[] merged for current tab
}) {
  const sprites = task?.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
  const backdrops = task?.backdrops?.length > 0 ? task.backdrops : []
  const variables = task?.variables ?? []

  const normInitStates  = normaliseInitialStates(initialStates ?? initialState, sprites)
  const normExtStates   = externalStates ?? (externalState ? normaliseInitialStates(externalState, sprites) : null)

  const blocksDivRefs       = useRef({})
  const workspaceRefs       = useRef({})
  const spriteStatesRef     = useRef(initSpriteStates(sprites))
  const preRunSpriteStatesRef = useRef({})
  const BlocklyRef          = useRef(null)
  const signalRef           = useRef(null)
  const syncTimerRef        = useRef(null)
  const suppressChangeRef   = useRef(false)
  const lastCheckRef        = useRef(null)
  const lastEmittedStateRef = useRef(null)
  const statusRef           = useRef('loading')
  const runningRef          = useRef(false)
  const onStateChangeRef    = useRef(onStateChange)
  const onSpriteStatesChangeRef = useRef(onSpriteStatesChange)
  const onCheckResultRef    = useRef(onCheckResult)
  const askResolveRef       = useRef(null)
  const inputStateRef       = useRef({ keysPressed: new Set(), mouseDown: false, mouseX: 0, mouseY: 0 })
  const keySignalsRef       = useRef(new Map()) // normalizedKey → active signal (at most one per key)
  const isDraggingRef       = useRef(false)
  const dragStartRef        = useRef(null)
  const dragMovedRef        = useRef(false)
  const draggingSpriteIdRef = useRef(null)
  const backdropNameRef     = useRef(backdrops[0]?.name ?? null)
  const imageCacheRef       = useRef({})
  const variableRuntimeRef  = useRef({})

  const [internalSelectedSpriteId, setInternalSelectedSpriteId] = useState(sprites[0]?.id ?? 'sprite1')
  const selectedSpriteId = controlledSpriteId ?? internalSelectedSpriteId
  function setSelectedSpriteId(id) {
    if (controlledSpriteId !== null) onSpriteSelect?.(id)
    else setInternalSelectedSpriteId(id)
  }

  const [status, setStatus]         = useState('loading')
  const [running, setRunning]       = useState(false)
  const [checkPassed, setCheckPassed] = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [spriteStates, setSpriteStates] = useState(() => initSpriteStates(sprites))
  const [variableValues, setVariableValues] = useState({})
  const [askPrompt, setAskPrompt]   = useState(null)
  const [askValue, setAskValue]     = useState('')
  const [broadcastToasts, setBroadcastToasts] = useState([])
  const [stageCursor, setStageCursor] = useState('default')
  const [stageScale, setStageScale] = useState(1)
  const [flyoutCollapsed, setFlyoutCollapsed] = useState(false)
  const [backdropName, setBackdropName] = useState(backdrops[0]?.name ?? null)
  const [imageVersion, setImageVersion] = useState(0)
  const canvasRef = useRef(null)
  const rootRef   = useRef(null)

  statusRef.current = status
  runningRef.current = running
  onStateChangeRef.current = onStateChange
  onSpriteStatesChangeRef.current = onSpriteStatesChange
  onCheckResultRef.current = onCheckResult

  // ── Sync Blockly context globals (lazy — only read when dropdowns open) ──────
  useEffect(() => {
    setSpriteContext(sprites)
    setBackdropContext(backdrops)
    setVariableContext(variables)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprites, backdrops, variables])

  useEffect(() => {
    setCostumeContext((sprites.find(sp => sp.id === selectedSpriteId) ?? sprites[0])?.costumes ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprites, selectedSpriteId])

  // ── Draw stage ──────────────────────────────────────────────────────────────
  const drawStage = useCallback((states) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, STAGE_W, STAGE_H)

    const currentName = backdropNameRef.current
    const backdrop = (currentName ? backdrops.find(b => b.name === currentName) : null) ?? backdrops[0]

    if (backdrop?.image) {
      const url = resolveAssetFileUrl(assetsPath, backdrop.image)
      const img = imageCacheRef.current[url]
      if (img) {
        ctx.drawImage(img, 0, 0, STAGE_W, STAGE_H)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, STAGE_W, STAGE_H)
      }
    } else {
      ctx.fillStyle = backdrop?.colour ?? '#ffffff'
      ctx.fillRect(0, 0, STAGE_W, STAGE_H)
    }

    for (const sp of sprites) {
      const state = states[sp.id]
      if (!state?.visible) continue
      const costumeEntry = sp.costumes?.length > 0
        ? (sp.costumes.find(c => c.name === state.costume) ?? sp.costumes[0])
        : null
      if (costumeEntry?.image) {
        const url = resolveAssetFileUrl(assetsPath, costumeEntry.image)
        const img = imageCacheRef.current[url]
        if (img) { drawSpriteImage(ctx, state, img); continue }
      }
      drawSpriteShape(ctx, state, sp.type ?? 'cat')
    }
    for (const sp of sprites) {
      const state = states[sp.id]
      if (state?.bubble) drawBubble(ctx, state)
    }
  }, [sprites, backdrops, assetsPath])

  useEffect(() => { drawStage(spriteStates) }, [spriteStates, backdropName, imageVersion, drawStage])

  // ── Preload backdrop images ──────────────────────────────────────────────────
  useEffect(() => {
    for (const backdrop of backdrops) {
      if (!backdrop.image) continue
      const url = resolveAssetFileUrl(assetsPath, backdrop.image)
      if (!url) continue
      if (imageCacheRef.current[url] !== undefined) continue
      imageCacheRef.current[url] = null
      const img = new Image()
      img.onload = () => {
        imageCacheRef.current[url] = img
        setImageVersion(v => v + 1)
      }
      img.src = url
    }
  }, [assetsPath, backdrops])

  // ── Preload sprite costume images ────────────────────────────────────────────
  useEffect(() => {
    for (const sp of sprites) {
      for (const costume of sp.costumes ?? []) {
        if (!costume.image) continue
        const url = resolveAssetFileUrl(assetsPath, costume.image)
        if (!url) continue
        if (imageCacheRef.current[url] !== undefined) continue
        imageCacheRef.current[url] = null
        const img = new Image()
        img.onload = () => {
          imageCacheRef.current[url] = img
          setImageVersion(v => v + 1)
        }
        img.src = url
      }
    }
  }, [assetsPath, sprites])

  // ── Emit workspace states ────────────────────────────────────────────────────
  const emitWorkspaceState = useCallback(() => {
    if (!BlocklyRef.current || suppressChangeRef.current) return
    try {
      const states = {}
      for (const [id, ws] of Object.entries(workspaceRefs.current)) {
        states[id] = saveWorkspace(BlocklyRef.current, ws)
      }
      lastEmittedStateRef.current = states
      onStateChangeRef.current?.(states)
    } catch {}
  }, [])

  // ── Build sprite workspace array for run calls ───────────────────────────────
  const resizeBlocklyWorkspaces = useCallback(() => {
    const Blockly = BlocklyRef.current
    if (!Blockly) return
    try { Blockly.WidgetDiv?.hide?.() } catch {}
    try {
      if (Blockly.DropDownDiv?.hideWithoutAnimation) Blockly.DropDownDiv.hideWithoutAnimation()
      else Blockly.DropDownDiv?.hide?.()
    } catch {}
    for (const ws of Object.values(workspaceRefs.current)) {
      try { Blockly.svgResize(ws) } catch {}
    }
  }, [])

  const buildSpriteWorkspaces = useCallback(() => {
    const result = sprites.map(sp => ({
      id: sp.id,
      name: sp.name,
      workspace: workspaceRefs.current[sp.id],
      state: spriteStatesRef.current[sp.id],
      costumes: sp.costumes ?? [],
      onUpdate: s => {
        commitSpriteStates({ ...spriteStatesRef.current, [sp.id]: s })
      },
    })).filter(sp => sp.workspace)
    // Include stage workspace when enabled
    if (task?.enableStageCode && workspaceRefs.current['__stage__']) {
      result.push({
        id: '__stage__',
        name: '__stage__',
        workspace: workspaceRefs.current['__stage__'],
        state: { ...STAGE_RUNTIME_STATE },
        costumes: [],
        onUpdate: () => {},
      })
    }
    return result
  }, [sprites, task?.enableStageCode])

  function commitSpriteStates(nextStates) {
    spriteStatesRef.current = nextStates
    setSpriteStates(nextStates)
    onSpriteStatesChangeRef.current?.(nextStates)
  }

  function updateSpriteStateOverride(id, updates) {
    const newState = { ...spriteStatesRef.current[id], ...updates }
    commitSpriteStates({ ...spriteStatesRef.current, [id]: newState })
    if ('x' in updates || 'y' in updates) refreshSpriteToolbox(id)
  }

  function buildToolboxForSprite(spriteId) {
    const state = spriteStatesRef.current[spriteId] ?? { x: 0, y: 0 }
    const isStage = spriteId === '__stage__'
    let baseToolbox
    if (unrestricted) {
      baseToolbox = isStage ? STAGE_TOOLBOX : DEFAULT_TOOLBOX
    } else {
      baseToolbox = isStage ? STAGE_TOOLBOX : (task?.toolbox ?? DEFAULT_TOOLBOX)
    }
    const withPredefined = predefinedBlocks?.length
      ? addPredefinedBlocksToToolbox(baseToolbox, predefinedBlocks)
      : baseToolbox
    return buildAlwaysOpenToolbox(withPredefined, { position: { x: state.x, y: state.y } })
  }

  function refreshSpriteToolbox(spriteId) {
    const ws = workspaceRefs.current[spriteId]
    if (!ws || readOnly) return
    try {
      ws.updateToolbox(buildToolboxForSprite(spriteId))
      requestAnimationFrame(() => {
        try {
          ws.getFlyout?.()?.setVisible(!flyoutCollapsed)
          BlocklyRef.current?.svgResize?.(ws)
        } catch {}
      })
    } catch {}
  }

  function handleWorkspaceClickEvent(event, ws, spriteId, Blockly) {
    if (
      (event?.type === Blockly.Events.CLICK || event?.type === 'click') &&
      event.targetType === 'block' &&
      event.blockId
    ) {
      const clicked =
        ws.getBlockById(event.blockId) ??
        ws.getFlyout?.()?.getWorkspace?.()?.getBlockById?.(event.blockId)
      if (clicked) runClickedBlock(clicked, spriteId)
      return true
    }
    return false
  }

  function handleWorkspaceDomClick(event, ws, spriteId, Blockly) {
    if (event.button !== 0) return
    if (!event.target?.closest?.('.blocklyDraggable')) return
    setTimeout(() => {
      const selected = Blockly.getSelected?.()
      const flyoutWs = ws.getFlyout?.()?.getWorkspace?.()
      if (
        selected?.type &&
        (selected.workspace === ws || selected.workspace === flyoutWs)
      ) {
        runClickedBlock(selected, spriteId)
      }
    }, 0)
  }

  // ── Initialise Blockly (one workspace per sprite) ────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { Blockly } = await loadBlocklyModules()
        if (cancelled) return
        BlocklyRef.current = Blockly

        await new Promise(r => requestAnimationFrame(r))
        if (cancelled) return

        for (const sp of sprites) {
          const div = blocksDivRefs.current[sp.id]
          if (!div) continue

          const ws = Blockly.inject(div, {
            toolbox: buildToolboxForSprite(sp.id),
            renderer: 'zelos',
            grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
            zoom: { startScale: 0.75 },
            trashcan: true,
            readOnly,
          })
          workspaceRefs.current[sp.id] = ws
          Blockly.svgResize(ws)

          // Load initial state for this sprite
          const initState = normInitStates[sp.id]
          if (initState) {
            try {
              suppressChangeRef.current = true
              loadWorkspace(Blockly, ws, initState)
              requestAnimationFrame(() => { suppressChangeRef.current = false })
            } catch { suppressChangeRef.current = false }
          }

          if (!readOnly) {
            ws.addChangeListener((event) => {
              if (handleWorkspaceClickEvent(event, ws, sp.id, Blockly)) return
              if (suppressChangeRef.current) return
              clearTimeout(syncTimerRef.current)
              syncTimerRef.current = setTimeout(emitWorkspaceState, SYNC_DEBOUNCE)
            })

            div.addEventListener('click', event => handleWorkspaceDomClick(event, ws, sp.id, Blockly))
          }
        }

        // Create stage workspace if enabled
        if (task?.enableStageCode) {
          const stageDiv = blocksDivRefs.current['__stage__']
          if (stageDiv) {
            const stageWs = Blockly.inject(stageDiv, {
              toolbox: buildToolboxForSprite('__stage__'),
              renderer: 'zelos',
              grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
              zoom: { startScale: 0.75 },
              trashcan: true,
              readOnly,
            })
            workspaceRefs.current['__stage__'] = stageWs
            Blockly.svgResize(stageWs)
            const stageInitState = normInitStates?.['__stage__']
            if (stageInitState) {
              try {
                suppressChangeRef.current = true
                loadWorkspace(Blockly, stageWs, stageInitState)
                requestAnimationFrame(() => { suppressChangeRef.current = false })
              } catch { suppressChangeRef.current = false }
            }
            if (!readOnly) {
              stageWs.addChangeListener((event) => {
                if (handleWorkspaceClickEvent(event, stageWs, '__stage__', Blockly)) return
                if (suppressChangeRef.current) return
                clearTimeout(syncTimerRef.current)
                syncTimerRef.current = setTimeout(emitWorkspaceState, SYNC_DEBOUNCE)
              })

              stageDiv.addEventListener('click', event => handleWorkspaceDomClick(event, stageWs, '__stage__', Blockly))
            }
          }
        }

        if (!cancelled) setStatus('ready')
      } catch (err) {
        console.error('Scratch init error:', err)
        if (!cancelled) setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(syncTimerRef.current)
      if (signalRef.current) signalRef.current.stopped = true
      for (const s of keySignalsRef.current.values()) s.stopped = true
      keySignalsRef.current.clear()
      for (const ws of Object.values(workspaceRefs.current)) ws?.dispose?.()
      workspaceRefs.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resize active workspace when sprite selection changes ────────────────────
  useEffect(() => {
    if (status !== 'ready' || !BlocklyRef.current) return
    requestAnimationFrame(resizeBlocklyWorkspaces)
  }, [selectedSpriteId, status, stageScale, resizeBlocklyWorkspaces])

  // ── Apply flyout collapsed state whenever it or selected sprite changes ──────
  useEffect(() => {
    if (status !== 'ready' || !BlocklyRef.current) return
    const ws = workspaceRefs.current[selectedSpriteId]
    if (!ws) return
    try {
      ws.getFlyout?.()?.setVisible(!flyoutCollapsed)
      requestAnimationFrame(() => { try { BlocklyRef.current.svgResize(ws) } catch {} })
    } catch {}
  }, [flyoutCollapsed, selectedSpriteId, status])

  // ── Update toolbox when task.toolbox or predefined blocks change ─────────────
  useEffect(() => {
    if (status !== 'ready' || !BlocklyRef.current) return
    try {
      for (const sp of sprites) refreshSpriteToolbox(sp.id)
      if (task?.enableStageCode) refreshSpriteToolbox('__stage__')
    } catch {}
  }, [task?.toolbox, task?.enableStageCode, unrestricted, status, sprites, predefinedBlocks, flyoutCollapsed])

  // ── Load external state (teacher push) ───────────────────────────────────────
  useEffect(() => {
    if (!normExtStates || status !== 'ready' || !BlocklyRef.current) return
    if (normExtStates === lastEmittedStateRef.current) return
    try {
      suppressChangeRef.current = true
      for (const [id, state] of Object.entries(normExtStates)) {
        const ws = workspaceRefs.current[id]
        if (ws && state) loadWorkspace(BlocklyRef.current, ws, state)
      }
      requestAnimationFrame(() => { suppressChangeRef.current = false })
    } catch { suppressChangeRef.current = false }
  }, [normExtStates, status])

  useEffect(() => {
    if (!syncNowKey || status !== 'ready' || readOnly) return
    clearTimeout(syncTimerRef.current)
    emitWorkspaceState()
  }, [syncNowKey, status, readOnly, emitWorkspaceState])

  // Responsive stage scaling — shrink canvas CSS size to keep editor visible
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let resizeFrame = 0
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      const editorReserve = w < 760 ? MIN_EDITOR_WIDTH_COMPACT : MIN_EDITOR_WIDTH
      const widthScale = (w - editorReserve - 8) / (STAGE_W + 2)
      const heightScale = hideStage ? 1 : (h - STAGE_VERTICAL_CHROME) / (STAGE_H + 2)
      const nextScale = Math.min(1, Math.max(MIN_STAGE_SCALE, Math.min(widthScale, heightScale)))
      const scale = Number.isFinite(nextScale) ? nextScale : 1
      setStageScale(scale)
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(resizeBlocklyWorkspaces)
    })
    obs.observe(el)
    return () => {
      obs.disconnect()
      cancelAnimationFrame(resizeFrame)
    }
  }, [hideStage, resizeBlocklyWorkspaces])

  // ── Signal factory ───────────────────────────────────────────────────────────
  const createSignal = useCallback(() => {
    const signal = createRunSignal()
    signal.keysPressed = inputStateRef.current.keysPressed
    signal.mouseDown   = inputStateRef.current.mouseDown
    signal.mouseX      = inputStateRef.current.mouseX
    signal.mouseY      = inputStateRef.current.mouseY
    signal.backdrop    = backdropNameRef.current
    signal.backdrops   = backdrops
    signal.onBackdropChange = name => {
      backdropNameRef.current = name
      setBackdropName(name)
    }
    signal.ask = q => new Promise(resolve => {
      askResolveRef.current = resolve
      setAskValue('')
      setAskPrompt(q)
    })
    signal.variables = { ...variableRuntimeRef.current }
    signal.onVariablesChange = vars => {
      variableRuntimeRef.current = { ...vars }
      setVariableValues({ ...vars })
    }
    signal.onBroadcast = msg => {
      const id = Date.now() + Math.random()
      setBroadcastToasts(prev => [...prev, { id, message: msg }])
      setTimeout(() => setBroadcastToasts(prev => prev.filter(t => t.id !== id)), 2000)
    }
    return signal
  }, [backdrops])

  // ── Check helpers ────────────────────────────────────────────────────────────
  const check = task?.check
  const scratchChecks = normalizeScratchChecks(check)
  const hasAfterRunCheck = scratchChecks.some(c => c.evaluation !== 'manual')

  const notifyCheck = useCallback((passed, force = false) => {
    setCheckPassed(passed)
    setCheckAttempted(true)
    if (!force && lastCheckRef.current === passed) return
    lastCheckRef.current = passed
    let workspaceStates = null
    try {
      if (BlocklyRef.current) {
        workspaceStates = {}
        for (const [id, ws] of Object.entries(workspaceRefs.current)) {
          workspaceStates[id] = saveWorkspace(BlocklyRef.current, ws)
        }
      }
    } catch {}
    onCheckResultRef.current?.(passed, {
      workspaceStates,
      spriteStates: { ...spriteStatesRef.current },
    })
  }, [])

  function finishRun(signal) {
    if (!signal.stopped) {
      runningRef.current = false
      setRunning(false)
      if (scratchChecks.length > 0 && hasAfterRunCheck) {
        const sws = buildSpriteWorkspaces()
        notifyCheck(scratchChecks.every(c => evalSingleCheck(c, sws, signal, preRunSpriteStatesRef.current)))
      }
    }
  }

  // ── Stop all active runs (green flag + key events) ────────────────────────────
  function stopAll() {
    if (signalRef.current) signalRef.current.stopped = true
    for (const s of keySignalsRef.current.values()) s.stopped = true
    keySignalsRef.current.clear()
  }

  // ── Run / Stop ────────────────────────────────────────────────────────────────
  async function handleRun() {
    if (status !== 'ready') return
    stopAll()
    lastCheckRef.current = null
    preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
    runningRef.current = true
    setRunning(true)
    setCheckAttempted(false)
    const signal = createSignal()
    signalRef.current = signal
    try { await runAllSprites(buildSpriteWorkspaces(), signal) } catch {}
    finishRun(signal)
  }

  async function runClickedBlock(block, spriteId) {
    if (runningRef.current || statusRef.current !== 'ready') return
    stopAll()
    lastCheckRef.current = null
    preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
    runningRef.current = true
    setRunning(true)
    setCheckAttempted(false)
    const signal = createSignal()
    signalRef.current = signal
    const startBlock = block.type === 'event_whenflagclicked' ? block.getNextBlock() : block
    try { await runBlockInContext(startBlock, buildSpriteWorkspaces(), spriteId, signal) } catch {}
    finishRun(signal)
  }

  // Fires key-press hats concurrently with any running green-flag script.
  // At most one run per key at a time — a new keydown stops the previous run for that key.
  async function fireKeyEvent(key) {
    if (statusRef.current !== 'ready') return
    const prev = keySignalsRef.current.get(key)
    if (prev) prev.stopped = true
    const shouldFinishRun = !runningRef.current
    if (shouldFinishRun) preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
    const signal = createSignal()
    keySignalsRef.current.set(key, signal)
    try { await runAllSpritesEvent(buildSpriteWorkspaces(), 'event_whenkeypressed', signal, key) } catch {}
    if (keySignalsRef.current.get(key) === signal) keySignalsRef.current.delete(key)
    if (shouldFinishRun) finishRun(signal)
  }

  function handleStop() {
    stopAll()
    runningRef.current = false
    setRunning(false)
    setAskPrompt(null)
    askResolveRef.current?.('')
    askResolveRef.current = null
  }

  function handleResetStage() {
    stopAll()
    runningRef.current = false
    setRunning(false)
    setAskPrompt(null)
    askResolveRef.current?.('')
    askResolveRef.current = null
    const reset = initSpriteStates(sprites)
    commitSpriteStates(reset)
    const defaultBackdrop = backdrops[0]?.name ?? null
    backdropNameRef.current = defaultBackdrop
    setBackdropName(defaultBackdrop)
    variableRuntimeRef.current = {}
    setVariableValues({})
    lastCheckRef.current = null
    setCheckPassed(false)
    setCheckAttempted(false)
  }

  function handleCheck() {
    const sws = buildSpriteWorkspaces()
    notifyCheck(scratchChecks.every(c => evalSingleCheck(c, sws, signalRef.current)), true)
  }

  // ── Pointer events on canvas ─────────────────────────────────────────────────
  function handleCanvasPointerDown(event) {
    inputStateRef.current.mouseDown = true
    if (signalRef.current) signalRef.current.mouseDown = true

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (STAGE_W / rect.width)
    const y = (event.clientY - rect.top)  * (STAGE_H / rect.height)

    // Find top-most sprite under pointer (reverse order = drawn last = on top)
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i]
      const state = spriteStatesRef.current[sp.id]
      if (state && hitTest(state, x, y)) {
        isDraggingRef.current = true
        dragMovedRef.current  = false
        draggingSpriteIdRef.current = sp.id
        dragStartRef.current = { canvasX: x, canvasY: y, spriteX: state.x, spriteY: state.y }
        event.currentTarget.setPointerCapture(event.pointerId)
        setStageCursor('grabbing')
        return
      }
    }
  }

  function handleCanvasPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (STAGE_W / rect.width)
    const y = (event.clientY - rect.top)  * (STAGE_H / rect.height)

    if (isDraggingRef.current && dragStartRef.current && draggingSpriteIdRef.current) {
      const dx = x - dragStartRef.current.canvasX
      const dy = y - dragStartRef.current.canvasY
      if (!dragMovedRef.current && Math.hypot(dx, dy) > 3) dragMovedRef.current = true
      if (dragMovedRef.current) {
        const id = draggingSpriteIdRef.current
        const newX = Math.max(-240, Math.min(240, dragStartRef.current.spriteX + dx))
        const newY = Math.max(-180, Math.min(180, dragStartRef.current.spriteY - dy))
        const updated = { ...spriteStatesRef.current[id], x: newX, y: newY }
        commitSpriteStates({ ...spriteStatesRef.current, [id]: updated })
      }
      return
    }

    const scratchX = x - STAGE_W / 2
    const scratchY = STAGE_H / 2 - y
    inputStateRef.current.mouseX = scratchX
    inputStateRef.current.mouseY = scratchY
    if (signalRef.current) { signalRef.current.mouseX = scratchX; signalRef.current.mouseY = scratchY }

    let overSprite = false
    for (let i = sprites.length - 1; i >= 0; i--) {
      const state = spriteStatesRef.current[sprites[i].id]
      if (state && hitTest(state, x, y)) { overSprite = true; break }
    }
    setStageCursor(overSprite ? 'grab' : 'default')
  }

  function handleCanvasPointerUp() {
    inputStateRef.current.mouseDown = false
    if (signalRef.current) signalRef.current.mouseDown = false

    const wasDragging = isDraggingRef.current
    const wasMoved    = dragMovedRef.current
    const draggedId   = draggingSpriteIdRef.current
    isDraggingRef.current       = false
    dragStartRef.current        = null
    dragMovedRef.current        = false
    draggingSpriteIdRef.current = null
    setStageCursor('default')

    if (wasDragging && !wasMoved && draggedId) {
      // Click on sprite — fire event only for that sprite
      if (statusRef.current === 'ready' && !runningRef.current) {
        if (signalRef.current) signalRef.current.stopped = true
        lastCheckRef.current = null
        preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
        runningRef.current = true
        setRunning(true)
        setCheckAttempted(false)
        const signal = createSignal()
        signalRef.current = signal
        const allSws = buildSpriteWorkspaces()
        const sws = allSws.filter(s => s.id === draggedId)
        runAllSpritesEvent(sws, 'event_whenthisspriteclicked', signal, null, allSws)
          .then(() => finishRun(signal))
          .catch(() => finishRun(signal))
      }
    } else if (wasDragging && wasMoved && draggedId) {
      refreshSpriteToolbox(draggedId)
    }
  }

  function handleCanvasPointerLeave() {
    if (!isDraggingRef.current) setStageCursor('default')
  }

  function handleAskSubmit(event) {
    event.preventDefault()
    askResolveRef.current?.(askValue)
    askResolveRef.current = null
    setAskPrompt(null)
    setAskValue('')
  }

  // ── Key events ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return
    function onKeyDown(event) {
      const key = normalizeKey(event.key)
      if (!key) return
      if (document.activeElement === canvasRef.current && PAGE_NAVIGATION_KEYS.has(event.key)) {
        event.preventDefault()
      }
      inputStateRef.current.keysPressed.add(key)
      fireKeyEvent(key)
    }
    function onKeyUp(event) {
      const key = normalizeKey(event.key)
      if (key) inputStateRef.current.keysPressed.delete(key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  const showManualCheck = scratchChecks.some(c => c.evaluation === 'manual')

  // ── Sprite panel (tiles + properties) ────────────────────────────────────────
  function renderSpriteProps(compact) {
    const sp = sprites.find(x => x.id === selectedSpriteId)
    const st = spriteStates[selectedSpriteId]
    if (!sp || !st) return null
    return (
      <div style={compact ? s.spritePropBarCompact : s.spritePropBar}>
        <PropField label="x" value={Math.round(st.x ?? 0)} onChange={v => updateSpriteStateOverride(selectedSpriteId, { x: Math.max(-240, Math.min(240, v)) })} readOnly={readOnly} min={-240} max={240} />
        <PropField label="y" value={Math.round(st.y ?? 0)} onChange={v => updateSpriteStateOverride(selectedSpriteId, { y: Math.max(-180, Math.min(180, v)) })} readOnly={readOnly} min={-180} max={180} />
        <PropField label="Direction" value={Math.round(st.direction ?? 90)} onChange={v => updateSpriteStateOverride(selectedSpriteId, { direction: v })} readOnly={readOnly} min={-179} max={180} />
        <PropField label="Size" value={Math.round(st.size ?? 100)} onChange={v => updateSpriteStateOverride(selectedSpriteId, { size: Math.max(1, v) })} readOnly={readOnly} min={1} max={1000} />
        <div style={s.spritePropField}>
          <span style={s.spritePropLabel}>Show</span>
          <button
            type="button"
            style={{ ...s.showHideBtn, ...(st.visible ? s.showHideBtnOn : s.showHideBtnOff) }}
            onClick={readOnly ? undefined : () => updateSpriteStateOverride(selectedSpriteId, { visible: !st.visible })}
            disabled={readOnly}
            title={st.visible ? 'Click to hide' : 'Click to show'}
          >
            {st.visible ? '👁' : '🚫'}
          </button>
        </div>
        <div style={s.spritePropField}>
          <span style={s.spritePropLabel}>Rotation</span>
          <div style={s.rotStyleGroup}>
            {ROT_STYLES.map(({ val, icon, title }) => (
              <button
                key={val}
                type="button"
                style={{ ...s.rotStyleBtn, ...((st.rotationStyle ?? 'all around') === val ? s.rotStyleBtnActive : {}) }}
                onClick={readOnly ? undefined : () => updateSpriteStateOverride(selectedSpriteId, { rotationStyle: val })}
                disabled={readOnly}
                title={title}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        {sp.costumes?.length > 1 && (
          <div style={s.spritePropField}>
            <span style={s.spritePropLabel}>Costume</span>
            <select
              style={s.costumeSelect}
              value={st.costume ?? sp.costumes[0]?.name ?? ''}
              disabled={readOnly}
              onChange={readOnly ? undefined : e => updateSpriteStateOverride(selectedSpriteId, { costume: e.target.value })}
            >
              {sp.costumes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
    )
  }

  const stageTileFull = task?.enableStageCode ? (
    <button
      key="__stage__"
      type="button"
      style={{ ...s.spriteTile, ...('__stage__' === selectedSpriteId ? s.spriteTileActive : {}) }}
      onClick={() => setSelectedSpriteId('__stage__')}
      title="Stage scripts"
    >
      <div style={{ ...s.spriteTileThumb, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <span style={s.spriteTileName}>Stage</span>
    </button>
  ) : null

  const stageTileCompact = task?.enableStageCode ? (
    <button
      key="__stage__"
      type="button"
      style={{ ...s.spriteTileCompact, ...('__stage__' === selectedSpriteId ? s.spriteTileCompactActive : {}) }}
      onClick={() => setSelectedSpriteId('__stage__')}
      title="Stage scripts"
    >
      <div style={s.spriteTileCompactThumb}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <span style={s.spriteTileCompactName}>Stage</span>
    </button>
  ) : null

  const spritePanelFull = (
    <div style={s.spritePanel}>
      <div style={s.spriteTileRow}>
        {stageTileFull}
        {sprites.map(sp => (
          <button
            key={sp.id}
            type="button"
            style={{ ...s.spriteTile, ...(sp.id === selectedSpriteId ? s.spriteTileActive : {}) }}
            onClick={() => setSelectedSpriteId(sp.id)}
          >
            <div style={s.spriteTileThumb}>
              <SpriteThumb sprite={sp} state={spriteStates[sp.id]} imageCache={imageCacheRef.current} assetsPath={assetsPath} size={52} imageVersion={imageVersion} />
              {!spriteStates[sp.id]?.visible && <span style={s.spriteTileHiddenBadge} title="Hidden">👁</span>}
            </div>
            <span style={s.spriteTileName}>{sp.name}</span>
          </button>
        ))}
        {!readOnly && onAddSprite && (
          <button
            type="button"
            style={s.spriteAddTile}
            onClick={onAddSprite}
            aria-label="Add sprite"
            title="Add sprite"
          >
            <span style={s.spriteAddIcon}>+</span>
            <span style={s.spriteTileName}>Add</span>
          </button>
        )}
      </div>
      {selectedSpriteId !== '__stage__' && renderSpriteProps(false)}
      {spritePanelEditor && <div style={s.spritePanelEditor}>{spritePanelEditor}</div>}
    </div>
  )

  const spritePanelCompact = (
    <div style={s.spritePanelCompact}>
      <div style={s.spriteTileRowCompact}>
        {stageTileCompact}
        {sprites.map(sp => (
          <button
            key={sp.id}
            type="button"
            style={{ ...s.spriteTileCompact, ...(sp.id === selectedSpriteId ? s.spriteTileCompactActive : {}) }}
            onClick={() => setSelectedSpriteId(sp.id)}
          >
            <div style={s.spriteTileCompactThumb}>
              <SpriteThumb sprite={sp} state={spriteStates[sp.id]} imageCache={imageCacheRef.current} assetsPath={assetsPath} size={24} imageVersion={imageVersion} />
            </div>
            <span style={s.spriteTileCompactName}>{sp.name}</span>
          </button>
        ))}
      </div>
      {selectedSpriteId !== '__stage__' && renderSpriteProps(true)}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="scratch-workspace" style={hideStage ? s.rootColumn : s.root} ref={rootRef}>
      {status !== 'ready' && (
        <div style={s.overlay}>
          <div style={s.centre}>
            {status === 'loading'
              ? <p style={s.loadingText}>Getting Scratch ready…</p>
              : <p style={s.errorText}>Scratch failed to load. Please refresh the page.</p>
            }
          </div>
        </div>
      )}

      {/* Sprite panel above editor when stage is hidden and no external selector */}
      {hideStage && !onSpriteSelect && spritePanelCompact}
      {spritePanelTarget && createPortal(spritePanelFull, spritePanelTarget)}

      {/* Block editor — all workspace divs stacked, only selected one visible */}
      <div style={s.editorPane}>
        <div style={s.editorPaneHeader}>
          <button
            type="button"
            onClick={() => setFlyoutCollapsed(c => !c)}
            style={s.flyoutToggleBtn}
            title={flyoutCollapsed ? 'Show blocks' : 'Hide blocks'}
          >
            {flyoutCollapsed ? '▶ Blocks' : '◀ Hide'}
          </button>
        </div>
        <div style={s.editorPaneBody}>
          {task?.enableStageCode && (
            <div
              key="__stage__"
              ref={el => { if (el) blocksDivRefs.current['__stage__'] = el }}
              style={{
                position: 'absolute', inset: 0,
                visibility: selectedSpriteId === '__stage__' ? 'visible' : 'hidden',
                pointerEvents: selectedSpriteId === '__stage__' ? 'auto' : 'none',
              }}
            />
          )}
          {sprites.map(sp => (
            <div
              key={sp.id}
              ref={el => { if (el) blocksDivRefs.current[sp.id] = el }}
              style={{
                position: 'absolute', inset: 0,
                visibility: sp.id === selectedSpriteId ? 'visible' : 'hidden',
                pointerEvents: sp.id === selectedSpriteId ? 'auto' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Stage + controls */}
      {!hideStage && (
        <div style={s.stagePane}>
          <div style={s.stageToolbar}>
            <button
              type="button"
              className="btn-primary"
              style={s.greenFlagBtn}
              onClick={handleRun}
              aria-label="Run"
              title="Run green flag scripts"
            >
              <span style={s.flagPole} aria-hidden="true"><span style={s.flagBanner} /></span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={s.stopFlagBtn}
              onClick={handleStop}
              aria-label="Stop"
              title="Stop all scripts"
            >
              <span style={s.stopIcon} aria-hidden="true" />
            </button>
            <button type="button" className="btn-secondary" style={s.resetBtn} onClick={handleResetStage} title="Reset stage">
              Reset
            </button>
          </div>

          <div style={{ ...s.stageFrame, width: STAGE_W * stageScale, height: STAGE_H * stageScale }}>
            {variables.some(v => v.showOnStage) && (
              <div style={s.variableMonitors}>
                {variables.filter(v => v.showOnStage).map(v => (
                  <div key={v.name} style={s.variableMonitor}>
                    <span style={s.variableMonitorName}>{v.name}</span>
                    <span style={s.variableMonitorValue}>{variableValues[v.name] ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
            {broadcastToasts.length > 0 && (
              <div style={s.broadcastToastStack}>
                {broadcastToasts.map(t => (
                  <div key={t.id} style={s.broadcastToast}>
                    <span style={s.broadcastToastIcon}>📢</span> {t.message}
                  </div>
                ))}
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={STAGE_W}
              height={STAGE_H}
              tabIndex={readOnly ? undefined : 0}
              style={{ ...s.canvas, width: STAGE_W * stageScale, height: STAGE_H * stageScale, cursor: readOnly ? 'default' : stageCursor }}
              onPointerDown={readOnly ? undefined : handleCanvasPointerDown}
              onPointerMove={readOnly ? undefined : handleCanvasPointerMove}
              onPointerUp={readOnly ? undefined : handleCanvasPointerUp}
              onPointerLeave={readOnly ? undefined : handleCanvasPointerLeave}
            />
            {askPrompt && (
              <form style={s.askBox} onSubmit={handleAskSubmit}>
                <label style={s.askLabel}>{askPrompt}</label>
                <div style={s.askRow}>
                  <input style={s.askInput} value={askValue} onChange={e => setAskValue(e.target.value)} autoFocus />
                  <button className="btn-primary" style={s.askBtn} type="submit">OK</button>
                </div>
              </form>
            )}
          </div>

          {spritePanelFull}

          <div style={s.controls}>
            {!readOnly && showManualCheck && (
              <button className="btn-secondary" style={s.checkBtn} onClick={handleCheck}>Check</button>
            )}
            {scratchChecks.length > 0 && !checkAttempted && showManualCheck && !running && (
              <span style={s.checkNone}>Run your code, then click Check</span>
            )}
            {scratchChecks.length > 0 && !checkAttempted && hasAfterRunCheck && !showManualCheck && !running && (
              <span style={s.checkNone}>Run your code to check</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { display: 'flex', flex: 1, minHeight: 0, minWidth: 0, gap: 8, height: '100%', position: 'relative' },
  rootColumn: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0, height: '100%', position: 'relative' },
  overlay: { position: 'absolute', inset: 0, zIndex: 10, background: '#f5f5f5', borderRadius: 8 },
  editorPane: { flex: '1 1 420px', minWidth: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#F9F9F9', display: 'flex', flexDirection: 'column' },
  editorPaneHeader: { display: 'flex', alignItems: 'center', height: 30, padding: '0 6px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 },
  editorPaneBody: { flex: 1, minHeight: 0, position: 'relative' },
  flyoutToggleBtn: { padding: '3px 8px', fontSize: '0.72rem', fontFamily: 'var(--font-body)', fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 },
  stagePane: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: STAGE_W * MIN_STAGE_SCALE },
  stageToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  canvas: { display: 'block', width: STAGE_W, height: STAGE_H, border: '1px solid #e5e7eb', borderRadius: 8 },
  stageFrame: { position: 'relative', width: STAGE_W, height: STAGE_H },
  // ── Sprite panel (full, below stage) ─────────────────────────────────────────
  spritePanel: { display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 2px' },
  spriteTileRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  spriteTile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '6px 8px', border: '2px solid #e5e7eb', borderRadius: 8,
    background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
    transition: 'border-color 0.12s, background 0.12s', position: 'relative',
  },
  spriteTileActive: { borderColor: 'var(--colour-primary)', background: '#f3eeff' },
  spriteTileThumb: { width: 52, height: 52, borderRadius: 6, overflow: 'hidden', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  spriteTileHiddenBadge: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: 'rgba(0,0,0,0.35)', borderRadius: 6 },
  spriteTileName: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--colour-text)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  spriteAddTile: {
    width: 70, minHeight: 82, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '6px 8px', border: '2px dashed var(--colour-primary)', borderRadius: 8,
    background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--colour-primary)',
  },
  spriteAddIcon: { fontSize: '1.5rem', lineHeight: 1, fontWeight: 500 },
  spritePropBar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '4px 2px', borderTop: '1px solid #e5e7eb' },
  spritePanelEditor: { paddingTop: 4, borderTop: '1px solid #e5e7eb' },
  spritePropField: { display: 'flex', flexDirection: 'column', gap: 2 },
  spritePropLabel: { fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  spritePropInput: { width: 58, padding: '3px 5px', border: '1px solid #d1d5db', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--colour-text)', textAlign: 'center', background: '#fff' },
  showHideBtn: { width: 30, height: 26, border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', transition: 'background 0.1s' },
  showHideBtnOn:  { background: '#f0fdf4', borderColor: '#86efac' },
  showHideBtnOff: { background: '#fef2f2', borderColor: '#fca5a5', opacity: 0.7 },
  rotStyleGroup: { display: 'flex', gap: 2 },
  rotStyleBtn: { width: 26, height: 26, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontFamily: 'var(--font-body)', transition: 'background 0.1s, border-color 0.1s' },
  rotStyleBtnActive: { background: '#ede9fe', borderColor: 'var(--colour-primary)', color: 'var(--colour-primary)' },
  costumeSelect: { padding: '3px 5px', border: '1px solid #d1d5db', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--colour-text)', background: '#fff', cursor: 'pointer' },
  // ── Sprite panel compact (hideStage mode) ─────────────────────────────────────
  spritePanelCompact: { display: 'flex', flexDirection: 'column', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 },
  spriteTileRowCompact: { display: 'flex', gap: 5, flexWrap: 'wrap', padding: '5px 8px' },
  spriteTileCompact: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 8px 3px 4px', border: '2px solid #e5e7eb', borderRadius: 16,
    background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
    transition: 'border-color 0.12s, background 0.12s',
  },
  spriteTileCompactActive: { borderColor: 'var(--colour-primary)', background: '#f3eeff' },
  spriteTileCompactThumb: { width: 24, height: 24, borderRadius: 4, overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spriteTileCompactName: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--colour-text)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  spritePropBarCompact: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 8px 6px', borderTop: '1px solid #e5e7eb' },
  variableMonitors: { position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 5, pointerEvents: 'none' },
  variableMonitor: { display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,140,26,0.92)', borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700 },
  variableMonitorName: { padding: '2px 6px', color: '#fff', background: 'rgba(0,0,0,0.18)' },
  variableMonitorValue: { padding: '2px 6px', color: '#fff', minWidth: 24, textAlign: 'right' },
  broadcastToastStack: { position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', zIndex: 6, pointerEvents: 'none' },
  broadcastToast: { background: 'rgba(255, 171, 25, 0.96)', color: '#fff', padding: '4px 14px', borderRadius: 20, fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.22)', whiteSpace: 'nowrap', animation: 'scratch-toast-in 0.18s ease' },
  broadcastToastIcon: { fontSize: '0.75rem' },
  askBox: { position: 'absolute', left: 12, right: 12, bottom: 12, display: 'grid', gap: 8, padding: 10, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' },
  askLabel: { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--colour-text)' },
  askRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 },
  askInput: { minWidth: 0, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 14 },
  askBtn: { padding: '8px 12px', fontSize: 13, borderRadius: 6 },
  controls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  greenFlagBtn: { width: 44, height: 36, padding: 0, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', borderColor: '#16a34a' },
  stopFlagBtn:  { width: 44, height: 36, padding: 0, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderColor: '#dc2626', color: '#fff' },
  flagPole:   { width: 20, height: 18, display: 'inline-block', position: 'relative', borderLeft: '3px solid #fff' },
  flagBanner: { position: 'absolute', top: 1, left: 1, width: 15, height: 10, background: '#fff', borderRadius: '1px 5px 5px 1px' },
  stopIcon:   { width: 14, height: 14, display: 'inline-block', background: '#fff', borderRadius: 2 },
  resetBtn:   { padding: '8px 14px', fontSize: 14 },
  checkBtn:   { padding: '10px 20px', fontSize: 15 },
  centre:     { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 },
  loadingText: { fontFamily: 'var(--font-body)', color: 'var(--colour-text)', fontSize: '1rem' },
  errorText:   { fontFamily: 'var(--font-body)', color: '#ef4444', fontSize: '1rem' },
  checkNone:   { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af' },
}
