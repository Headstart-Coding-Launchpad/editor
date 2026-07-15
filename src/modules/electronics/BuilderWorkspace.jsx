import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, cloneCircuit, parseCircuit, serializeCircuit } from './circuit'
import { CodeWorkspaceTabs } from '../../builder/components/task-editor/TaskEditorFields'

export default function BuilderWorkspace({
  task, onUpdate, codeTab, codeStages,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
  resetToStarterBtn,
}) {
  const activeCircuit = useMemo(() => {
    if (codeTab === 'complete') return parseCircuit(task.completeCircuit, task.starterCircuit ?? DEFAULT_CIRCUIT)
    const stageMatch = codeTab?.match(/^stage_(\d+)$/)
    if (stageMatch) return parseCircuit(codeStages?.[Number(stageMatch[1])]?.circuit, task.starterCircuit ?? DEFAULT_CIRCUIT)
    return parseCircuit(task.starterCircuit, DEFAULT_CIRCUIT)
  }, [codeTab, codeStages, task.completeCircuit, task.starterCircuit])

  function updateCircuit(nextCircuit) {
    const circuit = cloneCircuit(nextCircuit)
    if (codeTab === 'complete') {
      onUpdate({ ...task, completeCircuit: circuit })
      return
    }
    const stageMatch = codeTab?.match(/^stage_(\d+)$/)
    if (stageMatch) {
      const idx = Number(stageMatch[1])
      const stages = [...(task.codeStages ?? [])]
      stages[idx] = { ...(stages[idx] ?? {}), circuit }
      onUpdate({ ...task, codeStages: stages })
      return
    }
    onUpdate({ ...task, starterCircuit: circuit })
  }

  return (
    <div style={s.wrap}>
      <CodeWorkspaceTabs
        activeTab={codeTab}
        onChange={handleCodeTabChange}
        starterLabel="Starter board"
        testLabel="Complete board"
        stages={codeStages}
        onAddStage={handleAddStage}
        onRemoveStage={handleRemoveStage}
        rightAction={resetToStarterBtn}
      />
      <div style={s.workspace}>
        <ElectronicsWorkspace
          circuit={activeCircuit}
          onChange={updateCircuit}
          showCodeTab={task?.microcontroller?.enabled === true}
          code={task?.microcontroller?.starterCode ?? ''}
          onCodeChange={code => onUpdate({ ...task, microcontroller: { ...(task.microcontroller ?? {}), enabled: true, starterCode: code } })}
          title={codeTab === 'complete' ? 'Complete board' : codeTab?.startsWith('stage_') ? 'Stage board' : 'Starter board'}
        />
      </div>
      <label style={s.microToggle}>
        <input
          type="checkbox"
          checked={task?.microcontroller?.enabled === true}
          onChange={e => onUpdate({ ...task, microcontroller: { ...(task.microcontroller ?? {}), enabled: e.target.checked } })}
        />
        Enable future MicroPython code tab for this task
      </label>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 520 },
  workspace: { height: 520, display: 'flex', minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  microToggle: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: '#475569' },
}
