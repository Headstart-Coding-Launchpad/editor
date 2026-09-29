// Node-safe helpers for the modules' `authoring.printTask` hooks (the Builder's printable lesson,
// src/builder/printLesson.js). Every function takes the printer's `esc` (HTML escaper) so the
// output stays byte-identical to what printLesson has always produced.

export function parseObjectLike(value, fallback = {}) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

export function sortByPath(a, b) {
  const aPath = a[0]
  const bPath = b[0]
  const aParts = aPath.split('/').filter(Boolean)
  const bParts = bPath.split('/').filter(Boolean)
  const length = Math.min(aParts.length, bParts.length)
  for (let i = 0; i < length; i += 1) {
    const cmp = aParts[i].localeCompare(bParts[i])
    if (cmp !== 0) return cmp
  }
  return aParts.length - bParts.length || aPath.localeCompare(bPath)
}

export function snippet(value, max = 140) {
  if (value == null || value === '') return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

export function formatSummary(value) {
  if (value == null || value === '') return ''
  if (Array.isArray(value))
    return value
      .map((item) => formatSummary(item))
      .filter(Boolean)
      .join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}: ${formatSummary(val)}`)
      .filter(Boolean)
      .join('; ')
  }
  return String(value)
}

// "Carry … From: Task n", printed when the task carries work from an earlier task.
export function printCarryFrom(label, taskId, esc) {
  if (taskId == null) return ''
  return `<div class="field"><div class="field-label">${label}</div><div class="field-value">Task ${esc(String(taskId))}</div></div>`
}

// The optional Copy code panel (modules with `supportsCopyCode`).
export function printCopyCode(task, esc) {
  if (!task.copyCode?.trim?.()) return ''
  return `<div class="field"><div class="field-label">Copy Code Panel</div><pre class="code-block">${esc(task.copyCode)}</pre></div>`
}

// Code-string modules (python, turtle, arcade): carry, starter / complete code, copy code and
// code stages.
export function printCodeStringTask(task, { esc }) {
  const parts = []
  parts.push(printCarryFrom('Carry Code From', task.carryCodeFrom, esc))
  if (task.starterCode != null) {
    parts.push(
      `<div class="field"><div class="field-label">Starter Code</div><pre class="code-block">${esc(task.starterCode)}</pre></div>`
    )
  }
  if (task.completeCode != null) {
    parts.push(
      `<div class="field"><div class="field-label">Complete Code</div><pre class="code-block">${esc(task.completeCode)}</pre></div>`
    )
  }
  parts.push(printCopyCode(task, esc))
  if (task.codeStages?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`
    )
    for (const stage of task.codeStages) {
      parts.push(
        `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div><pre class="code-block">${esc(stage.code || '')}</pre></div>`
      )
    }
    parts.push(`</div>`)
  }
  return parts.join('')
}

// Modules with nothing module-specific to print.
export function printNothing() {
  return ''
}
