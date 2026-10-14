// "Export work" for Python tasks (see src/shared/exportWork/exporters.js): the code as a .py
// file, and a share link showing the code and its last output.
import ShareView from './ShareView.jsx'

function readCode(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

const pythonExporter = {
  readLive(student) {
    const code = readCode(student?.currentCode)
    return code ? { code, output: student?.currentOutput ?? '' } : null
  },
  readSubmission(submission) {
    const code = readCode(submission)
    return code ? { code, output: '' } : null
  },
  async buildFiles(item, ctx) {
    return { files: [{ name: `${ctx.stem}.py`, data: item.work.code }], notes: [] }
  },
  sharePayload(item) {
    return { code: item.work.code, output: String(item.work.output ?? '').slice(0, 20000) }
  },
  ShareView,
}

export default pythonExporter
