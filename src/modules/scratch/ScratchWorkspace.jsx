import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CollapsedPanelRail, CollapseTabButton } from '../../app/components/CollapsiblePanelControls'
import { useElementSize } from '../../shared/useElementSize.js'
import {
  loadBlocklyModules,
  DEFAULT_TOOLBOX,
  STAGE_TOOLBOX,
  DEFAULT_SPRITES,
  buildAlwaysOpenToolbox,
  addPrebuiltStacksToToolbox,
  createRunSignal,
  runAllSprites,
  runAllSpritesEvent,
  runBlockInContext,
  normalizeKey,
  saveWorkspace,
  loadWorkspace,
  evaluateScratchCheck,
  partialEvaluateScratchCheck,
  setSpriteContext,
  setBackdropContext,
  setCostumeContext,
  setVariableContext,
  addCreateVariableButtonToToolbox,
  CREATE_VARIABLE_CALLBACK_KEY,
} from './scratch'
import { resolveAssetFileUrl } from '../../shared/assetPaths'
import { FEEDBACK_TIMING, evaluateCheckWithCustomFeedback } from '../checks'
import { useTypeAssets } from '../../shared/useTypeAssets'
import PanelTabs, { PanelTabPanel } from '../../app/components/PanelTabs'
import { loadLayoutTab, saveLayoutTab } from '../../app/studentStorage'
import {
  createSpriteFromPreset,
  normalizeSpritePresets,
  createBackdropFromPreset,
  normalizeBackdropPresets,
  resolvePresetLibrary,
} from '../../shared/spritePresets'

const STAGE_W = 480
const STAGE_H = 360
const SYNC_DEBOUNCE = 1000
const CURSOR_THROTTLE_MS = 50
const CURSOR_STALE_MS = 2000
// A live cursor's click/drag "halo": a bigger, translucent yellow ring shown around
// (not instead of) the small pointer dot while the source's mouse button is held,
// for the whole drag — not just the initial click.
const CURSOR_HALO_RADIUS = 16
const CURSOR_HALO_FILL = 'rgba(234, 179, 8, 0.35)'
const CURSOR_HALO_STROKE = 'rgba(202, 138, 4, 0.6)'
const BLOCK_PLACED_CHECK_DEBOUNCE = 500
const IDLE_FEEDBACK_DEBOUNCE = 900
const MIN_STAGE_SCALE = 0.35
// Vertical space the stage toolbar (Run/Stop/Reset/+Backdrop) plus stagePane's own gap take
// above the canvas — height-scaling must leave room for this instead of scaling the canvas
// into the toolbar's space.
const STAGE_TOOLBAR_HEIGHT_RESERVE = 52
const MIN_EDITOR_WIDTH = 420
const MIN_EDITOR_WIDTH_COMPACT = 320
const MIN_EDITOR_WIDTH_COLLAPSED = 280
const MIN_EDITOR_WIDTH_COLLAPSED_COMPACT = 180
// Below this width, side-by-side editor+stage is too cramped — switch to an explicit
// Blocks/Stage tab switcher instead (see the `compact` state below). Matches the threshold
// LessonTaskContent.jsx uses for its own Instructions/Code tab tier. Exported:
// LessonTaskContent.jsx reuses this to decide when to tab Instructions away *before* the
// code area would otherwise be squeezed under it (see EXPLAINER_FIXED_WIDTH there) — the
// two thresholds must stay in lockstep, not just coincidentally match. Height has no
// equivalent compact threshold — see computeStageScale — but NARROW_BREAKPOINT_HEIGHT below
// still doubles as the "wide" reference point computeBlockScale interpolates from.
export const NARROW_BREAKPOINT = 1000
export const NARROW_BREAKPOINT_HEIGHT = 600
// Hysteresis margin for leaving compact mode once entered. Switching compact on/off changes
// which panes are mounted with a natural (content-driven) height — e.g. the Blocks pane's
// Blockly canvas vs. the shorter Stage pane — so the resulting re-measurement of *width* can
// land back on the opposite side of NARROW_BREAKPOINT from a single ResizeObserver tick, flip
// `compact` straight back, and repeat forever (visible as rapid layout flicker, most
// noticeable with the container width parked just above NARROW_BREAKPOINT). Requiring the
// container to clear the breakpoint by this margin before *exiting* compact — entry keeps the
// original threshold — breaks that loop without moving the documented 1000px entry point.
const COMPACT_EXIT_HYSTERESIS = 48
const SCRATCH_PANEL_TABS_SURFACE = 'scratch_panel'
// Block canvas auto-zoom range. There's no manual zoom any more (wheel/on-canvas controls
// were removed as confusing) — scale is purely a function of available space, continuously
// recalculated (see computeBlockScale). MAX matches the old fixed default scale, so a wide
// screen looks exactly as before; MIN is a readability floor — below it we lean on the
// flyout-collapse/compact-tab mechanisms instead of shrinking blocks further.
const BLOCK_SCALE_MAX = 0.75
const BLOCK_SCALE_MIN = 0.6

// Continuous, not tiered: full size whenever the container is at/above the same 1000×600
// "wide" reference point `compact` uses, interpolating down to the floor as it shrinks
// within compact territory. Exported (and pure) so it's unit-testable without Blockly.
export function computeBlockScale(width, height) {
  const wFactor = Math.min(1, width / NARROW_BREAKPOINT)
  const hFactor = Math.min(1, height / NARROW_BREAKPOINT_HEIGHT)
  const factor = Math.min(wFactor, hFactor)
  return BLOCK_SCALE_MIN + (BLOCK_SCALE_MAX - BLOCK_SCALE_MIN) * factor
}

// Shrinks the stage canvas to fit whatever space is actually available, on both axes — a
// container that's short (a laptop window, or the editor area shrinking when a banner takes
// up room above it) scales the stage down exactly like a narrow one does, rather than the
// stage getting clipped/scrolled or the layout switching modes. `height` is optional: the two
// callers that recalculate on flyout-collapse/drag-end only have a fresh width to hand, so
// they omit it and this falls back to width-only scaling for that call (height last set by
// the container-resize effect stays in effect for the other axis). Exported (and pure) so
// it's unit-testable without Blockly.
export function computeStageScale(width, height, { compact, flyoutCollapsed }) {
  const editorReserve = flyoutCollapsed
    ? (width < 760 ? MIN_EDITOR_WIDTH_COLLAPSED_COMPACT : MIN_EDITOR_WIDTH_COLLAPSED)
    : (width < 760 ? MIN_EDITOR_WIDTH_COMPACT : MIN_EDITOR_WIDTH)
  const widthScale = compact ? (width - 8) / (STAGE_W + 2) : (width - editorReserve - 8) / (STAGE_W + 2)
  const heightScale = height > 0 ? (height - STAGE_TOOLBAR_HEIGHT_RESERVE) / (STAGE_H + 2) : Infinity
  const nextScale = Math.min(1, Math.max(MIN_STAGE_SCALE, Math.min(widthScale, heightScale)))
  return Number.isFinite(nextScale) ? nextScale : 1
}
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

const SPRITE_TYPE_COLOR = { cat: '#FFA500', ball: '#4C97FF', star: '#FFD700', arrow: '#9966FF', bat: 'var(--colour-ink-strong)', parrot: '#22c55e' }

export function isSpriteStudentEditable(sprite) {
  return sprite?.studentEditable !== false
}

export function getSelectableScratchSprites(sprites, respectStudentEditable = false) {
  return respectStudentEditable ? sprites.filter(isSpriteStudentEditable) : sprites
}

// A student-added sprite/backdrop (from the runtime "Add sprite"/"Add backdrop" picker, or
// restored from persisted `__meta__`) is decorative only: it must never satisfy a check that
// assumes an author-known sprite set (`sprite_property`, `block_used`, etc. with no explicit
// `spriteName`, or `spriteWorkspaces[0]` fallbacks). Author-authored sprites are always
// checkable; student-added ones are excluded before check evaluation.
export function isSpriteCheckable(sprite) {
  return sprite?.studentAdded !== true
}

export function filterCheckableSpriteWorkspaces(spriteWorkspaces) {
  return (spriteWorkspaces ?? []).filter(isSpriteCheckable)
}

// A student-typed variable name must be non-empty and must not collide (case-insensitively)
// with an existing author-defined or already-created variable — collisions would let a
// student variable accidentally satisfy a `variable_equals`/`variable_compare` check that
// targets an author-known name.
export function isValidNewVariableName(name, existingVariables = []) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return false
  return !(existingVariables ?? []).some(v => v.name.toLowerCase() === trimmed.toLowerCase())
}

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
      ctx.fillStyle = 'var(--colour-ink-strong)'; ctx.fill()
      ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.1, r * 0.55, r * 0.3, -0.3, 0, Math.PI * 2)
      ctx.fillStyle = 'var(--colour-ink-strong)'; ctx.fill()
      ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.1, r * 0.55, r * 0.3, 0.3, 0, Math.PI * 2)
      ctx.fillStyle = 'var(--colour-ink-strong)'; ctx.fill()
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

