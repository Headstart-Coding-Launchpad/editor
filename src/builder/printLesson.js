import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import { getEffectiveLessonForTask, getComposedModuleTypes } from '../shared/composedLesson'
import { getModuleAuthoring, getModuleLabel } from '../modules/definitions'
import { getTaskActivity } from '../activities/registry.pure.js'

function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
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
      if (Array.isArray(val)) {
        const s = val.join(' ')
        return s ? [`${attr}="${esc(s)}"`] : []
      }
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
  try {
    return hastToHtml(_mdProc.runSync(_mdProc.parse(text)))
  } catch {
    return esc(text)
  }
}

function renderCheckHtml(check) {
  if (!check) return '<em>None</em>'
  const checks = Array.isArray(check) ? check : [check]
  return checks
    .map((c) => {
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
    })
    .join('')
}

export function buildPrintHtml(lesson) {
  function renderTask(task, taskNumber) {
    // Composed lessons carry the module type per task, not on the lesson itself.
    const taskType = getEffectiveLessonForTask(lesson, task)?.type ?? lesson.type
    const parts = []
    parts.push(`<section class="task">`)
    parts.push(
      `<h3 class="task-title"><span class="task-num">${taskNumber}</span> ${esc(task.title || '(untitled)')}</h3>`
    )

    // A `taskType: 'activity'` task (not a legacy quiz) names its activity and prints its
    // description (shown above the activity when there is no explainer).
    const activity = getTaskActivity(task)
    const itemActivity = activity && !activity.legacy ? activity : null
    const badges = []
    if (task.taskType) badges.push(`<span class="badge badge-type">${esc(task.taskType)}</span>`)
    if (task.quizType) badges.push(`<span class="badge">${esc(task.quizType)}</span>`)
    if (itemActivity) {
      const name = task.activityType === itemActivity.id ? itemActivity.label : task.activityType
      badges.push(`<span class="badge">${esc(name ?? '')}</span>`)
    }
    if (task.informationType) badges.push(`<span class="badge">${esc(task.informationType)}</span>`)
    if (!task.taskType) {
      badges.push(
        `<span class="badge badge-mode">${task.interactionMode === 'submit' ? 'Submit' : 'Run'}</span>`
      )
    }
    if (task.estimatedMinutes)
      badges.push(`<span class="badge">${esc(String(task.estimatedMinutes))} min</span>`)
    if (badges.length) parts.push(`<div class="badges">${badges.join('')}</div>`)

    if (task.explainer) {
      parts.push(
        `<div class="field"><div class="field-label">Explainer</div><div class="field-value markdown">${mdToHtml(task.explainer)}</div></div>`
      )
    }
    if (itemActivity && !task.explainer && task.description) {
      parts.push(
        `<div class="field"><div class="field-label">Description</div><div class="field-value markdown">${mdToHtml(task.description)}</div></div>`
      )
    }
    if (task.leftContent) {
      parts.push(
        `<div class="field"><div class="field-label">Left Content (Recap)</div><div class="field-value markdown">${mdToHtml(task.leftContent)}</div></div>`
      )
    }

    // Quizzes and activities print their own fields (definition.printHtml).
    const activityHtml = activity?.printHtml?.(task, { esc, mdToHtml })
    if (activityHtml) parts.push(activityHtml)

    // A code task prints its module's own fields (the module's authoring.printTask).
    if (!task.taskType) {
      const moduleHtml = getModuleAuthoring(taskType)?.printTask(task, { esc })
      if (moduleHtml) parts.push(moduleHtml)
    }

    const hints = (task.hints || []).filter(Boolean)
    if (hints.length) {
      parts.push(`<div class="field"><div class="field-label">Hints</div><ol>`)
      for (const h of hints) parts.push(`<li class="markdown">${mdToHtml(h)}</li>`)
      parts.push(`</ol></div>`)
    }

    if (task.check) {
      parts.push(
        `<div class="field"><div class="field-label">Check</div>${renderCheckHtml(task.check)}</div>`
      )
    }

    parts.push(`</section>`)
    return parts.join('')
  }

  const printTypeLabel = (type) => getModuleLabel(type, 'print') ?? type
  const composedTypes = getComposedModuleTypes(lesson)
  const typeLabel =
    composedTypes.length > 0
      ? composedTypes.map(printTypeLabel).join(' + ')
      : printTypeLabel(lesson.type)
  let taskNumber = 1
  const taskSections = []

  for (const item of lesson.tasks) {
    if (item.type === 'group') {
      taskSections.push(`<section class="group">`)
      taskSections.push(
        `<h2 class="group-title">Group: ${esc(item.title || '(untitled group)')}</h2>`
      )
      for (const sub of item.subtasks || []) {
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
.muted { color: #6b7280; }
.path-cell code, .circuit-table code, .parts-table code { font-family: 'Consolas', 'Courier New', monospace; font-size: 0.9em; }
.snippet-cell { white-space: normal; }
.subfield-label { font-size: 0.75em; font-weight: 700; color: #374151; margin-top: 7px; margin-bottom: 2px; }
.circuit-board { margin-bottom: 4px; }
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
