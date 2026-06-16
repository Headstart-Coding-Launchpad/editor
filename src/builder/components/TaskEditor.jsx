import React, { useState } from 'react'
import { filterChecksForInteraction } from '../../shared/checks'
import ExplainerEditor from './ExplainerEditor'
import QuizTask from '../../app/components/QuizTask'
import InformationTask from '../../app/components/InformationTask'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { copyStarterToComplete } from '../lessonUtils'
import { Field, TaskFormatIcon, SpriteManager, BackdropManager } from './task-editor/TaskEditorFields'
import { QuizTypePicker, MatchPairsBuilder, FillBlankBuilder, ShortAnswerBuilder, QuizOptionsBuilder } from './task-editor/QuizEditors'
import { ScratchToolboxPicker } from './task-editor/ScratchEditors'
import { useTaskEditorState } from '../hooks/useTaskEditorState'
import TaskPreviewPanel from './task-editor/TaskPreviewPanel'
import TaskOptionsSection from './task-editor/TaskOptionsSection'
import { getLessonModule } from '../../modules/registry'

// Re-export for backward compatibility
export { ScratchToolboxPicker, SpriteManager, BackdropManager }

export default function TaskEditor({ task, lesson, onUpdate, parentGroup }) {
  const [selectedFile, setSelectedFile] = useState(task.starterFiles?.[0]?.name ?? '')
  const [codeTab, setCodeTab] = useState('starter')
  const [selectedCompleteFile, setSelectedCompleteFile] = useState('')
  const { typeStorageAssets } = useTypeAssets(lesson.type)
  const lessonStorageAssets = lesson.storageAssets ?? []
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

  const lessonMod = getLessonModule(lesson.type)
  const isPython     = lessonMod?.type === 'python'
  const isScratch    = lessonMod?.type === 'scratch'
  const isFilesystem = lessonMod?.type === 'filesystem'
  const isQuiz = task.taskType === 'quiz'
  const isInformation = task.taskType === 'information'
  const isCompleteTab = codeTab === 'complete'
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

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  const {
    output, runStatus, running, runningTests, pyodideStatus, inputPrompt, iframeSrc,
    checkResult, checkResults, incorrectCheckResults, testResults, htmlPreviewOpen, quizSelectedAnswer,
    iframeRef,
    setCheckResults, setRunStatus, setCheckResult, setIframeSrc, setHtmlPreviewOpen, setQuizSelectedAnswer,
    handleRun, handleRunTests, handleStop, handleTestChecks, handleQuizPreviewSelect, handleInputSubmit,
    resetRunState,
  } = useTaskEditorState({ task, lesson, activePythonCode, activeFiles, activeEntryFile, isPython, isScratch, set, iframeStorageAssets })

  function handleCodeTabChange(tab) {
    if (tab === codeTab) return
    resetRunState()

    if (tab === 'complete') {
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
    onUpdate({ ...task, codeStages: updated.length > 0 ? updated : undefined })
    setCodeTab('starter')
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
      onUpdate({
        ...task, taskType: 'quiz', quizType, options,
        check: answer ? { type: 'answer_equals', value: answer } : null,
        carryCodeFrom: null, carryBlocksFrom: null,
      })
      return
    }

    if (taskType === 'information') {
      const {
        options: _options, check: _check, carryCodeFrom: _c1, carryBlocksFrom: _c2,
        starterCode: _sc, completeCode: _cc, starterFiles: _sf, completeFiles: _cf,
        entryFile: _ef, completeEntryFile: _ce, toolbox: _tb,
        starterBlocks: _sb, completeBlocks: _cb, predefinedBlocks: _pb, prebuiltStacks: _ps,
        interactionMode: _im, _checkTested,
        ...rest
      } = task
      onUpdate({ ...rest, taskType: 'information', informationType: task.informationType ?? 'standard', explainer: task.explainer ?? '' })
      return
    }

    const { taskType: _t, informationType: _i, options: _o, ...rest } = task
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className="te-input"
              style={{ flex: 1 }}
              value={task.title}
              onChange={e => set('title', e.target.value)}
              placeholder={`${parentGroup.title} - N`}
            />
            {task._customTitle ? (
              <button type="button" className="te-reset-title-btn" title="Reset to auto-generated name" onClick={() => onUpdate({ ...task, title: '', _customTitle: undefined })}>
                reset
              </button>
            ) : (
              <span className="te-auto-title-badge">auto</span>
            )}
          </div>
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
          min="1"
          step="1"
          value={task.estimatedMinutes ?? ''}
          onChange={e => {
            const value = e.target.value
            set('estimatedMinutes', value === '' ? undefined : Math.max(1, Number.parseInt(value, 10) || 1))
          }}
          placeholder="e.g. 10"
        />
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
          ].map(({ value, label, iconType }) => {
            const active = value === (isQuiz ? 'quiz' : isInformation ? 'information' : 'code')
            return (
              <button key={value} type="button" className={active ? 'te-task-format-btn te-task-format-btn--active' : 'te-task-format-btn'} onClick={() => handleTaskTypeChange(value)}>
                <TaskFormatIcon type={iconType} />
                <span className="te-task-format-label">{label}</span>
              </button>
            )
          })}
        </div>
      </Field>

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

      {isInformation && (
        <TaskPreviewPanel>
          <div className="te-info-preview"><InformationTask task={task} lesson={lesson} /></div>
        </TaskPreviewPanel>
      )}

      {!isQuiz && !isInformation && (
        <TaskOptionsSection
          task={task} lesson={lesson} onUpdate={onUpdate}
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
          <TaskPreviewPanel>
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
