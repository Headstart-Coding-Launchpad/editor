import React, { useEffect, useMemo, useState } from 'react'
import PythonEditor from '../python/PythonEditor'
import { taskShowsBlocks } from '../../shared/blockGuides'
import { getTaskLineHintSets } from '../../shared/lineHints'
import { getTaskLockSets } from '../../shared/lockedLines'
import OutputPanel from '../../app/components/OutputPanel'
import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import SplitPane from '../../shared/SplitPane'
import {
  CollapsedPanelRail,
  CollapseTabButton,
} from '../../app/components/CollapsiblePanelControls'
import CopyCodePanel from '../../app/components/CopyCodePanel'
// A course task (task.course) shows its map and vehicle; any other task the plain picture.
import TurtlePicture from './CoursePicture.jsx'
// Course mode's tap-to-paint map editor (course.studentMap, turtle.course_map).
import CourseMapEditor from './CourseMapEditor.jsx'
import { getTaskCourse } from './course.js'
import TaskVariablesPanel from '../../shared/variablesPanel/TaskVariablesPanel.jsx'
import { getTaskScrub } from '../../shared/scrub/scrubConfig.js'
import { usePythonSlowMo } from '../python/slowMo/usePythonSlowMo.js'
import SlowMoBar from '../python/slowMo/SlowMoBar.jsx'
import SlowMoNameTags from '../python/slowMo/SlowMoNameTags.jsx'
import PuzzleBar from '../../shared/puzzle/PuzzleBar.jsx'
import { getShowVariables, taskShowsVariables } from '../../shared/variablesPanel/variablesPanel.js'
import ResultPane from '../../shared/resultPane/ResultPane.jsx'
import { useResultPane, useRunFinishedToken } from '../../shared/resultPane/useResultPane.js'
import { useWorkspaceLayout } from '../../shared/resultPane/useWorkspaceLayout.js'

// The editor's share of the width when side by side (percent).
const TURTLE_SPLIT = 50

