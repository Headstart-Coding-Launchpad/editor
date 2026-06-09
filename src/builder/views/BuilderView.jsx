import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import PreviewView from './PreviewView'
import { HTML_ONLY } from '../components/FileManager'
import { flattenTasks, findGroupForTask, updateTaskInTasks, updateSubtaskTitles } from '../../shared/taskUtils'
import { normalizeTasksForExport, validateLesson } from '../lessonUtils'
import { firestore } from '../../shared/firebase'
import { useAuth } from '../../auth/useAuth'

// ─── Group editor panel ───────────────────────────────────────────────────────

function GroupEditor({ group, onUpdate }) {
  return (
    <div style={ge.wrap}>
      <div style={ge.field}>
        <span style={ge.label}>Group title</span>
        <input
          style={ge.input}
          value={group.title}
          onChange={e => onUpdate({ ...group, title: e.target.value })}
          placeholder="e.g. Functions"
          autoFocus
        />
      </div>
      <p style={ge.hint}>
        This group contains {group.subtasks?.length ?? 0} subtask{(group.subtasks?.length ?? 0) !== 1 ? 's' : ''}.
        Subtasks are shown as a single step in the student progress indicator.
        Use the task list to add, reorder, or delete subtasks.
      </p>
    </div>
  )
}

const ge = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, padding: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
    outline: 'none',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: 0,
  },
}

// ─── Print helpers ────────────────────────────────────────────────────────────

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

