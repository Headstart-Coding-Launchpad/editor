// Filesystem module section of the Builder's printable lesson (authoring.printTask). Node-safe.
import {
  formatSummary,
  parseObjectLike,
  printCarryFrom,
  snippet,
  sortByPath,
} from '../printHelpers.js'

function renderFilesystemField(label, fsValue, esc) {
  if (fsValue == null) return ''
  const fs = parseObjectLike(fsValue)
  const entries = Object.entries(fs)
    .filter(([, entry]) => entry && typeof entry === 'object')
    .sort(sortByPath)

  if (!entries.length) {
    return `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-value">No files or folders.</div></div>`
  }

  const rows = entries
    .map(([path, entry]) => {
      const type = entry.type === 'dir' ? 'Folder' : 'File'
      const detail =
        entry.type === 'dir'
          ? ''
          : snippet(
              entry.content ??
                entry.src ??
                formatSummary(
                  Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'type'))
                )
            )
      const depth = Math.max(0, path.split('/').filter(Boolean).length - 1)
      const detailHtml = detail
        ? esc(detail)
        : `<span class="muted">${entry.type === 'dir' ? 'Folder' : 'Empty'}</span>`
      return `<tr><td class="path-cell" style="padding-left:${8 + depth * 14}px"><code>${esc(path)}</code></td><td>${type}</td><td class="snippet-cell">${detailHtml}</td></tr>`
    })
    .join('')

  return `<div class="field"><div class="field-label">${esc(label)}</div><table class="data-table fs-table"><tr><th>Path</th><th>Type</th><th>Content snippet</th></tr>${rows}</table></div>`
}

export function printFilesystemTask(task, { esc }) {
  const parts = []
  parts.push(printCarryFrom('Carry Filesystem From', task.carryFsFrom, esc))
  parts.push(renderFilesystemField('Starter Filesystem', task.starterFs, esc))
  parts.push(renderFilesystemField('Complete Filesystem', task.completeFs, esc))
  if (task.codeStages?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Filesystem Stages (${task.codeStages.length})</div>`
    )
    for (const stage of task.codeStages) {
      parts.push(
        `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>${renderFilesystemField('Stage Filesystem', stage.fs ?? {}, esc)}</div>`
      )
    }
    parts.push(`</div>`)
  }
  return parts.join('')
}
