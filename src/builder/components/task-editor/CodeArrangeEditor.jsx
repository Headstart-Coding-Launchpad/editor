import React, { useRef, useState } from 'react'
import { getLessonModule } from '../../../modules/registry'
import { evaluateFeedbackCheckResults, evaluateSingleCheck, normalizeChecks } from '../../../modules/checks'
import {
  assembleCodeArrangement, buildSolutionSlotState, fragmentIdExists, getCodeArrangeEntryFile, getSlotIds, isArrangementComplete,
} from '../../../shared/codeArrange'
import CodeArrangeTask from '../../../app/components/CodeArrangeTask'
import { Field } from './TaskEditorFields'
import TaskPreviewPanel from './TaskPreviewPanel'

let nextFragmentSeq = 1
function makeFragmentId(prefix) {
  return `${prefix}-${Date.now()}-${nextFragmentSeq++}`
}

function makeSlotPart() {
  return { type: 'slot', id: makeFragmentId('slot'), code: '' }
}

// A newly added line defaults to a single blank with no surrounding text —
// the degenerate "whole line" shape — since that's the most common case;
// authors extend it with fixed text and/or more blanks via the composer.
function makeLine() {
  return { id: makeFragmentId('line'), parts: [makeSlotPart()] }
}

// Visual authoring UI (not a raw JSON-shaped form) for the `code_arrange`
// task type: an ordered, reorderable list of lines, each built the same way
// as an alternating fixed-text / blank-slot "parts" composer (a line that's
// just one blank with no text is a whole draggable line; a line mixing text
// and blanks reads like `for i in range(___):`) — plus one shared task-level
// list of distractor tiles, an entry-file picker for HTML, the module's
// ordinary completion-check editor, and a live preview that runs the
// assembled program through the *same* runtime module the student pipeline
// uses (getLessonModule(...).runtime), so authors can drag a test
// arrangement and confirm their checks pass before publishing.
export default function CodeArrangeEditor({ task, onUpdate }) {
  const moduleType = task.moduleType === 'html' ? 'html' : 'python'
  const lessonMod = getLessonModule(moduleType)
  const lines = task.lines ?? []
  const distractors = task.distractors ?? []

  const [previewSlotState, setPreviewSlotState] = useState({})
  const [previewOutput, setPreviewOutput] = useState('')
  const [previewRunStatus, setPreviewRunStatus] = useState(null)
  const [previewRunning, setPreviewRunning] = useState(false)
  const [previewIframeSrc, setPreviewIframeSrc] = useState(null)
  const [previewCheckPassed, setPreviewCheckPassed] = useState(false)
  const [previewCheckAttempted, setPreviewCheckAttempted] = useState(false)
  const [previewPyodideStatus, setPreviewPyodideStatus] = useState(lessonMod.runtime.isReady?.() ? 'ready' : 'idle')
  const [previewInputPrompt, setPreviewInputPrompt] = useState(null)
  const iframeRef = React.useRef(null)
  const previewAppendOutputRef = useRef(null)

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  // Every structural edit (removing a line, a part, or a distractor) can
  // invalidate ids the in-progress Builder preview arrangement is holding
  // onto. Rather than track that per call site, re-derive the next task and
  // drop any preview selection that no longer resolves to a real slot/tile —
  // harmless no-op when nothing changed, cheap given these tasks are small.
  function applyTask(nextTask) {
    onUpdate(nextTask)
    setPreviewSlotState(prev => {
      const validSlotIds = new Set(getSlotIds(nextTask))
      const next = {}
      for (const [slotId, fragmentId] of Object.entries(prev)) {
        if (validSlotIds.has(slotId) && fragmentIdExists(nextTask, fragmentId)) next[slotId] = fragmentId
      }
      return next
    })
  }

  function applyLines(nextLines) {
    applyTask({ ...task, lines: nextLines })
  }

  function updateLine(index, updater) {
    applyLines(lines.map((line, i) => i === index ? updater(line) : line))
  }

  function addLine(afterIndex) {
    const next = [...lines]
    next.splice(afterIndex + 1, 0, makeLine())
    applyLines(next)
  }

  function removeLine(index) {
    applyLines(lines.filter((_, i) => i !== index))
  }

  function moveLine(index, direction) {
    const target = index + direction
    if (target < 0 || target >= lines.length) return
    const next = [...lines]
    ;[next[index], next[target]] = [next[target], next[index]]
    applyLines(next)
  }

  function addPart(index, type) {
    updateLine(index, line => ({
      ...line,
      parts: [...(line.parts ?? []), type === 'slot' ? makeSlotPart() : { type: 'text', text: '' }],
    }))
  }
  function updatePart(index, partIndex, updater) {
    updateLine(index, line => ({ ...line, parts: line.parts.map((p, i) => i === partIndex ? updater(p) : p) }))
  }
  function removePart(index, partIndex) {
    updateLine(index, line => ({ ...line, parts: line.parts.filter((_, i) => i !== partIndex) }))
  }
  function movePart(index, partIndex, direction) {
    updateLine(index, line => {
      const target = partIndex + direction
      if (target < 0 || target >= line.parts.length) return line
      const parts = [...line.parts]
      ;[parts[partIndex], parts[target]] = [parts[target], parts[partIndex]]
      return { ...line, parts }
    })
  }
  function updatePartText(index, partIndex, text) {
    updatePart(index, partIndex, part => ({ ...part, text }))
  }
  function updatePartCode(index, partIndex, code) {
    updatePart(index, partIndex, part => ({ ...part, code }))
  }

  function applyDistractors(nextDistractors) {
    applyTask({ ...task, distractors: nextDistractors })
  }
  function addDistractor() {
    applyDistractors([...distractors, { id: makeFragmentId('distractor'), code: '' }])
  }
  function updateDistractor(index, code) {
    applyDistractors(distractors.map((d, i) => i === index ? { ...d, code } : d))
  }
  function removeDistractor(index) {
    applyDistractors(distractors.filter((_, i) => i !== index))
  }

  function handleEntryFileChange(entryFile) {
    const files = task.starterFiles?.length ? [...task.starterFiles] : []
    if (!files.some(f => f.name === entryFile)) files.unshift({ name: entryFile, type: 'html', content: '' })
    onUpdate({ ...task, entryFile, starterFiles: files })
  }

  function updateStaticFile(index, updates) {
    const files = (task.starterFiles ?? []).map((f, i) => i === index ? { ...f, ...updates } : f)
    set('starterFiles', files)
  }

  function addStaticFile() {
    set('starterFiles', [...(task.starterFiles ?? []), { name: 'style.css', type: 'css', content: '' }])
  }

  function removeStaticFile(index) {
    set('starterFiles', (task.starterFiles ?? []).filter((_, i) => i !== index))
  }

  function resetPreviewRun() {
    setPreviewOutput('')
    setPreviewRunStatus(null)
    setPreviewCheckAttempted(false)
    setPreviewCheckPassed(false)
    setPreviewIframeSrc(null)
    setPreviewInputPrompt(null)
  }

  function buildPreviewFiles(assembledCode) {
    const entryFile = getCodeArrangeEntryFile(task)
    const others = (task.starterFiles ?? []).filter(f => f.name !== entryFile)
    return [{ name: entryFile, type: 'html', content: assembledCode ?? '' }, ...others]
  }

  async function handlePreviewRun() {
    const assembled = assembleCodeArrangement(task, previewSlotState)
    if (assembled == null || previewRunning) return
    setPreviewRunning(true)
    resetPreviewRun()

    if (moduleType === 'python') {
      if (!lessonMod.runtime.isReady()) {
        setPreviewPyodideStatus('loading')
        await lessonMod.runtime.init(msg => setPreviewPyodideStatus(msg))
        setPreviewPyodideStatus('ready')
      }
      let accumulated = ''
      const echoOutput = text => { accumulated += text; setPreviewOutput(accumulated) }
      previewAppendOutputRef.current = echoOutput
      const result = await lessonMod.runtime.run(assembled, task, {
        onOutput: echoOutput,
        onInputRequired: p => setPreviewInputPrompt(p),
      })
      setPreviewInputPrompt(null)

      if (result.status === 'stopped') {
        setPreviewRunning(false)
        return
      }

      setPreviewRunStatus(result.status)
      if (task.check) {
        const context = { status: result.status, code: assembled, variables: result.variables ?? {} }
        const passed = normalizeChecks(task.check).every(c => evaluateSingleCheck(c, accumulated, context))
        setPreviewCheckPassed(passed)
        setPreviewCheckAttempted(true)
        set('_checkTested', true)
      }
      setPreviewRunning(false)
      return
    }

    const files = buildPreviewFiles(assembled)
    const src = lessonMod.runtime.buildPreviewSrc({ files, entryFile: getCodeArrangeEntryFile(task) }, task, { assets: [], assetsPath: '', storageAssets: [] })
    setPreviewIframeSrc(src)
    setPreviewRunStatus('success')
    lessonMod.runtime.waitForPreviewText().then(text => {
      setPreviewOutput(text)
      if (task.check) {
        const iframeDoc = iframeRef.current?.contentDocument ?? null
        const codeStr = files.map(f => f.content).join('\n')
        const passed = normalizeChecks(task.check).every(c => evaluateSingleCheck(c, text, { code: codeStr, iframeDoc }))
        setPreviewCheckPassed(passed)
        setPreviewCheckAttempted(true)
        set('_checkTested', true)
      }
      setPreviewRunning(false)
    })
  }

  function handlePreviewInputSubmit(value) {
    previewAppendOutputRef.current?.(value + '\n')
    setPreviewInputPrompt(null)
    lessonMod.runtime.provideInput(value)
  }

  function handleLoadSolution() {
    setPreviewSlotState(buildSolutionSlotState(task))
    resetPreviewRun()
  }

  function handleClearPreview() {
    setPreviewSlotState({})
    resetPreviewRun()
  }

  const CheckEditor = lessonMod?.CheckEditor ?? null
  const previewAssembled = assembleCodeArrangement(task, previewSlotState)
  const previewComplete = isArrangementComplete(task, previewSlotState)
  const feedbackPreview = task.check && previewCheckAttempted
    ? evaluateFeedbackCheckResults(task, previewOutput, { code: previewAssembled ?? '', status: previewRunStatus })
    : []

  return (
    <>
      <Field label="Language">
        <div style={{ display: 'flex', gap: 24 }}>
          <label className="te-carry-radio-label">
            <input type="radio" checked={moduleType === 'python'} onChange={() => onUpdate({ ...task, moduleType: 'python' })} />
            Python
          </label>
          <label className="te-carry-radio-label">
            <input type="radio" checked={moduleType === 'html'} onChange={() => onUpdate({ ...task, moduleType: 'html' })} />
            HTML
          </label>
        </div>
      </Field>

      {moduleType === 'html' && (
        <Field label="Entry file" hint="The assembled lines become this file's content">
          <input className="te-input" value={task.entryFile ?? 'index.html'} onChange={e => handleEntryFileChange(e.target.value)} />
        </Field>
      )}

      <Field label="Program lines" hint="Each line is built from fixed text and blanks — a line with just one blank behaves like a whole draggable line">
        <div style={caStyles.lineList}>
          {lines.map((line, index) => (
            <LineEditor
              key={line.id}
              line={line}
              index={index}
              total={lines.length}
              onMoveUp={() => moveLine(index, -1)}
              onMoveDown={() => moveLine(index, 1)}
              onInsertBelow={() => addLine(index)}
              onRemove={() => removeLine(index)}
              disableRemove={lines.length <= 1}
              onAddPart={type => addPart(index, type)}
              onUpdatePartText={(partIndex, text) => updatePartText(index, partIndex, text)}
              onUpdatePartCode={(partIndex, code) => updatePartCode(index, partIndex, code)}
              onMovePart={(partIndex, direction) => movePart(index, partIndex, direction)}
              onRemovePart={partIndex => removePart(index, partIndex)}
            />
          ))}
        </div>
        <button type="button" className="btn-ghost te-secondary-btn" onClick={() => addLine(lines.length - 1)} style={{ marginTop: 8 }}>
          + Add line
        </button>
      </Field>

      <Field label="Distractor tiles" hint="Wrong tiles added to the one shared pool — students can drag any of these into any blank">
        <div className="te-quiz-answer-stack">
          {distractors.map((d, index) => (
            <div key={d.id} className="te-quiz-answer-card">
              <input
                className="te-input"
                style={caStyles.chipInput}
                value={d.code ?? ''}
                onChange={e => updateDistractor(index, e.target.value)}
                placeholder="A plausible but wrong value"
                spellCheck={false}
              />
              <button type="button" className="te-remove-btn" onClick={() => removeDistractor(index)} title="Remove distractor">✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost te-secondary-btn" onClick={addDistractor} style={{ marginTop: 8 }}>
          + Add distractor
        </button>
      </Field>

      {moduleType === 'html' && (
        <Field label="Other files" hint="Static files that aren't assembled from tiles, e.g. style.css">
          <div className="te-quiz-answer-stack">
            {(task.starterFiles ?? []).filter(f => f.name !== (task.entryFile ?? 'index.html')).map((f) => {
              const index = (task.starterFiles ?? []).findIndex(candidate => candidate === f)
              return (
                <div key={f.name} className="te-quiz-answer-card">
                  <input className="te-input" style={{ maxWidth: 160 }} value={f.name} onChange={e => updateStaticFile(index, { name: e.target.value })} />
                  <textarea className="te-input" style={caStyles.codeTextarea} value={f.content ?? ''} onChange={e => updateStaticFile(index, { content: e.target.value })} spellCheck={false} />
                  <button type="button" className="btn-ghost te-secondary-btn" onClick={() => removeStaticFile(index)}>Remove</button>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={addStaticFile} style={{ marginTop: 8 }}>Add file</button>
        </Field>
      )}

      <Field label="Completion check">
        <label className={task.check ? 'te-option-toggle-card te-option-toggle-card--active' : 'te-option-toggle-card'}>
          <input
            type="checkbox"
            checked={!!task.check}
            onChange={e => set('check', e.target.checked ? (lessonMod?.defaultCheck?.('run') ?? null) : null)}
            className="te-option-choice-input"
          />
          <span className="te-option-choice-title">Enable check</span>
          <span className={task.check ? 'te-option-choice-text te-option-choice-text--active' : 'te-option-choice-text'}>
            Evaluated against the real run result of the assembled program.
          </span>
        </label>
        {task.check && CheckEditor && (
          <CheckEditor
            task={task}
            lesson={{ type: moduleType }}
            onUpdate={onUpdate}
            interactionMode="run"
            output={previewOutput}
            activePythonCode={previewAssembled ?? ''}
            activeFiles={buildPreviewFiles(previewAssembled ?? '')}
          />
        )}
      </Field>

      <TaskPreviewPanel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={handleLoadSolution} disabled={getSlotIds(task).length === 0}>
            Load authored solution
          </button>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={handleClearPreview}>
            Clear
          </button>
        </div>
        <CodeArrangeTask
          task={task}
          moduleType={moduleType}
          selectedAnswer={previewSlotState}
          onSelectAnswer={setPreviewSlotState}
          output={previewOutput}
          runStatus={previewRunStatus}
          inputPrompt={previewInputPrompt}
          onInputSubmit={handlePreviewInputSubmit}
          running={previewRunning}
          checkPassed={previewCheckPassed}
          checkAttempted={previewCheckAttempted}
          pyodideStatus={previewPyodideStatus}
          iframeSrc={previewIframeSrc}
          iframeRef={iframeRef}
          onRun={handlePreviewRun}
        />
        {previewCheckAttempted && (
          <div style={{ marginTop: 10, border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: previewCheckPassed ? '#f0fdf4' : '#fffbeb', borderColor: previewCheckPassed ? '#bbf7d0' : '#fde68a' }}>
            {previewCheckPassed ? 'Check passes — students will see the completion banner.' : 'Check does not pass with this ordering — try another arrangement or review the check.'}
            {feedbackPreview.some(r => r.passed) && (
              <div style={{ marginTop: 6, color: '#92400e' }}>Feedback check matched: {feedbackPreview.find(r => r.passed)?.hint || '(no hint set)'}</div>
            )}
          </div>
        )}
        {!previewComplete && (
          <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280' }}>
            Drag tiles into every slot above, or use "Load authored solution", to test-run this task.
          </div>
        )}
      </TaskPreviewPanel>
    </>
  )
}

// One line's authoring card: reorder/insert/remove controls, and the parts
// composer every line uses (a "whole line" is just a single-slot line
// composed the same way as any other).
function LineEditor({
  line, index, total, disableRemove,
  onMoveUp, onMoveDown, onInsertBelow, onRemove,
  onAddPart, onUpdatePartText, onUpdatePartCode, onMovePart, onRemovePart,
}) {
  return (
    <div style={caStyles.lineCard}>
      <div style={caStyles.lineHeader}>
        <span className="te-quiz-answer-badge">{index + 1}</span>
        <div style={caStyles.lineControls}>
          <button type="button" className="te-remove-btn" onClick={onMoveUp} disabled={index === 0} title="Move line up">▲</button>
          <button type="button" className="te-remove-btn" onClick={onMoveDown} disabled={index === total - 1} title="Move line down">▼</button>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={onInsertBelow}>+ Insert below</button>
          <button type="button" className="te-remove-btn" onClick={onRemove} disabled={disableRemove} title="Remove line">✕</button>
        </div>
      </div>

      <div style={caStyles.lineBody}>
        <div style={caStyles.partsComposer}>
          {(line.parts ?? []).length === 0 && (
            <span style={caStyles.emptyHint}>No parts yet — add fixed text or a blank below.</span>
          )}
          {(line.parts ?? []).map((part, partIndex) => part?.type === 'slot' ? (
            <SlotPartChip
              key={partIndex}
              part={part}
              index={partIndex}
              total={line.parts.length}
              onUpdateCode={code => onUpdatePartCode(partIndex, code)}
              onMove={direction => onMovePart(partIndex, direction)}
              onRemove={() => onRemovePart(partIndex)}
            />
          ) : (
            <TextPartChip
              key={partIndex}
              part={part}
              index={partIndex}
              total={line.parts.length}
              onUpdateText={text => onUpdatePartText(partIndex, text)}
              onMove={direction => onMovePart(partIndex, direction)}
              onRemove={() => onRemovePart(partIndex)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={() => onAddPart('text')}>+ Add fixed text</button>
          <button type="button" className="btn-ghost te-secondary-btn" onClick={() => onAddPart('slot')}>+ Add blank</button>
        </div>
        <LinePreview parts={line.parts ?? []} />
      </div>
    </div>
  )
}

// A read-only strip showing how the parts sequence currently reads, so
// authors can see fixed text vs. blanks at a glance while composing.
function LinePreview({ parts }) {
  if (parts.length === 0) return null
  return (
    <div style={caStyles.linePreview}>
      {parts.map((part, i) => part.type === 'slot' ? (
        <span key={i} style={caStyles.linePreviewSlot}>{part.code?.trim() ? part.code : '(blank)'}</span>
      ) : (
        <span key={i} style={caStyles.linePreviewText}>{part.text || '·'}</span>
      ))}
    </div>
  )
}

// A fixed-text segment in the parts composer.
function TextPartChip({ part, index, total, onUpdateText, onMove, onRemove }) {
  return (
    <div style={caStyles.textChip}>
      <span style={caStyles.chipLabel}>Text</span>
      <input
        className="te-input"
        style={caStyles.chipInput}
        value={part.text ?? ''}
        onChange={e => onUpdateText(e.target.value)}
        placeholder="Fixed text"
        spellCheck={false}
      />
      <div style={caStyles.chipControls}>
        <button type="button" className="te-remove-btn" onClick={() => onMove(-1)} disabled={index === 0} title="Move earlier">◀</button>
        <button type="button" className="te-remove-btn" onClick={() => onMove(1)} disabled={index === total - 1} title="Move later">▶</button>
        <button type="button" className="te-remove-btn" onClick={onRemove} title="Remove text">✕</button>
      </div>
    </div>
  )
}

// A blank-slot segment in the parts composer: just its own correct value —
// distractors are authored once, task-wide, in the shared "Distractor
// tiles" field below the line list.
function SlotPartChip({ part, index, total, onUpdateCode, onMove, onRemove }) {
  return (
    <div style={caStyles.slotChip}>
      <div style={caStyles.chipHeader}>
        <span style={{ ...caStyles.chipLabel, ...caStyles.chipLabelSlot }}>Blank</span>
        <div style={caStyles.chipControls}>
          <button type="button" className="te-remove-btn" onClick={() => onMove(-1)} disabled={index === 0} title="Move earlier">◀</button>
          <button type="button" className="te-remove-btn" onClick={() => onMove(1)} disabled={index === total - 1} title="Move later">▶</button>
          <button type="button" className="te-remove-btn" onClick={onRemove} title="Remove blank">✕</button>
        </div>
      </div>
      <input
        className="te-input"
        style={caStyles.chipInput}
        value={part.code ?? ''}
        onChange={e => onUpdateCode(e.target.value)}
        placeholder="Correct value for this blank"
        spellCheck={false}
      />
    </div>
  )
}

const caStyles = {
  codeTextarea: {
    minHeight: 80,
    resize: 'vertical',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.86rem',
    whiteSpace: 'pre',
    overflow: 'auto',
  },
  lineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  lineCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    background: '#fff',
  },
  lineHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  lineControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  lineBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  partsComposer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  emptyHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#9ca3af',
  },
  chipLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6b7280',
  },
  chipLabelSlot: {
    color: 'var(--colour-primary)',
  },
  chipInput: {
    width: 160,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.85rem',
  },
  chipControls: {
    display: 'flex',
    gap: 4,
  },
  chipHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  textChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px dashed #d1d5db',
    background: '#fff',
  },
  slotChip: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 200,
    padding: '8px 10px',
    borderRadius: 6,
    border: '2px solid var(--colour-primary)',
    background: '#f5f3ff',
  },
  linePreview: {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 6,
    background: '#111827',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.84rem',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  linePreviewText: {
    color: '#e5e7eb',
    whiteSpace: 'pre',
  },
  linePreviewSlot: {
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 3,
    padding: '0 4px',
    margin: '0 1px',
  },
}
