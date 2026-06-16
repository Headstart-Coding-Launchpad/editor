import React from 'react'
import PythonEditor from '../../app/components/PythonEditor'
import OutputPanel from '../../app/components/OutputPanel'
import { loadSavedCode } from '../../app/studentStorage'

export default function StudentWorkspace({
  task, cs, lessonId, identityId, viewingTaskId,
  isViewingPrev, isForcedTeacherLive,
  displayCode, displayOutput, displayRunStatus,
  displayCheckPassed, displayCheckAttempted, displaySelection,
}) {
  const savedCode = isViewingPrev ? loadSavedCode(lessonId, viewingTaskId, identityId) : null

  return (
    <>
      {!isViewingPrev && !isForcedTeacherLive && (
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
                  onClick={cs.running || cs.runningTests ? cs.handleStop : cs.handleRun}
                  disabled={!cs.running && !cs.runningTests && cs.pyodideStatus === 'loading'}
                >
                  {cs.running || cs.runningTests ? 'Stop' : cs.pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                </button>
                {task?.tests?.length > 0 && (
                  <button
                    className="btn-primary"
                    style={s.primaryBtn}
                    onClick={cs.runningTests ? undefined : cs.handleRunTests}
                    disabled={cs.running || cs.pyodideStatus === 'loading' || cs.runningTests}
                  >
                    {cs.runningTests ? 'Running tests…' : 'Run Tests'}
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
        code={isForcedTeacherLive ? displayCode : isViewingPrev ? (savedCode?.code ?? '') : cs.code}
        readOnly={isViewingPrev || isForcedTeacherLive}
        onChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleCodeChange}
        onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorSelection}
        onActivity={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorActivity}
        remoteSelection={isForcedTeacherLive ? displaySelection : null}
        pyodideStatus={cs.pyodideStatus}
      />
      {!isViewingPrev && !isForcedTeacherLive && (
        task?.interactionMode === 'submit' ? (
          <>
            {cs.runStatus === 'submitted' && !task?.check && (
              <div style={s.submitBanner}>Code submitted</div>
            )}
          </>
        ) : (
          <>
            <OutputPanel
              output={cs.output}
              runStatus={cs.runStatus}
              inputPrompt={cs.inputPrompt}
              onInputSubmit={cs.handleInputSubmit}
              checkPassed={cs.checkPassed}
              hasCheck={!!task?.check || task?.tests?.length > 0}
              running={cs.running || cs.runningTests}
            />
            {cs.testResults !== null && (
              <div style={s.testResultsPanel}>
                {cs.testResults.map((r, i) => (
                  <span key={r.id ?? i} style={{ ...s.testResultBadge, background: r.passed ? '#dcfce7' : '#fef3c7', color: r.passed ? '#15803d' : '#b45309' }}>
                    {r.passed ? '✓' : '✗'} {r.name || `Test ${i + 1}`}
                  </span>
                ))}
              </div>
            )}
          </>
        )
      )}
      {isForcedTeacherLive && (
        <OutputPanel
          output={displayOutput}
          runStatus={displayRunStatus}
          checkPassed={displayCheckPassed}
          hasCheck={!!task?.check}
          checkAttempted={displayCheckAttempted}
        />
      )}
      {isViewingPrev && (
        <OutputPanel
          output={savedCode?.output ?? ''}
          runStatus={savedCode?.runStatus ?? null}
          checkPassed={false}
          hasCheck={false}
          checkAttempted={false}
        />
      )}
    </>
  )
}

const s = {
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
  },
  testResultsPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
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
