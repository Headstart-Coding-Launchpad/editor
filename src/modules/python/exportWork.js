// "Export work" for Python tasks (see src/shared/exportWork/exporters.js): the code as a .py
// file, the Python Stage drawing (when the code drew one) as a PNG, and a share link showing the
// code, its last output and the drawing. The drawing exists only for the task the student last
// ran live (currentStageResult); older tasks export their code only. A run that played a beat
// (Beat Maker, src/shared/beats/) also gets its beat as a WAV file, "Save my beat".
import { canvasToPngBytes, makeCanvas, svgToPngBytes } from '../../shared/exportWork/pictures.js'
import { drawStage } from '../../shared/stage/canvas.js'
import { STAGE_SIZE } from '../../shared/stage/commands.js'
import { stageToSvg } from '../../shared/stage/svg.js'
import { compactStageForSync, readStageResult } from '../../shared/stage/sync.js'
import { isBeatCommand, readBeatSong } from '../../shared/beats/patterns.js'
import { renderBeatWav } from '../../shared/beats/render.js'
import ShareView from './ShareView.jsx'

const PICTURE_SIZE = 800

function readCode(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

/** The Stage drawing as PNG bytes (canvas, else via its SVG), or null when nothing was drawn. */
export async function renderStagePng(stage, size = PICTURE_SIZE) {
  // Beat Maker's commands draw nothing on the canvas: a beat on its own is no picture.
  const commands = readStageResult(stage)?.commands ?? []
  if (!commands.some((command) => !isBeatCommand(command))) return null
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (ctx) {
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
    const files = []
    const notes = []
    const png = await renderStagePng(item.work.stage)
    if (png) files.push({ name: `${ctx.stem}_stage.png`, data: png })
    const song = readBeatSong(readStageResult(item.work.stage)?.commands)
    if (song) {
      const wav = await renderBeatWav(song)
      if (wav) files.push({ name: `${ctx.stem}_beat.wav`, data: wav })
      else notes.push(`${item.task?.title || 'A task'}: this browser can't save the beat as sound.`)
    }
    return { files, notes }
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
