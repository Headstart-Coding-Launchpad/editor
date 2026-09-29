import { CodeWorkspaceTabs } from '../../builder/components/task-editor/TaskEditorFields'

// The Builder's editor for a Template Module task's starting work, rendered by TaskEditor with the
// shared tab state: `codeTab` is 'starter', 'complete' or 'stage_<n>', and `activePythonCode` is
// the text of that tab (the Builder resolves it from starterCode / completeCode / codeStages).
//
// TODO(new-module): replace the textarea with the module's real authoring surface (and a
// preview if the work can run). Write only the fields the definition reads: starterCode,
// completeCode and codeStages[n].code in this scaffold.
export default function BuilderWorkspace({
  task,
  onUpdate,
  codeTab,
  codeStages,
  activePythonCode,
  handleCodeTabChange,
  handleAddStage,
  handleRemoveStage,
  resetToStarterBtn,
}) {
  const match = /^stage_(\d+)$/.exec(codeTab ?? '')
  const stageIndex = match ? Number(match[1]) : null

  function change(text) {
    if (codeTab === 'complete') onUpdate({ ...task, completeCode: text })
    else if (stageIndex != null) {
      onUpdate({
        ...task,
        codeStages: (task.codeStages ?? []).map((stage, index) =>
          index === stageIndex ? { ...stage, code: text } : stage
        ),
      })
    } else onUpdate({ ...task, starterCode: text })
  }

  return (
    <div className="te-code-workspace-stack" style={s.wrap}>
      <CodeWorkspaceTabs
        activeTab={codeTab}
        onChange={handleCodeTabChange}
        starterLabel="Starter"
        testLabel="Complete"
        stages={codeStages ?? []}
        onAddStage={handleAddStage}
        onRemoveStage={handleRemoveStage}
        rightAction={resetToStarterBtn}
      />
      <textarea
        aria-label="Template Module starting work"
        className="te-input"
        style={s.textarea}
        value={activePythonCode ?? ''}
        spellCheck={false}
        onChange={(event) => change(event.target.value)}
      />
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', minHeight: 300 },
  textarea: {
    flex: 1,
    minHeight: 260,
    fontFamily: 'var(--font-mono, monospace)',
    borderRadius: '0 0 8px 8px',
    resize: 'vertical',
  },
}
