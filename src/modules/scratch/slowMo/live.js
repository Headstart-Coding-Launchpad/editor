// Slow-mo in the live mirrors. Pure.
//
// The slow-mo state rides inside the Scratch sprite-state payload (`spriteState.slowMo`, see
// handleScratchSpriteState in useStudentCodeState.js), so it reaches a Go Live / presentation
// broadcast (teacherLive.spriteState) and a tutor watching one student (currentSpriteState) by the
// same throttled path as the stage itself, and is cleared (null) with it.
//
//   { mode: 'playing' | 'paused' | 'finished', step, speed, glow: [{ spriteId, blockId }] }

export const SLOW_MO_LIVE_MODES = Object.freeze(['playing', 'paused', 'finished'])
const MAX_GLOW = 40

function cleanGlow(glow) {
  const list = Array.isArray(glow)
    ? glow
    : glow && typeof glow === 'object'
      ? Object.values(glow)
      : []
  return list
    .filter((g) => g && typeof g.spriteId === 'string' && typeof g.blockId === 'string')
    .slice(0, MAX_GLOW)
    .map((g) => ({ spriteId: g.spriteId, blockId: g.blockId }))
}

/** The compact live shape of the workspace's slow-mo view, or null when slow-mo isn't running. */
export function buildSlowMoLive(view) {
  if (!view || !SLOW_MO_LIVE_MODES.includes(view.mode)) return null
  return {
    mode: view.mode,
    step: Number.isFinite(view.step) ? view.step : 0,
    speed: Number.isFinite(view.speed) ? view.speed : 1,
    glow: cleanGlow(view.glow),
  }
}

/** Reads a received live slow-mo state (Realtime Database may turn the glow list into an object). */
export function readSlowMoLive(raw) {
  if (!raw || typeof raw !== 'object' || !SLOW_MO_LIVE_MODES.includes(raw.mode)) return null
  return buildSlowMoLive({ ...raw, glow: cleanGlow(raw.glow) })
}

/** Words for the mirror's status pill, e.g. "Slow-mo · step 4 · paused". */
export function slowMoStatusText(live) {
  if (!live) return ''
  const mode = live.mode === 'playing' ? 'playing' : live.mode === 'paused' ? 'paused' : 'finished'
  return `Slow-mo · step ${live.step} · ${mode}`
}
