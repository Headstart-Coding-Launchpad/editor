// Decoded pictures for the Stage's image commands (charts, see ./charts.js). A canvas can only
// draw a picture once the browser has decoded it, which takes a moment, so the canvas renderer
// asks for the ready one (stageImageFor) and whoever draws loads them first (loadStageImages)
// and draws again once they are in. Nothing happens where there is no Image (Node, the CLI).
import { STAGE_BACKGROUND, STAGE_SIZE } from './commands.js'
import { chartImageRect, chartImageSrc, isChartImage } from './charts.js'

// png → { image, ready, promise }. Kept small: one run rarely shows more than a few charts.
const cache = new Map()
const MAX_CACHED = 16
// A picture that hasn't decoded by then is drawn as a blank (jsdom never decodes at all).
const LOAD_TIMEOUT_MS = 5000

function remember(png, entry) {
  cache.delete(png)
  cache.set(png, entry)
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value)
  return entry
}

/** Test hook and warm start: an already-decoded picture for this png. */
export function rememberStageImage(png, image) {
  remember(String(png), { image, ready: true, promise: Promise.resolve(true) })
}

export function forgetStageImages() {
  cache.clear()
}

/** The decoded picture for an image command, or null while it loads (or when it can't). */
export function stageImageFor(command) {
  if (!isChartImage(command)) return null
  const entry = cache.get(command.png)
  return entry?.ready ? entry.image : null
}

function decode(command) {
  const existing = cache.get(command.png)
  if (existing) return existing.promise
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const image = new Image()
  const entry = { image, ready: false, promise: null }
  entry.promise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS)
    const done = (ok) => {
      clearTimeout(timer)
      entry.ready = ok
      resolve(ok)
    }
    image.onload = () => done(true)
    image.onerror = () => done(false)
    image.src = chartImageSrc(command)
  })
  remember(command.png, entry)
  return entry.promise
}

/**
 * Decodes every image command in the list. Resolves true when at least one picture became ready
 * that wasn't before (so the caller draws again), false otherwise.
 */
export async function loadStageImages(commands) {
  const pending = (Array.isArray(commands) ? commands : []).filter(
    (command) => isChartImage(command) && !stageImageFor(command)
  )
  if (pending.length === 0) return false
  const results = await Promise.all(pending.map(decode))
  return results.some(Boolean)
}

/**
 * Draws an image command on a 2D context set up in stage units (0–400): white over the whole
 * stage, then the picture fitted inside it. A picture still loading leaves the stage white.
 */
export function drawStageImage(ctx, command) {
  ctx.fillStyle = STAGE_BACKGROUND
  ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
  const image = stageImageFor(command)
  if (!image) return
  const { x, y, w, h } = chartImageRect(command)
  ctx.drawImage(image, x, y, w, h)
}
