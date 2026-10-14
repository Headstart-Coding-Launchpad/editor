// "Export work" for Turtle tasks (see src/shared/exportWork/exporters.js): the code as a .py
// file, the drawing as a PNG (replayed with ./draw.js, the same renderer the student and tutor
// canvases use), and a share link with both. The drawing exists only for the task the student
// last ran live (currentTurtleResult); older tasks export their code only.
import { canvasToPngBytes, makeCanvas } from '../../shared/exportWork/pictures.js'
import { drawTurtleCommands } from './draw.js'
import { createTurtleState } from './engine.js'
import { compactTurtleResultForSync } from './sync.js'
import ShareView from './ShareView.jsx'

const PICTURE_SIZE = 800

function readCode(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

/** The drawing as PNG bytes, or null when there is nothing drawn. */
export async function renderTurtlePng(turtleResult, size = PICTURE_SIZE) {
  const commands = turtleResult?.commands ?? []
  if (!commands.length) return null
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  drawTurtleCommands(ctx, commands, {
    background: turtleResult?.state?.background ?? '#ffffff',
    turtle: { ...createTurtleState(), ...(turtleResult?.state ?? {}) },
  })
  return canvasToPngBytes(canvas)
}

const turtleExporter = {
  readLive(student) {
    const code = readCode(student?.currentCode)
    if (!code) return null
    return { code, turtleResult: student?.currentTurtleResult ?? null }
  },
  readSubmission(submission) {
    const code = readCode(submission)
    return code ? { code, turtleResult: null } : null
  },
  async buildFiles(item, ctx) {
    return { files: [{ name: `${ctx.stem}.py`, data: item.work.code }], notes: [] }
  },
  async buildPictures(item, ctx) {
    const png = await renderTurtlePng(item.work.turtleResult)
    if (!png) {
      return {
        files: [],
        notes: [
          `${item.task.title || 'A task'}: no drawing to export (only the live task has one).`,
        ],
      }
    }
    return { files: [{ name: `${ctx.stem}_drawing.png`, data: png }], notes: [] }
  },
  sharePayload(item) {
    return {
      code: item.work.code,
      turtleResult: compactTurtleResultForSync(item.work.turtleResult),
    }
  },
  ShareView,
}

export default turtleExporter
