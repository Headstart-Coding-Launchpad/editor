// The Scratch stage as a PNG, painted with the workspace's own stage drawing (paintStage) at 2×.
import { canvasToPngBytes, makeCanvas } from '../../../shared/exportWork/pictures.js'
import { STAGE_H, STAGE_W, paintStage } from '../ScratchWorkspace.jsx'

const SCALE = 2

export async function renderStagePng(model, { assetsPath, images }) {
  try {
    await document.fonts?.load("48px 'Noto Color Emoji'")
  } catch {
    // Falls back to the system emoji font.
  }
  const canvas = makeCanvas(STAGE_W * SCALE, STAGE_H * SCALE)
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  paintStage(ctx, {
    sprites: model.sprites,
    backdrops: model.backdrops,
    backdropName: model.backdropName,
    states: model.spriteStates,
    clones: model.cloneStates,
    assetsPath,
    imageCache: images,
  })
  return canvasToPngBytes(canvas)
}
