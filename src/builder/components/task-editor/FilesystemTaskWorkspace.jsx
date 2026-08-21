import { useEffect, useState } from 'react'
import { CodeWorkspaceTabs, StageMetadataEditor } from './TaskEditorFields'
import { FsTreeEditor } from '../../../modules/filesystem/filesystemEditors'
import { DEFAULT_FS } from '../../../modules/filesystem/filesystem'
import { evaluateFeedbackCheckResults, evaluateSingleCheck, normalizeChecks } from '../../../modules/checks'
import TaskCheckResults from './TaskCheckResults'

export default function FilesystemTaskWorkspace({
  task, lesson, onUpdate,
  codeTab, codeStages,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
  resetToStarterBtn,
}) {
  const [checkResults, setCheckResults] = useState(null)
  const [incorrectCheckResults, setIncorrectCheckResults] = useState(null)

  // Editing the check (via filesystem's CheckEditor) marks the task untested but doesn't
  // touch this component's state, so without this the pass/fail banner below would keep
  // showing results from before the edit.
  useEffect(() => {
    setCheckResults(null)
    setIncorrectCheckResults(null)
  }, [task.check])

  const isCompleteTab = codeTab === 'complete'
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null
  const activeFs = isStageTab ? activeStage?.fs : isCompleteTab ? task.completeFs : task.starterFs

  // Filesystem has no Run action — evaluating checks against the currently-viewed tab's
  // filesystem (mirroring Python/HTML's "Test checks", which uses whatever's in the active
  // tab too) is the only way an author gets any confidence a check will actually pass,
  // and is also what clears the Builder's "run the task to verify it" warning for this type.
  function handleTestChecks() {
    const checksToEval = normalizeChecks(task.check)
    if (checksToEval.length === 0) return
    const fs = activeFs ?? DEFAULT_FS
    const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, '', { fs }) }))
    setCheckResults(results)
    setIncorrectCheckResults(null)
    onUpdate({ ...task, _checkTested: true })
    const feedbackResults = evaluateFeedbackCheckResults(task, '', { fs })
    if (feedbackResults.length > 0) setIncorrectCheckResults(feedbackResults)
  }

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

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

  function handleCopyStarterToComplete() {
    if (!window.confirm('Replace the complete filesystem with the starter filesystem?')) return
    onUpdate({ ...task, completeFs: task.starterFs ?? DEFAULT_FS })
  }

  return (
    <div className="te-code-workspace-stack">
      <CodeWorkspaceTabs
        activeTab={codeTab}
        onChange={handleCodeTabChange}
        stages={codeStages}
        onAddStage={handleAddStage}
        onRemoveStage={handleRemoveStage}
        rightAction={resetToStarterBtn}
        starterLabel="Starter filesystem"
        testLabel="Complete filesystem"
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
      <div style={{ padding: '12px 10px', overflowY: 'auto', flex: 1 }}>
        {isStageTab ? (
          <FsTreeEditor
            label={`Stage filesystem: ${activeStage?.label ?? `Stage ${activeStageIndex + 1}`}`}
            fs={activeStage?.fs}
            onFsChange={newFs => updateStage(activeStageIndex, { fs: newFs })}
            storageAssets={lesson.storageAssets ?? []}
          />
        ) : isCompleteTab ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                type="button"
                className="btn-ghost te-secondary-btn"
                onClick={handleCopyStarterToComplete}
                disabled={!task.starterFs}
                title="Copy the starter filesystem into the complete filesystem"
              >
                ↓ Copy starter to complete
              </button>
            </div>
            <FsTreeEditor
              label="Complete filesystem (reference solution)"
              fs={task.completeFs}
              onFsChange={newFs => onUpdate({ ...task, completeFs: newFs })}
              storageAssets={lesson.storageAssets ?? []}
            />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FsTreeEditor
              label="Starter filesystem"
              fs={task.starterFs}
              onFsChange={newFs => onUpdate({ ...task, starterFs: newFs })}
              storageAssets={lesson.storageAssets ?? []}
            />
            <div>
              <label style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Starts in (optional)
                <input
                  className="te-input"
                  value={task.startsInDir ?? ''}
                  onChange={e => set('startsInDir', e.target.value || undefined)}
                  placeholder="e.g. /Documents/"
                  style={{ fontFamily: 'var(--font-code)' }}
                />
              </label>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', margin: '4px 0 0' }}>
                Directory the student's explorer opens in. Leave blank to start at the root.
              </p>
            </div>
          </div>
        )}
      </div>
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
      <TaskCheckResults task={task} lessonType="filesystem" checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
    </div>
  )
}
