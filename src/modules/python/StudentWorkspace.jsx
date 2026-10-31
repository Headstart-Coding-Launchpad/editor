import React, { useEffect, useMemo, useState } from 'react'
import PythonEditor from './PythonEditor'
import { taskShowsBlocks } from '../../shared/blockGuides'
import { getTaskLineHintSets } from '../../shared/lineHints'
import { freezeValueLocks, getTaskLockSets } from '../../shared/lockedLines'
import OutputPanel from '../../app/components/OutputPanel'
import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import SplitPane from '../../shared/SplitPane'
import {
  CollapsedPanelRail,
  CollapseTabButton,
} from '../../app/components/CollapsiblePanelControls'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import TaskVariablesPanel from '../../shared/variablesPanel/TaskVariablesPanel.jsx'
import { useVariableLinks } from '../../shared/variablesPanel/useVariableLinks.js'
import { codeCallsInput, getTaskRunOnOpen } from '../../shared/scrub/runOnOpen.js'
import { getTaskScrub } from '../../shared/scrub/scrubConfig.js'
import ScrubReplayNote from '../../shared/scrub/ScrubReplayNote.jsx'
import ScrubOpenedCue from '../../shared/scrub/ScrubOpenedCue.jsx'
import {
  getPeekBand,
  getShowVariables,
  panelRunForTask,
  predictTagsAbove,
  taskShowsVariables,
} from '../../shared/variablesPanel/variablesPanel.js'
import { getRunCountWidgets } from '../../shared/runCounts.js'
import StagePane from '../../shared/stage/StagePane.jsx'
import { codeImportsStage, stageCommandsOf } from '../../shared/stage/commands.js'
import { codeImportsMatplotlib } from '../../shared/stage/charts.js'
import ResultPane from '../../shared/resultPane/ResultPane.jsx'
import { getTaskLayout } from '../../shared/resultPane/resultPane.js'
import { useResultPane, useRunFinishedToken } from '../../shared/resultPane/useResultPane.js'
import { useWorkspaceLayout } from '../../shared/resultPane/useWorkspaceLayout.js'
import { readStageResult } from '../../shared/stage/sync.js'
import { useElementSize } from '../../shared/useElementSize.js'
import { stageTargetCode, stageTargetGhostOn, useStageTarget } from './stageTarget.js'
import { usePythonSlowMo } from './slowMo/usePythonSlowMo.js'
import PredictRunLockNote, {
  PREDICT_RUN_LOCK_NOTE_ID,
} from '../../shared/variablesPanel/PredictRunLockNote.jsx'
import SlowMoBar, { SlowMoRunLabel } from './slowMo/SlowMoBar.jsx'
import { PYTHON_SLOW_MO_RUN_TITLE } from './slowMo/config.js'
import SlowMoNameTags from './slowMo/SlowMoNameTags.jsx'
import PuzzleBar from '../../shared/puzzle/PuzzleBar.jsx'

