import React, { useState } from 'react'
import { filterChecksForInteraction } from '../../modules/checks'
import ExplainerEditor from './ExplainerEditor'
import QuizTask from '../../app/components/QuizTask'
import InformationTask from '../../app/components/InformationTask'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { copyStarterToComplete } from '../lessonUtils'
import { Field, TaskFormatIcon, SpriteManager, BackdropManager } from './task-editor/TaskEditorFields'
import { QuizTypePicker, MatchPairsBuilder, FillBlankBuilder, ShortAnswerBuilder, QuizOptionsBuilder } from './task-editor/QuizEditors'
import CodeArrangeEditor from './task-editor/CodeArrangeEditor'
import { ScratchToolboxPicker } from '../../modules/scratch/scratchEditors'
import { useTaskEditorState } from '../hooks/useTaskEditorState'
import TaskPreviewPanel from './task-editor/TaskPreviewPanel'
import TaskOptionsSection from './task-editor/TaskOptionsSection'
import { getLessonModule } from '../../modules/registry'
import { LESSON_MODULE_TYPES } from '../../shared/composedLesson'
import { AnimatedPanelShell, CollapsedPanelRail, CollapseTabButton } from '../../app/components/CollapsiblePanelControls'

// Re-export for backward compatibility
export { ScratchToolboxPicker, SpriteManager, BackdropManager }

