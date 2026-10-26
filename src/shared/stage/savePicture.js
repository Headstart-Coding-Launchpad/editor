// The Python Stage drawing as a PNG (browser only): the student's "Save my picture" button in
// StagePane and the tutor's Export work (src/modules/python/exportWork.js) share it.
import {
  canvasToPngBytes,
  downloadFile,
  makeCanvas,
  svgToPngBytes,
} from '../exportWork/pictures.js'
import { slugifyTitle } from '../exportWork/naming.js'
import { drawStage } from './canvas.js'
import { STAGE_SIZE } from './commands.js'
import { loadStageImages } from './stageImages.js'
import { stageToSvg } from './svg.js'

export const STAGE_PICTURE_SIZE = 800

/** A command list drawn as PNG bytes (canvas, else via its SVG), or null when it is empty. */
export async function stagePngBytes(commands, size = STAGE_PICTURE_SIZE) {
  const list = Array.isArray(commands) ? commands : []
  if (!list.length) return null
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // A chart (plt.show()) is a PNG that has to decode before the canvas can draw it.
    await loadStageImages(list)
    drawStage(ctx, list)
    return canvasToPngBytes(canvas)
  }
  return svgToPngBytes(stageToSvg(list), STAGE_SIZE, STAGE_SIZE, { scale: size / STAGE_SIZE })
}

/** The PNG's file name: 'my-picture.png', or '<task title>-picture.png'. */
export function stagePictureFileName(title) {
  const slug = slugifyTitle(title ?? '').toLowerCase()
  return `${slug || 'my'}-picture.png`
}

/** Downloads the drawing as a PNG. Resolves true when a file was offered. */
export async function saveStagePicture(commands, fileName = stagePictureFileName('')) {
  const bytes = await stagePngBytes(commands)
  if (!bytes) return false
  downloadFile(fileName, bytes, 'image/png')
  return true
}
