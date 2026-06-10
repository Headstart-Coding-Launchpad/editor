import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'

function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
const HAST_PROP_ATTR = { className: 'class', htmlFor: 'for', httpEquiv: 'http-equiv' }

function hastToHtml(node) {
  if (!node) return ''
  if (node.type === 'text') return esc(node.value)
  if (node.type === 'raw') return node.value
  if (node.type === 'root') return (node.children || []).map(hastToHtml).join('')
  if (node.type === 'element') {
    const attrParts = Object.entries(node.properties || {}).flatMap(([key, val]) => {
      const attr = HAST_PROP_ATTR[key] ?? key
      if (val === false || val == null) return []
      if (val === true) return [attr]
      if (Array.isArray(val)) { const s = val.join(' '); return s ? [`${attr}="${esc(s)}"`] : [] }
      return [`${attr}="${esc(String(val))}"`]
    })
    const attrStr = attrParts.length ? ' ' + attrParts.join(' ') : ''
    const inner = (node.children || []).map(hastToHtml).join('')
    return VOID_TAGS.has(node.tagName)
      ? `<${node.tagName}${attrStr}>`
      : `<${node.tagName}${attrStr}>${inner}</${node.tagName}>`
  }
  return ''
}

const _mdProc = unified().use(remarkParse).use(remarkBreaks).use(remarkRehype)

function mdToHtml(text) {
  if (!text) return ''
  try { return hastToHtml(_mdProc.runSync(_mdProc.parse(text))) }
  catch { return esc(text) }
}

function renderCheckHtml(check) {
  if (!check) return '<em>None</em>'
  const checks = Array.isArray(check) ? check : [check]
  return checks.map(c => {
    const parts = [`<strong>${esc(c.type)}</strong>`]
    if (c.value !== undefined) parts.push(`value: <code>${esc(String(c.value))}</code>`)
    if (c.selector) parts.push(`selector: <code>${esc(c.selector)}</code>`)
    if (c.evaluation) parts.push(`evaluation: ${esc(c.evaluation)}`)
    if (c.spriteName) parts.push(`sprite: ${esc(c.spriteName)}`)
    if (c.property) parts.push(`property: ${esc(c.property)}`)
    if (c.operator) parts.push(`operator: ${esc(c.operator)}`)
    if (c.opcode) parts.push(`opcode: <code>${esc(c.opcode)}</code>`)
    if (c.variableName) parts.push(`variable: ${esc(c.variableName)}`)
    return `<div class="check-item">${parts.join(' — ')}</div>`
  }).join('')
}

