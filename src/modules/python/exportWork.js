// "Export work" for Python tasks (see src/shared/exportWork/exporters.js): the code as a .py
// file, the Python Stage drawing (when the code drew one) as a PNG, and a share link showing the
// code, its last output and the drawing. The drawing exists only for the task the student last
// ran live (currentStageResult); older tasks export their code only.
import { stagePngBytes } from '../../shared/stage/savePicture.js'
import { compactStageForSync, readStageResult } from '../../shared/stage/sync.js'
import ShareView from './ShareView.jsx'

const PICTURE_SIZE = 800

function readCode(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

/**
 * The Stage drawing as PNG bytes (canvas, else via its SVG), or null when nothing was drawn. The
 * student's "Save my picture" button makes the same PNG (src/shared/stage/savePicture.js).
 */
export async function renderStagePng(stage, size = PICTURE_SIZE) {
  return stagePngBytes(readStageResult(stage)?.commands ?? [], size)
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
