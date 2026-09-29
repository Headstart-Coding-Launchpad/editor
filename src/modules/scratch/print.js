// Scratch module section of the Builder's printable lesson (authoring.printTask). Node-safe.
import { printCarryFrom } from '../printHelpers.js'

function printJsonField(label, value, esc) {
  return `<div class="field"><div class="field-label">${label}</div><pre class="code-block">${esc(JSON.stringify(value, null, 2))}</pre></div>`
}

export function printScratchTask(task, { esc }) {
  const parts = []
  parts.push(printCarryFrom('Carry Blocks From', task.carryBlocksFrom, esc))
  if (task.sprites?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Sprites</div><table class="data-table"><tr><th>Name</th><th>Type</th><th>X</th><th>Y</th><th>Size</th><th>Direction</th><th>Student Editable</th></tr>`
    )
    for (const sp of task.sprites) {
      parts.push(
        `<tr><td>${esc(sp.name)}</td><td>${esc(sp.type || '')}</td><td>${esc(String(sp.x ?? ''))}</td><td>${esc(String(sp.y ?? ''))}</td><td>${esc(String(sp.size ?? ''))}</td><td>${esc(String(sp.direction ?? ''))}</td><td>${sp.studentEditable === false ? 'No' : 'Yes'}</td></tr>`
      )
    }
    parts.push(`</table></div>`)
  }
  if (task.backdrops?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Backdrops</div><table class="data-table"><tr><th>Name</th><th>Colour / Image</th></tr>`
    )
    for (const bd of task.backdrops) {
      parts.push(`<tr><td>${esc(bd.name)}</td><td>${esc(bd.colour || bd.image || '')}</td></tr>`)
    }
    parts.push(`</table></div>`)
  }
  if (task.variables?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Variables</div><table class="data-table"><tr><th>Name</th><th>Show on Stage</th></tr>`
    )
    for (const v of task.variables) {
      parts.push(`<tr><td>${esc(v.name)}</td><td>${v.showOnStage ? 'Yes' : 'No'}</td></tr>`)
    }
    parts.push(`</table></div>`)
  }
  if (task.toolbox) {
    parts.push(
      `<div class="field"><div class="field-label">Toolbox XML</div><pre class="code-block">${esc(task.toolbox)}</pre></div>`
    )
  }
  if (task.prebuiltStacks?.length) {
    parts.push(printJsonField('Prebuilt Stacks', task.prebuiltStacks, esc))
  }
  if (task.starterBlocks != null) {
    parts.push(printJsonField('Starter Blocks', task.starterBlocks, esc))
  }
  if (task.completeBlocks != null) {
    parts.push(printJsonField('Complete Blocks', task.completeBlocks, esc))
  }
  if (task.codeStages?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`
    )
    for (const stage of task.codeStages) {
      parts.push(
        `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div><pre class="code-block">${esc(JSON.stringify(stage.blocks, null, 2))}</pre></div>`
      )
      if (stage.prebuiltStacks?.length) {
        parts.push(
          `<pre class="code-block">${esc(JSON.stringify(stage.prebuiltStacks, null, 2))}</pre>`
        )
      }
    }
    parts.push(`</div>`)
  }
  return parts.join('')
}
