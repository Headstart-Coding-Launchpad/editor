// Verbatim copies of the Builder's per-type branches before plan step 4.8 moved them onto the
// module definitions' `authoring` hooks. moduleAuthoring.test.js compares every module's hooks
// against these. Do not edit: they are the reference behaviour.
import { createSpriteFromPreset } from '../../../shared/spritePresets.js'
import { DEFAULT_CIRCUIT, cloneCircuit } from '../../electronics/circuit.js'
import { DEFAULT_FS } from '../../filesystem/filesystem.js'
import { makeDefaultDesktop } from '../../desktop/desktopState.js'

// src/builder/components/FileManager.jsx
const HTML_ONLY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
</head>
<body>

</body>
</html>`

// src/builder/printLesson.js
export function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const COMPONENT_LABELS = {
  battery: 'Battery',
  resistor: 'Resistor',
  led: 'LED',
  push_button: 'Button',
  slide_switch: 'Switch',
  potentiometer: 'Potentiometer',
  motor: 'Motor',
  servo_motor: 'Servo',
  buzzer: 'Buzzer',
  rgb_led: 'RGB LED',
  microcontroller: 'Micro Controller',
  transistor: 'Transistor',
  diode: 'Diode',
  sensor: 'Sensor',
  terminal: 'Junction',
}

function parseObjectLike(value, fallback = {}) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function sortByPath(a, b) {
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

function snippet(value, max = 140) {
  if (value == null || value === '') return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function formatSummary(value) {
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

function renderFilesystemField(label, fsValue) {
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

function componentTypeLabel(type) {
  return COMPONENT_LABELS[type] ?? String(type ?? '')
}

function renderAvailableParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return ''
  const rows = [...parts]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map(
      (type) =>
        `<tr><td><code>${esc(type)}</code></td><td>${esc(componentTypeLabel(type))}</td></tr>`
    )
    .join('')
  return `<div class="field"><div class="field-label">Available Parts</div><table class="data-table parts-table"><tr><th>Type</th><th>Label</th></tr>${rows}</table></div>`
}

function renderComponentTable(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return `<div class="field-value muted">No components.</div>`
  }
  const rows = [...components]
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .map((component) => {
      const position = component.position
        ? `row ${component.position.row ?? ''}, col ${component.position.col ?? ''}`
        : ''
      const props =
        component.props && typeof component.props === 'object'
          ? Object.fromEntries(
              Object.entries(component.props).filter(
                ([key]) => key !== 'code' && key !== 'starterCode'
              )
            )
          : component.props
      return `<tr><td><code>${esc(component.id ?? '')}</code></td><td>${esc(componentTypeLabel(component.type))}</td><td>${esc(component.label ?? '')}</td><td>${esc((component.pins ?? []).join(', '))}</td><td>${esc(position)}</td><td>${esc(formatSummary(props))}</td></tr>`
    })
    .join('')
  return `<table class="data-table circuit-table"><tr><th>ID</th><th>Type</th><th>Label</th><th>Pins</th><th>Position</th><th>Properties</th></tr>${rows}</table>`
}

function renderWireTable(wires) {
  if (!Array.isArray(wires) || wires.length === 0) {
    return `<div class="field-value muted">No wires.</div>`
  }
  const rows = [...wires]
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .map(
      (wire) =>
        `<tr><td><code>${esc(wire.id ?? '')}</code></td><td><code>${esc(wire.from ?? '')}</code></td><td><code>${esc(wire.to ?? '')}</code></td><td>${esc(wire.color ?? '')}</td></tr>`
    )
    .join('')
  return `<table class="data-table circuit-table"><tr><th>ID</th><th>From</th><th>To</th><th>Colour</th></tr>${rows}</table>`
}

function renderMicroPythonBlocks(label, circuit) {
  const blocks = []
  const components = Array.isArray(circuit.components) ? circuit.components : []
  for (const component of components
    .filter((item) => item?.type === 'microcontroller')
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))) {
    const code = component.props?.code ?? component.props?.starterCode
    if (code) {
      blocks.push(
        `<div class="file-block"><div class="file-name">${esc(label)} - ${esc(component.id ?? 'microcontroller')}</div><pre class="code-block">${esc(code)}</pre></div>`
      )
    }
  }
  const legacyCode = circuit.microcontroller?.starterCode ?? circuit.microcontroller?.code
  if (legacyCode) {
    blocks.push(
      `<div class="file-block"><div class="file-name">${esc(label)} - microcontroller</div><pre class="code-block">${esc(legacyCode)}</pre></div>`
    )
  }
  return blocks.join('')
}

function renderCircuitField(label, circuitValue) {
  if (circuitValue == null) return ''
  const circuit = parseObjectLike(circuitValue, { components: [], wires: [] })
  const board = circuit.board && typeof circuit.board === 'object' ? circuit.board : {}
  const boardSummary = [
    board.type,
    board.rows && board.cols ? `${board.rows} rows x ${board.cols} cols` : '',
  ]
    .filter(Boolean)
    .join(', ')
  const microPython = renderMicroPythonBlocks(label, circuit)

  return [
    `<div class="field circuit-field"><div class="field-label">${esc(label)}</div>`,
    boardSummary ? `<div class="field-value circuit-board">Board: ${esc(boardSummary)}</div>` : '',
    `<div class="subfield-label">Components</div>`,
    renderComponentTable(circuit.components),
    `<div class="subfield-label">Wires</div>`,
    renderWireTable(circuit.wires),
    microPython ? `<div class="subfield-label">MicroPython Code</div>${microPython}` : '',
    `</div>`,
  ].join('')
}

export function legacyPrintModuleSections(task, taskType) {
  const parts = []
  if (!task.taskType) {
    if (taskType === 'python' || taskType === 'turtle' || taskType === 'arcade') {
      if (task.carryCodeFrom != null) {
        parts.push(
          `<div class="field"><div class="field-label">Carry Code From</div><div class="field-value">Task ${esc(String(task.carryCodeFrom))}</div></div>`
        )
      }
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
      if (task.copyCode?.trim?.()) {
        parts.push(
          `<div class="field"><div class="field-label">Copy Code Panel</div><pre class="code-block">${esc(task.copyCode)}</pre></div>`
        )
      }
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
    }

    if (taskType === 'html') {
      if (task.carryCodeFrom != null) {
        parts.push(
          `<div class="field"><div class="field-label">Carry Code From</div><div class="field-value">Task ${esc(String(task.carryCodeFrom))}</div></div>`
        )
      }
      if (task.entryFile) {
        parts.push(
          `<div class="field"><div class="field-label">Entry File</div><div class="field-value">${esc(task.entryFile)}</div></div>`
        )
      }
      if (task.starterFiles?.length) {
        parts.push(`<div class="field"><div class="field-label">Starter Files</div>`)
        for (const f of task.starterFiles) {
          parts.push(
            `<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`
          )
        }
        parts.push(`</div>`)
      }
      if (task.completeFiles?.length) {
        parts.push(`<div class="field"><div class="field-label">Complete Files</div>`)
        for (const f of task.completeFiles) {
          parts.push(
            `<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`
          )
        }
        parts.push(`</div>`)
      }
      if (task.copyCode?.trim?.()) {
        parts.push(
          `<div class="field"><div class="field-label">Copy Code Panel</div><pre class="code-block">${esc(task.copyCode)}</pre></div>`
        )
      }
      if (task.codeStages?.length) {
        parts.push(
          `<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`
        )
        for (const stage of task.codeStages) {
          parts.push(`<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>`)
          for (const f of stage.files || []) {
            parts.push(
              `<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`
            )
          }
          parts.push(`</div>`)
        }
        parts.push(`</div>`)
      }
    }

    if (taskType === 'scratch') {
      if (task.carryBlocksFrom != null) {
        parts.push(
          `<div class="field"><div class="field-label">Carry Blocks From</div><div class="field-value">Task ${esc(String(task.carryBlocksFrom))}</div></div>`
        )
      }
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
          parts.push(
            `<tr><td>${esc(bd.name)}</td><td>${esc(bd.colour || bd.image || '')}</td></tr>`
          )
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
        parts.push(
          `<div class="field"><div class="field-label">Prebuilt Stacks</div><pre class="code-block">${esc(JSON.stringify(task.prebuiltStacks, null, 2))}</pre></div>`
        )
      }
      if (task.starterBlocks != null) {
        parts.push(
          `<div class="field"><div class="field-label">Starter Blocks</div><pre class="code-block">${esc(JSON.stringify(task.starterBlocks, null, 2))}</pre></div>`
        )
      }
      if (task.completeBlocks != null) {
        parts.push(
          `<div class="field"><div class="field-label">Complete Blocks</div><pre class="code-block">${esc(JSON.stringify(task.completeBlocks, null, 2))}</pre></div>`
        )
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
    }

    if (taskType === 'filesystem') {
      if (task.carryFsFrom != null) {
        parts.push(
          `<div class="field"><div class="field-label">Carry Filesystem From</div><div class="field-value">Task ${esc(String(task.carryFsFrom))}</div></div>`
        )
      }
      parts.push(renderFilesystemField('Starter Filesystem', task.starterFs))
      parts.push(renderFilesystemField('Complete Filesystem', task.completeFs))
      if (task.codeStages?.length) {
        parts.push(
          `<div class="field"><div class="field-label">Filesystem Stages (${task.codeStages.length})</div>`
        )
        for (const stage of task.codeStages) {
          parts.push(
            `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>${renderFilesystemField('Stage Filesystem', stage.fs ?? {})}</div>`
          )
        }
        parts.push(`</div>`)
      }
    }

    if (taskType === 'electronics') {
      if (task.carryCircuitFrom != null) {
        parts.push(
          `<div class="field"><div class="field-label">Carry Circuit From</div><div class="field-value">Task ${esc(String(task.carryCircuitFrom))}</div></div>`
        )
      }
      parts.push(renderAvailableParts(task.availableComponents))
      if (
        task.microcontroller?.enabled ||
        task.microcontroller?.boardType ||
        task.microcontroller?.starterCode
      ) {
        parts.push(
          `<div class="field"><div class="field-label">Microcontroller</div><div class="field-value">${esc(task.microcontroller.boardType || 'Enabled')}</div></div>`
        )
        if (task.microcontroller.starterCode) {
          parts.push(
            `<div class="field"><div class="field-label">MicroPython Starter Code</div><pre class="code-block">${esc(task.microcontroller.starterCode)}</pre></div>`
          )
        }
      }
      parts.push(renderCircuitField('Starter Circuit', task.starterCircuit))
      parts.push(renderCircuitField('Complete Circuit', task.completeCircuit))
      if (task.codeStages?.length) {
        parts.push(
          `<div class="field"><div class="field-label">Circuit Stages (${task.codeStages.length})</div>`
        )
        for (const stage of task.codeStages) {
          parts.push(
            `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>${renderCircuitField('Stage Circuit', stage.circuit ?? {})}</div>`
          )
        }
        parts.push(`</div>`)
      }
    }
  }
  return parts.join('')
}

// src/builder/hooks/useBuilderState.js (lesson.type / defaultSprites made parameters)
export function legacyDefaultTypeFields(prevTask, moduleType, defaultSprites = []) {
  const lesson = { type: moduleType }
  return defaultTypeFields(prevTask, moduleType)

  function defaultTypeFields(prevTask = null, moduleType = lesson.type) {
    if (moduleType === 'python' || moduleType === 'arcade' || moduleType === 'turtle') {
      return {
        starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
        carryCodeFrom: prevTask?.id ?? null,
      }
    }
    if (moduleType === 'scratch') {
      if (prevTask) {
        return {
          toolbox: '',
          starterBlocks: prevTask.completeBlocks ?? prevTask.starterBlocks ?? null,
          carryBlocksFrom: prevTask.id,
          sprites: JSON.parse(JSON.stringify(prevTask.sprites ?? [])),
          backdrops: JSON.parse(JSON.stringify(prevTask.backdrops ?? [])),
          variables: JSON.parse(JSON.stringify(prevTask.variables ?? [])),
        }
      }
      const sprites =
        defaultSprites.length > 0 ? [createSpriteFromPreset([], defaultSprites[0])] : undefined
      return {
        toolbox: '',
        starterBlocks: null,
        carryBlocksFrom: null,
        ...(sprites ? { sprites } : {}),
      }
    }
    if (moduleType === 'electronics') {
      return {
        starterCircuit: prevTask
          ? cloneCircuit(prevTask.completeCircuit ?? prevTask.starterCircuit ?? DEFAULT_CIRCUIT)
          : cloneCircuit(DEFAULT_CIRCUIT),
        carryCircuitFrom: prevTask?.id ?? null,
        microcontroller: prevTask?.microcontroller
          ? { ...prevTask.microcontroller }
          : { enabled: false, boardType: null, starterCode: '' },
      }
    }
    if (moduleType === 'filesystem') {
      return {
        starterFs: prevTask?.completeFs ?? prevTask?.starterFs ?? DEFAULT_FS,
        carryFsFrom: prevTask?.id ?? null,
      }
    }
    if (moduleType === 'desktop') {
      return {
        starterDesktop:
          prevTask?.completeDesktop ??
          prevTask?.starterDesktop ??
          makeDefaultDesktop(prevTask?.availableApps),
        carryDesktopFrom: prevTask?.id ?? null,
        availableApps: prevTask?.availableApps ?? ['fileManager'],
      }
    }
    return {
      starterFiles: prevTask
        ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map((f) => ({ ...f }))
        : [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
      entryFile: prevTask
        ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html')
        : 'index.html',
      carryCodeFrom: prevTask?.id ?? null,
    }
  }
}

// src/builder/lessonUtils.js
export function legacyCopyStarterToComplete(task, lessonType) {
  if (lessonType === 'python' || lessonType === 'arcade') {
    return { completeCode: task.starterCode ?? '' }
  }
  if (lessonType === 'html') {
    return {
      completeFiles: (task.starterFiles ?? []).map((file) => ({ ...file })),
      completeEntryFile: task.entryFile ?? 'index.html',
    }
  }
  if (lessonType === 'electronics') {
    return { completeCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) }
  }
  return {}
}

// src/builder/components/lesson-meta/SandboxStarterModal.jsx
function isPythonLikeType(type) {
  return type === 'python' || type === 'arcade' || type === 'turtle'
}

export function legacySandboxStarterSummary(lesson) {
  const sandboxLineCount = (lesson.sandboxStarter ?? '').trim()
    ? (lesson.sandboxStarter ?? '').split('\n').length
    : 0
  const sandboxFileCount = lesson.sandboxStarterFiles?.length ?? 0
  const sandboxFsCount = lesson.sandboxStarterFs
    ? Object.keys(lesson.sandboxStarterFs).length - 1
    : 0

  if (isPythonLikeType(lesson.type)) {
    return sandboxLineCount
      ? `${sandboxLineCount} lines configured`
      : 'No sandbox starter code set.'
  }
  if (lesson.type === 'scratch') {
    return lesson.sandboxStarter
      ? 'Scratch sandbox starter configured.'
      : 'No Scratch sandbox starter set.'
  }
  if (lesson.type === 'filesystem') {
    return sandboxFsCount ? `${sandboxFsCount} items configured` : 'No sandbox filesystem set.'
  }
  if (lesson.type === 'electronics') {
    return lesson.sandboxStarterCircuit
      ? 'Sandbox breadboard configured.'
      : 'No sandbox breadboard set.'
  }
  return sandboxFileCount
    ? `${sandboxFileCount} starter files configured`
    : 'No sandbox starter files set.'
}

// Inline conditions from src/builder/components/TaskEditor.jsx, LessonMetaPanel.jsx,
// BuilderView.jsx, task-editor/TaskEditorFields.jsx and useTaskEditorState's callers, each
// wrapped in a function of the lesson (type) it read.
export function legacyUsesUnifiedCodeStages(lesson) {
  return ['python', 'html', 'arcade', 'turtle', 'electronics', 'scratch'].includes(lesson.type)
}

export function legacyIncludesTypeAssetsInPreview(lesson) {
  return lesson.type === 'html'
}

export function legacyBuilderRunFlags(lessonMod) {
  const isPython = lessonMod?.type === 'python'
  const isScratch = lessonMod?.type === 'scratch'
  return { isPython, isScratch }
}

export function legacyIncompleteDraftWorkspace(lesson, task) {
  return (
    (lesson.type === 'html' && !Array.isArray(task.starterFiles)) ||
    (lesson.type === 'filesystem' && !task.starterFs) ||
    (lesson.type === 'desktop' && !task.starterDesktop) ||
    (lesson.type === 'electronics' && !task.starterCircuit)
  )
}

export function legacyIncompleteDraftLabel(lesson) {
  return lesson.type === 'html'
    ? 'starter files'
    : lesson.type === 'filesystem'
      ? 'starter filesystem'
      : lesson.type === 'desktop'
        ? 'starter desktop'
        : 'starter breadboard'
}

export function legacyResetToStarterReselectsFiles(lesson) {
  return lesson.type === 'html'
}

export function legacyCodeFormat(lesson) {
  return {
    value: 'code',
    label: lesson.type === 'scratch' ? 'Scratch' : 'Code',
    iconType: lesson.type === 'scratch' ? 'scratch' : 'code',
  }
}

export function legacyCopyCodePlaceholder(lesson) {
  return lesson.type === 'python'
    ? 'Code students can copy...'
    : '<!-- Code students can copy... -->'
}

// LessonMetaPanel.jsx
export function legacySharedTypeAssets(lesson) {
  return ['html', 'arcade'].includes(lesson.type)
}

// BuilderView.jsx: the type whose assets supply defaultSprites
export function legacyBuilderSpriteLibraryType(lesson) {
  return ['scratch', 'composed'].includes(lesson.type) ? 'scratch' : null
}

// task-editor/TaskEditorFields.jsx SpriteAddPicker
export function legacySpritePickerLibraryType(lessonType) {
  return lessonType === 'scratch' ? 'scratch' : null
}

// SandboxStarterModal.jsx SandboxStarterEditor: which editor renders
export function legacySandboxStarterEditor(lesson) {
  const isPython = isPythonLikeType(lesson.type)
  const isScratch = lesson.type === 'scratch'
  const isFilesystem = lesson.type === 'filesystem'
  const isElectronics = lesson.type === 'electronics'
  return isPython
    ? 'code'
    : isScratch
      ? 'blocks'
      : isFilesystem
        ? 'fs'
        : isElectronics
          ? 'circuit'
          : 'files'
}