function buildPrintHtml(lesson) {
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

// ─── BuilderView ──────────────────────────────────────────────────────────────

export default function BuilderView({ lesson, dirty, onUpdate, onNew, onMarkSaved }) {
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const first = lesson.tasks[0]
    if (!first) return null
    if (first.type === 'group') return first.subtasks?.[0]?.id ?? null
    return first.id
  })
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [publishStatus, setPublishStatus] = useState(null) // null | 'publishing' | 'done' | 'error'
  const [taskFeedback, setTaskFeedback] = useState([])
  const { role } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedTaskId || !lesson?.id) { setTaskFeedback([]); return }
    getDocs(query(
      collection(firestore, 'lessons', lesson.id, 'feedback'),
      where('taskId', '==', selectedTaskId)
    )).then(snap => {
      const items = snap.docs.map(d => d.data())
      items.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      setTaskFeedback(items)
    }).catch(() => setTaskFeedback([]))
  }, [lesson?.id, selectedTaskId])

  function handleLessonUpdate(updater) {
    if (typeof updater === 'function') {
      onUpdate(prev => {
        const next = updater(prev)
        return {
          ...next,
          tasks: updateSubtaskTitles(next.tasks),
        }
      })
    } else {
      onUpdate({
        ...updater,
        tasks: updateSubtaskTitles(updater.tasks),
      })
    }
  }

  function selectTask(id) {
    setSelectedTaskId(id)
    setSelectedGroupId(null)
  }

  function selectGroup(id) {
    setSelectedGroupId(id)
    setSelectedTaskId(null)
  }

  if (previewing) {
    return <PreviewView lesson={lesson} onClose={() => setPreviewing(false)} initialTaskId={selectedTaskId} />
  }

  // ── Default type fields for a new task ──────────────────────────────────────

  function defaultTypeFields(prevTask = null) {
    if (lesson.type === 'python') {
      return {
        starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
        carryCodeFrom: prevTask?.id ?? null,
      }
    }
    if (lesson.type === 'scratch') {
      return {
        toolbox: '',
        starterBlocks: prevTask ? (prevTask.completeBlocks ?? prevTask.starterBlocks ?? null) : null,
        carryBlocksFrom: prevTask?.id ?? null,
      }
    }
    return {
      starterFiles: prevTask
        ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map(f => ({ ...f }))
        : [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
      entryFile: prevTask ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html') : 'index.html',
      carryCodeFrom: prevTask?.id ?? null,
    }
  }

  function nextId() {
    return flattenTasks(lesson.tasks).reduce((m, t) => Math.max(m, t.id), 0) + 1
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleDownload() {
    if (errors.length) {
      alert('Cannot download — please fix these errors:\n\n' + errors.join('\n'))
      return
    }
    if (warnings.length) {
      const ok = confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nDownload anyway?')
      if (!ok) return
    }

    const exported = {
      ...lesson,
      tasks: normalizeTasksForExport(lesson.tasks),
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${lesson.id || 'lesson'}.json`
    a.click()
    URL.revokeObjectURL(url)
    onMarkSaved()
  }

  async function handlePublish() {
    if (errors.length) {
      alert('Cannot publish — please fix these errors:\n\n' + errors.join('\n'))
      return
    }
    if (warnings.length) {
      const ok = confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nPublish anyway?')
      if (!ok) return
    }
    if (!lesson.id) {
      alert('Cannot publish — lesson ID is required.')
      return
    }
    setPublishStatus('publishing')
    try {
      const exported = JSON.parse(JSON.stringify({ ...lesson, tasks: normalizeTasksForExport(lesson.tasks) }))
      await setDoc(doc(firestore, 'lessons', lesson.id), exported)
      setPublishStatus('done')
      onMarkSaved()
      setTimeout(() => navigate('/admin'), 1500)
    } catch (err) {
      console.error('Publish failed:', err)
      setPublishStatus('error')
      setTimeout(() => setPublishStatus(null), 3000)
      alert('Failed to publish: ' + err.message)
    }
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this page and try again.'); return }
    win.document.write(buildPrintHtml(lesson))
    win.document.close()
    win.focus()
    win.print()
  }

  function handleUpload() {
    if (dirty && !confirm('You have unsaved changes — download your lesson first.\n\nContinue?')) return
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result)
          if (!parsed.id || !parsed.tasks) throw new Error('Unrecognised format')
          handleLessonUpdate(parsed)
          const firstFlat = flattenTasks(parsed.tasks)
          selectTask(firstFlat[0]?.id ?? null)
        } catch (err) {
          alert('Could not load file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function topLevelInsertPosition() {
    const flat = flattenTasks(lesson.tasks)
    const defaultPrev = flat[flat.length - 1] ?? null
    if (selectedTaskId != null) {
      const topIdx = lesson.tasks.findIndex(item => item.type !== 'group' && item.id === selectedTaskId)
      if (topIdx >= 0) return { index: topIdx + 1, prevTask: lesson.tasks[topIdx] }
      const groupIdx = lesson.tasks.findIndex(
        item => item.type === 'group' && (item.subtasks ?? []).some(s => s.id === selectedTaskId)
      )
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return {
          index: groupIdx + 1,
          prevTask: (group.subtasks ?? []).find(s => s.id === selectedTaskId) ?? defaultPrev,
        }
      }
    }
    if (selectedGroupId != null) {
      const groupIdx = lesson.tasks.findIndex(item => item.type === 'group' && item.id === selectedGroupId)
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return { index: groupIdx + 1, prevTask: (group.subtasks ?? []).at(-1) ?? defaultPrev }
      }
    }
    return { index: lesson.tasks.length, prevTask: defaultPrev }
  }

  function handleAddTask() {
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const newTask = { id: newId, title: '', explainer: '', ...defaultTypeFields(prevTask) }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newTask)
      return { ...prev, tasks: next }
    })
    selectTask(newId)
  }

  function handleAddGroup() {
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const groupId = `g-${Date.now()}`
    const firstSubtask = {
      id: newId,
      title: 'New Group - 1',
      explainer: '',
      ...defaultTypeFields(prevTask),
    }
    const newGroup = {
      id: groupId,
      type: 'group',
      title: 'New Group',
      subtasks: [firstSubtask],
    }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newGroup)
      return { ...prev, tasks: next }
    })
    selectGroup(groupId)
  }

  function handleAddSubtask(groupId) {
    const group = lesson.tasks.find(t => t.type === 'group' && t.id === groupId)
    if (!group) return
    const newId = nextId()
    const subtasks = group.subtasks ?? []
    const selectedSubtaskIdx = selectedTaskId != null
      ? subtasks.findIndex(s => s.id === selectedTaskId)
      : -1
    const insertIndex = selectedSubtaskIdx >= 0 ? selectedSubtaskIdx + 1 : subtasks.length
    const prevSubtask = selectedSubtaskIdx >= 0 ? subtasks[selectedSubtaskIdx] : (subtasks[subtasks.length - 1] ?? null)
    const newSubtask = {
      id: newId,
      title: `${group.title} - ${subtasks.length + 1}`,
      explainer: '',
      ...defaultTypeFields(prevSubtask),
    }
    handleLessonUpdate(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.type !== 'group' || t.id !== groupId) return t
        const subs = t.subtasks ?? []
        return { ...t, subtasks: [...subs.slice(0, insertIndex), newSubtask, ...subs.slice(insertIndex)] }
      }),
    }))
    selectTask(newId)
  }

  function handleDuplicate(task, groupId = null) {
    const newId = nextId()

    if (groupId) {
      const group = lesson.tasks.find(t => t.type === 'group' && t.id === groupId)
      const newTitle = group ? `${group.title} - ${(group.subtasks?.length ?? 0) + 1}` : task.title
      const dup = { ...task, id: newId, title: newTitle }
      handleLessonUpdate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.type === 'group' && t.id === groupId
            ? { ...t, subtasks: [...(t.subtasks ?? []), dup] }
            : t
        ),
      }))
    } else {
      const dup = { ...task, id: newId, title: task.title + ' (copy)' }
      handleLessonUpdate(prev => ({ ...prev, tasks: [...prev.tasks, dup] }))
      selectTask(dup.id)
      return
    }
    selectTask(newId)
  }

  function handleDelete(taskId) {
    if (!confirm('Delete this task?')) return
    const group = findGroupForTask(lesson.tasks, taskId)

    if (group) {
      const newSubtasks = (group.subtasks ?? []).filter(t => t.id !== taskId)
      if (newSubtasks.length === 0) {
        // Remove the now-empty group too
        handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== group.id) }))
        const remaining = flattenTasks(lesson.tasks.filter(t => t.id !== group.id))
        selectTask(remaining[0]?.id ?? null)
      } else {
        handleLessonUpdate(prev => ({
          ...prev,
          tasks: prev.tasks.map(t =>
            t.type === 'group' && t.id === group.id ? { ...t, subtasks: newSubtasks } : t
          ),
        }))
        selectTask(newSubtasks[0]?.id ?? null)
      }
    } else {
      handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }))
      const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type !== 'group' && t.id === taskId)))
      selectTask(remaining[0]?.id ?? null)
    }
  }

  function handleDeleteGroup(groupId) {
    if (!confirm('Delete this group and all its subtasks?')) return
    handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => !(t.type === 'group' && t.id === groupId)) }))
    const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type === 'group' && t.id === groupId)))
    selectTask(remaining[0]?.id ?? null)
  }

  function handleReorder(reorderedTasks) {
    onUpdate(prev => ({ ...prev, tasks: reorderedTasks }))
  }

  function handleReorderSubtask(groupId, reorderedSubtasks) {
    const updated = lesson.tasks.map(item => {
      if (item.type === 'group') {
        const subtasks = item.id === groupId ? reorderedSubtasks : (item.subtasks ?? [])
        return {
          ...item,
          subtasks,
        }
      }
      return item
    })
    onUpdate(prev => ({ ...prev, tasks: updated }))
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const { errors, warnings } = validateLesson(lesson)
  const flatTasks = flattenTasks(lesson.tasks)
  const selectedTask = selectedTaskId != null ? flatTasks.find(t => t.id === selectedTaskId) : null
  const selectedGroup = selectedGroupId != null
    ? lesson.tasks.find(t => t.type === 'group' && t.id === selectedGroupId)
    : null

  // Pass a flat-tasks version of lesson to TaskEditor so its internal pickers work correctly
  const lessonForEditor = selectedTask ? { ...lesson, tasks: flatTasks } : lesson
  const selectedTaskGroup = selectedTask
    ? (lesson.tasks.find(t => t.type === 'group' && (t.subtasks ?? []).some(s => s.id === selectedTask.id)) ?? null)
    : null

  return (
    <div style={s.page}>
      <header style={s.topBar}>
        <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={s.dirtyDot} title="Unsaved changes" />}
          {role === 'admin' && (
            <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => navigate('/admin')}>
              Back to Admin
            </button>
          )}
          <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={onNew}>New</button>
          <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleUpload}>Upload</button>
          <button
            className="btn-ghost"
            style={{ fontSize: 13, padding: '5px 12px' }}
            onClick={() => setPreviewing(true)}
            disabled={lesson.tasks.length === 0}
            title={lesson.tasks.length === 0 ? 'Add at least one task to preview' : 'Preview as student'}
          >
            Preview
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 13, padding: '5px 12px' }}
            onClick={handlePrint}
            disabled={lesson.tasks.length === 0}
            title={lesson.tasks.length === 0 ? 'Add at least one task to print' : 'Print lesson reference'}
          >
            Print
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: 13, padding: '5px 14px' }}
            onClick={handleDownload}
            disabled={errors.length > 0}
          >
            Download JSON
          </button>
          {role === 'admin' && (
            <button
              className="btn-primary"
              style={{ fontSize: 13, padding: '5px 14px', background: publishStatus === 'done' ? '#16a34a' : publishStatus === 'error' ? '#ef4444' : undefined }}
              onClick={handlePublish}
              disabled={errors.length > 0 || publishStatus === 'publishing'}
            >
              {publishStatus === 'publishing' ? 'Publishing…' : publishStatus === 'done' ? 'Published ✓' : publishStatus === 'error' ? 'Publish failed ✕' : 'Publish to Firestore'}
            </button>
          )}
        </div>
      </header>

      <div style={{ ...s.body, gridTemplateColumns: metaOpen ? '320px 280px minmax(0, 1fr)' : '40px 280px minmax(0, 1fr)' }}>
        <aside style={metaOpen ? s.metaPane : s.metaPaneCollapsed}>
          {metaOpen ? (
            <LessonMetaPanel lesson={lesson} onUpdate={onUpdate} onCollapse={() => setMetaOpen(false)} />
          ) : (
            <div style={s.collapsedMetaStrip}>
              <button type="button" style={s.expandMetaBtn} onClick={() => setMetaOpen(true)} title="Expand lesson details">
                ›
              </button>
            </div>
          )}
        </aside>

        <aside style={s.taskPane}>
          <TaskList
            tasks={lesson.tasks}
            selectedTaskId={selectedTaskId}
            selectedGroupId={selectedGroupId}
            onSelect={selectTask}
            onSelectGroup={selectGroup}
            onAdd={handleAddTask}
            onAddGroup={handleAddGroup}
            onAddSubtask={handleAddSubtask}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onDeleteGroup={handleDeleteGroup}
            onReorder={handleReorder}
            onReorderSubtask={handleReorderSubtask}
          />
          <ValidationPanel key={selectedTaskId ?? 'none'} errors={errors} warnings={warnings} />
        </aside>

        <main style={s.main}>
          {selectedGroup && !selectedTask ? (
            <GroupEditor
              group={selectedGroup}
              onUpdate={updatedGroup => {
                handleLessonUpdate(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t =>
                    t.type === 'group' && t.id === updatedGroup.id ? updatedGroup : t
                  ),
                }))
              }}
            />
          ) : selectedTask ? (
            <>
              <TaskEditor
                key={selectedTask.id}
                task={selectedTask}
                lesson={lessonForEditor}
                parentGroup={selectedTaskGroup}
                onUpdate={updated => {
                  let finalUpdated = updated
                  if (selectedTaskGroup) {
                    if ('_customTitle' in updated && !updated._customTitle) {
                      // Explicit reset — clear flag so updateSubtaskTitles regenerates title
                      const { _customTitle, ...withoutFlag } = finalUpdated
                      finalUpdated = withoutFlag
                    } else if (updated.title !== selectedTask.title) {
                      finalUpdated = { ...updated, _customTitle: true }
                    }
                  }
                  handleLessonUpdate(prev => ({
                    ...prev,
                    tasks: updateTaskInTasks(prev.tasks, finalUpdated),
                  }))
                }}
              />
              {taskFeedback.length > 0 && (
                <TaskFeedbackPanel feedback={taskFeedback} />
              )}
            </>
          ) : (
            <div style={s.empty}>
              <p>Select a task from the left panel, or add a new one to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Task feedback panel ──────────────────────────────────────────────────────

function TaskFeedbackPanel({ feedback }) {
  const [open, setOpen] = useState(false)
  return (
    <section style={s.feedbackSection}>
      <button
        type="button"
        style={s.feedbackHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={s.feedbackTitle}>Lesson Feedback ({feedback.length})</span>
        <span style={{ ...s.optionsChevron, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={s.feedbackBody}>
          {feedback.map((item, i) => (
            <div key={i} style={s.feedbackItem}>
              <div style={s.feedbackMeta}>
                <span style={s.feedbackEmail}>{item.teacherEmail}</span>
                <span style={s.feedbackDate}>{new Date(item.submittedAt).toLocaleString()}</span>
              </div>
              <p style={s.feedbackText}>{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Validation panel ─────────────────────────────────────────────────────────

function ValidationPanel({ errors, warnings }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(errors.length ? 'errors' : 'warnings')
  const [ignoredWarnings, setIgnoredWarnings] = useState(() => new Set())

  const visibleWarnings = warnings.filter(w => !ignoredWarnings.has(w))

  const summaryParts = []
  if (errors.length) summaryParts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`)
  if (visibleWarnings.length) summaryParts.push(`${visibleWarnings.length} warning${visibleWarnings.length !== 1 ? 's' : ''}`)
  const summary = summaryParts.join(', ') || 'No issues'

  const items = activeTab === 'errors' ? errors : visibleWarnings
  const count = activeTab === 'errors' ? errors.length : visibleWarnings.length

  return (
    <section style={s.validation}>
      <button
        type="button"
        style={s.validationHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={s.validationHeaderTitle}>Validation</span>
        <span style={{ ...s.validationSummary, color: errors.length ? '#ef4444' : visibleWarnings.length ? '#f59e0b' : '#22c55e' }}>
          {summary}
        </span>
        <span style={{ ...s.optionsChevron, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <>
          <div style={s.validationTabs}>
            <button
              style={{ ...s.validationTab, ...(activeTab === 'errors' ? s.validationTabActive : {}) }}
              onClick={() => setActiveTab('errors')}
            >
              Errors <span style={s.countBadge}>{errors.length}</span>
            </button>
            <button
              style={{ ...s.validationTab, ...(activeTab === 'warnings' ? s.validationTabActive : {}) }}
              onClick={() => setActiveTab('warnings')}
            >
              Warnings <span style={s.countBadge}>{visibleWarnings.length}</span>
            </button>
          </div>

          <div style={s.validationBody}>
            {count === 0 ? (
              <p style={s.validationEmpty}>
                No {activeTab === 'errors' ? 'errors' : 'warnings'} found.
              </p>
            ) : (
              items.map((item, i) => (
                <div key={`${activeTab}-${i}`} style={activeTab === 'errors' ? s.errorItem : s.warningItem}>
                  <span style={{ flex: 1 }}>{item}</span>
                  {activeTab === 'warnings' && (
                    <button
                      type="button"
                      style={s.ignoreBtn}
                      onClick={() => setIgnoredWarnings(prev => new Set([...prev, item]))}
                      title="Ignore this warning until you change task"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  topBar: {
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 52,
    flexShrink: 0,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#ffffff',
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--colour-secondary)',
    display: 'inline-block',
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 280px minmax(0, 1fr)',
    overflow: 'hidden',
  },
  metaPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  metaPaneCollapsed: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  collapsedMetaStrip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    width: '100%',
  },
  expandMetaBtn: {
    width: 28,
    height: 28,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    fontSize: '1.15rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  },
  taskPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  main: {
    overflow: 'auto',
    background: '#f5f5f5',
    padding: 20,
    minWidth: 0,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
  },
  validation: {
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  validationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#fafafa',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  validationHeaderTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  validationSummary: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optionsChevron: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontSize: '1rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  validationTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 10,
    gap: 6,
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  validationTab: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--colour-text)',
    borderRadius: 6,
    padding: '7px 8px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  validationTabActive: {
    borderColor: 'var(--colour-primary)',
    color: 'var(--colour-primary)',
    background: '#f7f2ff',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    marginLeft: 6,
    padding: '0 6px',
    borderRadius: 999,
    background: '#eef2ff',
    color: 'var(--colour-primary)',
    fontSize: '0.72rem',
  },
  validationBody: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  validationEmpty: {
    margin: 0,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  errorItem: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  warningItem: {
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  ignoreBtn: {
    flexShrink: 0,
    padding: '2px 8px',
    background: 'transparent',
    border: '1px solid #d97706',
    borderRadius: 4,
    color: '#92400e',
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  feedbackSection: {
    marginTop: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#f0fdf4',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  feedbackTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#16a34a',
    flex: 1,
  },
  feedbackBody: {
    padding: '8px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#fff',
    maxHeight: 320,
    overflowY: 'auto',
  },
  feedbackItem: {
    borderLeft: '3px solid #86efac',
    paddingLeft: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  feedbackMeta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  feedbackEmail: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.78rem',
    color: 'var(--colour-primary)',
  },
  feedbackDate: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  feedbackText: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: 'var(--colour-text)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
}