export default function TaskEditor({ task, lesson, onUpdate, parentGroup, composedLesson = null }) {
  const [selectedFile, setSelectedFile] = useState(task.starterFiles?.[0]?.name ?? '')
  // Visible by default while authoring a Draft lesson; collapsed by default once Draft is off,
  // since this section is author-only and adds noise for a lesson ready for full validation.
  const [authoringMetaCollapsed, setAuthoringMetaCollapsed] = useState(() => lesson.draft !== true)
  const usesUnifiedCodeStages = ['python', 'html', 'arcade', 'electronics', 'scratch'].includes(lesson.type)
  const [codeTab, setCodeTab] = useState(usesUnifiedCodeStages ? 'stage_0' : 'starter')
  const [selectedCompleteFile, setSelectedCompleteFile] = useState('')
  const { typeStorageAssets } = useTypeAssets(lesson.type)
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(lesson.id, lesson.storageAssets ?? [])
  const lessonWithStorageAssets = { ...lesson, storageAssets: lessonStorageAssets }
  const allStorageAssets = [
    ...lessonStorageAssets,
    ...typeStorageAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]
  const sharedAssetNames = lesson.sharedAssetNames ?? null
  const includedTypeAssets = lesson.type === 'html' ? (
    sharedAssetNames !== null
      ? typeStorageAssets.filter(a => sharedAssetNames.includes(a.name))
      : typeStorageAssets
  ) : []
  const iframeStorageAssets = [
    ...lessonStorageAssets.filter(a => a.showInEditor),
    ...includedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]

  const lessonMod = getLessonModule(lessonWithStorageAssets.type)
  const isPython     = lessonMod?.type === 'python'
  const isScratch    = lessonMod?.type === 'scratch'
  const isFilesystem = lessonMod?.type === 'filesystem'
  const supportsCopyCode = lessonMod?.supportsCopyCode === true
  const isQuiz = task.taskType === 'quiz'
  const isInformation = task.taskType === 'information'
  const isCodeArrange = task.taskType === 'code_arrange'
  const isCompleteTab = !usesUnifiedCodeStages && codeTab === 'complete'
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const codeStages = task.codeStages ?? []
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null
  const activePythonCode = isCompleteTab
    ? (task.completeCode ?? '')
    : isStageTab
    ? (activeStage?.code ?? '')
    : (task.starterCode ?? '')
  const activeFiles = isCompleteTab
    ? (task.completeFiles ?? [])
    : isStageTab
    ? (activeStage?.files ?? [])
    : (task.starterFiles ?? [])
  const activeEntryFile = isCompleteTab
    ? (task.completeEntryFile ?? task.entryFile ?? 'index.html')
    : isStageTab
    ? (activeStage?.entryFile ?? task.entryFile ?? 'index.html')
    : (task.entryFile ?? 'index.html')
  const explainerInlineCodeLanguages = lessonMod?.explainerInlineCodeLanguages ?? []
  const incompleteDraftWorkspace = lesson.draft === true && !isQuiz && !isInformation && !isCodeArrange && (
    (lesson.type === 'html' && !Array.isArray(task.starterFiles))
    || (lesson.type === 'filesystem' && !task.starterFs)
    || (lesson.type === 'electronics' && !task.starterCircuit)
  )

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function setPriority(priority) {
    if (priority === 'core') {
      const { priority: _priority, ...rest } = task
      onUpdate(rest)
      return
    }
    set('priority', priority)
  }

  function handleModuleChange(moduleType) {
    if (moduleType === task.moduleType) return
    const next = { ...task, moduleType: moduleType || undefined }
    // A module-type conversion cannot safely retain an instance ID from an
    // imported composed lesson; it could resolve to the old workspace type.
    delete next.moduleId
    for (const field of [
      'starterCode', 'completeCode', 'starterFiles', 'completeFiles', 'entryFile', 'completeEntryFile',
      'starterBlocks', 'completeBlocks', 'toolbox', 'sprites', 'backdrops', 'variables',
      'starterFs', 'completeFs', 'startsInDir', 'starterCircuit', 'completeCircuit', 'microcontroller',
      'arcadeDesign', 'completeArcadeDesign', 'arcadeTools', 'codeStages',
      'carryCodeFrom', 'carryBlocksFrom', 'carryFsFrom', 'carryCircuitFrom',
      'check', 'feedbackChecks', 'incorrectChecks', '_checkTested', 'copyCode',
    ]) delete next[field]
    onUpdate(next)
  }

  function handleCopyCodeToggle(enabled) {
    if (enabled) {
      onUpdate({ ...task, copyCode: task.copyCode ?? '' })
      return
    }
    const { copyCode: _copyCode, ...rest } = task
    onUpdate(rest)
  }

  const {
    output, runStatus, running, runningTests, pyodideStatus, inputPrompt, iframeSrc,
    checkResult, checkResults, incorrectCheckResults, testResults, htmlPreviewOpen, quizSelectedAnswer,
    iframeRef,
    setCheckResults, setRunStatus, setCheckResult, setIframeSrc, setHtmlPreviewOpen, setQuizSelectedAnswer,
    handleRun, handleRunTests, handleStop, handleTestChecks, handleQuizPreviewSelect, handleInputSubmit,
    resetRunState,
  } = useTaskEditorState({ task, lesson: lessonWithStorageAssets, activePythonCode, activeFiles, activeEntryFile, isPython, isScratch, set, iframeStorageAssets })

  function handleCodeTabChange(tab) {
    if (tab === codeTab) return
    resetRunState()

    if (!usesUnifiedCodeStages && tab === 'complete') {
      lessonMod?.initCompleteTab?.(task, { onUpdate, selectedFile, setSelectedCompleteFile })
    }

    const stageMatch = tab.match(/^stage_(\d+)$/)
    if (stageMatch) {
      const idx = parseInt(stageMatch[1], 10)
      const stage = (task.codeStages ?? [])[idx]
      lessonMod?.initStageTab?.(stage, { setSelectedFile })
    }

    setCodeTab(tab)
  }

  function handleAddStage() {
    if (!lessonMod?.makeNewStage) return
    const existing = task.codeStages ?? []
    const newStage = lessonMod.makeNewStage(task, existing)
    const updated = [...existing, newStage]
    onUpdate({ ...task, codeStages: updated })
    setCodeTab(`stage_${updated.length - 1}`)
    lessonMod.initStageTab?.(newStage, { setSelectedFile })
  }

  function handleRemoveStage(idx) {
    const existing = task.codeStages ?? []
    const updated = existing.filter((_, i) => i !== idx)
    const feedbackChecks = task.feedbackChecks ?? task.incorrectChecks
    const updateFeedbackCheck = check => {
      const stageIndex = check?.stageOffer?.stageIndex
      if (!Number.isInteger(stageIndex)) return check
      if (stageIndex === idx) {
        const { stageOffer: _stageOffer, ...next } = check
        return next
      }
      return stageIndex > idx ? { ...check, stageOffer: { ...check.stageOffer, stageIndex: stageIndex - 1 } } : check
    }
    const nextFeedbackChecks = Array.isArray(feedbackChecks)
      ? feedbackChecks.map(updateFeedbackCheck)
      : feedbackChecks ? updateFeedbackCheck(feedbackChecks) : feedbackChecks
    onUpdate({
      ...task,
      codeStages: updated.length > 0 ? updated : undefined,
      ...(task.feedbackChecks != null ? { feedbackChecks: nextFeedbackChecks } : {}),
      ...(task.incorrectChecks != null ? { incorrectChecks: nextFeedbackChecks } : {}),
    })
    setCodeTab(updated.length > 0 ? `stage_${Math.max(0, idx - 1)}` : (usesUnifiedCodeStages ? 'stage_0' : 'starter'))
  }

  function makeDefaultQuizOptions() {
    return [{ id: 'a', text: '' }, { id: 'b', text: '' }]
  }

  function renumberQuizOptions(options) {
    return options.map((option, index) => ({ ...option, id: String.fromCharCode(97 + index) }))
  }

  function handleTaskTypeChange(taskType) {
    resetRunState()
    setQuizSelectedAnswer('')

    if (taskType === 'quiz') {
      const quizType = task.taskType === 'quiz' ? (task.quizType ?? 'multiple_choice') : 'multiple_choice'
      const options = task.options?.length ? renumberQuizOptions(task.options) : makeDefaultQuizOptions()
      const answer = options.some(option => option.id === task.check?.value) ? task.check.value : ''
      const { copyCode: _copyCode, ...rest } = task
      onUpdate({
        ...rest, taskType: 'quiz', quizType, options,
        check: answer ? { type: 'answer_equals', value: answer } : null,
        carryCodeFrom: null, carryBlocksFrom: null, carryFsFrom: null, carryCircuitFrom: null,
      })
      return
    }

    if (taskType === 'code_arrange') {
      const nextModuleType = ['python', 'html'].includes(task.moduleType) ? task.moduleType : 'python'
      const { copyCode: _copyCode, codeStages: _codeStages, carryCodeFrom: _c1, carryBlocksFrom: _c2, carryFsFrom: _c3, carryCircuitFrom: _c4, ...rest } = task
      onUpdate({
        ...rest,
        taskType: 'code_arrange',
        moduleType: nextModuleType,
        moduleId: task.moduleId,
        lines: task.lines?.length ? task.lines : [
          { id: 'line-1', parts: [{ type: 'slot', id: 'line-1-slot-1', code: '' }] },
          { id: 'line-2', parts: [{ type: 'slot', id: 'line-2-slot-1', code: '' }] },
        ],
        distractors: task.distractors ?? [],
        ...(nextModuleType === 'html' ? {
          entryFile: task.entryFile ?? 'index.html',
          starterFiles: task.starterFiles?.length ? task.starterFiles : [{ name: task.entryFile ?? 'index.html', type: 'html', content: '' }],
        } : {}),
        check: null,
      })
      return
    }

    if (taskType === 'information') {
      const {
        options: _options, check: _check, carryCodeFrom: _c1, carryBlocksFrom: _c2,
        starterCode: _sc, completeCode: _cc, starterFiles: _sf, completeFiles: _cf,
        entryFile: _ef, completeEntryFile: _ce, toolbox: _tb,
        starterBlocks: _sb, completeBlocks: _cb, predefinedBlocks: _pb, prebuiltStacks: _ps,
        starterFs: _starterFs, completeFs: _completeFs, carryFsFrom: _carryFsFrom,
        starterCircuit: _starterCircuit, completeCircuit: _completeCircuit, carryCircuitFrom: _carryCircuitFrom,
        microcontroller: _microcontroller, copyCode: _copyCode,
        interactionMode: _im, _checkTested,
        lines: _lines, distractors: _distractors,
        ...rest
      } = task
      onUpdate({ ...rest, taskType: 'information', informationType: task.informationType ?? 'standard', explainer: task.explainer ?? '' })
      return
    }

    const {
      taskType: _t, informationType: _i, options: _o,
      lines: _l2, distractors: _d2,
      ...rest
    } = task
    const typeFields = lessonMod?.makeCodeTaskFields(task) ?? {}
    onUpdate({ ...rest, ...typeFields, check: null })
  }

  function handleInteractionModeChange(interactionMode) {
    const nextChecks = filterChecksForInteraction(task.check, interactionMode)
    onUpdate({
      ...task, interactionMode,
      check: task.check ? (nextChecks.length > 0 ? nextChecks : null) : task.check,
      _checkTested: false,
    })
    setCheckResults(null)
    setRunStatus(null)
  }

  function handleQuizTypeChange(quizType) {
    setQuizSelectedAnswer('')
    setCheckResults(null)
    setRunStatus(null)

    if (quizType === 'multiple_choice') {
      const options = task.options?.length ? task.options : makeDefaultQuizOptions()
      const answer = options.some(o => o.id === task.check?.value) ? task.check.value : ''
      onUpdate({ ...task, quizType: 'multiple_choice', options, check: answer ? { type: 'answer_equals', value: answer } : null })
      return
    }
    if (quizType === 'match') {
      const defaultPairs = [{ id: 'p1', prompt: '', answer: '' }, { id: 'p2', prompt: '', answer: '' }]
      onUpdate({ ...task, quizType: 'match', pairs: task.pairs?.length ? task.pairs : defaultPairs, check: null })
      return
    }
    if (quizType === 'fill_blank') {
      onUpdate({ ...task, quizType: 'fill_blank', mode: task.mode ?? 'drag', text: task.text ?? '', blanks: task.blanks ?? [], check: null })
      return
    }
    if (quizType === 'short_answer') {
      const existing = task.check?.type?.startsWith('answer_') ? task.check : null
      onUpdate({ ...task, quizType: 'short_answer', check: existing ?? null })
      return
    }
    if (quizType === 'confidence') {
      onUpdate({ ...task, quizType: 'confidence', options: undefined, pairs: undefined, blanks: undefined, text: undefined, check: null })
    }
  }

  function handleResetCompleteToStarter() {
    if (!window.confirm('Replace the complete code with the starter code?')) return
    const updates = copyStarterToComplete(task, lesson.type)
    onUpdate({ ...task, ...updates })
    if (lesson.type === 'html') {
      setSelectedCompleteFile(updates.completeEntryFile ?? updates.completeFiles?.[0]?.name ?? '')
      setIframeSrc(null)
      setHtmlPreviewOpen(false)
    }
  }

  const resetToStarterBtn = isCompleteTab ? (
    <button type="button" className="btn-ghost te-secondary-btn" onClick={handleResetCompleteToStarter}>
      Reset to starter code
    </button>
  ) : null

  return (
    <div className="te-wrap">
      {parentGroup ? (
        <Field label="Task title">
          <input className="te-input" value={task.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Counted loops" />
        </Field>
      ) : (
        <Field label="Task title">
          <input className="te-input" value={task.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Hello World" />
        </Field>
      )}

      <Field label="Estimated time (minutes)">
        <input
          className="te-input"
          type="number"
          min="0.5"
          step="0.5"
          value={task.estimatedMinutes ?? ''}
          onChange={e => {
            const value = e.target.value
            if (value === '') { set('estimatedMinutes', undefined); return }
            const parsed = Number.parseFloat(value)
            set('estimatedMinutes', Math.max(0.5, Number.isFinite(parsed) ? parsed : 0.5))
          }}
          placeholder="e.g. 10 or 7.5"
        />
      </Field>

      {authoringMetaCollapsed ? (
        <CollapsedPanelRail
          onClick={() => setAuthoringMetaCollapsed(false)}
          label="Authoring metadata"
          direction="down"
          orientation="horizontal"
          title="Show authoring metadata"
          ariaLabel="Show authoring metadata"
        />
      ) : (
        <AnimatedPanelShell animate>
          <div style={s.authoringMetaSection}>
            <div style={s.authoringMetaHeader}>
              <span style={s.authoringMetaHeaderLabel}>Authoring metadata</span>
              <CollapseTabButton
                onClick={() => setAuthoringMetaCollapsed(true)}
                direction="left"
                title="Collapse authoring metadata"
                ariaLabel="Collapse authoring metadata"
                style={s.authoringMetaCollapseBtn}
              />
            </div>

            <Field label="Authoring intent (Markdown)" hint="Visible to authors only; students never see this field.">
              <ExplainerEditor
                title={task.title || 'Task intent'} value={task.intent ?? ''} onChange={value => set('intent', value)}
                lessonType={lesson.type} inlineCodeLanguages={explainerInlineCodeLanguages}
                assets={lesson.assets ?? []} assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''} storageAssets={allStorageAssets}
              />
            </Field>

            <Field label="Task activity" hint="Visible to authors only; students never see this field.">
              <input
                className="te-input"
                value={task.taskActivity ?? ''}
                onChange={e => set('taskActivity', e.target.value)}
                placeholder="e.g. Pair-share discussion, quick demo, whiteboard sketch"
              />
            </Field>

            {(task.intentLastChangedAt || task.taskLastChangedAt) && (
              <div style={s.auditMeta}>
                {task.intentLastChangedAt && <span>Intent updated: {String(task.intentLastChangedAt)}</span>}
                {task.taskLastChangedAt && <span>Task content updated: {String(task.taskLastChangedAt)}</span>}
              </div>
            )}
          </div>
        </AnimatedPanelShell>
      )}

      <Field label="Priority">
        <div className="te-priority-grid">
          {[
            { value: 'core', label: 'Core', hint: 'Expected lesson path' },
            { value: 'optional', label: 'Optional', hint: 'Safe to skip' },
          ].map(option => {
            const active = (task.priority ?? 'core') === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'te-info-type-btn te-info-type-btn--active' : 'te-info-type-btn'}
                onClick={() => setPriority(option.value)}
              >
                <span className="te-info-type-label">{option.label}</span>
                <span className="te-info-type-hint">{option.hint}</span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Available in">
        <div className="te-info-type-grid">
          {[
            { value: 'both', label: 'Both', hint: 'Live and solo mode' },
            { value: 'live', label: 'Live only', hint: 'During live sessions' },
            { value: 'solo', label: 'Solo only', hint: 'In solo mode' },
          ].map(option => {
            const active = (task.taskMode ?? 'both') === option.value
            return (
              <button key={option.value} type="button" className={active ? 'te-info-type-btn te-info-type-btn--active' : 'te-info-type-btn'} onClick={() => set('taskMode', option.value === 'both' ? undefined : option.value)}>
                <span className="te-info-type-label">{option.label}</span>
                <span className="te-info-type-hint">{option.hint}</span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Task format">
        <div className="te-task-format-grid">
          {[
            { value: 'code', label: lesson.type === 'scratch' ? 'Scratch' : 'Code', iconType: lesson.type === 'scratch' ? 'scratch' : 'code' },
            { value: 'information', label: 'Information', iconType: 'information' },
            { value: 'quiz', label: 'Quiz', iconType: 'quiz' },
            ...(composedLesson?.type === 'composed' ? [{ value: 'code_arrange', label: 'Arrange', iconType: 'code_arrange' }] : []),
          ].map(({ value, label, iconType }) => {
            const active = value === (isQuiz ? 'quiz' : isInformation ? 'information' : isCodeArrange ? 'code_arrange' : 'code')
            return (
              <button key={value} type="button" className={active ? 'te-task-format-btn te-task-format-btn--active' : 'te-task-format-btn'} onClick={() => handleTaskTypeChange(value)}>
                <TaskFormatIcon type={iconType} />
                <span className="te-task-format-label">{label}</span>
              </button>
            )
          })}
        </div>
      </Field>

      {!isInformation && !isQuiz && composedLesson?.type === 'composed' && (
        <Field label="Code task module" hint="Choose the workspace for this task. Changing it clears code, checks, stages, and carry-through settings.">
          <div className="te-info-type-grid">
            {(isCodeArrange ? ['python', 'html'] : LESSON_MODULE_TYPES).map(moduleType => {
              const active = task.moduleType === moduleType
              const icon = {
                python: '🐍', arcade: '🕹️', html: '🌐', scratch: '🧩', filesystem: '🗂️', electronics: '⚡',
              }[moduleType]
              return (
                <button
                  key={moduleType}
                  type="button"
                  className={active ? 'te-info-type-btn te-info-type-btn--active' : 'te-info-type-btn'}
                  onClick={() => handleModuleChange(moduleType)}
                >
                  <span className="te-info-type-label">{icon} {moduleType === 'arcade' ? 'Arcade Kit' : moduleType[0].toUpperCase() + moduleType.slice(1)}</span>
                  <span className="te-info-type-hint">
                    {moduleType === 'filesystem' ? 'File manager' : 'Workspace'}
                    {moduleType === 'arcade' ? ' · Experimental' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {isInformation && (
        <Field label="Information type">
          <div className="te-info-type-grid">
            {[
              { value: 'standard', label: 'Standard', hint: 'Markdown explainer' },
              { value: 'recap', label: 'Two Pane View', hint: 'Two editable markdown panes' },
              { value: 'introduction', label: 'Introduction', hint: 'Lesson metadata slide' },
            ].map(option => {
              const active = (task.informationType ?? 'standard') === option.value
              return (
                <button key={option.value} type="button" className={active ? 'te-info-type-btn te-info-type-btn--active' : 'te-info-type-btn'} onClick={() => set('informationType', option.value)}>
                  <span className="te-info-type-label">{option.label}</span>
                  <span className="te-info-type-hint">{option.hint}</span>
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {isInformation && (task.informationType ?? 'standard') === 'recap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>Left pane (Markdown)</span>
          <ExplainerEditor
            title={task.title} value={task.leftContent ?? ''} onChange={v => set('leftContent', v)}
            lessonType={lesson.type} inlineCodeLanguages={explainerInlineCodeLanguages}
            assets={lesson.assets ?? []} assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''} storageAssets={allStorageAssets}
          />
        </div>
      )}

      {(task.informationType ?? 'standard') !== 'introduction' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
              {isInformation && (task.informationType ?? 'standard') === 'recap' ? 'Right pane (Markdown)' : 'Explainer (Markdown)'}
            </span>
            <label className="te-check-toggle">
              <input type="checkbox" checked={task.explainer !== null && task.explainer !== undefined} onChange={e => set('explainer', e.target.checked ? '' : null)} />
              Enable
            </label>
          </div>
          {task.explainer !== null && task.explainer !== undefined && (
            <ExplainerEditor
              title={task.title} value={task.explainer} onChange={v => set('explainer', v)}
              lessonType={lesson.type} inlineCodeLanguages={explainerInlineCodeLanguages}
              assets={lesson.assets ?? []} assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''} storageAssets={allStorageAssets}
            />
          )}
        </div>
      )}

      {!isQuiz && !isInformation && supportsCopyCode && (
        <Field label="Copy code panel" hint="optional">
          <div style={s.copyCodeEditor}>
            <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
              <input type="checkbox" checked={task.copyCode !== null && task.copyCode !== undefined} onChange={e => handleCopyCodeToggle(e.target.checked)} />
              Enable
            </label>
            {task.copyCode !== null && task.copyCode !== undefined && (
              <textarea
                className="te-input"
                style={s.copyCodeTextarea}
                value={task.copyCode ?? ''}
                onChange={e => set('copyCode', e.target.value)}
                spellCheck={false}
                placeholder={lesson.type === 'python' ? 'Code students can copy...' : '<!-- Code students can copy... -->'}
              />
            )}
          </div>
        </Field>
      )}

      {isInformation && (
        <TaskPreviewPanel task={task} draft={lesson.draft}>
          <div className="te-info-preview"><InformationTask task={task} lesson={lesson} /></div>
        </TaskPreviewPanel>
      )}

      {!isQuiz && !isInformation && !isCodeArrange && (
        <TaskOptionsSection
          task={task} lesson={lessonWithStorageAssets} onUpdate={onUpdate}
          activePythonCode={activePythonCode} activeFiles={activeFiles} output={output}
          setCheckResults={setCheckResults} setRunStatus={setRunStatus}
          handleInteractionModeChange={handleInteractionModeChange}
        />
      )}

      {!isInformation && <div className="te-divider" />}

      {isInformation ? null : isQuiz ? (
        <>
          <QuizTypePicker task={task} onQuizTypeChange={handleQuizTypeChange} />
          {(!task.quizType || task.quizType === 'multiple_choice') ? (
            <QuizOptionsBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'match' ? (
            <MatchPairsBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'fill_blank' ? (
            <FillBlankBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'short_answer' ? (
            <ShortAnswerBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'confidence' ? (
            <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: '0.86rem', color: '#6b7280' }}>
              Students rate their confidence 1–5 (red to green). No options or check needed — any rating counts as complete.
            </div>
          ) : null}
          <TaskPreviewPanel task={task} draft={lesson.draft}>
            <QuizTask task={task} showQuestion selectedAnswer={quizSelectedAnswer} onSelectAnswer={handleQuizPreviewSelect} submitted={runStatus === 'submitted'} checkPassed={checkResults?.every(r => r.passed) ?? false} />
            {checkResults !== null && (() => {
              const allPassed = checkResults.every(r => r.passed)
              return (
                <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a' }}>
                  {task.quizType === 'confidence'
                    ? 'Rating submitted — any confidence level completes this task.'
                    : allPassed
                    ? 'Check passes — students will see the completion banner.'
                    : task.quizType === 'match' || task.quizType === 'fill_blank'
                      ? 'Check does not pass — try placing the correct answers in the preview.'
                      : 'Check does not pass — review the answer or check configuration.'}
                </div>
              )
            })()}
          </TaskPreviewPanel>
        </>
      ) : isCodeArrange ? (
        <CodeArrangeEditor task={task} onUpdate={onUpdate} />
      ) : incompleteDraftWorkspace ? (
        <div style={s.incompleteDraft}>
          This draft task has no {lesson.type === 'html' ? 'starter files' : lesson.type === 'filesystem' ? 'starter filesystem' : 'starter breadboard'} yet.
          Choose the Code format above to initialise the standard editor fields, then continue editing the task.
        </div>
      ) : lessonMod?.BuilderWorkspace ? (
        <lessonMod.BuilderWorkspace
          task={task} lesson={lesson} onUpdate={onUpdate}
          codeTab={codeTab} codeStages={codeStages}
          activePythonCode={activePythonCode}
          selectedFile={selectedFile} selectedCompleteFile={selectedCompleteFile}
          setSelectedFile={setSelectedFile} setSelectedCompleteFile={setSelectedCompleteFile}
          running={running} runningTests={runningTests} pyodideStatus={pyodideStatus}
          htmlPreviewOpen={htmlPreviewOpen} setHtmlPreviewOpen={setHtmlPreviewOpen}
          iframeSrc={iframeSrc} iframeRef={iframeRef}
          inputPrompt={inputPrompt} output={output} runStatus={runStatus}
          checkResult={checkResult} setCheckResult={setCheckResult}
          checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} testResults={testResults}
          handleCodeTabChange={handleCodeTabChange} handleAddStage={handleAddStage} handleRemoveStage={handleRemoveStage}
          handleRun={handleRun} handleStop={handleStop} handleRunTests={handleRunTests}
          handleTestChecks={handleTestChecks} handleInputSubmit={handleInputSubmit}
          resetToStarterBtn={resetToStarterBtn}
        />
      ) : (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: '0.86rem', color: '#991b1b' }}>
          Unrecognised lesson type "{lesson.type}" — no builder workspace available for this task.
        </div>
      )}
    </div>
  )
}

const s = {
  authoringMetaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    border: '1px dashed #d8b4fe',
    background: '#faf5ff',
  },
  authoringMetaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authoringMetaHeaderLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--colour-primary)',
  },
  authoringMetaCollapseBtn: {
    width: 26,
    fontSize: 15,
  },
  auditMeta: {
    display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 6,
    background: '#f8fafc', border: '1px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: '#64748b',
  },
  incompleteDraft: {
    padding: '12px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a',
    fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#92400e', lineHeight: 1.5,
  },
  copyCodeEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  copyCodeTextarea: {
    minHeight: 150,
    resize: 'vertical',
    fontFamily: 'var(--font-code)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
    whiteSpace: 'pre',
    overflow: 'auto',
  },
}