function drawEmojiAtOrigin(ctx, emoji, r) {
  ctx.font = `${r * 2}px 'Noto Color Emoji', serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.scale(-1, 1)
  ctx.fillText(emoji, 0, 0)
}

function drawSpriteShape(ctx, s, type, emoji) {
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const dir = Number.isFinite(Number(s.direction)) ? Number(s.direction) : 90
  const rs  = s.rotationStyle ?? 'all around'
  const rot = rs === "don't rotate" || rs === 'left-right' ? 0 : (dir - 90) * (Math.PI / 180)
  const flipH = rs === 'left-right' && dir > 90 && dir < 270
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  if (flipH) ctx.scale(-1, 1)
  if (emoji) drawEmojiAtOrigin(ctx, emoji, r)
  else drawScratchSpriteAtOrigin(ctx, type, r)
  ctx.restore()
}

export function wrapScratchBubbleText(ctx, message, maxWidth) {
  const lines = []
  let line = ''

  for (const word of String(message).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)

  // A long unbroken value (for example a URL) still needs to stay inside the bubble.
  return lines.flatMap(currentLine => {
    if (ctx.measureText(currentLine).width <= maxWidth) return currentLine
    const characters = []
    let segment = ''
    for (const character of currentLine) {
      if (segment && ctx.measureText(segment + character).width > maxWidth) {
        characters.push(segment)
        segment = character
      } else {
        segment += character
      }
    }
    if (segment) characters.push(segment)
    return characters
  })
}

function drawBubble(ctx, s) {
  if (!s.bubble) return
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const fontSize = Math.max(11, r * 0.6)
  ctx.font = `${fontSize}px Quicksand, sans-serif`
  const maxTextWidth = 180
  const lines = wrapScratchBubbleText(ctx, s.bubble, maxTextWidth)
  if (!lines.length) return
  const lineHeight = Math.ceil(fontSize * 1.25)
  const bw = Math.min(Math.max(...lines.map(line => ctx.measureText(line).width)) + 20, maxTextWidth + 20)
  const bh = Math.max(lines.length * lineHeight + 16, 30)
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
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  const textY = by + 8 + fontSize
  lines.forEach((line, index) => ctx.fillText(line, bx + 10, textY + index * lineHeight))
}

function drawSpriteImage(ctx, s, img) {
  const cx = toCanvasX(s.x)
  const cy = toCanvasY(s.y)
  const r  = Math.max(4, (s.size / 100) * 24)
  const dir = Number.isFinite(Number(s.direction)) ? Number(s.direction) : 90
  const rs  = s.rotationStyle ?? 'all around'
  const rot = rs === "don't rotate" || rs === 'left-right' ? 0 : (dir - 90) * (Math.PI / 180)
  const flipH = rs === 'left-right' && dir > 90 && dir < 270
  const drawSize = r * 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  if (flipH) ctx.scale(-1, 1)
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

// Shared by real sprites and clones: picks the current costume image (falling back to the
// vector shape) and draws one instance. `state` may belong to a sprite or a clone of one.
function drawSpriteVisual(ctx, state, costumes, fallbackType, fallbackEmoji, assetsPath, imageCache) {
  if (!state?.visible) return
  const costumeEntry = costumes?.length > 0
    ? (costumes.find(c => c.name === state.costume) ?? costumes[0])
    : null
  if (costumeEntry?.image) {
    const url = resolveAssetFileUrl(assetsPath, costumeEntry.image)
    const img = imageCache[url]
    if (img) { drawSpriteImage(ctx, state, img); return }
  }
  drawSpriteShape(ctx, state, fallbackType ?? 'cat', costumeEntry?.emoji || fallbackEmoji)
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
  const rot = rs === "don't rotate" || rs === 'left-right' ? 0 : (dir - 90) * (Math.PI / 180)
  const flipH = rs === 'left-right' && dir > 90 && dir < 270

  const costumeEntry = sprite.costumes?.length > 0
    ? (sprite.costumes.find(c => c.name === state?.costume) ?? sprite.costumes[0])
    : null
  if (costumeEntry?.image && imageCache) {
    const url = resolveAssetFileUrl(assetsPath, costumeEntry.image)
    const img = imageCache[url]
    if (img) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
      if (flipH) ctx.scale(-1, 1)
      ctx.drawImage(img, -r, -r, r * 2, r * 2)
      ctx.restore(); return
    }
  }

  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  if (flipH) ctx.scale(-1, 1)
  const thumbEmoji = costumeEntry?.emoji || sprite.emoji
  if (thumbEmoji) drawEmojiAtOrigin(ctx, thumbEmoji, r)
  else drawScratchSpriteAtOrigin(ctx, sprite.type ?? 'cat', r)
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
      if (check.spriteName) {
        const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
        return target ? evaluateScratchCheck(check, target.workspace, null, null) : false
      }
      return spriteWorkspaces.some(sp => evaluateScratchCheck(check, sp.workspace, null, null))
    }
    if (check.type === 'variable_equals' || check.type === 'variable_compare') {
      return evaluateScratchCheck(check, null, null, signal)
    }
    if (check.type === 'block_run') {
      if (check.spriteName) {
        const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
        return target ? evaluateScratchCheck(check, target.workspace, null, signal) : false
      }
      return spriteWorkspaces.some(sp => evaluateScratchCheck(check, sp.workspace, null, signal))
    }
    if (check.type === 'blocks_in_order' || check.type === 'block_count') {
      if (check.spriteName) {
        const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
        if (!target) return false
        return evaluateScratchCheck(check, target.workspace, null, null)
      }
      return spriteWorkspaces.some(sp => evaluateScratchCheck(check, sp.workspace, null, null))
    }
    // sprite_property / sprite_property_delta / sprite_property_changed / costume_is: match by name or fall back to first
    const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
    if (!target) return false
    const preRunState = preRunSpriteStates[target.id] ?? null
    return evaluateScratchCheck(check, target.workspace, target.state, signal, preRunState)
  } catch { return false }
}

// Returns 'pass', 'pending', or 'fail' — used for after_block_placed evaluation.
function evalSingleCheckPartial(check, spriteWorkspaces) {
  if (!check?.type) return 'fail'
  try {
    const bySprite = (fn) => {
      if (check.spriteName) {
        const target = spriteWorkspaces.find(sp => sp.name === check.spriteName) ?? spriteWorkspaces[0]
        return target ? fn(target.workspace) : 'pending'
      }
      const results = spriteWorkspaces.map(sp => fn(sp.workspace))
      if (results.some(r => r === 'pass')) return 'pass'
      if (results.some(r => r === 'fail')) return 'fail'
      return 'pending'
    }
    return bySprite(ws => partialEvaluateScratchCheck(check, ws))
  } catch { return 'pending' }
}

function normalizeScratchChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter(c => c?.type)
  if (check.type) return [check]
  return []
}

// A live cursor's on-screen marker: a small solid dot for the exact pointer position,
// plus a bigger translucent yellow halo layered on top while the source's mouse
// button is held — for the whole click/drag, not just the initial press. Rendered
// inside a zero-size absolutely-positioned wrapper (see call sites) so both circles
// can center on the same point via `translate(-50%, -50%)` without recomputing
// per-circle offsets for two different diameters.
function LiveCursorDot({ down }) {
  return (
    <>
      {down && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: CURSOR_HALO_RADIUS * 2, height: CURSOR_HALO_RADIUS * 2, borderRadius: '50%',
          background: CURSOR_HALO_FILL, border: `2px solid ${CURSOR_HALO_STROKE}`,
          pointerEvents: 'none', zIndex: 6,
        }} />
      )}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 12, height: 12, borderRadius: '50%',
        background: '#7c3aed', border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: 6,
      }} />
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScratchWorkspace({
  task,
  readOnly = false,
  unrestricted = false,
  assetsPath = '',
  initialStates = null,
  initialState  = null,      // legacy single-sprite alias
  onStateChange,
  onSpriteStatesChange,
  onActivity,
  onCursorMove,
  onBlockDragMove,
  onCheckResult,
  externalStates = null,
  externalState  = null,     // legacy alias
  externalSpriteState = null,
  externalCursor = null,
  externalBlockDrag = null,
  syncNowKey = null,
  hideStage = false,
  selectedSpriteId: controlledSpriteId = null,
  onSpriteSelect = null,
  spritePanelTarget = null,
  onAddSprite = null,
  spritePanelEditor = null,
  hideSpriteProps = false,
  onRemoveSprite = null,
  spritePanelFooter = null,
  predefinedBlocks = null,   // Legacy PredefinedBlock[] merged for current tab
  prebuiltStacks = null,     // Visual stack snippets merged for current tab
  respectStudentEditable = false,
  forceCompact = false,
  onVisiblePanesChange = null,
  highlightedPanes = null,
  forcedPane = null,
  forcedPaneToken = null,
}) {
  // Sprites/backdrops start from the task's authored lists but become mutable local state so
  // an author-gated student "Add sprite"/"Add backdrop" picker (see below) can grow them during
  // a session without disturbing already-injected Blockly workspaces. ScratchWorkspace remounts
  // per task (callers key it by task id), so these re-seed correctly on every task change.
  const [sprites, setSprites] = useState(() => task?.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES)
  const [backdrops, setBackdrops] = useState(() => task?.backdrops?.length > 0 ? task.backdrops : [])
  // Variables shown/selectable at runtime = author-authored + any the student created this
  // session (restored from persisted `__meta__.createdVariables` on mount — see the init effect).
  const [createdVariables, setCreatedVariables] = useState([])
  const variables = useMemo(() => [...(task?.variables ?? []), ...createdVariables], [task?.variables, createdVariables])
  const selectableSprites = getSelectableScratchSprites(sprites, respectStudentEditable)

  const canAddSprite = !readOnly && !!task?.allowAddSprite
  const canAddBackdrop = !readOnly && !!task?.allowAddBackdrop
  const canCreateVariable = !readOnly && !!task?.allowCreateVariable
  const { defaultSprites: libSprites, defaultBackdrops: libBackdrops } = useTypeAssets(
    (canAddSprite || canAddBackdrop) ? 'scratch' : null,
  )
  const spriteLibraryOptions = resolvePresetLibrary(normalizeSpritePresets(libSprites), task?.addSpritePresetIds)
  const backdropLibraryOptions = resolvePresetLibrary(normalizeBackdropPresets(libBackdrops), task?.addBackdropPresetIds)
  const [spritePickerOpen, setSpritePickerOpen] = useState(false)
  const [backdropPickerOpen, setBackdropPickerOpen] = useState(false)
  const [variablePrompt, setVariablePrompt] = useState(null) // { value, error } | null
  const normInitStatesRef = useRef(null)

  // initialStates/initialState may be a function: it is resolved lazily inside the
  // init effect, AFTER the previous task's workspace has unmounted and flushed its
  // pending save — resolving during render would read storage before that flush.
  const resolveInitStates = () => {
    const raw = initialStates ?? initialState
    return normaliseInitialStates(typeof raw === 'function' ? raw() : raw, sprites)
  }
  const normExtStates   = externalStates ?? (externalState ? normaliseInitialStates(externalState, sprites) : null)

  const blocksDivRefs       = useRef({})
  const workspaceRefs       = useRef({})
  const spriteStatesRef     = useRef(initSpriteStates(sprites))
  const clonesRef           = useRef({})
  const preRunSpriteStatesRef = useRef({})
  const BlocklyRef          = useRef(null)
  const signalRef           = useRef(null)
  const syncTimerRef        = useRef(null)
  const pendingSyncRef      = useRef(false)
  const suppressChangeRef   = useRef(false)
  const lastCheckRef        = useRef(null)
  const lastCheckSuggestionRef = useRef('')
  const blockPlacedTimerRef = useRef(null)
  const idleFeedbackTimerRef = useRef(null)
  const evaluateBlockPlacedChecksRef = useRef(null)
  const evaluateIdleFeedbackRef = useRef(null)
  const lastEmittedStateRef = useRef(null)
  const statusRef           = useRef('loading')
  const runningRef          = useRef(false)
  const onStateChangeRef    = useRef(onStateChange)
  const onSpriteStatesChangeRef = useRef(onSpriteStatesChange)
  const onActivityRef       = useRef(onActivity)
  const onCursorMoveRef     = useRef(onCursorMove)
  const onBlockDragMoveRef  = useRef(onBlockDragMove)
  const onCheckResultRef    = useRef(onCheckResult)
  const onVisiblePanesChangeRef = useRef(onVisiblePanesChange)
  const draggingBlockRef    = useRef(null)
  const askResolveRef       = useRef(null)
  const inputStateRef       = useRef({ keysPressed: new Set(), mouseDown: false, mouseX: 0, mouseY: 0 })
  const keySignalsRef       = useRef(new Map()) // normalizedKey → active signal (at most one per key)
  const isDraggingRef       = useRef(false)
  const dragStartRef        = useRef(null)
  const dragMovedRef        = useRef(false)
  const draggingSpriteIdRef = useRef(null)
  const backdropNameRef     = useRef(backdrops[0]?.name ?? null)
  const lastCursorSentRef   = useRef(0)
  const cursorDotElRef      = useRef(null)
  const cursorHaloElRef     = useRef(null)
  const cursorRafRef        = useRef(null)
  const pendingCursorRef    = useRef(null)
  const imageCacheRef       = useRef({})
  const variableRuntimeRef  = useRef({})
  // Kept in sync every render (see below) so the `useCallback([])`-memoized emitWorkspaceState
  // — bound once per sprite workspace at injection time via addChangeListener — always reads
  // the latest sprites/backdrops/createdVariables instead of a stale closure from whichever
  // render was active when that workspace was injected.
  const spritesRef          = useRef(sprites)
  const backdropsRef        = useRef(backdrops)
  const createdVariablesRef = useRef(createdVariables)
  const spriteAddWrapRef    = useRef(null)
  const backdropAddWrapRef  = useRef(null)

  const [internalSelectedSpriteId, setInternalSelectedSpriteId] = useState(selectableSprites[0]?.id ?? (task?.enableStageCode ? '__stage__' : null))
  const selectedSpriteId = controlledSpriteId ?? internalSelectedSpriteId

  function canSelectSpriteId(id) {
    return id === '__stage__' || !respectStudentEditable || selectableSprites.some(sp => sp.id === id)
  }

  function setSelectedSpriteId(id) {
    if (!canSelectSpriteId(id)) return
    if (controlledSpriteId !== null) onSpriteSelect?.(id)
    else setInternalSelectedSpriteId(id)
  }

  function handleActivePaneChange(id) {
    setActivePane(id)
    saveLayoutTab(SCRATCH_PANEL_TABS_SURFACE, id)
  }

  const [status, setStatus]         = useState('loading')
  const [running, setRunning]       = useState(false)
  const [checkPassed, setCheckPassed] = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [spriteStates, setSpriteStates] = useState(() => initSpriteStates(sprites))
  const [cloneStates, setCloneStates] = useState({})
  const [variableValues, setVariableValues] = useState({})
  const [askPrompt, setAskPrompt]   = useState(null)
  const [askValue, setAskValue]     = useState('')
  const [broadcastToasts, setBroadcastToasts] = useState([])
  function pushToast(message, kind = 'broadcast', duration = 2000) {
    const id = Date.now() + Math.random()
    setBroadcastToasts(prev => [...prev, { id, message, kind }])
    setTimeout(() => setBroadcastToasts(prev => prev.filter(t => t.id !== id)), duration)
  }
  const [stageCursor, setStageCursor] = useState('default')
  const [stageScale, setStageScale] = useState(1)
  const [flyoutCollapsed, setFlyoutCollapsed] = useState(false)
  // Manual-only rail collapse for the stage panel in the wide (non-compact) layout — the
  // student clicks to reclaim editor space; nothing auto-toggles it. See `compact` below
  // for the separate, measurement-driven Blocks/Stage tab switcher used at narrow sizes.
  const [stagePanelCollapsed, setStagePanelCollapsed] = useState(false)
  const [compact, setCompact] = useState(forceCompact)
  const [activePane, setActivePane] = useState(() => loadLayoutTab(SCRATCH_PANEL_TABS_SURFACE) || 'blocks')
  const [backdropName, setBackdropName] = useState(backdrops[0]?.name ?? null)
  const [imageVersion, setImageVersion] = useState(0)
  const [cursorStale, setCursorStale] = useState(false)
  const canvasRef              = useRef(null)
  const stageToolbarRef        = useRef(null)
  const rootRef                = useRef(null)
  const [rootSizeRef, rootSize] = useElementSize()
  const setRootNode = useCallback(node => {
    rootRef.current = node
    rootSizeRef(node)
  }, [rootSizeRef])
  const rootResizeFrameRef     = useRef(0)
  const flyoutCollapsedRef     = useRef(false)
  const compactRef             = useRef(forceCompact)
  const blockScaleRef          = useRef(BLOCK_SCALE_MAX)
  const blockDragActiveRef     = useRef(false)
  const pendingScaleRecalcRef  = useRef(false)
  const hideStageRef           = useRef(hideStage)
  const isWindowResizeRef      = useRef(false)

  flyoutCollapsedRef.current = flyoutCollapsed
  compactRef.current = compact
  hideStageRef.current = hideStage
  spritesRef.current = sprites
  backdropsRef.current = backdrops
  createdVariablesRef.current = createdVariables

  statusRef.current = status
  runningRef.current = running
  onStateChangeRef.current = onStateChange
  onSpriteStatesChangeRef.current = onSpriteStatesChange
  onActivityRef.current = onActivity
  onCursorMoveRef.current = onCursorMove
  onBlockDragMoveRef.current = onBlockDragMove
  onCheckResultRef.current = onCheckResult
  onVisiblePanesChangeRef.current = onVisiblePanesChange

  // ── Sync Blockly context globals (lazy — only read when dropdowns open) ──────
  useEffect(() => {
    setSpriteContext(sprites)
    setBackdropContext(backdrops)
    setVariableContext(variables)
  }, [sprites, backdrops, variables])

  // ── Report which of Blocks/Stage are actually on screen ──────────────────────
  // Mirrors the rendering conditions above (compact tab switcher, hideStage, and the
  // student's manual stage-collapse rail) so callers — e.g. the teacher's student list —
  // can show what a student is currently looking at without duplicating this logic.
  useEffect(() => {
    const panes = hideStage
      ? ['blocks']
      : compact
        ? [activePane]
        : stagePanelCollapsed
          ? ['blocks']
          : ['blocks', 'stage']
    onVisiblePanesChangeRef.current?.(panes)
  }, [hideStage, compact, activePane, stagePanelCollapsed])

  // Teacher "force switch tab" — a one-time jump to Blocks or Stage, applied through the
  // same path as a manual click (so it's remembered like one) rather than a persistent
  // controlled prop: the student stays free to switch away again immediately afterward.
  // Guarded by forcedPaneToken (the command's pushedAt) so the same token never re-applies
  // on an unrelated re-render.
  const lastForcedPaneTokenRef = useRef(null)
  useEffect(() => {
    if (!forcedPane || forcedPaneToken == null || lastForcedPaneTokenRef.current === forcedPaneToken) return
    lastForcedPaneTokenRef.current = forcedPaneToken
    handleActivePaneChange(forcedPane)
  }, [forcedPane, forcedPaneToken])

  useEffect(() => {
    const costumes = (sprites.find(sp => sp.id === selectedSpriteId) ?? sprites[0])?.costumes ?? []
    setCostumeContext(costumes.map(c => ({ ...c, imageUrl: c.image ? resolveAssetFileUrl(assetsPath, c.image) : undefined })))
  }, [sprites, selectedSpriteId, assetsPath])

  useEffect(() => {
    if (controlledSpriteId !== null) return
    if (selectedSpriteId && canSelectSpriteId(selectedSpriteId)) return
    setInternalSelectedSpriteId(selectableSprites[0]?.id ?? (task?.enableStageCode ? '__stage__' : null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respectStudentEditable, sprites, task?.enableStageCode])

  // ── Draw stage ──────────────────────────────────────────────────────────────
  const drawStage = useCallback((states, clones = {}) => {
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
      drawSpriteVisual(ctx, states[sp.id], sp.costumes, sp.type ?? 'cat', sp.emoji, assetsPath, imageCacheRef.current)
    }
    for (const clone of Object.values(clones)) {
      const base = sprites.find(sp => sp.id === clone.baseId)
      drawSpriteVisual(ctx, clone.state, clone.costumes, base?.type ?? 'cat', base?.emoji, assetsPath, imageCacheRef.current)
    }
    for (const sp of sprites) {
      const state = states[sp.id]
      if (state?.bubble) drawBubble(ctx, state)
    }
    for (const clone of Object.values(clones)) {
      if (clone.state?.bubble) drawBubble(ctx, clone.state)
    }
  }, [sprites, backdrops, assetsPath])

  useEffect(() => { drawStage(spriteStates, cloneStates) }, [spriteStates, cloneStates, backdropName, imageVersion, drawStage])

  useEffect(() => {
    if (!stagePanelCollapsed) drawStage(spriteStatesRef.current, clonesRef.current)
  }, [stagePanelCollapsed, drawStage])

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

  // ── Wait for the emoji web font ───────────────────────────────────────────────
  // Canvas text is drawn with whatever font is *already* loaded at the moment
  // fillText() runs — unlike DOM text, it doesn't automatically repaint once a
  // `font-display: swap` web font (Noto Color Emoji, loaded via index.css) finishes
  // downloading. A sprite/clone drawn as an emoji before the font is ready renders in
  // the browser's fallback emoji glyphs and then never updates, even after the real
  // font loads — unless something else happens to trigger a redraw first, which is why
  // it can look like it "flips" between the fallback and Noto styles inconsistently.
  // Explicitly wait for it once, then force one redraw via the same imageVersion bump
  // preload effects above use.
  useEffect(() => {
    let cancelled = false
    // Promise.resolve(...) wraps the possibly-undefined result (older browsers with no
    // Font Loading API) so .catch()/.finally() are always safe to chain.
    Promise.resolve(document.fonts?.load("16px 'Noto Color Emoji'"))
      .catch(() => {})
      .finally(() => { if (!cancelled) setImageVersion(v => v + 1) })
    return () => { cancelled = true }
  }, [])

  // ── Emit workspace states ────────────────────────────────────────────────────
  const emitWorkspaceState = useCallback(() => {
    if (!BlocklyRef.current || suppressChangeRef.current) return
    try {
      const states = {}
      for (const [id, ws] of Object.entries(workspaceRefs.current)) {
        states[id] = saveWorkspace(BlocklyRef.current, ws)
      }
      // Student-added sprites/backdrops/variables carry through the same save/carry/remote-reset
      // path as authored blocks: stashed under a `__meta__` key alongside the per-sprite Blockly
      // states so callers that store this blob opaquely (carry-through, teacher live view) need
      // no changes. Restored on mount — see the init effect's `restoreAddedSprites` call.
      const addedSprites = spritesRef.current.filter(sp => sp.studentAdded)
      const addedBackdrops = backdropsRef.current.filter(b => b.studentAdded)
      const createdVars = createdVariablesRef.current
      if (addedSprites.length || addedBackdrops.length || createdVars.length) {
        states.__meta__ = {
          addedSprites,
          addedBackdrops,
          createdVariables: createdVars,
          variableValues: { ...variableRuntimeRef.current },
        }
      }
      pendingSyncRef.current = false
      lastEmittedStateRef.current = states
      onStateChangeRef.current?.(states)
    } catch {}
  }, [])

  // Persists a student sprite/backdrop addition or variable creation immediately, rather than
  // waiting for the next Blockly block-change event (a freshly-added sprite/backdrop/variable
  // may have no blocks of its own yet, so nothing would otherwise trigger a save).
  function persistMetaNow() {
    clearTimeout(syncTimerRef.current)
    emitWorkspaceState()
  }

  // ── Build sprite workspace array for run calls ───────────────────────────────
  const resizeBlocklyWorkspaces = useCallback(() => {
    const Blockly = BlocklyRef.current
    if (!Blockly) return
    try { Blockly.WidgetDiv?.hide?.() } catch {}
    try {
      if (Blockly.DropDownDiv?.hideWithoutAnimation) Blockly.DropDownDiv.hideWithoutAnimation()
      else Blockly.DropDownDiv?.hide?.()
    } catch {}
    // Only preserve the scroll position for genuine window-resize events.
    // Flyout toggles and post-drag recalcs must let Blockly reposition the canvas
    // naturally so it accounts for the flyout appearing/disappearing.
    const isWindowResize = isWindowResizeRef.current
    isWindowResizeRef.current = false
    for (const ws of Object.values(workspaceRefs.current)) {
      try {
        try { ws.setScale(blockScaleRef.current) } catch {}
        const scrollX = ws.scrollX
        const scrollY = ws.scrollY
        Blockly.svgResize(ws)
        if (isWindowResize && flyoutCollapsedRef.current && Number.isFinite(scrollX) && Number.isFinite(scrollY)) {
          ws.scrollX = scrollX
          ws.scrollY = scrollY
          ws.translate?.(scrollX, scrollY)
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    requestAnimationFrame(resizeBlocklyWorkspaces)
  }, [stagePanelCollapsed, resizeBlocklyWorkspaces])

  const buildSpriteWorkspaces = useCallback(() => {
    const result = sprites.map(sp => ({
      id: sp.id,
      name: sp.name,
      studentAdded: !!sp.studentAdded,
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
    onSpriteStatesChangeRef.current?.(nextStates, clonesRef.current, backdropNameRef.current)
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
    const withStacks = prebuiltStacks?.length || predefinedBlocks?.length
      ? addPrebuiltStacksToToolbox(baseToolbox, prebuiltStacks, predefinedBlocks)
      : baseToolbox
    const withCreateVariable = canCreateVariable ? addCreateVariableButtonToToolbox(withStacks) : withStacks
    return buildAlwaysOpenToolbox(withCreateVariable, { position: { x: state.x, y: state.y } })
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
    // A click that lands on an editable field (text/number/dropdown) opens that field's editor —
    // Blockly's own click-event path (handleWorkspaceClickEvent) already excludes this case, but
    // this raw DOM listener doesn't, so it would run the block just from clicking in to edit it.
    if (event.target?.closest?.('.blocklyEditableField')) return
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

  // Adds sprites restored from persisted `__meta__.addedSprites`, or one newly created via the
  // "Add sprite" picker, to workspace state. Blockly workspace injection for these happens in
  // the "ensure workspaces" effect below, keyed off `sprites`.
  function restoreAddedSprites(addedSprites) {
    if (!addedSprites?.length) return
    setSprites(prev => [...prev, ...addedSprites])
    const nextStates = { ...spriteStatesRef.current }
    for (const sp of addedSprites) nextStates[sp.id] = defaultSpriteState(sp)
    commitSpriteStates(nextStates)
  }

  // ── Student "Add sprite"/"Add backdrop" pickers, and "Make a Variable" ──────
  // Tagged `studentAdded: true` so checks (see filterCheckableSpriteWorkspaces) and the
  // author's own sprite/backdrop set never confuse these with authored ones. Persisted
  // immediately (see persistMetaNow) since a freshly-added sprite/backdrop/variable has no
  // Blockly block-change event of its own to trigger the usual debounced save.
  function handleAddSprite(preset) {
    const newSprite = { ...createSpriteFromPreset(sprites, preset), studentAdded: true }
    setSprites(prev => [...prev, newSprite])
    commitSpriteStates({ ...spriteStatesRef.current, [newSprite.id]: defaultSpriteState(newSprite) })
    setSpritePickerOpen(false)
    requestAnimationFrame(persistMetaNow)
  }

  function handleAddBackdrop(preset) {
    const newBackdrop = { ...createBackdropFromPreset(backdrops, preset), studentAdded: true }
    setBackdrops(prev => [...prev, newBackdrop])
    backdropNameRef.current = newBackdrop.name
    setBackdropName(newBackdrop.name)
    setBackdropPickerOpen(false)
    requestAnimationFrame(persistMetaNow)
  }

  function submitCreateVariable(rawName) {
    if (!isValidNewVariableName(rawName, variables)) {
      setVariablePrompt(prev => ({
        value: prev?.value ?? rawName ?? '',
        error: String(rawName ?? '').trim() ? 'That name is already used.' : 'Enter a name.',
      }))
      return
    }
    const name = String(rawName).trim()
    setCreatedVariables(prev => [...prev, { name }])
    setVariablePrompt(null)
    requestAnimationFrame(persistMetaNow)
  }

  function attachWorkspaceListeners(ws, div, spriteId, Blockly) {
    if (readOnly) return
    ws.addChangeListener((event) => {
      if (handleWorkspaceClickEvent(event, ws, spriteId, Blockly)) return
      if (suppressChangeRef.current) return
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        if (event.isStart) {
          onActivityRef.current?.({ type: 'block_drag', at: Date.now() })
          draggingBlockRef.current = { ws, spriteId, blockId: event.blockId }
        } else if (draggingBlockRef.current?.blockId === event.blockId) {
          draggingBlockRef.current = null
          onBlockDragMoveRef.current?.(null)
        }
      }
      // UI-only events (viewport, selection, toolbox) don't change the blocks —
      // saving on them would persist an empty/no-op state on mere task visits.
      if (event.isUiEvent) return
      // Any real edit invalidates a prior check attempt (e.g. clicking a block to edit its
      // field runs it via click-to-run, which can fail; the failure banner must not linger
      // once the learner starts fixing it). The debounced evaluators below recompute a fresh
      // verdict for after_block_placed/idle-feedback checks; after_run-only checks stay
      // cleared until the learner runs again.
      if (lastCheckRef.current !== null) clearCheckFeedback()
      pendingSyncRef.current = true
      clearTimeout(syncTimerRef.current)
      if (event.type === 'create') {
        // A brand-new block (e.g. just dragged out of the flyout) doesn't exist
        // in a watching mirror's last-synced copy yet, so the live block-drag
        // position stream has nothing to move there until this lands — sync
        // right away instead of waiting out the debounce, so it appears (at
        // wherever it currently sits) and live-following can pick it up for
        // the rest of the drag instead of only once the drag settles.
        emitWorkspaceState()
      } else {
        syncTimerRef.current = setTimeout(emitWorkspaceState, SYNC_DEBOUNCE)
      }
      clearTimeout(blockPlacedTimerRef.current)
      blockPlacedTimerRef.current = setTimeout(() => evaluateBlockPlacedChecksRef.current?.(), BLOCK_PLACED_CHECK_DEBOUNCE)
      clearTimeout(idleFeedbackTimerRef.current)
      idleFeedbackTimerRef.current = setTimeout(() => evaluateIdleFeedbackRef.current?.(), IDLE_FEEDBACK_DEBOUNCE)
    })
    div.addEventListener('click', event => handleWorkspaceDomClick(event, ws, spriteId, Blockly))
    // Cursor position is captured off the hot path: a block (or flyout-stack) drag
    // fires very frequent native pointermove events on this same div, and reading
    // layout synchronously inside that handler (screenToWsCoordinates forces a
    // getBoundingClientRect) interleaves with Blockly's own drag rendering and
    // visibly delays it. Stash the raw point and do the conversion in the next
    // animation frame instead — by then Blockly's own pointermove-driven DOM
    // writes for this frame have already happened, so the read doesn't force an
    // extra out-of-band layout pass. Deliberately still runs during drags: that's
    // when a watching teacher most wants to see the cursor.
    div.addEventListener('pointermove', event => {
      if (!onCursorMoveRef.current && !onBlockDragMoveRef.current) return
      // The block palette (Blockly's own flyout) is a separate sub-workspace nested
      // inside this same div, with its own independent pan/scroll — converting a
      // point over it through the *main* workspace's transform would place the
      // mirror's dot at a meaningless coordinate, generally off-screen. Detected
      // here (cheap DOM check) rather than in the rAF below, since `event.target`
      // is only valid on the event itself.
      const overFlyout = !!event.target?.closest?.('.blocklyFlyout')
      pendingCursorRef.current = { ws, spriteId, clientX: event.clientX, clientY: event.clientY, down: (event.buttons & 1) === 1, overFlyout }
      if (cursorRafRef.current) return
      cursorRafRef.current = requestAnimationFrame(() => {
        cursorRafRef.current = null
        const pending = pendingCursorRef.current
        if (!pending) return
        const now = Date.now()
        if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return
        lastCursorSentRef.current = now
        // A block actively being dragged in this workspace: stream its live
        // position too, read straight off Blockly's own drag-tracked coordinate
        // (no layout involved) so the mirror can follow it in real time instead
        // of only jumping to the settled position once the drag ends.
        const dragging = draggingBlockRef.current
        if (dragging && dragging.ws === pending.ws && onBlockDragMoveRef.current) {
          const block = pending.ws.getBlockById(dragging.blockId)
          if (block) {
            const xy = block.getRelativeToSurfaceXY()
            onBlockDragMoveRef.current({ spriteId: dragging.spriteId, blockId: dragging.blockId, x: xy.x, y: xy.y, at: now })
          }
        }
        if (!onCursorMoveRef.current) return
        const flyoutWs = pending.overFlyout ? pending.ws.getFlyout?.()?.getWorkspace?.() : null
        const coordWs = flyoutWs ?? pending.ws
        const wsCoord = Blockly.utils.svgMath.screenToWsCoordinates(coordWs, { x: pending.clientX, y: pending.clientY })
        onCursorMoveRef.current({ target: flyoutWs ? 'flyout' : 'workspace', spriteId: pending.spriteId, x: wsCoord.x, y: wsCoord.y, down: pending.down, at: now })
      })
    })
    div.addEventListener('pointerleave', () => {
      pendingCursorRef.current = null
      onCursorMoveRef.current?.(null)
    })
  }

  // Injects a Blockly workspace for one sprite/stage id, unless one already exists. Used both
  // by the initial mount effect and by the "ensure workspaces" effect that reacts to sprites
  // added later (student picker, or restored from persisted `__meta__.addedSprites`).
  function injectWorkspaceFor(Blockly, spriteId, initState) {
    const div = blocksDivRefs.current[spriteId]
    if (!div || workspaceRefs.current[spriteId]) return null
    const ws = Blockly.inject(div, {
      toolbox: buildToolboxForSprite(spriteId),
      renderer: 'zelos',
      grid: { spacing: 24, length: 2, colour: '#eee', snap: true },
      // Zoom is fully automatic (see computeBlockScale/blockScaleRef) — no manual wheel-zoom
      // or on-canvas zoom controls, since a student fighting an auto-zoom that keeps
      // recalculating from container size is exactly the "auto behavior fights a manual
      // choice" problem the compact-tab rework above was built to avoid. The wheel now
      // pans instead, since it no longer has a zoom job to do.
      zoom: { controls: false, wheel: false, startScale: BLOCK_SCALE_MAX, minScale: BLOCK_SCALE_MIN, maxScale: BLOCK_SCALE_MAX },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
      readOnly,
    })
    workspaceRefs.current[spriteId] = ws
    Blockly.svgResize(ws)
    if (canCreateVariable && !readOnly) {
      try { ws.registerButtonCallback(CREATE_VARIABLE_CALLBACK_KEY, () => setVariablePrompt({ value: '', error: '' })) } catch {}
    }
    if (initState) {
      try {
        suppressChangeRef.current = true
        loadWorkspace(Blockly, ws, initState)
        requestAnimationFrame(() => { suppressChangeRef.current = false })
      } catch { suppressChangeRef.current = false }
    }
    attachWorkspaceListeners(ws, div, spriteId, Blockly)
    return ws
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

        const normInitStates = resolveInitStates()
        normInitStatesRef.current = normInitStates

        for (const sp of sprites) injectWorkspaceFor(Blockly, sp.id, normInitStates[sp.id])

        // Create stage workspace if enabled
        if (task?.enableStageCode) injectWorkspaceFor(Blockly, '__stage__', normInitStates?.['__stage__'])

        if (!cancelled) setStatus('ready')

        // Publish the freshly-loaded state right away, rather than waiting for the
        // learner's first edit: a live watcher (teacher broadcast or "watch one
        // student") otherwise has no blocks at all until that first edit's debounced
        // sync lands, so an in-progress drag of an already-existing block has nothing
        // to move — it only appears once the drag ends and the delayed sync catches up.
        if (!cancelled && !readOnly) emitWorkspaceState()

        // Restore student-added sprites/backdrops/variables from the persisted `__meta__`
        // blob (same "state" object blocks are saved in — see emitWorkspaceState/notifyCheck).
        // Injecting Blockly workspaces for any restored sprites happens in the "ensure
        // workspaces" effect below, once `sprites` state grows to include them.
        const meta = normInitStates?.__meta__ ?? null
        if (!cancelled && meta) {
          restoreAddedSprites(meta.addedSprites)
          if (meta.addedBackdrops?.length) setBackdrops(prev => [...prev, ...meta.addedBackdrops])
          if (meta.createdVariables?.length) setCreatedVariables(meta.createdVariables)
          if (meta.variableValues) {
            variableRuntimeRef.current = { ...meta.variableValues }
            setVariableValues({ ...meta.variableValues })
          }
        }
      } catch (err) {
        console.error('Scratch init error:', err)
        if (!cancelled) setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(syncTimerRef.current)
      clearTimeout(blockPlacedTimerRef.current)
      clearTimeout(idleFeedbackTimerRef.current)
      // Flush any pending debounced save before disposing, otherwise edits made in
      // the last SYNC_DEBOUNCE ms before a task change are silently lost and carry
      // picks up a stale (possibly empty) earlier save.
      if (pendingSyncRef.current) emitWorkspaceState()
      if (signalRef.current) signalRef.current.stopped = true
      for (const s of keySignalsRef.current.values()) s.stopped = true
      keySignalsRef.current.clear()
      for (const ws of Object.values(workspaceRefs.current)) ws?.dispose?.()
      workspaceRefs.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Ensure a Blockly workspace exists for every current sprite ───────────────
  // Fires whenever `sprites` grows after the initial mount (a student added one via the
  // picker, or one was just restored from persisted `__meta__.addedSprites` above). Sprites
  // already injected are skipped, so this never disturbs an in-progress edit.
  useEffect(() => {
    if (status !== 'ready' || !BlocklyRef.current) return
    let injectedAny = false
    for (const sp of sprites) {
      if (workspaceRefs.current[sp.id]) continue
      injectWorkspaceFor(BlocklyRef.current, sp.id, normInitStatesRef.current?.[sp.id])
      injectedAny = true
    }
    if (injectedAny) requestAnimationFrame(resizeBlocklyWorkspaces)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprites, status])

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
      requestAnimationFrame(() => {
        // Skip svgResize while a block is being dragged — svgResize shifts ws.scrollX
        // by the flyout width, which would make the dragged block jump away from the cursor.
        // The deferred recalc triggered on pointerup will run svgResize afterwards.
        if (blockDragActiveRef.current) { pendingScaleRecalcRef.current = true; return }
        try { BlocklyRef.current.svgResize(ws) } catch {}
      })
    } catch {}
  }, [flyoutCollapsed, selectedSpriteId, status])

  // ── Update toolbox when task.toolbox or predefined blocks change ─────────────
  useEffect(() => {
    if (status !== 'ready' || !BlocklyRef.current) return
    try {
      for (const sp of sprites) refreshSpriteToolbox(sp.id)
      if (task?.enableStageCode) refreshSpriteToolbox('__stage__')
    } catch {}
  }, [task?.toolbox, task?.enableStageCode, unrestricted, status, sprites, predefinedBlocks, prebuiltStacks, flyoutCollapsed])

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

  // ── Load external sprite/stage state (mirror) ────────────────────────────────
  // Read-only mirror instances receive live sprite/clone/backdrop state from a
  // remote source (Go-Live or broadcast) and must render it without ever running
  // the interpreter — drawStage() already redraws purely from this state, so a
  // plain setState here is sufficient and never touches commitSpriteStates
  // (which would re-fire onSpriteStatesChange and echo the mirror's own state back).
  useEffect(() => {
    if (!readOnly || !externalSpriteState || status !== 'ready') return
    if (externalSpriteState.spriteStates) {
      spriteStatesRef.current = externalSpriteState.spriteStates
      setSpriteStates(externalSpriteState.spriteStates)
    }
    setCloneStates(externalSpriteState.cloneStates ?? {})
    if (externalSpriteState.backdropName) {
      backdropNameRef.current = externalSpriteState.backdropName
      setBackdropName(externalSpriteState.backdropName)
    }
  }, [externalSpriteState, status, readOnly])

  // ── Live cursor (mirror) ──────────────────────────────────────────────────────
  // A stale (no longer updating) cursor fades out rather than freezing in place.
  useEffect(() => {
    setCursorStale(false)
    if (!externalCursor?.at) return undefined
    const remaining = CURSOR_STALE_MS - (Date.now() - externalCursor.at)
    if (remaining <= 0) { setCursorStale(true); return undefined }
    const t = setTimeout(() => setCursorStale(true), remaining)
    return () => clearTimeout(t)
  }, [externalCursor?.at])

  const effectiveCursor = (!readOnly || !externalCursor || cursorStale) ? null : externalCursor
  const isWorkspaceCursor = effectiveCursor?.target === 'workspace' || effectiveCursor?.target === 'flyout'

  // Follow the source's active sprite tab while a workspace- or flyout-target cursor
  // is live, so the cursor is never moving on a tab the mirror isn't currently showing.
  useEffect(() => {
    if (!isWorkspaceCursor) return
    if (effectiveCursor.spriteId && effectiveCursor.spriteId !== selectedSpriteId) {
      setSelectedSpriteId(effectiveCursor.spriteId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCursor?.target, effectiveCursor?.spriteId])

  // Render the workspace/flyout cursor as an SVG dot (plus a bigger translucent
  // yellow halo while a click/drag is held) appended directly into that sprite's
  // Blockly block-canvas (or, for a flyout-target cursor, the flyout's own nested
  // sub-workspace canvas) so both inherit that surface's own pan/zoom/scroll
  // transform automatically — no manual workspace-to-screen conversion needed.
  useEffect(() => {
    if (cursorHaloElRef.current) {
      cursorHaloElRef.current.remove()
      cursorHaloElRef.current = null
    }
    if (cursorDotElRef.current) {
      cursorDotElRef.current.remove()
      cursorDotElRef.current = null
    }
    if (!isWorkspaceCursor || status !== 'ready') return undefined
    const ws = workspaceRefs.current[effectiveCursor.spriteId]
    const canvas = effectiveCursor.target === 'flyout' ? ws?.getFlyout?.()?.getWorkspace?.()?.getCanvas?.() : ws?.getCanvas?.()
    if (!canvas) return undefined
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    halo.setAttribute('r', String(CURSOR_HALO_RADIUS))
    halo.setAttribute('fill', CURSOR_HALO_FILL)
    halo.setAttribute('stroke', CURSOR_HALO_STROKE)
    halo.setAttribute('stroke-width', '2')
    halo.style.pointerEvents = 'none'
    halo.style.display = 'none'
    canvas.appendChild(halo)
    cursorHaloElRef.current = halo
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    dot.setAttribute('r', '6')
    dot.setAttribute('fill', '#7c3aed')
    dot.setAttribute('stroke', '#fff')
    dot.setAttribute('stroke-width', '2')
    dot.style.pointerEvents = 'none'
    canvas.appendChild(dot)
    cursorDotElRef.current = dot
    return () => { halo.remove(); dot.remove() }
  }, [effectiveCursor?.target, effectiveCursor?.spriteId, status])

  useEffect(() => {
    if (!cursorDotElRef.current || !isWorkspaceCursor) return
    cursorDotElRef.current.setAttribute('cx', effectiveCursor.x)
    cursorDotElRef.current.setAttribute('cy', effectiveCursor.y)
    if (cursorHaloElRef.current) {
      cursorHaloElRef.current.setAttribute('cx', effectiveCursor.x)
      cursorHaloElRef.current.setAttribute('cy', effectiveCursor.y)
      cursorHaloElRef.current.style.display = effectiveCursor.down ? '' : 'none'
    }
  }, [effectiveCursor?.x, effectiveCursor?.y, effectiveCursor?.target, effectiveCursor?.down])

  // ── Live block drag (mirror) ──────────────────────────────────────────────────
  // Repositions a block the mirror already has (from the last settled state) to
  // follow the source's in-progress drag, so the watcher sees it move in real
  // time instead of only jumping once the drag ends and the full state resyncs.
  // moveTo() is a plain reposition, not a real drag — it doesn't touch connections
  // or fire through addChangeListener (mirror workspaces never register one), so
  // it can't loop back into this component's own sync logic. If the dragged block
  // isn't part of the mirror's currently-loaded state (e.g. just pulled from the
  // flyout) there's nothing to move yet — it appears once the drag ends.
  useEffect(() => {
    if (!readOnly || !externalBlockDrag || status !== 'ready' || !BlocklyRef.current) return
    const ws = workspaceRefs.current[externalBlockDrag.spriteId]
    const block = ws?.getBlockById(externalBlockDrag.blockId)
    if (!block || typeof block.moveTo !== 'function') return
    try {
      block.moveTo(new BlocklyRef.current.utils.Coordinate(externalBlockDrag.x, externalBlockDrag.y))
    } catch {}
  }, [externalBlockDrag, status, readOnly])

  useEffect(() => {
    if (!syncNowKey || status !== 'ready' || readOnly) return
    clearTimeout(syncTimerRef.current)
    emitWorkspaceState()
  }, [syncNowKey, status, readOnly, emitWorkspaceState])

  // Evaluate after_block_placed checks once the workspace is ready (handles pre-loaded blocks).
  useEffect(() => {
    if (status !== 'ready') return
    evaluateBlockPlacedChecksRef.current?.()
  }, [status])

  // Responsive stage scaling — shrink canvas CSS size to keep editor visible — plus the
  // compact-mode (Blocks/Stage tabs) decision. Compact is width-only: it's a narrow-screen
  // (mobile-like) fallback where each pane needs the full width in turn. A short-but-wide
  // container (e.g. the editor area shrinking when a banner takes up room above it) instead
  // scales the stage down on the height axis too — see computeStageScale — so it shrinks
  // in place rather than switching layouts or getting clipped.
  useEffect(() => {
    const w = rootSize.width
    const h = rootSize.height
    // Not measured yet (ref not attached / first paint hasn't happened) — wait for a real size.
    if (!w && !h) return
    // See COMPACT_EXIT_HYSTERESIS: once compact, require clearing the breakpoint by that
    // margin before switching back, so the layout change compact causes can't immediately
    // re-measure back across the same line and flip straight back.
    const wasCompact = compactRef.current
    const isCompact = forceCompact || (wasCompact
      ? w < NARROW_BREAKPOINT + COMPACT_EXIT_HYSTERESIS
      : w < NARROW_BREAKPOINT)
    setCompact(isCompact)
    compactRef.current = isCompact
    blockScaleRef.current = computeBlockScale(w, h)

    const scale = computeStageScale(w, h, { compact: isCompact, flyoutCollapsed: flyoutCollapsedRef.current })
    setStageScale(scale)
    cancelAnimationFrame(rootResizeFrameRef.current)
    isWindowResizeRef.current = true
    rootResizeFrameRef.current = requestAnimationFrame(resizeBlocklyWorkspaces)
    return () => cancelAnimationFrame(rootResizeFrameRef.current)
  }, [rootSize.width, rootSize.height, hideStage, forceCompact, resizeBlocklyWorkspaces])

  // Re-calculate stage scale when flyout collapses/expands (ResizeObserver won't re-fire).
  // If a pointer drag is active (block being dragged from the palette), defer until pointerup
  // so the editor pane doesn't resize mid-drag and break Blockly's coordinate conversion.
  useEffect(() => {
    if (hideStage) return
    if (blockDragActiveRef.current) {
      pendingScaleRecalcRef.current = true
      return
    }
    const el = rootRef.current
    if (!el) return
    const { width: w, height: h } = el.getBoundingClientRect()
    if (!w) return
    setStageScale(computeStageScale(w, h, { compact, flyoutCollapsed }))
    requestAnimationFrame(resizeBlocklyWorkspaces)
  }, [flyoutCollapsed, hideStage, compact, resizeBlocklyWorkspaces])

  // Track pointer drags on the root so scale recalc is deferred until the drag ends.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const runPendingRecalc = () => {
      if (!pendingScaleRecalcRef.current) return
      pendingScaleRecalcRef.current = false
      if (hideStageRef.current) return
      const rootEl = rootRef.current
      if (!rootEl) return
      const { width: w, height: h } = rootEl.getBoundingClientRect()
      if (!w) return
      setStageScale(computeStageScale(w, h, { compact: compactRef.current, flyoutCollapsed: flyoutCollapsedRef.current }))
      requestAnimationFrame(resizeBlocklyWorkspaces)
    }

    const onDown = () => { blockDragActiveRef.current = true }
    const onUp = () => { blockDragActiveRef.current = false; runPendingRecalc() }

    el.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [resizeBlocklyWorkspaces])

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
    signal.onBroadcast = msg => pushToast(msg, 'broadcast')
    // A script threw instead of running to completion (a bad block combination, a missing
    // sprite/variable reference, etc.). This used to be swallowed silently — no message, no
    // console line, nothing — so a broken script just appeared to do nothing. Surface it via
    // the same toast mechanism broadcasts already use, in plain language rather than the raw
    // error text, since this module's audience is often younger learners debugging by trial
    // and error and a raw stack trace wouldn't mean much to them.
    signal.onError = () => pushToast('This script ran into a problem and stopped.', 'error', 4000)
    signal.onCloneCreated = clone => {
      clonesRef.current = { ...clonesRef.current, [clone.id]: clone }
      setCloneStates(clonesRef.current)
    }
    signal.onCloneUpdated = (id, state) => {
      if (!clonesRef.current[id]) return
      clonesRef.current = { ...clonesRef.current, [id]: { ...clonesRef.current[id], state } }
      setCloneStates(clonesRef.current)
    }
    signal.onCloneDeleted = id => {
      if (!clonesRef.current[id]) return
      const next = { ...clonesRef.current }
      delete next[id]
      clonesRef.current = next
      setCloneStates(next)
    }
    return signal
  }, [backdrops])

  function clearClones() {
    clonesRef.current = {}
    setCloneStates({})
  }

  // ── Check helpers ────────────────────────────────────────────────────────────
  const check = task?.check
  const scratchChecks = normalizeScratchChecks(check)
  // after_block_placed is handled via workspace change listener, not the run cycle.
  const hasAfterRunCheck = scratchChecks.some(c => c.evaluation !== 'manual' && c.evaluation !== 'after_block_placed')
  const hasAfterBlockPlacedCheck = scratchChecks.some(c => c.evaluation === 'after_block_placed')

  const notifyCheck = useCallback((passed, force = false, meta = {}) => {
    const suggestion = meta.suggestion ?? ''
    setCheckPassed(passed)
    setCheckAttempted(true)
    if (!force && lastCheckRef.current === passed && lastCheckSuggestionRef.current === suggestion) return
    lastCheckRef.current = passed
    lastCheckSuggestionRef.current = suggestion
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
      suggestion,
    })
  }, [])

  // Clears any displayed check feedback — used when workspace returns to a pending state.
  function clearCheckFeedback() {
    setCheckPassed(false)
    setCheckAttempted(false)
    lastCheckRef.current = null
    lastCheckSuggestionRef.current = ''
  }

  // Evaluates all after_block_placed checks and updates feedback.
  // Called on every debounced workspace change when after_block_placed checks are present.
  function evaluateBlockPlacedChecks() {
    if (!BlocklyRef.current) return
    const afterBlockChecks = scratchChecks.filter(c => c.evaluation === 'after_block_placed')
    if (afterBlockChecks.length === 0) return
    const sws = filterCheckableSpriteWorkspaces(buildSpriteWorkspaces())
    const results = afterBlockChecks.map(c => evalSingleCheckPartial(c, sws))
    const completionPassed = results.every(r => r === 'pass')
    if (completionPassed && hasAfterRunCheck) {
      // All block-placement checks pass, but there are also after_run checks (e.g. block_run)
      // that only a real Run can verify — don't declare the check attempted/passed yet.
      clearCheckFeedback()
    } else if (results.every(r => r === 'pass')) {
      const evaluation = evaluateCheckWithCustomFeedback(
        task,
        completionPassed,
        feedbackCheck => evalSingleCheck(feedbackCheck, sws, signalRef.current, preRunSpriteStatesRef.current),
        '',
        {},
        { feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT },
      )
      notifyCheck(evaluation.passed, false, { suggestion: evaluation.suggestion })
    } else if (results.some(r => r === 'fail')) {
      const evaluation = evaluateCheckWithCustomFeedback(
        task,
        false,
        feedbackCheck => evalSingleCheck(feedbackCheck, sws, signalRef.current, preRunSpriteStatesRef.current),
        '',
        {},
        { feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT },
      )
      notifyCheck(false, false, { suggestion: evaluation.suggestion })
    } else {
      clearCheckFeedback()
    }
  }
  evaluateBlockPlacedChecksRef.current = evaluateBlockPlacedChecks

  function evaluateIdleFeedback() {
    if (!BlocklyRef.current || (!task?.feedbackChecks && !task?.incorrectChecks)) return
    const sws = filterCheckableSpriteWorkspaces(buildSpriteWorkspaces())
    // Idle evaluation happens purely from editing, without a run — only after_block_placed
    // checks can be assessed here. after_run checks (e.g. block_run) need a real run and must
    // not be judged against a stale signalRef from a previous run.
    const idleChecks = scratchChecks.filter(c => c.evaluation === 'after_block_placed')
    const completionPassed = idleChecks.length > 0 && idleChecks.every(c => evalSingleCheck(c, sws, signalRef.current, preRunSpriteStatesRef.current))
    const evaluation = evaluateCheckWithCustomFeedback(
      task,
      completionPassed,
      feedbackCheck => evalSingleCheck(feedbackCheck, sws, signalRef.current, preRunSpriteStatesRef.current),
      '',
      {},
      { feedbackTiming: FEEDBACK_TIMING.ON_IDLE },
    )
    if (evaluation.feedbackResults.some(result => result.passed)) {
      notifyCheck(evaluation.passed, true, { suggestion: evaluation.suggestion })
    }
  }
  evaluateIdleFeedbackRef.current = evaluateIdleFeedback

  function finishRun(signal) {
    if (!signal.stopped) {
      runningRef.current = false
      setRunning(false)
      if (scratchChecks.length > 0 && hasAfterRunCheck) {
        const sws = filterCheckableSpriteWorkspaces(buildSpriteWorkspaces())
        const afterRunChecks = scratchChecks.filter(c => c.evaluation !== 'manual' && c.evaluation !== 'after_block_placed')
        const completionPassed = afterRunChecks.every(c => evalSingleCheck(c, sws, signal, preRunSpriteStatesRef.current))
        const evaluation = evaluateCheckWithCustomFeedback(
          task,
          completionPassed,
          feedbackCheck => evalSingleCheck(feedbackCheck, sws, signal, preRunSpriteStatesRef.current),
          '',
          {},
          { feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT },
        )
        notifyCheck(evaluation.passed, false, { suggestion: evaluation.suggestion })
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
    onActivityRef.current?.({ type: 'green_flag', at: Date.now() })
    stopAll()
    clearClones()
    lastCheckRef.current = null
    lastCheckSuggestionRef.current = ''
    preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
    runningRef.current = true
    setRunning(true)
    setCheckAttempted(false)
    const signal = createSignal()
    signalRef.current = signal
    try { await runAllSprites(buildSpriteWorkspaces(), signal) } catch (err) { signal.onError?.(err) }
    finishRun(signal)
  }

  async function runClickedBlock(block, spriteId) {
    if (runningRef.current || statusRef.current !== 'ready') return
    onActivityRef.current?.({ type: 'block_click', at: Date.now() })
    stopAll()
    lastCheckRef.current = null
    lastCheckSuggestionRef.current = ''
    preRunSpriteStatesRef.current = { ...spriteStatesRef.current }
    runningRef.current = true
    setRunning(true)
    setCheckAttempted(false)
    const signal = createSignal()
    signalRef.current = signal
    const startBlock = block.type === 'event_whenflagclicked' ? block.getNextBlock() : block
    try { await runBlockInContext(startBlock, buildSpriteWorkspaces(), spriteId, signal) } catch (err) { signal.onError?.(err) }
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
    try { await runAllSpritesEvent(buildSpriteWorkspaces(), 'event_whenkeypressed', signal, key) } catch (err) { signal.onError?.(err) }
    if (keySignalsRef.current.get(key) === signal) keySignalsRef.current.delete(key)
    if (shouldFinishRun) finishRun(signal)
  }

  function handleStop() {
    onActivityRef.current?.({ type: 'stop', at: Date.now() })
    stopAll()
    clearClones()
    runningRef.current = false
    setRunning(false)
    setAskPrompt(null)
    askResolveRef.current?.('')
    askResolveRef.current = null
  }

  function handleResetStage() {
    stopAll()
    clearClones()
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
    lastCheckSuggestionRef.current = ''
    setCheckPassed(false)
    setCheckAttempted(false)
  }

  function handleCheck() {
    const sws = filterCheckableSpriteWorkspaces(buildSpriteWorkspaces())
    const completionPassed = scratchChecks.every(c => evalSingleCheck(c, sws, signalRef.current))
    const evaluation = evaluateCheckWithCustomFeedback(
      task,
      completionPassed,
      feedbackCheck => evalSingleCheck(feedbackCheck, sws, signalRef.current, preRunSpriteStatesRef.current),
      '',
      {},
      { feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT },
    )
    notifyCheck(evaluation.passed, true, { suggestion: evaluation.suggestion })
  }

  // ── Pointer events on canvas ─────────────────────────────────────────────────
  function handleCanvasPointerDown(event) {
    inputStateRef.current.mouseDown = true
    if (signalRef.current) signalRef.current.mouseDown = true

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (STAGE_W / rect.width)
    const y = (event.clientY - rect.top)  * (STAGE_H / rect.height)

    // Sent immediately (not throttled) so a watcher sees the press-down moment itself,
    // not just whatever the next throttled pointermove happens to catch.
    if (!readOnly && onCursorMoveRef.current) {
      lastCursorSentRef.current = Date.now()
      onCursorMoveRef.current({ target: 'stage', x: x - STAGE_W / 2, y: STAGE_H / 2 - y, down: true, at: lastCursorSentRef.current })
    }

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
        setStageCursor(isSpriteStudentEditable(sp) || !respectStudentEditable ? 'grabbing' : 'default')
        return
      }
    }
  }

  function handleCanvasPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (STAGE_W / rect.width)
    const y = (event.clientY - rect.top)  * (STAGE_H / rect.height)
    const scratchX = x - STAGE_W / 2
    const scratchY = STAGE_H / 2 - y
    inputStateRef.current.mouseX = scratchX
    inputStateRef.current.mouseY = scratchY
    if (signalRef.current) { signalRef.current.mouseX = scratchX; signalRef.current.mouseY = scratchY }

    // Sent unconditionally, including for the whole duration of a sprite drag below
    // (this used to sit after that drag's early `return`, so a watcher's cursor
    // dot froze at wherever the drag started — and its "down" halo along with it —
    // instead of following the drag and fading out 2s after the last update).
    if (!readOnly && onCursorMoveRef.current) {
      const now = Date.now()
      if (now - lastCursorSentRef.current >= CURSOR_THROTTLE_MS) {
        lastCursorSentRef.current = now
        onCursorMoveRef.current({ target: 'stage', x: scratchX, y: scratchY, down: inputStateRef.current.mouseDown, at: now })
      }
    }

    if (isDraggingRef.current && dragStartRef.current && draggingSpriteIdRef.current) {
      const dx = x - dragStartRef.current.canvasX
      const dy = y - dragStartRef.current.canvasY
      if (!dragMovedRef.current && Math.hypot(dx, dy) > 3) {
        dragMovedRef.current = true
        onActivityRef.current?.({ type: 'sprite_drag', at: Date.now(), spriteId: draggingSpriteIdRef.current })
      }
      if (respectStudentEditable && !isSpriteStudentEditable(sprites.find(sp => sp.id === draggingSpriteIdRef.current))) return
      if (dragMovedRef.current) {
        const id = draggingSpriteIdRef.current
        const newX = Math.max(-240, Math.min(240, dragStartRef.current.spriteX + dx))
        const newY = Math.max(-180, Math.min(180, dragStartRef.current.spriteY - dy))
        const updated = { ...spriteStatesRef.current[id], x: newX, y: newY }
        commitSpriteStates({ ...spriteStatesRef.current, [id]: updated })
      }
      return
    }

    let overSprite = false
    for (let i = sprites.length - 1; i >= 0; i--) {
      if (respectStudentEditable && !isSpriteStudentEditable(sprites[i])) continue
      const state = spriteStatesRef.current[sprites[i].id]
      if (state && hitTest(state, x, y)) { overSprite = true; break }
    }
    setStageCursor(overSprite ? 'grab' : 'default')
  }

  function handleCanvasPointerUp() {
    inputStateRef.current.mouseDown = false
    if (signalRef.current) signalRef.current.mouseDown = false

    if (!readOnly && onCursorMoveRef.current) {
      lastCursorSentRef.current = Date.now()
      onCursorMoveRef.current({ target: 'stage', x: inputStateRef.current.mouseX, y: inputStateRef.current.mouseY, down: false, at: lastCursorSentRef.current })
    }

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
        lastCheckSuggestionRef.current = ''
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
    } else if (wasDragging && wasMoved && draggedId && (!respectStudentEditable || isSpriteStudentEditable(sprites.find(sp => sp.id === draggedId)))) {
      refreshSpriteToolbox(draggedId)
    }
  }

  function handleCanvasPointerLeave() {
    if (!isDraggingRef.current) setStageCursor('default')
    if (!readOnly) onCursorMoveRef.current?.(null)
  }

  // ── Pointer events over the stage toolbar (green flag / stop / reset) ────────
  // Tracked as a plain pixel offset from the toolbar's own top-left corner, not a
  // fraction of its bounding box: the toolbar container stretches to fill whatever
  // width its layout gives it (flex, `justifyContent: 'flex-start'`), but the
  // buttons inside stay a fixed size and hug the left edge — so a container that's
  // wider on one viewer than another (e.g. one compact/"minimised", one not) leaves
  // a fraction of THAT width pointing at a different button on each side. Pixel
  // offsets from the left edge stay correct regardless, since the button row's
  // own layout (sizes, gaps, and the reserved-but-hidden collapse button in
  // compact mode — see the CollapseTabButton `visibility` note above) is identical
  // between viewers.
  function toolbarOffset(event) {
    const rect = stageToolbarRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    }
  }

  function handleToolbarPointerMove(event) {
    if (readOnly || !onCursorMoveRef.current) return
    const now = Date.now()
    if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return
    const offset = toolbarOffset(event)
    if (!offset) return
    lastCursorSentRef.current = now
    onCursorMoveRef.current({ target: 'toolbar', x: offset.x, y: offset.y, down: (event.buttons & 1) === 1, at: now })
  }

  function handleToolbarPointerDown(event) {
    if (readOnly || !onCursorMoveRef.current) return
    const offset = toolbarOffset(event)
    if (!offset) return
    lastCursorSentRef.current = Date.now()
    onCursorMoveRef.current({ target: 'toolbar', x: offset.x, y: offset.y, down: true, at: lastCursorSentRef.current })
  }

  function handleToolbarPointerUp(event) {
    if (readOnly || !onCursorMoveRef.current) return
    const offset = toolbarOffset(event)
    if (!offset) return
    lastCursorSentRef.current = Date.now()
    onCursorMoveRef.current({ target: 'toolbar', x: offset.x, y: offset.y, down: false, at: lastCursorSentRef.current })
  }

  function handleToolbarPointerLeave() {
    if (!readOnly) onCursorMoveRef.current?.(null)
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
      // Typing into a Blockly field editor (or any other text input) fires DOM keydown events
      // on that input — those keystrokes are text, not a stage "key pressed" event, and must
      // not run whenkeypressed hats or re-evaluate after_run checks against a no-op run.
      const tag = event.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || event.target?.isContentEditable) return
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

  // Close the sprite/backdrop add pickers on an outside click.
  useEffect(() => {
    if (!spritePickerOpen && !backdropPickerOpen) return
    function onPointerDown(e) {
      if (spritePickerOpen && spriteAddWrapRef.current && !spriteAddWrapRef.current.contains(e.target)) setSpritePickerOpen(false)
      if (backdropPickerOpen && backdropAddWrapRef.current && !backdropAddWrapRef.current.contains(e.target)) setBackdropPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [spritePickerOpen, backdropPickerOpen])

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
        {selectableSprites.map(sp => (
          <div
            key={sp.id}
            role="button"
            tabIndex={0}
            style={{ ...s.spriteTile, ...(sp.id === selectedSpriteId ? s.spriteTileActive : {}) }}
            onClick={() => setSelectedSpriteId(sp.id)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedSpriteId(sp.id)}
          >
            <div style={s.spriteTileThumb}>
              <SpriteThumb sprite={sp} state={spriteStates[sp.id]} imageCache={imageCacheRef.current} assetsPath={assetsPath} size={52} imageVersion={imageVersion} />
              {!spriteStates[sp.id]?.visible && <span style={s.spriteTileHiddenBadge} title="Hidden">👁</span>}
            </div>
            <span style={s.spriteTileName}>{sp.name}</span>
            {!readOnly && onRemoveSprite && (
              <button
                type="button"
                className="te-sprite-remove-circle"
                onClick={e => { e.stopPropagation(); onRemoveSprite(sp.id) }}
                disabled={sprites.length <= 1}
                title="Remove sprite"
              >✕</button>
            )}
          </div>
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
        {canAddSprite && (
          <div style={s.addPickerWrap} ref={spriteAddWrapRef}>
            <button
              type="button"
              style={s.spriteAddTile}
              onClick={() => setSpritePickerOpen(open => !open)}
              aria-expanded={spritePickerOpen}
              aria-label="Add sprite"
              title="Add sprite"
            >
              <span style={s.spriteAddIcon}>+</span>
              <span style={s.spriteTileName}>Add</span>
            </button>
            {spritePickerOpen && (
              <div style={s.addPickerPanel} role="listbox" aria-label="Choose a sprite to add">
                {spriteLibraryOptions.length === 0 && <p style={s.addPickerEmpty}>No sprites available</p>}
                {spriteLibraryOptions.map(preset => (
                  <button key={preset.id} type="button" style={s.addPickerItem} role="option" onClick={() => handleAddSprite(preset)}>
                    {preset.costumes?.[0]?.image
                      ? <img src={resolveAssetFileUrl(assetsPath, preset.costumes[0].image)} alt="" style={s.addPickerThumbImg} onError={e => { e.target.style.display = 'none' }} />
                      : <span style={s.addPickerThumbEmoji}>{preset.costumes?.[0]?.emoji || preset.emoji || '🟢'}</span>}
                    <span style={s.addPickerName}>{preset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {selectedSpriteId !== '__stage__' && !hideSpriteProps && renderSpriteProps(false)}
      {spritePanelEditor && <div style={s.spritePanelEditor}>{spritePanelEditor}</div>}
      {spritePanelFooter && <div style={s.spritePanelFooter}>{spritePanelFooter}</div>}
    </div>
  )

  const spritePanelCompact = (
    <div style={s.spritePanelCompact}>
      <div style={s.spriteTileRowCompact}>
        {stageTileCompact}
        {selectableSprites.map(sp => (
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
    <div className="scratch-workspace" style={hideStage ? s.rootColumn : compact ? s.rootCompact : s.root} ref={setRootNode}>
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

      {variablePrompt && (
        <div style={s.modalOverlay} onClick={() => setVariablePrompt(null)}>
          <form
            style={s.variableModal}
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); submitCreateVariable(variablePrompt.value) }}
          >
            <label style={s.askLabel} htmlFor="scratch-new-variable-name">New variable name</label>
            <input
              id="scratch-new-variable-name"
              style={s.askInput}
              autoFocus
              value={variablePrompt.value}
              onChange={e => setVariablePrompt({ value: e.target.value, error: '' })}
            />
            {variablePrompt.error && <span style={s.errorText}>{variablePrompt.error}</span>}
            <div style={s.variableModalRow}>
              <button type="button" className="btn-secondary" onClick={() => setVariablePrompt(null)}>Cancel</button>
              <button type="submit" className="btn-primary" style={s.askBtn}>Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Sprite panel above editor when stage is hidden and no external selector */}
      {hideStage && !onSpriteSelect && spritePanelCompact}
      {spritePanelTarget && createPortal(spritePanelFull, spritePanelTarget)}

      {/* Blocks/Stage tab switcher — compact layouts only. Both panes below stay mounted
          regardless of which tab is active (hidden via `display:none`, not unmounted): the
          Blocks pane holds live Blockly-injected DOM the workspaces are bound to, and the
          Stage pane must keep mirroring live sprite/backdrop state for teacher live-view. */}
      {!hideStage && compact && (
        <PanelTabs
          label="Scratch panel"
          tabs={[{ id: 'blocks', label: 'Blocks' }, { id: 'stage', label: 'Stage' }]}
          activeId={activePane}
          onChange={handleActivePaneChange}
          highlightedIds={highlightedPanes}
        />
      )}

      {/* Block editor — all workspace divs stacked, only selected one visible */}
      <div style={compact ? { ...s.editorPane, display: activePane === 'blocks' ? 'flex' : 'none' } : s.editorPane}>
        <div style={s.editorPaneHeader}>
          <button
            type="button"
            onClick={() => setFlyoutCollapsed(c => !c)}
            style={flyoutCollapsed ? s.flyoutToggleBtnOpen : s.flyoutToggleBtnHide}
            title={flyoutCollapsed ? 'Show blocks palette' : 'Hide blocks palette'}
          >
            {flyoutCollapsed ? (
              <>
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6" rx="1"/>
                  <rect x="8" y="0" width="6" height="6" rx="1"/>
                  <rect x="0" y="8" width="6" height="6" rx="1"/>
                  <rect x="8" y="8" width="6" height="6" rx="1"/>
                </svg>
                Blocks
              </>
            ) : '◀ Hide'}
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
      {!hideStage && !compact && stagePanelCollapsed && (
        <div style={s.stageRailPane}>
          <CollapsedPanelRail
            onClick={() => setStagePanelCollapsed(false)}
            label="Stage"
            direction="left"
            title="Show Stage"
            ariaLabel="Show Stage"
          />
        </div>
      )}
      {!hideStage && (compact || !stagePanelCollapsed) && (
        <div style={compact ? { ...s.stagePane, display: activePane === 'stage' ? 'flex' : 'none', flexGrow: 1, flexShrink: 1, flexBasis: 0 } : s.stagePane}>
          <div
            ref={stageToolbarRef}
            style={s.stageToolbar}
            onPointerMove={readOnly ? undefined : handleToolbarPointerMove}
            onPointerDown={readOnly ? undefined : handleToolbarPointerDown}
            onPointerUp={readOnly ? undefined : handleToolbarPointerUp}
            onPointerLeave={readOnly ? undefined : handleToolbarPointerLeave}
          >
            {effectiveCursor?.target === 'toolbar' && (
              <div style={{ position: 'absolute', left: effectiveCursor.x, top: effectiveCursor.y }}>
                <LiveCursorDot down={effectiveCursor.down} />
              </div>
            )}
            <CollapseTabButton
              onClick={() => setStagePanelCollapsed(true)}
              direction="right"
              title="Collapse Stage"
              ariaLabel="Collapse Stage"
              // Reserved (not simply omitted) in compact mode: this button toggles the
              // side-by-side collapsible stage pane, which doesn't exist in compact's
              // Blocks/Stage tab layout — but removing it outright shifted the green
              // flag and every button after it left by its width, so its position no
              // longer matched between compact and non-compact layouts.
              style={compact ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
            />
            <button
              type="button"
              className="btn-primary"
              style={s.greenFlagBtn}
              onClick={e => { e.currentTarget.blur(); handleRun() }}
              aria-label="Run"
              title="Run green flag scripts"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 15 15"><rect x="1" y="0" width="2" height="15" rx=".5" fill="#374151"/><polygon points="3,1 14,6 3,11" fill="#22c55e"/></svg>
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
            <button type="button" className="btn-secondary" style={s.resetBtn} onClick={handleResetStage} title="Reset the stage: put sprites back where they started">
              Reset Stage
            </button>
            {canAddBackdrop && (
              <div style={s.addPickerWrap} ref={backdropAddWrapRef}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={s.resetBtn}
                  onClick={() => setBackdropPickerOpen(open => !open)}
                  aria-expanded={backdropPickerOpen}
                  title="Add backdrop"
                >
                  + Backdrop
                </button>
                {backdropPickerOpen && (
                  <div style={s.addPickerPanel} role="listbox" aria-label="Choose a backdrop to add">
                    {backdropLibraryOptions.length === 0 && <p style={s.addPickerEmpty}>No backdrops available</p>}
                    {backdropLibraryOptions.map(preset => (
                      <button key={preset.id} type="button" style={s.addPickerItem} role="option" onClick={() => handleAddBackdrop(preset)}>
                        {preset.image
                          ? <img src={resolveAssetFileUrl(assetsPath, preset.image)} alt="" style={s.addPickerThumbImg} onError={e => { e.target.style.display = 'none' }} />
                          : <span style={{ ...s.addPickerThumbEmoji, background: preset.colour ?? '#fff', borderRadius: 4 }} />}
                        <span style={s.addPickerName}>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                  <div key={t.id} style={t.kind === 'error' ? s.errorToast : s.broadcastToast}>
                    <span style={s.broadcastToastIcon}>{t.kind === 'error' ? '⚠️' : '📢'}</span> {t.message}
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
            {effectiveCursor?.target === 'stage' && (
              <div style={{ position: 'absolute', left: toCanvasX(effectiveCursor.x) * stageScale, top: toCanvasY(effectiveCursor.y) * stageScale }}>
                <LiveCursorDot down={effectiveCursor.down} />
              </div>
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
            {scratchChecks.length > 0 && !checkAttempted && hasAfterBlockPlacedCheck && !hasAfterRunCheck && !showManualCheck && !running && (
              <span style={s.checkNone}>Place the blocks to check</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  // flex: '1 0 auto' (not '1 1 0%'/height:100%) so this never shrinks below its content's
  // natural height — the stage stays a constant size and the editor pane (which stretches
  // to match via align-items:stretch) tracks it, instead of both being squeezed by
  // whatever vertical space sibling page content happens to leave.
  root: { display: 'flex', flex: '1 1 auto', minWidth: 0, minHeight: 0, height: '100%', gap: 8, position: 'relative' },
  rootColumn: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0, height: '100%', position: 'relative' },
  // Compact layout: Blocks/Stage tab bar on top, one full-width pane below (see `compact`).
  rootCompact: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0, height: '100%', gap: 8, position: 'relative' },
  overlay: { position: 'absolute', inset: 0, zIndex: 10, background: '#f5f5f5', borderRadius: 8 },
  editorPane: { flex: '1 1 420px', minWidth: 0, border: '1px solid var(--ui-border-neutral)', borderRadius: 8, overflow: 'hidden', background: '#F9F9F9', display: 'flex', flexDirection: 'column' },
  editorPaneHeader: { display: 'flex', alignItems: 'center', height: 30, padding: '0 6px', borderBottom: '1px solid var(--ui-border-neutral)', background: '#fafafa', flexShrink: 0 },
  editorPaneBody: { flex: 1, minHeight: 0, position: 'relative' },
  flyoutToggleBtnOpen: { padding: '4px 10px', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 700, border: '2px solid var(--colour-primary)', borderRadius: 6, background: 'var(--colour-primary)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' },
  flyoutToggleBtnHide: { padding: '4px 10px', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 700, border: '2px solid var(--colour-primary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--colour-primary)', display: 'flex', alignItems: 'center', gap: 5 },
  // The compact variant overrides these with flexGrow/flexShrink/flexBasis longhands
  // rather than `flex: 1`: mixing the shorthand onto a style that already sets flexShrink
  // made React warn about removing a style property during rerender on every transition.
  stagePane: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: STAGE_W * MIN_STAGE_SCALE, minHeight: 0, overflow: 'auto' },
  stageRailPane: { width: 44, minWidth: 44, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  stageToolbar: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, flexWrap: 'wrap' },
  canvas: { display: 'block', width: STAGE_W, height: STAGE_H, border: '1px solid var(--ui-border-neutral)', borderRadius: 8 },
  stageFrame: { position: 'relative', width: STAGE_W, height: STAGE_H },
  // ── Sprite panel (full, below stage) ─────────────────────────────────────────
  spritePanel: { display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0 2px' },
  spriteTileRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  spriteTile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '6px 8px', border: '2px solid var(--ui-border-neutral)', borderRadius: 8,
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
  // ── Student "Add sprite"/"Add backdrop" pickers ──────────────────────────────
  addPickerWrap: { position: 'relative' },
  addPickerPanel: {
    position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
    display: 'flex', flexWrap: 'wrap', gap: 6, width: 220, maxHeight: 220, overflowY: 'auto',
    padding: 8, background: '#fff', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
  },
  addPickerEmpty: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--colour-muted-soft)', margin: 0 },
  addPickerItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 64,
    padding: '4px 4px 6px', border: '1px solid var(--ui-border-neutral)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
  },
  addPickerThumbImg: { width: 32, height: 32, objectFit: 'contain' },
  addPickerThumbEmoji: { width: 32, height: 32, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  addPickerName: { fontSize: '0.68rem', fontWeight: 600, color: 'var(--colour-text)', maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  // ── "Make a Variable" modal ──────────────────────────────────────────────────
  modalOverlay: { position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  variableModal: { display: 'grid', gap: 8, width: 260, padding: 16, background: '#fff', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.22)' },
  variableModalRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  spritePropBar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '4px 2px', borderTop: '1px solid var(--ui-border-neutral)' },
  spritePanelEditor: { paddingTop: 10, borderTop: '1px solid var(--ui-border-neutral)' },
  spritePanelFooter: { paddingTop: 8 },
  spritePropField: { display: 'flex', flexDirection: 'column', gap: 2 },
  spritePropLabel: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--colour-muted)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  spritePropInput: { width: 58, padding: '3px 5px', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--colour-text)', textAlign: 'center', background: '#fff' },
  showHideBtn: { width: 30, height: 26, border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 5, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', transition: 'background 0.1s' },
  showHideBtnOn:  { background: '#f0fdf4', borderColor: '#86efac' },
  showHideBtnOff: { background: '#fef2f2', borderColor: '#fca5a5', opacity: 0.7 },
  rotStyleGroup: { display: 'flex', gap: 2 },
  rotStyleBtn: { width: 26, height: 26, border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 4, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontFamily: 'var(--font-body)', transition: 'background 0.1s, border-color 0.1s' },
  rotStyleBtnActive: { background: '#ede9fe', borderColor: 'var(--colour-primary)', color: 'var(--colour-primary)' },
  costumeSelect: { padding: '3px 5px', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 5, fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--colour-text)', background: '#fff', cursor: 'pointer' },
  // ── Sprite panel compact (hideStage mode) ─────────────────────────────────────
  spritePanelCompact: { display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--ui-border-neutral)', background: '#fafafa', flexShrink: 0 },
  spriteTileRowCompact: { display: 'flex', gap: 5, flexWrap: 'wrap', padding: '5px 8px' },
  spriteTileCompact: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 8px 3px 4px', border: '2px solid var(--ui-border-neutral)', borderRadius: 16,
    background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)',
    transition: 'border-color 0.12s, background 0.12s',
  },
  spriteTileCompactActive: { borderColor: 'var(--colour-primary)', background: '#f3eeff' },
  spriteTileCompactThumb: { width: 24, height: 24, borderRadius: 4, overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spriteTileCompactName: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--colour-text)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  spritePropBarCompact: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 8px 6px', borderTop: '1px solid var(--ui-border-neutral)' },
  variableMonitors: { position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 5, pointerEvents: 'none' },
  variableMonitor: { display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,140,26,0.92)', borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700 },
  variableMonitorName: { padding: '2px 6px', color: '#fff', background: 'rgba(0,0,0,0.18)' },
  variableMonitorValue: { padding: '2px 6px', color: '#fff', minWidth: 24, textAlign: 'right' },
  broadcastToastStack: { position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', zIndex: 6, pointerEvents: 'none' },
  broadcastToast: { background: 'rgba(255, 171, 25, 0.96)', color: '#fff', padding: '4px 14px', borderRadius: 20, fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.22)', whiteSpace: 'nowrap', animation: 'scratch-toast-in 0.18s ease' },
  errorToast: { background: 'rgba(220, 38, 38, 0.96)', color: '#fff', padding: '4px 14px', borderRadius: 20, fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.22)', whiteSpace: 'nowrap', animation: 'scratch-toast-in 0.18s ease' },
  broadcastToastIcon: { fontSize: '0.75rem' },
  askBox: { position: 'absolute', left: 12, right: 12, bottom: 12, display: 'grid', gap: 8, padding: 10, background: '#fff', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' },
  askLabel: { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--colour-text)' },
  askRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 },
  askInput: { minWidth: 0, padding: '8px 10px', border: '1px solid var(--ui-border-neutral-strong)', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 14 },
  askBtn: { padding: '8px 12px', fontSize: 13, borderRadius: 6 },
  controls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  greenFlagBtn: { width: 44, height: 36, padding: 0, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderColor: 'var(--colour-muted-soft)' },
  stopFlagBtn:  { width: 44, height: 36, padding: 0, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderColor: '#dc2626', color: '#fff' },
  stopIcon:   { width: 14, height: 14, display: 'inline-block', background: '#fff', borderRadius: 2 },
  resetBtn:   { padding: '8px 14px', fontSize: 14 },
  checkBtn:   { padding: '10px 20px', fontSize: 15 },
  centre:     { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 },
  loadingText: { fontFamily: 'var(--font-body)', color: 'var(--colour-text)', fontSize: '1rem' },
  errorText:   { fontFamily: 'var(--font-body)', color: '#ef4444', fontSize: '1rem' },
  checkNone:   { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-muted-soft)' },
}
