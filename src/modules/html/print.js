// HTML module section of the Builder's printable lesson (authoring.printTask). Node-safe.
import { printCarryFrom, printCopyCode } from '../printHelpers.js'

function printFileBlock(file, esc) {
  return `<div class="file-block"><div class="file-name">${esc(file.name)}</div><pre class="code-block">${esc(file.content || '')}</pre></div>`
}

export function printHtmlTask(task, { esc }) {
  const parts = []
  parts.push(printCarryFrom('Carry Code From', task.carryCodeFrom, esc))
  if (task.entryFile) {
    parts.push(
      `<div class="field"><div class="field-label">Entry File</div><div class="field-value">${esc(task.entryFile)}</div></div>`
    )
  }
  if (task.starterFiles?.length) {
    parts.push(`<div class="field"><div class="field-label">Starter Files</div>`)
    for (const f of task.starterFiles) parts.push(printFileBlock(f, esc))
    parts.push(`</div>`)
  }
  if (task.completeFiles?.length) {
    parts.push(`<div class="field"><div class="field-label">Complete Files</div>`)
    for (const f of task.completeFiles) parts.push(printFileBlock(f, esc))
    parts.push(`</div>`)
  }
  parts.push(printCopyCode(task, esc))
  if (task.codeStages?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`
    )
    for (const stage of task.codeStages) {
      parts.push(`<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>`)
      for (const f of stage.files || []) parts.push(printFileBlock(f, esc))
      parts.push(`</div>`)
    }
    parts.push(`</div>`)
  }
  return parts.join('')
}