// The editor's share of the width when side by side (percent).
const PYTHON_SPLIT = 58

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
  // The presenter's slow-mo playback in Go Live (teacherLive.pythonSlowMo, ./slowMo/live.js).
  displayPythonSlowMo = null,
  isTeacherEditing,
  teacherLiveCode,
  onVisiblePanesChange,
  // A Code Arrange task that draws on the Stage (src/activities/code_arrange/):
  // `arrangeBoard({ onRun, runLabel })` renders the tile board in the editor's place, and
  // `arrangeReady` says every blank is filled. The board owns Run and the tutor's remote Run; the
  // Stage, name tags, slow-mo and console are this workspace's own, and open from the start.
  arrangeBoard = null,
  arrangeReady = true,
}) {
  // A task with a name-tag panel (showVariables) opens with the output side showing, so the
  // student can predict before the first Run; so does one with a Stage target to draw over, and
  // one whose author picked the first result tab (layout.firstPane), and one that runs on open
  // (runOnOpen), so its opening preview is in view.
  const [localOutputCollapsed, setLocalOutputCollapsed] = useState(
    () =>
      !arrangeBoard &&
      !isForcedTeacherLive &&
      !isTeacherEditing &&
      !isViewingPrev &&
      !taskShowsVariables(lessonTask) &&
      !stageTargetCode(lessonTask) &&
      !getTaskLayout(lessonTask)?.firstPane &&
      !(getTaskRunOnOpen(lessonTask) && !codeCallsInput(cs.code))
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

  const showCopyCode = typeof task?.copyCode === 'string' && !!task.copyCode.trim()

  // Slow-mo (task.slowMo, ./slowMo/): record the run, then play it back line by line. A Go Live
  // viewer follows the presenter's playback.
  const slowMoShown = !isViewingPrev && !isTeacherEditing && task?.interactionMode !== 'submit'
  const slowMo = usePythonSlowMo({
    task: slowMoShown ? task : null,
    cs,
    code: cs.code,
    readOnly,
    live: isForcedTeacherLive ? displayPythonSlowMo : undefined,
  })
  const slowMoView = slowMoShown ? slowMo.view : null
  // The #@peek "stopped here" band (showVariables.at: marker), from when the task opens; not
  // while the panel is hidden or slow-mo steps through the run.
  const variablesSynced = isForcedTeacherLive ? displayVariablesPanel : undefined
  const panelRun = panelRunForTask(task, { panel: cs.variablesPanel, synced: variablesSynced })
  const peekBand =
    isViewingPrev || isTeacherEditing || slowMoView ? null : getPeekBand(task, code, panelRun)
  // Linked name tags (showVariables.link): each tag and its variable in the code share a colour
  // and a number. Not on views without the panel (a previous task, the tutor editing).
  const variableLinks = useVariableLinks(task, panelRun, {
    enabled: !isViewingPrev && !isTeacherEditing,
  })
  // Run-count boxes and counts at the end of #@count lines (task runCounts, src/shared/
  // runCounts.js): the student's own, or the presenter's in Go Live. Not on a previous task, the
  // tutor editing, or while slow-mo plays the run back (the counts would give it away).
  const runCountWidgets =
    isViewingPrev || isTeacherEditing || slowMoView
      ? null
      : getRunCountWidgets(
          task,
          code,
          isForcedTeacherLive ? { synced: displayVariablesPanel } : { panel: cs.variablesPanel },
          { readOnly, running: cs.running }
        )
  const slowMoControls = {
    ...slowMo,
    slowMo: () => {
      setOutputCollapsed(false)
      slowMo.slowMo()
    },
    step: () => {
      setOutputCollapsed(false)
      slowMo.step()
    },
  }

  // The Python Stage (src/shared/stage/): shown once the code draws, or from the start when the
  // task has a stageTarget to draw over. Go Live shows the broadcast drawing.
  const stageTarget = useStageTarget(task, { ready: cs.pyodideStatus === 'ready' })
  const liveStage = useMemo(() => readStageResult(displayStage), [displayStage])
  const stageResult = isForcedTeacherLive
    ? liveStage
    : isViewingPrev || isTeacherEditing
      ? null
      : cs.stageResult
  const stageCommands = slowMoView?.hasStage ? slowMoView.stage : stageCommandsOf(stageResult)
  // A Stage arrangement (arrangeBoard) shows the Stage from the start, as a stageTarget does.
  const showStage =
    !isViewingPrev &&
    !isTeacherEditing &&
    (stageCommands.length > 0 ||
      !!stageTargetCode(task) ||
      !!slowMoView?.hasStage ||
      !!arrangeBoard)
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

  // During slow-mo playback the output grows step by step; the check result shows once the
  // last step has played (the recorded run was checked like any Run).
  const shownOutputProps = slowMoView
    ? {
        ...outputProps,
        output: slowMoView.output,
        runStatus: slowMoView.finished ? outputProps.runStatus : null,
        checkPassed: slowMoView.finished ? outputProps.checkPassed : false,
        hasCheck: slowMoView.finished ? outputProps.hasCheck : false,
        checkAttempted: slowMoView.finished ? outputProps.checkAttempted : false,
        inputPrompt: null,
        running: false,
      }
    : outputProps

  // Smaller screens (src/shared/resultPane/): the editor plus ONE result pane with tabs Picture ·
  // Tags · Console — only the panes this task has — beside the editor, or below it on portrait
  // screens and phones. Wide desktops keep everything side by side. After Run the pane switches
  // to what the task is about; the Console tab counts unseen lines while hidden.
  // Predict tags above the code (showVariables.placement: above) until the first Run; then the
  // panel goes back to its usual place (beside the output, or its Tags tab). Not on a Code
  // Arrange board (no code editor to sit above).
  const tagsAbove =
    !isViewingPrev &&
    !isTeacherEditing &&
    !slowMoView &&
    !arrangeBoard &&
    predictTagsAbove(task, {
      run: panelRun,
      predictions: isForcedTeacherLive ? null : cs.variablesPanel?.predictions,
    })
  const tagsAvailable =
    taskShowsVariables(task) && !isViewingPrev && !isTeacherEditing && !tagsAbove
  const pictureAvailable =
    showStage ||
    (!isViewingPrev &&
      !isTeacherEditing &&
      // A chart program (matplotlib) draws on the Stage too.
      (codeImportsStage(code) || codeImportsMatplotlib(code)))
  const resultPanes = shouldShowOutput
    ? [pictureAvailable && 'picture', tagsAvailable && 'tags', 'console'].filter(Boolean)
    : []
  const {
    ref: workspaceRef,
    layout,
    inset,
  } = useWorkspaceLayout({ isMobile, split: PYTHON_SPLIT, paneCount: resultPanes.length })
  const tabbed = layout !== 'side' && resultPanes.length > 1
  const runToken = useRunFinishedToken({
    running: !readOnly && (cs.running || cs.runningTests),
    // A Go Live viewer: the presenter's run status arriving marks a finished run.
    liveKey: isForcedTeacherLive ? (displayRunStatus ?? null) : null,
  })
  const result = useResultPane({
    task,
    available: resultPanes,
    tabbed,
    tagsMode: tagsAvailable ? (getShowVariables(task)?.mode ?? null) : null,
    pictureGoal: !!stageTargetCode(task),
    slowMo: !!slowMoView,
    runToken,
    drew: stageCommands.length > 0,
    error: shownOutputProps.runStatus === 'error',
    output: shownOutputProps.output,
  })

  // What's on screen, for the tutor's student card ('stage' is the Picture tab).
  const stackedIds = ['picture', 'tags']
  // Side by side, every pane is on screen: the Stage once it shows, the tags and the console.
  const shownResultPanes =
    !shouldShowOutput || outputCollapsed
      ? []
      : !tabbed
        ? [showStage && 'picture', tagsAvailable && 'tags', 'console'].filter(Boolean)
        : resultPanes.filter(
            (id) =>
              id === result.active ||
              (result.stacked && stackedIds.includes(id) && stackedIds.includes(result.active))
          )
  const visiblePanesKey = [
    'code',
    ...(tagsAbove ? ['tags'] : []),
    ...shownResultPanes.map((id) => (id === 'picture' ? 'stage' : id)),
  ].join(',')
  useEffect(() => {
    onVisiblePanesChange?.(visiblePanesKey.split(','))
  }, [visiblePanesKey, onVisiblePanesChange])

  // Predict mode's Run lock (cs.predictRunLock, showVariables.lockRun): Run, slow-mo and the
  // run shortcut wait for every prediction, until the first Run. Never on a read-only view.
  const runLock = readOnly ? null : (cs.predictRunLock ?? null)

  // The lock note takes the student to the first empty tag: unfold the output and, with tabs,
  // open the Tags tab first (tags above the code are already in view).
  function revealTags() {
    if (tagsAbove) return
    setOutputCollapsed(false)
    if (tabbed && resultPanes.includes('tags')) result.select('tags')
  }

  // On a slow-mo task Run plays the run in slow-mo ("▶ Run (slow-mo)"), unless the task keeps a
  // separate Slow-mo button (slowMo.separateButton). The run shortcut, a Code Arrange board's Run
  // and the tutor's remote Run go through here too.
  const runIsSlowMo = slowMoShown && slowMo.throughRun

  function handleRunClick() {
    if (cs.running || cs.runningTests) {
      cs.handleStop()
      return
    }
    if (runLock) return
    setOutputCollapsed(false)
    if (runIsSlowMo) slowMo.run()
    else cs.handleRun()
  }

  // A Code Arrange board handles the tutor's remote Run itself (only a full board can run).
  useRemoteRunTrigger(
    arrangeBoard ? null : cs.remoteRunToken,
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

  // A Code Arrange task: slow-mo's bar above the tile board (slow-mo runs the assembled program,
  // so it waits for a full board).
  const arrangePane = arrangeBoard && (
    <div style={s.arrangePane}>
      {slowMoShown && (showEditableHeader || slowMoView) && (
        <SlowMoBar
          slowMo={slowMoControls}
          runDisabled={cs.running || cs.pyodideStatus === 'loading' || !arrangeReady || !!runLock}
        />
      )}
      {arrangeBoard({
        onRun: handleRunClick,
        runLabel: runIsSlowMo ? <SlowMoRunLabel /> : undefined,
      })}
    </div>
  )

  const editor = arrangePane || (
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
                  disabled={
                    !cs.running && !cs.runningTests && (cs.pyodideStatus === 'loading' || !!runLock)
                  }
                  title={
                    !cs.running && runLock
                      ? runLock.message
                      : runIsSlowMo && !cs.running
                        ? PYTHON_SLOW_MO_RUN_TITLE
                        : undefined
                  }
                  aria-describedby={!cs.running && runLock ? PREDICT_RUN_LOCK_NOTE_ID : undefined}
                >
                  {cs.running || cs.runningTests ? (
                    'Stop'
                  ) : cs.pyodideStatus === 'loading' ? (
                    'Getting Python ready...'
                  ) : runIsSlowMo ? (
                    <SlowMoRunLabel />
                  ) : (
                    'Run'
                  )}
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
                {!cs.running && <PredictRunLockNote lock={runLock} onReveal={revealTags} />}
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
      {slowMoShown && (showEditableHeader || slowMoView) && (
        <SlowMoBar
          slowMo={slowMoControls}
          runDisabled={cs.running || cs.runningTests || cs.pyodideStatus === 'loading' || !!runLock}
        />
      )}
      {/* setupNote, the puzzle's line counter and, after a pass, its par (src/shared/puzzle/). */}
      <PuzzleBar task={task} code={code} passed={!!outputProps.checkPassed} />
      <ScrubOpenedCue show={!readOnly && cs.scrubJustOpened} />
      {tagsAbove && (
        <TaskVariablesPanel
          task={task}
          panel={cs.variablesPanel}
          synced={variablesSynced}
          code={code}
          running={cs.running}
          placement="above"
          style={s.variablesAbove}
          {...variableLinks.panel}
        />
      )}
      <PythonEditor
        code={code}
        readOnly={readOnly}
        onChange={readOnly ? undefined : cs.handleCodeChange}
        // Live number / colour scrubbing (task `scrub`, src/shared/scrub/); not in a sandbox.
        // scrub.afterPass: none until the task's first pass (cs.scrubHeld).
        scrub={
          readOnly || isSandbox || cs.inPersonalSandbox || cs.scrubHeld ? null : getTaskScrub(task)
        }
        onScrubPreview={
          cs.scrubPreview ? (value, options) => cs.scrubPreview(value, null, options) : undefined
        }
        // A finished scrub: counted for the report, and checked once as a Run (checkOnRelease).
        onScrubCommit={cs.handleScrubCommit}
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
        // Line hints are scaffolding: once the check passes they go, not linger after the code.
        lineHints={readOnly || cs.checkPassed ? null : getTaskLineHintSets(task)}
        // Locked lines (#@lock, puzzle.onlyEdit) show in every view, Go Live included.
        // scrub.afterPass holds #@lock-values values shut until the first pass.
        lockedLines={
          !readOnly && cs.scrubHeld
            ? freezeValueLocks(getTaskLockSets(task))
            : getTaskLockSets(task)
        }
        showBlocks={taskShowsBlocks(task)}
        onRunShortcut={readOnly || task?.interactionMode === 'submit' ? undefined : handleRunClick}
        slowMoMarker={slowMoView?.marker ?? null}
        peekBand={peekBand}
        variableLinks={variableLinks.editor}
        runCounts={
          runCountWidgets && {
            ...runCountWidgets,
            onChange: cs.variablesPanel?.setCountPrediction,
            onCommit: cs.variablesPanel?.commitPredictions,
          }
        }
      />
      {showSubmitBanner && <div style={s.submitBanner}>Code submitted</div>}
    </div>
  )

  // The name-tag panel (showVariables): under the output side by side; its own tab on smaller
  // screens; alone while the output is folded away on a narrow screen.
  const variablesStyle = tabbed ? s.variablesFill : s.variablesPanel
  const variablesPanel = slowMoView ? (
    <SlowMoNameTags task={task} slowMo={slowMo} style={variablesStyle} {...variableLinks.panel} />
  ) : (
    <TaskVariablesPanel
      task={task}
      panel={cs.variablesPanel}
      synced={variablesSynced}
      code={code}
      running={cs.running}
      hidden={isViewingPrev || isTeacherEditing}
      style={variablesStyle}
      {...variableLinks.panel}
    />
  )

  const collapseDirection = layout === 'below' ? 'down' : 'right'
  const collapseButton = !isForcedTeacherLive && (
    <CollapseTabButton
      onClick={() => setOutputCollapsed(true)}
      direction={collapseDirection}
      title="Collapse Output"
      ariaLabel="Collapse Output"
      style={tabbed ? s.tabsCollapseBtn : s.outputCollapseBtn}
    />
  )

  const outputPanel = (
    <OutputPanel
      {...shownOutputProps}
      errorHelp={!isForcedTeacherLive && !isTeacherEditing && !isViewingPrev && !slowMoView}
      code={cs.code}
      drew={stageCommands.length > 0}
      fill
      collapsible={false}
      // With tabs, the collapse button sits at the end of the tab strip instead.
      leadingActions={tabbed ? null : collapseButton}
    />
  )

  const testResultsPanel = !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    cs.testResults !== null && (
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
    )

  // "Using your last answers: …" while a scrub preview replays the last Run's input() answers.
  const replayNote = <ScrubReplayNote answers={readOnly ? null : cs.scrubReplayAnswers} />

  const stagePane = (
    <StagePane
      key={task?.id ?? 'sandbox'}
      commands={stageCommands}
      target={stageTarget?.commands ?? null}
      ghostDefault={stageTargetGhostOn(task)}
      ran={!!stageResult || !!slowMoView}
      truncated={stageResult?.truncated === true}
      saveTitle={readOnly ? null : String(task?.title ?? '')}
      style={layout !== 'side' ? s.stageFill : stageBeside ? s.stageBeside : s.stageAbove}
      // Beat Maker: the student's own Run plays its beat once the program has finished (not
      // while input() waits); Go Live and slow-mo only show it.
      beatAutoPlay={!isForcedTeacherLive && !slowMoView && !cs.running && !!cs.stageResult}
    />
  )

  const output = (
    <div ref={outputPaneRef} style={s.outputPane}>
      {replayNote}
      {showStage ? (
        <div style={stageBeside ? s.stageRow : s.stageColumn}>
          {stagePane}
          <div style={s.consoleBox}>{outputPanel}</div>
        </div>
      ) : (
        outputPanel
      )}
      {testResultsPanel}
      {!tagsAbove && variablesPanel}
    </div>
  )

  // Picture · Tags · Console as tabs (or the console alone when it is the only pane).
  const resultPane = (
    <ResultPane
      panes={resultPanes.map((id) => ({
        id,
        content:
          id === 'picture' ? (
            <div style={s.consoleColumn}>
              {replayNote}
              {stagePane}
            </div>
          ) : id === 'tags' ? (
            variablesPanel
          ) : (
            <div style={s.consoleColumn}>
              {replayNote}
              {outputPanel}
              {testResultsPanel}
            </div>
          ),
      }))}
      active={result.active}
      onSelect={result.select}
      stacked={result.stacked}
      badges={result.badges}
      announcement={result.announcement}
      idPrefix="python-result"
      label="Result"
      trailing={tabbed ? <span style={s.tabsTrailing}>{collapseButton}</span> : null}
    />
  )

  const collapsedRail = (orientation) => (
    <CollapsedPanelRail
      onClick={isForcedTeacherLive ? undefined : () => setOutputCollapsed(false)}
      label="Output"
      direction={orientation === 'horizontal' ? 'up' : 'left'}
      orientation={orientation}
      title={isForcedTeacherLive ? 'Output (collapsed by the presenter)' : 'Show Output'}
      ariaLabel="Show Output"
      style={orientation === 'horizontal' ? s.outputRailHorizontal : undefined}
    />
  )

  let body
  if (!shouldShowOutput) {
    body = (
      <div style={s.mobileStack}>
        {editor}
        {!tagsAbove && variablesPanel}
      </div>
    )
  } else if (layout === 'below') {
    // Phones and portrait screens: the editor above, the result pane below.
    body = (
      <div style={s.belowStack}>
        <div style={s.belowEditor}>{editor}</div>
        {outputCollapsed ? (
          collapsedRail('horizontal')
        ) : (
          <div style={s.belowResult}>{resultPane}</div>
        )}
      </div>
    )
  } else {
    body = (
      <SplitPane
        style={s.pythonSplitPane}
        defaultSplit={PYTHON_SPLIT}
        rightCollapsed={outputCollapsed}
        collapsedRightWidth={44}
        collapsedRight={collapsedRail('vertical')}
        left={editor}
        right={layout === 'tabs' ? resultPane : output}
      />
    )
  }

  // The outer box is measured (never padded, so its size is steady); the inner one makes room
  // for a tablet's on-screen keyboard so the editor and the result pane stay in view.
  return (
    <div ref={workspaceRef} style={s.workspace} data-layout={layout}>
      <div style={inset ? { ...s.workspaceInner, paddingBottom: inset } : s.workspaceInner}>
        {body}
      </div>
    </div>
  )
}
const s = {
  // A Code Arrange task's tile board, scrolling in the editor's place.
  arrangePane: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: '4px 4px 8px',
  },
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
  // Predict tags above the code: never more than about half the editor pane, scrolling inside.
  variablesAbove: { flex: '0 0 auto', maxHeight: '45%', marginBottom: 6 },
  // The Python Stage beside or above the console (src/shared/stage/StagePane.jsx).
  stageRow: { display: 'flex', flexDirection: 'row', gap: 8, flex: 1, minHeight: 0 },
  stageColumn: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 },
  stageBeside: { flex: '0 0 55%' },
  stageAbove: { flex: '0 0 55%', minHeight: 180 },
  consoleBox: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  // The workspace's measured outer box and its inner box (padded for an on-screen keyboard).
  workspace: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    minWidth: 0,
  },
  workspaceInner: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    minWidth: 0,
  },
  // Phones and portrait screens: the editor above the result pane.
  belowStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
  },
  belowEditor: { display: 'flex', flexDirection: 'column', flex: '1 1 55%', minHeight: 160 },
  belowResult: { display: 'flex', flexDirection: 'column', flex: '1 1 45%', minHeight: 220 },
  outputRailHorizontal: { flexShrink: 0, padding: '6px 12px', minHeight: 44 },
  // Inside a result tab: the pane fills it.
  stageFill: { flex: 1, minHeight: 0 },
  variablesFill: { flex: '1 1 auto', minHeight: 0, maxHeight: '100%' },
  consoleColumn: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 },
  tabsTrailing: { marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4 },
  tabsCollapseBtn: {
    minWidth: 44,
    minHeight: 44,
    background: '#fff',
    color: 'var(--colour-primary)',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
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
  primaryBtn: { padding: '10px 28px', fontSize: 16, flexShrink: 0, minHeight: 44 },
  resetBtn: {
    fontSize: 12,
    padding: '5px 10px',
    marginLeft: 16,
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
