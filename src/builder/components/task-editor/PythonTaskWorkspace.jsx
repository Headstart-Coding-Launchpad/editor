import { CodeEditor } from '../../../shared/CodeEditor'
import { CodeWorkspaceTabs, StageMetadataEditor } from './TaskEditorFields'
import TaskCheckResults, { TargetedStageOfferPreview } from './TaskCheckResults'
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
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null

  function updateStage(idx, updates) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? { ...s, ...updates } : s)
    onUpdate({ ...task, codeStages: updated })
  }

  function replaceStage(idx, nextStage) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? nextStage : s)
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
          unifiedStages
        />
        {isStageTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #e5e7eb', borderTop: 0, borderBottom: 0, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
            <input
              className="te-input"
              style={{ width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
              value={activeStage?.label ?? ''}
              onChange={e => updateStage(activeStageIndex, { label: e.target.value })}
              placeholder={`Stage ${activeStageIndex + 1}`}
            />
            <StageMetadataEditor
              stage={activeStage}
              onChange={nextStage => replaceStage(activeStageIndex, nextStage)}
            />
          </div>
        )}
        {isStageTab ? (
          <div className="te-python-editor">
            <CodeEditor
              value={activePythonCode}
              language="python"
              onChange={v => updateStage(activeStageIndex, { code: v })}
              style={{ borderRadius: '0 0 8px 8px' }}
            />
          </div>
        ) : (
          <div className="te-no-file">Add a Starter stage to begin authoring this task. Legacy starter and complete code remains available to existing lessons but is no longer edited here.</div>
        )}
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
          <TaskCheckResults task={task} lessonType="python" checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
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
          <TargetedStageOfferPreview task={task} lessonType="python" incorrectCheckResults={incorrectCheckResults} />
        </>
      )}
    </>
  )
}