export function buildPrintHtml(lesson) {
  function renderTask(task, taskNumber) {
    const parts = []
    parts.push(`<section class="task">`)
    parts.push(`<h3 class="task-title"><span class="task-num">${taskNumber}</span> ${esc(task.title || '(untitled)')}</h3>`)

    const badges = []
    if (task.taskType) badges.push(`<span class="badge badge-type">${esc(task.taskType)}</span>`)
    if (task.quizType) badges.push(`<span class="badge">${esc(task.quizType)}</span>`)
    if (task.informationType) badges.push(`<span class="badge">${esc(task.informationType)}</span>`)
    if (!task.taskType) {
      badges.push(`<span class="badge badge-mode">${task.interactionMode === 'submit' ? 'Submit' : 'Run'}</span>`)
    }
    if (task.estimatedMinutes) badges.push(`<span class="badge">${esc(String(task.estimatedMinutes))} min</span>`)
    if (badges.length) parts.push(`<div class="badges">${badges.join('')}</div>`)

    if (task.explainer) {
      parts.push(`<div class="field"><div class="field-label">Explainer</div><div class="field-value markdown">${mdToHtml(task.explainer)}</div></div>`)
    }
    if (task.leftContent) {
      parts.push(`<div class="field"><div class="field-label">Left Content (Recap)</div><div class="field-value markdown">${mdToHtml(task.leftContent)}</div></div>`)
    }

    if (task.taskType === 'quiz') {
      if (task.quizType === 'multiple_choice' && task.options?.length) {
        parts.push(`<div class="field"><div class="field-label">Options</div><table class="data-table"><tr><th>ID</th><th>Text</th><th>Feedback</th></tr>`)
        for (const opt of task.options) {
          parts.push(`<tr><td>${esc(opt.id)}</td><td>${esc(opt.text)}</td><td>${esc(opt.feedback || '')}</td></tr>`)
        }
        parts.push(`</table></div>`)
      }
      if (task.quizType === 'match' && task.pairs?.length) {
        parts.push(`<div class="field"><div class="field-label">Pairs</div><table class="data-table"><tr><th>Prompt</th><th>Answer</th></tr>`)
        for (const p of task.pairs) {
          parts.push(`<tr><td>${esc(p.prompt)}</td><td>${esc(p.answer)}</td></tr>`)
        }
        parts.push(`</table></div>`)
      }
      if (task.quizType === 'fill_blank') {
        if (task.text) {
          parts.push(`<div class="field"><div class="field-label">Text</div><div class="field-value">${esc(task.text)}</div></div>`)
        }
        if (task.blanks?.length) {
          parts.push(`<div class="field"><div class="field-label">Blanks</div><table class="data-table"><tr><th>ID</th><th>Answer</th></tr>`)
          for (const b of task.blanks) {
            parts.push(`<tr><td>${esc(b.id)}</td><td>${esc(b.answer)}</td></tr>`)
          }
          parts.push(`</table></div>`)
        }
        if (task.distractors?.length) {
          parts.push(`<div class="field"><div class="field-label">Distractors</div><table class="data-table"><tr><th>ID</th><th>Text</th></tr>`)
          for (const d of task.distractors) {
            parts.push(`<tr><td>${esc(d.id)}</td><td>${esc(d.text)}</td></tr>`)
          }
          parts.push(`</table></div>`)
        }
      }
    }

    if (!task.taskType) {
      if (lesson.type === 'python') {
        if (task.carryCodeFrom != null) {
          parts.push(`<div class="field"><div class="field-label">Carry Code From</div><div class="field-value">Task ${esc(String(task.carryCodeFrom))}</div></div>`)
        }
        if (task.starterCode != null) {
          parts.push(`<div class="field"><div class="field-label">Starter Code</div><pre class="code-block">${esc(task.starterCode)}</pre></div>`)
        }
        if (task.completeCode != null) {
          parts.push(`<div class="field"><div class="field-label">Complete Code</div><pre class="code-block">${esc(task.completeCode)}</pre></div>`)
        }
        if (task.codeStages?.length) {
          parts.push(`<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`)
          for (const stage of task.codeStages) {
            parts.push(`<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div><pre class="code-block">${esc(stage.code || '')}</pre></div>`)
          }
          parts.push(`</div>`)
        }
      }

      if (lesson.type === 'html') {
        if (task.carryCodeFrom != null) {
          parts.push(`<div class="field"><div class="field-label">Carry Code From</div><div class="field-value">Task ${esc(String(task.carryCodeFrom))}</div></div>`)
        }
        if (task.entryFile) {
          parts.push(`<div class="field"><div class="field-label">Entry File</div><div class="field-value">${esc(task.entryFile)}</div></div>`)
        }
        if (task.starterFiles?.length) {
          parts.push(`<div class="field"><div class="field-label">Starter Files</div>`)
          for (const f of task.starterFiles) {
            parts.push(`<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`)
          }
          parts.push(`</div>`)
        }
        if (task.completeFiles?.length) {
          parts.push(`<div class="field"><div class="field-label">Complete Files</div>`)
          for (const f of task.completeFiles) {
            parts.push(`<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`)
          }
          parts.push(`</div>`)
        }
        if (task.codeStages?.length) {
          parts.push(`<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`)
          for (const stage of task.codeStages) {
            parts.push(`<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>`)
            for (const f of (stage.files || [])) {
              parts.push(`<div class="file-block"><div class="file-name">${esc(f.name)}</div><pre class="code-block">${esc(f.content || '')}</pre></div>`)
            }
            parts.push(`</div>`)
          }
          parts.push(`</div>`)
        }
      }

      if (lesson.type === 'scratch') {
        if (task.carryBlocksFrom != null) {
          parts.push(`<div class="field"><div class="field-label">Carry Blocks From</div><div class="field-value">Task ${esc(String(task.carryBlocksFrom))}</div></div>`)
        }
        if (task.sprites?.length) {
          parts.push(`<div class="field"><div class="field-label">Sprites</div><table class="data-table"><tr><th>Name</th><th>Type</th><th>X</th><th>Y</th><th>Size</th><th>Direction</th></tr>`)
          for (const sp of task.sprites) {
            parts.push(`<tr><td>${esc(sp.name)}</td><td>${esc(sp.type || '')}</td><td>${esc(String(sp.x ?? ''))}</td><td>${esc(String(sp.y ?? ''))}</td><td>${esc(String(sp.size ?? ''))}</td><td>${esc(String(sp.direction ?? ''))}</td></tr>`)
          }
          parts.push(`</table></div>`)
        }
        if (task.backdrops?.length) {
          parts.push(`<div class="field"><div class="field-label">Backdrops</div><table class="data-table"><tr><th>Name</th><th>Colour / Image</th></tr>`)
          for (const bd of task.backdrops) {
            parts.push(`<tr><td>${esc(bd.name)}</td><td>${esc(bd.colour || bd.image || '')}</td></tr>`)
          }
          parts.push(`</table></div>`)
        }
        if (task.variables?.length) {
          parts.push(`<div class="field"><div class="field-label">Variables</div><table class="data-table"><tr><th>Name</th><th>Show on Stage</th></tr>`)
          for (const v of task.variables) {
            parts.push(`<tr><td>${esc(v.name)}</td><td>${v.showOnStage ? 'Yes' : 'No'}</td></tr>`)
          }
          parts.push(`</table></div>`)
        }
        if (task.toolbox) {
          parts.push(`<div class="field"><div class="field-label">Toolbox XML</div><pre class="code-block">${esc(task.toolbox)}</pre></div>`)
        }
        if (task.starterBlocks != null) {
          parts.push(`<div class="field"><div class="field-label">Starter Blocks</div><pre class="code-block">${esc(JSON.stringify(task.starterBlocks, null, 2))}</pre></div>`)
        }
        if (task.completeBlocks != null) {
          parts.push(`<div class="field"><div class="field-label">Complete Blocks</div><pre class="code-block">${esc(JSON.stringify(task.completeBlocks, null, 2))}</pre></div>`)
        }
        if (task.codeStages?.length) {
          parts.push(`<div class="field"><div class="field-label">Code Stages (${task.codeStages.length})</div>`)
          for (const stage of task.codeStages) {
            parts.push(`<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div><pre class="code-block">${esc(JSON.stringify(stage.blocks, null, 2))}</pre></div>`)
          }
          parts.push(`</div>`)
        }
      }
    }

    const hints = (task.hints || []).filter(Boolean)
    if (hints.length) {
      parts.push(`<div class="field"><div class="field-label">Hints</div><ol>`)
      for (const h of hints) parts.push(`<li class="markdown">${mdToHtml(h)}</li>`)
      parts.push(`</ol></div>`)
    }

    if (task.check) {
      parts.push(`<div class="field"><div class="field-label">Check</div>${renderCheckHtml(task.check)}</div>`)
    }

    parts.push(`</section>`)
    return parts.join('')
  }

  const typeLabel = { python: 'Python', html: 'Web (HTML/CSS/JS)', scratch: 'Scratch' }[lesson.type] || lesson.type
  let taskNumber = 1
  const taskSections = []

  for (const item of lesson.tasks) {
    if (item.type === 'group') {
      taskSections.push(`<section class="group">`)
      taskSections.push(`<h2 class="group-title">Group: ${esc(item.title || '(untitled group)')}</h2>`)
      for (const sub of (item.subtasks || [])) {
        taskSections.push(renderTask(sub, taskNumber++))
      }
      taskSections.push(`</section>`)
    } else {
      taskSections.push(renderTask(item, taskNumber++))
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Lesson: ${esc(lesson.title || lesson.id || 'Untitled')}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; padding: 20px 28px; }
h1 { font-size: 1.5em; margin-bottom: 6px; }
.lesson-meta { color: #555; font-size: 0.9em; margin-bottom: 4px; }
.lesson-desc { margin-top: 8px; color: #333; border-top: 2px solid #6200ea; padding-top: 10px; margin-bottom: 24px; font-size: 0.95em; line-height: 1.5; }
.group { margin-bottom: 12px; }
.group-title { font-size: 1.05em; font-weight: 700; color: #6200ea; background: #f3e8ff; border-left: 4px solid #6200ea; padding: 7px 12px; margin-bottom: 8px; }
.task { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
.task-title { font-size: 0.98em; font-weight: 700; color: #111; margin-bottom: 7px; display: flex; align-items: center; gap: 8px; }
.task-num { background: #6200ea; color: #fff; border-radius: 4px; font-size: 0.75em; font-weight: 700; padding: 2px 6px; flex-shrink: 0; }
.badges { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 9px; }
.badge { background: #f3e8ff; color: #6200ea; border: 1px solid #d8b4fe; border-radius: 12px; font-size: 0.72em; padding: 2px 8px; font-weight: 600; }
.badge-type { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
.badge-mode { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.field { margin-top: 10px; }
.field-label { font-size: 0.72em; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.field-value { font-size: 0.88em; color: #333; word-break: break-word; }
.markdown { line-height: 1.6; font-size: 0.88em; color: #333; }
.markdown p { margin: 0 0 7px; }
.markdown p:last-child { margin-bottom: 0; }
.markdown ul, .markdown ol { margin: 4px 0 7px 20px; }
.markdown li { margin-bottom: 2px; }
.markdown h1, .markdown h2, .markdown h3, .markdown h4 { font-weight: 700; margin: 8px 0 4px; }
.markdown h1 { font-size: 1.1em; }
.markdown h2 { font-size: 1.0em; }
.markdown h3, .markdown h4 { font-size: 0.95em; }
.markdown code { background: #f5f5f5; border: 1px solid #e5e7eb; border-radius: 3px; padding: 1px 4px; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.88em; }
.markdown pre { background: #f5f5f5; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; font-size: 0.8em; font-family: 'Consolas', 'Courier New', monospace; white-space: pre-wrap; overflow-wrap: break-word; margin: 6px 0; }
.markdown pre code { background: none; border: none; padding: 0; }
.markdown blockquote { border-left: 3px solid #6200ea; padding-left: 10px; color: #555; margin: 6px 0; }
.markdown strong { font-weight: 700; }
.markdown a { color: #6200ea; }
.code-block { background: #f5f5f5; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; font-size: 0.8em; font-family: 'Consolas', 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; line-height: 1.45; }
.file-block { margin-bottom: 6px; }
.file-name { font-size: 0.78em; font-weight: 700; color: #6200ea; margin-bottom: 2px; }
.stage { margin-bottom: 8px; }
.stage-label { font-size: 0.8em; font-weight: 700; color: #374151; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 3px; padding: 2px 6px; display: inline-block; margin-bottom: 3px; }
.check-item { font-size: 0.86em; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 5px 9px; margin-bottom: 4px; color: #166534; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.86em; margin-top: 4px; }
.data-table th { text-align: left; background: #f3e8ff; color: #6200ea; padding: 5px 8px; border: 1px solid #d8b4fe; }
.data-table td { padding: 4px 8px; border: 1px solid #e5e7eb; vertical-align: top; word-break: break-word; }
ol { margin-left: 20px; font-size: 0.88em; line-height: 1.8; }
@media print {
  body { padding: 0; font-size: 10pt; }
  .code-block { font-size: 0.75em; }
  .task { page-break-inside: avoid; }
}
</style>
</head>
<body>
<h1>${esc(lesson.title || '(untitled)')}</h1>
<div class="lesson-meta">
  ID: <strong>${esc(lesson.id)}</strong>&ensp;|&ensp;Type: <strong>${esc(typeLabel)}</strong>${lesson.level != null ? `&ensp;|&ensp;Level: <strong>${esc(String(lesson.level))}</strong>` : ''}&ensp;|&ensp;Tasks: <strong>${esc(String(lesson.tasks?.length ?? 0))}</strong>
</div>
${lesson.description ? `<div class="lesson-desc markdown">${mdToHtml(lesson.description)}</div>` : ''}
${taskSections.join('\n')}
</body>
</html>`
}
