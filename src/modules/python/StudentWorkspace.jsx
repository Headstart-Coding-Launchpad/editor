import React, { useState } from 'react'
import PythonEditor from '../../app/components/PythonEditor'
import OutputPanel from '../../app/components/OutputPanel'
import SplitPane from '../../shared/SplitPane'
import { CollapsedPanelRail, CollapseTabButton } from '../../app/components/CollapsiblePanelControls'
import { loadSavedCode } from '../../app/studentStorage'

export default function StudentWorkspace({
  task, cs, lessonId, identityId, viewingTaskId,
  isViewingPrev, isForcedTeacherLive, isMobile,
  displayCode, displayOutput, displayRunStatus,
  displayCheckPassed, displayCheckAttempted, displaySelection,
  isTeacherEditing, teacherLiveCode,
}) {
  const [outputCollapsed, setOutputCollapsed] = useState(() => !isForcedTeacherLive && !isTeacherEditing && !isViewingPrev)
  const savedCode = isViewingPrev ? loadSavedCode(lessonId, viewingTaskId, identityId) : null
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const code = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
    ? (teacherLiveCode ?? '')
    : isViewingPrev
    ? (savedCode?.code ?? '')
    : cs.code
  const showEditableHeader = !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing
  const showSubmitBanner = showEditableHeader && task?.interactionMode === 'submit' && cs.runStatus === 'submitted' && !task?.check
  const shouldShowOutput = task?.interactionMode !== 'submit' || isForcedTeacherLive || isTeacherEditing || isViewingPrev
  const outputProps = isForcedTeacherLive || isTeacherEditing
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

  function handleRunTestsClick() {
    if (cs.runningTests) return
    setOutputCollapsed(false)
    cs.handleRunTests()
  }

  const editor = (
    <div style={s.editorPane}>
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
                  onClick={handleRunClick}
                  disabled={!cs.running && !cs.runningTests && cs.pyodideStatus === 'loading'}
                >
                  {cs.running || cs.runningTests ? 'Stop' : cs.pyodideStatus === 'loading' ? 'Getting Python ready...' : 'Run'}
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
        onSelectionChange={readOnly ? undefined : cs.handleEditorSelection}
        onActivity={readOnly ? undefined : cs.handleEditorActivity}
        remoteSelection={isForcedTeacherLive ? displaySelection : null}
        teacherHighlights={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? [] : cs.teacherHighlights}
        onHighlightDismiss={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.dismissHighlight}
        pyodideStatus={cs.pyodideStatus}
      />
      {showSubmitBanner && (
        <div style={s.submitBanner}>Code submitted</div>
      )}
    </div>
  )

  const output = (
    <div style={s.outputPane}>
      <OutputPanel
        {...outputProps}
        fill
        collapsible={false}
        leadingActions={
          <CollapseTabButton
            onClick={() => setOutputCollapsed(true)}
            direction="right"
            title="Collapse Output"
            ariaLabel="Collapse Output"
            style={s.outputCollapseBtn}
          />
        }
      />
      {!isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.testResults !== null && (
        <div style={s.testResultsPanel}>
          {cs.testResults.map((r, i) => (
            <span key={r.id ?? i} style={{ ...s.testResultBadge, background: r.passed ? '#dcfce7' : '#fef3c7', color: r.passed ? '#15803d' : '#b45309' }}>
              {r.passed ? 'Pass' : 'Check'} {r.name || `Test ${i + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (isMobile || !shouldShowOutput) {
    return (
      <div style={s.mobileStack}>
        {editor}
        {shouldShowOutput && !outputCollapsed && output}
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
          onClick={() => setOutputCollapsed(false)}
          label="Output"
          direction="left"
          title="Show Output"
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
