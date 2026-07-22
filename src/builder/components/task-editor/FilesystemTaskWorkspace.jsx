import { CodeWorkspaceTabs, StageMetadataEditor } from './TaskEditorFields'
import { FsTreeEditor } from '../../../modules/filesystem/filesystemEditors'
import { DEFAULT_FS } from '../../../modules/filesystem/filesystem'

export default function FilesystemTaskWorkspace({
  task, lesson, onUpdate,
  codeTab, codeStages,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
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
    </div>
  )
}
