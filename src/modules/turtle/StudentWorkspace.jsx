import React, { useEffect, useRef, useState } from 'react'
import PythonEditor from '../python/PythonEditor'
import OutputPanel from '../../app/components/OutputPanel'
import SplitPane from '../../shared/SplitPane'
import {
  CollapsedPanelRail,
  CollapseTabButton,
} from '../../app/components/CollapsiblePanelControls'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import { drawTurtleCommands, sizeCanvasToDisplay } from './draw.js'

export default function StudentWorkspace({
  task,
  cs,
  isMobile,
  viewingTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  isTeacherEditing,
  displayCode,
  displayTurtleResult,
  teacherLiveCode,
  onVisiblePanesChange,
}) {
  const canvasRef = useRef(null)
  const [outputCollapsed, setOutputCollapsed] = useState(true)

  const savedCode = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const code = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
      ? (teacherLiveCode ?? '')
      : isViewingPrev
        ? (savedCode?.code ?? '')
        : cs.code

  // Turtle draw state is ephemeral (not persisted) — the live student's own most recent
  // run, or (Phase 3) the broadcast snapshot synced via teacherLive.turtleResult when
  // watching a "Go Live" turtle task. isViewingPrev/isTeacherEditing still show an empty
  // canvas — there's no saved/editable canvas snapshot for those, only code.
  const turtleResult = isForcedTeacherLive
    ? displayTurtleResult
    : !readOnly
      ? cs.turtleResult
      : null
  const commands = turtleResult?.commands ?? []
  const background = turtleResult?.state?.background ?? '#ffffff'

  useEffect(() => {
    onVisiblePanesChange?.(['code', 'canvas'])
  }, [onVisiblePanesChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function redraw() {
      sizeCanvasToDisplay(canvas)
      const ctx = canvas.getContext('2d')
      // jsdom (unit tests) has no real canvas 2D context and returns null.
      if (ctx) drawTurtleCommands(ctx, commands, { background })
    }
    redraw()
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [commands, background])

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
          </div>
        </div>
      )}
      <PythonEditor
        code={code}
        readOnly={readOnly}
        onChange={readOnly ? undefined : cs.handleCodeChange}
        pyodideStatus={cs.pyodideStatus}
        errorLine={readOnly ? null : cs.errorLine}
        onRunShortcut={readOnly ? undefined : handleRunClick}
      />
    </div>
  )

  const canvasAndOutput = (
    <div style={s.rightPane}>
      <div style={s.canvasWrap}>
        <canvas ref={canvasRef} style={s.canvas} />
      </div>
      {!outputCollapsed && (
        <div style={s.outputPane}>
          <OutputPanel
            output={cs.output}
            runStatus={cs.runStatus}
            checkPassed={cs.checkPassed}
            hasCheck={!!task?.check}
            checkAttempted={cs.checkAttempted}
            fill
            collapsible={false}
            leadingActions={
              <CollapseTabButton
                onClick={() => setOutputCollapsed(true)}
                direction="right"
                title="Collapse Output"
                ariaLabel="Collapse Output"
              />
            }
          />
        </div>
      )}
      {outputCollapsed && (
        <CollapsedPanelRail
          onClick={() => setOutputCollapsed(false)}
          label="Output"
          direction="left"
          title="Show Output"
          ariaLabel="Show Output"
        />
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div style={s.mobileStack}>
        {editor}
        {canvasAndOutput}
      </div>
    )
  }

  return <SplitPane style={s.splitPane} defaultSplit={50} left={editor} right={canvasAndOutput} />
}

const s = {
  splitPane: { flex: '1 1 auto', minHeight: 0, height: 'auto', overflow: 'hidden' },
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
    flex: '1 1 auto',
    minHeight: 200,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvas: { width: '100%', height: '100%', display: 'block' },
  outputPane: { display: 'flex', flexDirection: 'column', flex: '0 0 auto', maxHeight: '35%' },
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
