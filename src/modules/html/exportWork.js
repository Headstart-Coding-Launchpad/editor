// "Export work" for HTML tasks (see src/shared/exportWork/exporters.js): the project's files as
// a .zip, optionally one self-contained .html (stylesheets and scripts inlined), and a share
// link with a sandboxed preview and the files.
import { decodeFileKey } from '../../shared/fileKeys'
import { decodeSessionFiles } from '../../shared/workspaceData'
import { buildZip } from '../../shared/exportWork/zip.js'
import { inlineHtmlFiles } from './inlineHtml.js'
import ShareView from './ShareView.jsx'

function filesFromMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return []
  return Object.entries(map)
    .filter(([, content]) => typeof content === 'string')
    .map(([name, content]) => ({ name, content }))
}

function workFrom(files, task) {
  if (!files.length) return null
  return { files, entryFile: task?.entryFile ?? 'index.html' }
}

const htmlExporter = {
  readLive(student, task) {
    const files = decodeSessionFiles(student?.currentFiles, decodeFileKey, 'html').map(
      ({ name, content }) => ({ name, content })
    )
    return workFrom(files, task)
  },
  readSubmission(submission, task) {
    if (typeof submission !== 'string') return null
    try {
      return workFrom(filesFromMap(JSON.parse(submission)), task)
    } catch {
      return null
    }
  },
  async buildFiles(item, ctx) {
    const { files, entryFile } = item.work
    const zip = await buildZip(
      files.map((file) => ({ name: `${ctx.stem}/${file.name}`, data: file.content }))
    )
    const out = [{ name: `${ctx.stem}.zip`, data: zip }]
    const notes = []
    if (ctx.options?.htmlSingleFile !== false) {
      const single = inlineHtmlFiles(files, entryFile)
      if (single) out.push({ name: `${ctx.stem}.html`, data: single })
      else notes.push(`${item.task.title || 'A task'}: no .html page to make a single file from.`)
    }
    return { files: out, notes }
  },
  sharePayload(item) {
    return { files: item.work.files, entryFile: item.work.entryFile }
  },
  ShareView,
}

export default htmlExporter
