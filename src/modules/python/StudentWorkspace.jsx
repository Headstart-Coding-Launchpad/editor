import React, { useEffect, useMemo, useState } from 'react'
import PythonEditor from './PythonEditor'
import { taskShowsBlocks } from '../../shared/blockGuides'
import { getTaskLineHintSets } from '../../shared/lineHints'
import OutputPanel from '../../app/components/OutputPanel'
import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import SplitPane from '../../shared/SplitPane'
import {
  CollapsedPanelRail,
  CollapseTabButton,
} from '../../app/components/CollapsiblePanelControls'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import TaskVariablesPanel from '../../shared/variablesPanel/TaskVariablesPanel.jsx'
import { getTaskScrub } from '../../shared/scrub/scrubConfig.js'
import { taskShowsVariables } from '../../shared/variablesPanel/variablesPanel.js'
import StagePane from '../../shared/stage/StagePane.jsx'
import { stageCommandsOf } from '../../shared/stage/commands.js'
import { readStageResult } from '../../shared/stage/sync.js'
import { useElementSize } from '../../shared/useElementSize.js'
import { stageTargetCode, stageTargetGhostOn, useStageTarget } from './stageTarget.js'

export default function StudentWorkspace({
  task: lessonTask,
  cs,
  lessonId,
  identityId,
  viewingTaskId,
  isSandbox,
  isViewingPrev,
  isForcedTeacherLive,
  isMobile,
  displayCode,
  displayOutput,
  displayRunStatus,
  displayOutputCollapsed,
  displayCheckPassed,
  displayCheckAttempted,
  displaySelection,
  displayVariablesPanel = null,
  // The Python Stage drawing broadcast in Go Live (compactStageForSync's shape).
  displayStage = null,
  isTeacherEditing,
  teacherLiveCode,
  onVisiblePanesChange,
}) {
  // A task with a name-tag panel (showVariables) opens with the output side showing, so the
  // student can predict before the first Run; so does one with a Stage target to draw over.
  const [localOutputCollapsed, setLocalOutputCollapsed] = useState(
    () =>
      !isForcedTeacherLive &&
      !isTeacherEditing &&
      !isViewingPrev &&
      !taskShowsVariables(lessonTask) &&
      !stageTargetCode(lessonTask)
  )
  // While forced-live, the panel state is locked to whatever the broadcast
  // source (teacher/watched student) has it set to — continuous, not a
  // one-time seed — so a live-viewing student can't diverge from it. See
  // publishOutputCollapsed (useTeacherLivePublish.js) for the source side.
  const outputCollapsed = isForcedTeacherLive
    ? (displayOutputCollapsed ?? false)
    : localOutputCollapsed

  function setOutputCollapsed(next) {
    setLocalOutputCollapsed((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      cs.publishOutputCollapsed(resolved)
      return resolved
    })
  }
  // Sandbox code is free play: the session still points at a lesson task, but that
  // task's submit mode, tests, check and copy-code panel don't apply to it.
  const inSandbox = isSandbox || cs.inPersonalSandbox
  const task = inSandbox ? null : lessonTask
  const savedCode = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const code = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
      ? (teacherLiveCode ?? '')
      : isViewingPrev
        ? (savedCode?.code ?? '')
        : cs.code
  const showEditableHeader = !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing
  const showSubmitBanner =
    showEditableHeader &&
    task?.interactionMode === 'submit' &&
    cs.runStatus === 'submitted' &&
    !task?.check
  const shouldShowOutput =
    task?.interactionMode !== 'submit' || isForcedTeacherLive || isTeacherEditing || isViewingPrev

  useEffect(() => {
    onVisiblePanesChange?.(shouldShowOutput && !outputCollapsed ? ['code', 'console'] : ['code'])
  }, [shouldShowOutput, outputCollapsed, onVisiblePanesChange])
  const showCopyCode = typeof task?.copyCode === 'string' && !!task.copyCode.trim()

  // The Python Stage (src/shared/stage/): shown once the code draws, or from the start when the
  // task has a stageTarget to draw over. Go Live shows the broadcast drawing.
  const stageTarget = useStageTarget(task, { ready: cs.pyodideStatus === 'ready' })
  const liveStage = useMemo(() => readStageResult(displayStage), [displayStage])
  const stageResult = isForcedTeacherLive
    ? liveStage
    : isViewingPrev || isTeacherEditing
      ? null
      : cs.stageResult
  const stageCommands = stageCommandsOf(stageResult)
  const showStage =
    !isViewingPrev && !isTeacherEditing && (stageCommands.length > 0 || !!stageTargetCode(task))
  const [outputPaneRef, outputPaneSize] = useElementSize()
  // Beside the console when the output side is wider than tall; above it otherwise (and always
  // on narrow screens).
  const stageBeside =
    !isMobile && outputPaneSize.width >= 480 && outputPaneSize.width > outputPaneSize.height * 1.05
  const outputProps =
    isForcedTeacherLive || isTeacherEditing
      ? {
          output: isTeacherEditing ? '' : displayOutput,
          runStatus: isTeacherEditing ? null : displayRunStatus,
          checkPassed: isTeacherEditing ? false : displayCheckPassed,
          hasCheck: !!task?.check,
          checkAttempted: isTeacherEditing ? false : displayCheckAttempted,
        }
      : isViewingPrev
        ? {
            output: savedCode?.output ?? '',
            runStatus: savedCode?.runStatus ?? null,
            checkPassed: false,
            hasCheck: false,
            checkAttempted: false,
          }
        : {
            output: cs.output,
            runStatus: cs.runStatus,
            inputPrompt: cs.inputPrompt,
            onInputSubmit: cs.handleInputSubmit,
            onInputChange: cs.handleInputChange,
            checkPassed: cs.checkPassed,
            hasCheck: !!task?.check || task?.tests?.length > 0,
            running: cs.running || cs.runningTests,
          }

  function handleRunClick() {
    if (cs.running || cs.runningTests) {
      cs.handleStop()
      return
    }
    setOutputCollapsed(false)
    cs.handleRun()
  }

  useRemoteRunTrigger(
    cs.remoteRunToken,
    () => {
      if (!cs.running && !cs.runningTests) handleRunClick()
    },
    { enabled: !readOnly, onHandled: cs.acknowledgeRemoteRun }
  )

  function handleRunTestsClick() {
    if (cs.runningTests) return
    setOutputCollapsed(false)
    cs.handleRunTests()
  }

  const editor = (
    <div style={s.editorPane}>
      {showCopyCode && <CopyCodePanel code={task.copyCode} language="python" />}
      {showEditableHeader && (
        <div style={s.editorHeader} className="ui-tabs ui-tabs--editor">
          <span style={s.editorTitle}>Code</span>
          <div style={s.editorActions}>
            {task?.interactionMode === 'submit' ? (
              <button className="btn-primary" style={s.primaryBtn} onClick={cs.handleSubmit}>
                Submit
              </button>
            ) : (
              <>
                <button
                  className={cs.running || cs.runningTests ? 'btn-danger' : 'btn-primary'}
                  style={s.primaryBtn}
                  data-highlight-target="run stop"
                  onClick={handleRunClick}
                  disabled={!cs.running && !cs.runningTests && cs.pyodideStatus === 'loading'}
                >
                  {cs.running || cs.runningTests
                    ? 'Stop'
                    : cs.pyodideStatus === 'loading'
                      ? 'Getting Python ready...'
                      : 'Run'}
                </button>
                {task?.tests?.length > 0 && (
                  <button
                    className="btn-primary"
                    style={s.primaryBtn}
                    onClick={handleRunTestsClick}
                    disabled={cs.running || cs.pyodideStatus === 'loading' || cs.runningTests}
                  >
                    {cs.runningTests ? 'Running tests...' : 'Run Tests'}
                  </button>
                )}
              </>
            )}
            <button
              className="btn-ghost-outline"
              style={s.resetBtn}
              onClick={cs.handleResetCode}
              disabled={cs.running}
              title={
                inSandbox
                  ? 'Reset code to the sandbox starter code'
                  : 'Reset code to the starter code for this task'
              }
            >
              Reset Code
            </button>
          </div>
        </div>
      )}
      <PythonEditor
        code={code}
        readOnly={readOnly}
        onChange={readOnly ? undefined : cs.handleCodeChange}
        // Live number / colour scrubbing (task `scrub`, src/shared/scrub/); not in a sandbox.
        scrub={readOnly || isSandbox || cs.inPersonalSandbox ? null : getTaskScrub(task)}
        onScrubPreview={cs.scrubPreview}
        onScrubCommit={cs.recordScrub}
        onSelectionChange={readOnly ? undefined : cs.handleEditorSelection}
        onActivity={readOnly ? undefined : cs.handleEditorActivity}
        remoteSelection={isForcedTeacherLive ? displaySelection : null}
        teacherHighlights={
          isViewingPrev || isForcedTeacherLive || isTeacherEditing ? [] : cs.teacherHighlights
        }
        onHighlightDismiss={
          isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.dismissHighlight
        }
        pyodideStatus={cs.pyodideStatus}
        errorLine={readOnly ? null : cs.errorLine}
        lineHints={readOnly ? null : getTaskLineHintSets(task)}
        showBlocks={taskShowsBlocks(task)}
        onRunShortcut={readOnly || task?.interactionMode === 'submit' ? undefined : handleRunClick}
      />
      {showSubmitBanner && <div style={s.submitBanner}>Code submitted</div>}
    </div>
  )

  // The name-tag panel (showVariables): under the output, or alone while the output is folded
  // away on a narrow screen.
  const variablesPanel = (
    <TaskVariablesPanel
      task={task}
      panel={cs.variablesPanel}
      synced={isForcedTeacherLive ? displayVariablesPanel : undefined}
      running={cs.running}
      hidden={isViewingPrev || isTeacherEditing}
      style={s.variablesPanel}
    />
  )

  const outputPanel = (
    <OutputPanel
      {...outputProps}
      fill
      collapsible={false}
      leadingActions={
        !isForcedTeacherLive && (
          <CollapseTabButton
            onClick={() => setOutputCollapsed(true)}
            direction="right"
            title="Collapse Output"
            ariaLabel="Collapse Output"
            style={s.outputCollapseBtn}
          />
        )
      }
    />
  )

  const output = (
    <div ref={outputPaneRef} style={s.outputPane}>
      {showStage ? (
        <div style={stageBeside ? s.stageRow : s.stageColumn}>
          <StagePane
            key={task?.id ?? 'sandbox'}
            commands={stageCommands}
            target={stageTarget?.commands ?? null}
            ghostDefault={stageTargetGhostOn(task)}
            ran={!!stageResult}
            truncated={stageResult?.truncated === true}
            style={isMobile ? s.stageMobile : stageBeside ? s.stageBeside : s.stageAbove}
          />
          <div style={isMobile ? s.consoleBoxMobile : s.consoleBox}>{outputPanel}</div>
        </div>
      ) : (
        outputPanel
      )}
      {!isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.testResults !== null && (
        <div style={s.testResultsPanel}>
          {cs.testResults.map((r, i) => (
            <span
              key={r.id ?? i}
              style={{
                ...s.testResultBadge,
                background: r.passed ? '#dcfce7' : '#fef3c7',
                color: r.passed ? '#15803d' : '#b45309',
              }}
            >
              {r.passed ? 'Pass' : 'Check'} {r.name || `Test ${i + 1}`}
            </span>
          ))}
        </div>
      )}
      {variablesPanel}
    </div>
  )

  if (isMobile || !shouldShowOutput) {
    return (
      <div style={s.mobileStack}>
        {editor}
        {shouldShowOutput && !outputCollapsed ? output : variablesPanel}
      </div>
    )
  }

  return (
    <SplitPane
      style={s.pythonSplitPane}
      defaultSplit={58}
      rightCollapsed={outputCollapsed}
      collapsedRightWidth={44}
      collapsedRight={
        <CollapsedPanelRail
          onClick={isForcedTeacherLive ? undefined : () => setOutputCollapsed(false)}
          label="Output"
          direction="left"
          title={isForcedTeacherLive ? 'Output (collapsed by the presenter)' : 'Show Output'}
          ariaLabel="Show Output"
        />
      }
      left={editor}
      right={output}
    />
  )
}

