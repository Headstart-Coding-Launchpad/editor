// "Export work" for Python tasks (see src/shared/exportWork/exporters.js): the code as a .py
// file, the Python Stage drawing (when the code drew one) as a PNG, and a share link showing the
// code, its last output and the drawing. The drawing exists only for the task the student last
// ran live (currentStageResult); older tasks export their code only.
import { canvasToPngBytes, makeCanvas, svgToPngBytes } from '../../shared/exportWork/pictures.js'
import { drawStage } from '../../shared/stage/canvas.js'
import { STAGE_SIZE } from '../../shared/stage/commands.js'
import { stageToSvg } from '../../shared/stage/svg.js'
import { loadStageImages } from '../../shared/stage/stageImages.js'
import { compactStageForSync, readStageResult } from '../../shared/stage/sync.js'
import ShareView from './ShareView.jsx'

const PICTURE_SIZE = 800

function readCode(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

/** The Stage drawing as PNG bytes (canvas, else via its SVG), or null when nothing was drawn. */
export async function renderStagePng(stage, size = PICTURE_SIZE) {
  const commands = readStageResult(stage)?.commands ?? []
  if (!commands.length) return null
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // A chart (plt.show()) is a PNG that has to decode before the canvas can draw it.
    await loadStageImages(commands)
    drawStage(ctx, commands)
    return canvasToPngBytes(canvas)
  }
  return svgToPngBytes(stageToSvg(commands), STAGE_SIZE, STAGE_SIZE, {
    scale: size / STAGE_SIZE,
  })
}

const pythonExporter = {
  readLive(student) {
    const code = readCode(student?.currentCode)
    return code
      ? {
          code,
          output: student?.currentOutput ?? '',
          stage: readStageResult(student?.currentStageResult),
        }
      : null
  },
  readSubmission(submission) {
    const code = readCode(submission)
    return code ? { code, output: '', stage: null } : null
  },
  async buildFiles(item, ctx) {
    return { files: [{ name: `${ctx.stem}.py`, data: item.work.code }], notes: [] }
  },
  async buildPictures(item, ctx) {
    // Code with no Stage drawing has no picture, and that needs no note.
    if (!item.work.stage) return { files: [], notes: [] }
    const png = await renderStagePng(item.work.stage)
    if (!png) return { files: [], notes: [] }
    return { files: [{ name: `${ctx.stem}_stage.png`, data: png }], notes: [] }
  },
  sharePayload(item) {
    const stage = item.work.stage ? compactStageForSync(item.work.stage) : null
    return {
      code: item.work.code,
      output: String(item.work.output ?? '').slice(0, 20000),
      // As JSON text: a grid() command holds lists of lists, which Firestore can't store.
      ...(stage ? { stageJson: JSON.stringify(stage) } : {}),
    }
  },
  ShareView,
}

export default pythonExporter
