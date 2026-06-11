import { CodeEditor } from '../../../shared/CodeEditor'
import { CodeWorkspaceTabs } from './TaskEditorFields'
import TaskCheckResults from './TaskCheckResults'
import TaskRunControls from './TaskRunControls'
import TaskTestResults from './TaskTestResults'

export default function PythonTaskWorkspace({
  task, onUpdate,
  codeTab, codeStages, activePythonCode,
  running, runningTests, pyodideStatus, inputPrompt, output, runStatus,
  checkResults, incorrectCheckResults, testResults,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
  handleRun, handleStop, handleRunTests, handleTestChecks, handleInputSubmit,
  resetToStarterBtn,
}) {
  const isCompleteTab = codeTab === 'complete'
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function updateStage(idx, updates) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? { ...s, ...updates } : s)
    onUpdate({ ...task, codeStages: updated })
  }

  return (
    <>
      <div className="te-code-workspace-stack">
        <CodeWorkspaceTabs
          activeTab={codeTab}
          onChange={handleCodeTabChange}
          stages={codeStages}
          onAddStage={handleAddStage}
          onRemoveStage={handleRemoveStage}
          rightAction={resetToStarterBtn}
        />
        {isStageTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #e5e7eb', borderTop: 0, borderBottom: 0 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
            <input
              className="te-input"
              style={{ width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
              value={activeStage?.label ?? ''}
              onChange={e => updateStage(activeStageIndex, { label: e.target.value })}
              placeholder={`Stage ${activeStageIndex + 1}`}
            />
          </div>
        )}
        <div className="te-python-editor">
          <CodeEditor
            value={activePythonCode}
            language="python"
            onChange={v => isCompleteTab ? set('completeCode', v) : isStageTab ? updateStage(activeStageIndex, { code: v }) : set('starterCode', v)}
            style={{ borderRadius: '0 0 8px 8px' }}
          />
        </div>
      </div>

      {task.interactionMode === 'submit' ? (
        <>
          <div className="te-run-row">
            <button
              className="btn-primary"
              onClick={handleTestChecks}
              disabled={!task.check}
              style={{ padding: '10px 28px', fontSize: 15 }}
            >
              Test checks
            </button>
            {!task.check && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af' }}>
                No checks configured — add a check to test.
              </span>
            )}
          </div>
          <TaskCheckResults checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
        </>
      ) : (
        <>
          <TaskRunControls
            running={running}
            runningTests={runningTests}
            pyodideStatus={pyodideStatus}
            hasTests={task.tests?.length > 0}
            onRun={handleRun}
            onStop={handleStop}
            onRunTests={handleRunTests}
          />
          <TaskTestResults
            output={output}
            runStatus={runStatus}
            running={running || runningTests}
            inputPrompt={inputPrompt}
            onInputSubmit={handleInputSubmit}
            checkResults={checkResults}
            incorrectCheckResults={incorrectCheckResults}
            testResults={testResults}
          />
        </>
      )}
    </>
  )
}