const s = {
  pythonSplitPane: {
    flex: '1 1 auto',
    minHeight: 0,
    height: 'auto',
    overflow: 'hidden',
  },
  mobileStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
    height: 'auto',
    overflow: 'hidden',
  },
  editorPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    gap: 0,
    paddingBottom: 4,
  },
  outputPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  variablesPanel: { flex: '0 1 auto', maxHeight: '55%' },
  // The Python Stage beside or above the console (src/shared/stage/StagePane.jsx).
  stageRow: { display: 'flex', flexDirection: 'row', gap: 8, flex: 1, minHeight: 0 },
  stageColumn: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 },
  stageBeside: { flex: '0 0 55%' },
  stageAbove: { flex: '0 0 55%', minHeight: 180 },
  stageMobile: { flex: '0 0 auto', height: 'min(90vw, 420px)' },
  consoleBox: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  consoleBoxMobile: { display: 'flex', flexDirection: 'column', minHeight: 160, minWidth: 0 },
  outputCollapseBtn: {
    width: 28,
    height: 26,
    alignSelf: 'center',
    background: '#fff',
    color: 'var(--colour-primary)',
    border: '1px solid #fff',
    borderRadius: 6,
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  },
  editorHeader: { flexShrink: 0 },
  editorTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: 'var(--colour-primary)',
    padding: '0 10px',
  },
  editorActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    flexWrap: 'wrap',
  },
  primaryBtn: { padding: '7px 18px', fontSize: 13, flexShrink: 0 },
  resetBtn: {
    fontSize: 14,
    padding: '9px 20px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  submitBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#1e40af',
    fontWeight: 600,
    flexShrink: 0,
  },
  testResultsPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    flexShrink: 0,
  },
  testResultBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    borderRadius: 999,
    padding: '3px 10px',
    border: '1px solid transparent',
  },
}