export default function StudentWorkspace({
  task,
  cs,
  isSandbox,
  isMobile,
  viewingTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  isTeacherEditing,
  displayCode,
  displayTurtleResult,
  displayVariablesPanel = null,
  // The presenter's slow-mo playback in Go Live (teacherLive.pythonSlowMo).
  displayPythonSlowMo = null,
  teacherLiveCode,
  onVisiblePanesChange,
}) {
  const [outputCollapsed, setOutputCollapsed] = useState(true)
  const [mapEditorOpen, setMapEditorOpen] = useState(false)

  const savedCode = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const code = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
      ? (teacherLiveCode ?? '')
      : isViewingPrev
        ? (savedCode?.code ?? '')
        : cs.code

  // Slow-mo (task.slowMo, src/modules/python/slowMo/): the recorded run drawn step by step. A Go
  // Live viewer follows the presenter's playback. Free play (a sandbox) has none.
  const slowMoShown = !isViewingPrev && !isTeacherEditing && !isSandbox && !cs.inPersonalSandbox
  const slowMo = usePythonSlowMo({
    task: slowMoShown ? task : null,
    cs,
    code: cs.code,
    readOnly,
    live: isForcedTeacherLive ? displayPythonSlowMo : undefined,
  })
  const slowMoView = slowMoShown ? slowMo.view : null
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

  // Turtle draw state is ephemeral (not persisted) — the live student's own most recent
  // run, or (Phase 3) the broadcast snapshot synced via teacherLive.turtleResult when
  // watching a "Go Live" turtle task. isViewingPrev/isTeacherEditing still show an empty
  // canvas — there's no saved/editable canvas snapshot for those, only code.
  const slowMoTurtle = useMemo(
    () =>
      slowMoView
        ? { commands: slowMoView.turtle?.commands ?? [], state: slowMoView.turtle?.state ?? null }
        : null,
    [slowMoView]
  )
  const turtleResult = slowMoTurtle
    ? slowMoTurtle
    : isForcedTeacherLive
      ? displayTurtleResult
      : !readOnly
        ? cs.turtleResult
        : null
  // While a Run's drawing plays (TurtlePicture), the check result waits for it to finish or be
  // skipped, as it does for slow-mo's last step.
  const [drawingPlaying, setDrawingPlaying] = useState(false)
  const holdResult = (!!slowMoView && !slowMoView.finished) || drawingPlaying

  // Smaller screens (src/shared/resultPane/): the editor plus ONE result pane with tabs Picture ·
  // Tags · Console, beside the editor or below it on portrait screens and phones. Wide desktops
  // keep the picture, name tags and output side by side as before.
  const inFreePlay = isSandbox || cs.inPersonalSandbox
  const tagsAvailable =
    !inFreePlay && !isViewingPrev && !isTeacherEditing && taskShowsVariables(task)
  const resultPanes = ['picture', tagsAvailable && 'tags', 'console'].filter(Boolean)
  const {
    ref: workspaceRef,
    layout,
    inset,
  } = useWorkspaceLayout({ isMobile, split: TURTLE_SPLIT, paneCount: resultPanes.length })
  const tabbed = layout !== 'side'
  const runToken = useRunFinishedToken({
    running: !readOnly && cs.running,
    // A Go Live viewer: each new broadcast run of the presenter's drawing.
    liveKey: isForcedTeacherLive ? (displayTurtleResult?.runId ?? null) : null,
  })
  const shownOutput = slowMoView ? slowMoView.output : cs.output
  const result = useResultPane({
    task,
    available: resultPanes,
    tabbed,
    tagsMode: tagsAvailable ? (getShowVariables(task)?.mode ?? null) : null,
    // A course (a maze or track to drive) is a picture goal from the start.
    pictureGoal: !inFreePlay && !!task?.course,
    preferPicture: true,
    slowMo: !!slowMoView,
    runToken,
    drew: (turtleResult?.commands?.length ?? 0) > 0,
    error: cs.runStatus === 'error',
    output: shownOutput,
  })

  // What's on screen, for the tutor's student card ('canvas' is the Picture tab).
  const stackedIds = ['picture', 'tags']
  const shownResultPanes = !tabbed
    ? ['picture']
    : resultPanes.filter(
        (id) =>
          id === result.active ||
          (result.stacked && stackedIds.includes(id) && stackedIds.includes(result.active))
      )
  const visiblePanesKey = [
    'code',
    ...shownResultPanes.map((id) => (id === 'picture' ? 'canvas' : id)),
  ].join(',')
  useEffect(() => {
    onVisiblePanesChange?.(visiblePanesKey.split(','))
  }, [visiblePanesKey, onVisiblePanesChange])

  // Student-made maps (course.studentMap): the map editor writes turtle.course_map(...) into the code.
  const taskCourse = useMemo(() => getTaskCourse(task), [task])
  const mapEditorAvailable = !readOnly && !inFreePlay && !!taskCourse?.studentMap

  const showCopyCode =
    !cs.inPersonalSandbox && typeof task?.copyCode === 'string' && !!task.copyCode.trim()

  function handleRunClick() {
    if (cs.running) {
      cs.handleStop()
      return
    }
    setOutputCollapsed(false)
    cs.handleRun()
  }

  useRemoteRunTrigger(
    cs.remoteRunToken,
    () => {
      if (!cs.running) handleRunClick()
    },
    { enabled: !readOnly, onHandled: cs.acknowledgeRemoteRun }
  )

  const editor = (
    <div style={s.editorPane}>
      {showCopyCode && <CopyCodePanel code={task.copyCode} language="python" />}
      {!readOnly && (
        <div style={s.editorHeader} className="ui-tabs ui-tabs--editor">
          <span style={s.editorTitle}>Code</span>
          <div style={s.editorActions}>
            <button
              className={cs.running ? 'btn-danger' : 'btn-primary'}
              style={s.primaryBtn}
              data-highlight-target="run stop"
              onClick={handleRunClick}
              disabled={!cs.running && cs.pyodideStatus === 'loading'}
            >
              {cs.running
                ? 'Stop'
                : cs.pyodideStatus === 'loading'
                  ? 'Getting Python ready...'
                  : 'Run'}
            </button>
            <button
              className="btn-ghost-outline"
              style={s.resetBtn}
              onClick={cs.handleResetCode}
              disabled={cs.running}
              title="Reset code to the starter code for this task"
            >
              Reset Code
            </button>
            {mapEditorAvailable && (
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.resetBtn}
                onClick={() => setMapEditorOpen(true)}
                disabled={cs.running}
                title="Draw your map by tapping squares"
              >
                <span aria-hidden="true">🧱</span> Map editor
              </button>
            )}
          </div>
        </div>
      )}
      {slowMoShown && (!readOnly || slowMoView) && (
        <SlowMoBar
          slowMo={slowMoControls}
          runDisabled={cs.running || cs.pyodideStatus === 'loading'}
        />
      )}
      {/* setupNote, the puzzle's line counter and, after a pass, its par (src/shared/puzzle/). */}
      {!isSandbox && !cs.inPersonalSandbox && (
        <PuzzleBar task={task} code={code} passed={!readOnly && !!cs.checkPassed} />
      )}
      <PythonEditor
        code={code}
        readOnly={readOnly}
        onChange={readOnly ? undefined : cs.handleCodeChange}
        // Live number / colour scrubbing (task `scrub`, src/shared/scrub/); not in a sandbox.
        scrub={readOnly || isSandbox || cs.inPersonalSandbox ? null : getTaskScrub(task)}
        onScrubPreview={cs.scrubPreview}
        onScrubCommit={cs.recordScrub}
        pyodideStatus={cs.pyodideStatus}
        errorLine={readOnly ? null : cs.errorLine}
        lineHints={readOnly || isSandbox || cs.inPersonalSandbox ? null : getTaskLineHintSets(task)}
        // Locked lines (#@lock, puzzle.onlyEdit) show in every view, Go Live included.
        lockedLines={isSandbox || cs.inPersonalSandbox ? null : getTaskLockSets(task)}
        showBlocks={taskShowsBlocks(task)}
        onRunShortcut={readOnly ? undefined : handleRunClick}
        slowMoMarker={slowMoView?.marker ?? null}
      />
    </div>
  )

  // The picture: one element for every layout, so a course mode's children and props go here
  // once. Switching between the side-by-side and tabbed layouts re-parents it, so it remounts
  // and shows the finished drawing (see useTurtlePlayback.js); switching tabs only hides it, so
  // a playing drawing carries on. Slow-mo draws its own steps, and a scrub preview has no runId,
  // so both draw at once.
  const picture = (
    <div style={s.canvasWrap}>
      <TurtlePicture
        task={task}
        code={code}
        result={turtleResult}
        animate={!slowMoView}
        onPlayingChange={setDrawingPlaying}
      />
    </div>
  )

  // The name-tag panel (showVariables); step by step during slow-mo.
  const variablesStyle = tabbed ? s.variablesFill : s.variablesPanel
  const variablesPanel = slowMoView ? (
    <SlowMoNameTags task={task} slowMo={slowMo} style={variablesStyle} />
  ) : (
    <TaskVariablesPanel
      task={inFreePlay ? null : task}
      panel={cs.variablesPanel}
      synced={isForcedTeacherLive ? displayVariablesPanel : undefined}
      running={cs.running}
      hidden={isViewingPrev || isTeacherEditing}
      style={variablesStyle}
    />
  )

  const outputPanel = (
    <OutputPanel
      // During slow-mo the output grows step by step and the check result waits for the
      // last step (the recorded run was checked like any Run).
      output={shownOutput}
      runStatus={holdResult ? null : cs.runStatus}
      checkPassed={holdResult ? false : cs.checkPassed}
      hasCheck={holdResult ? false : !!task?.check}
      checkAttempted={holdResult ? false : cs.checkAttempted}
      fill
      collapsible={false}
      // With tabs the Console is its own tab, so it never folds away.
      leadingActions={
        tabbed ? null : (
          <CollapseTabButton
            onClick={() => setOutputCollapsed(true)}
            direction="down"
            title="Collapse Output"
            ariaLabel="Collapse Output"
          />
        )
      }
    />
  )

  const canvasAndOutput = (
    <div style={s.rightPane}>
      {picture}
      {/* The name-tag panel, between the drawing and the output. */}
      {variablesPanel}
      {!outputCollapsed && <div style={s.outputPane}>{outputPanel}</div>}
      {outputCollapsed && (
        // Output sits *below* the canvas here (not beside it like Python), so it must use
        // the horizontal rail — the vertical one is height: 100% and swallows the pane.
        <CollapsedPanelRail
          onClick={() => setOutputCollapsed(false)}
          label="Output"
          direction="up"
          orientation="horizontal"
          title="Show Output"
          ariaLabel="Show Output"
          style={s.outputRail}
        />
      )}
    </div>
  )

  // Picture · Tags · Console as tabs.
  const resultPane = (
    <ResultPane
      panes={resultPanes.map((id) => ({
        id,
        content: id === 'picture' ? picture : id === 'tags' ? variablesPanel : outputPanel,
      }))}
      active={result.active}
      onSelect={result.select}
      stacked={result.stacked}
      badges={result.badges}
      announcement={result.announcement}
      idPrefix="turtle-result"
      label="Result"
    />
  )

  const body =
    layout === 'below' ? (
      // Phones and portrait screens: the editor above, the result pane below.
      <div style={s.belowStack}>
        <div style={s.belowEditor}>{editor}</div>
        <div style={s.belowResult}>{resultPane}</div>
      </div>
    ) : (
      <SplitPane
        style={s.splitPane}
        defaultSplit={TURTLE_SPLIT}
        left={editor}
        right={layout === 'tabs' ? resultPane : canvasAndOutput}
      />
    )

  // The outer box is measured (never padded, so its size is steady); the inner one makes room
  // for a tablet's on-screen keyboard so the editor and the result pane stay in view.
  return (
    <div ref={workspaceRef} style={s.workspace} data-layout={layout}>
      <div style={inset ? { ...s.workspaceInner, paddingBottom: inset } : s.workspaceInner}>
        {body}
      </div>
      {mapEditorOpen && mapEditorAvailable && (
        <CourseMapEditor
          code={cs.code}
          course={taskCourse}
          onApply={(nextCode) => {
            cs.handleCodeChange(nextCode)
            setMapEditorOpen(false)
          }}
          onClose={() => setMapEditorOpen(false)}
        />
      )}
    </div>
  )
}

const s = {
  splitPane: { flex: '1 1 auto', minHeight: 0, height: 'auto', overflow: 'hidden' },
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
  // The name-tag panel filling its own tab.
  variablesFill: { flex: '1 1 auto', minHeight: 0, maxHeight: '100%' },
  editorPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  rightPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  canvasWrap: {
    display: 'flex',
    flex: '1 1 0',
    minHeight: 160,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  variablesPanel: { flex: '0 1 auto', maxHeight: '40%' },
  outputPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: '0 0 35%',
    minHeight: 120,
    overflow: 'hidden',
  },
  outputRail: { flexShrink: 0, padding: '6px 12px' },
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
}
