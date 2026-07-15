import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { COMPONENT_LABELS, COMPONENT_TYPES, DEFAULT_AVAILABLE_COMPONENTS, DEFAULT_CIRCUIT, cloneCircuit, normalizeAvailableComponents, parseCircuit } from './circuit'
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
  const availableComponents = useMemo(() => normalizeAvailableComponents(task.availableComponents), [task.availableComponents])

  function updateAvailableComponents(type, enabled) {
    const current = new Set(availableComponents)
    if (enabled) current.add(type)
    else current.delete(type)
    onUpdate({ ...task, availableComponents: COMPONENT_TYPES.filter(componentType => current.has(componentType)) })
  }

  function resetAvailableComponents() {
    onUpdate({ ...task, availableComponents: [...DEFAULT_AVAILABLE_COMPONENTS] })
  }

  function clearAvailableComponents() {
    onUpdate({ ...task, availableComponents: [] })
  }

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
          availableComponents={availableComponents}
          setupMode
          showCodeTab={task?.microcontroller?.enabled === true}
          code={task?.microcontroller?.starterCode ?? ''}
          onCodeChange={code => onUpdate({ ...task, microcontroller: { ...(task.microcontroller ?? {}), enabled: true, starterCode: code } })}
          title={codeTab === 'complete' ? 'Complete board' : codeTab?.startsWith('stage_') ? 'Stage board' : 'Starter board'}
        />
      </div>
      <div style={s.componentPicker}>
        <div style={s.componentPickerHeader}>
          <span style={s.componentPickerTitle}>Available components</span>
          <div style={s.pickerActions}>
            <button type="button" className="btn-ghost" style={s.smallButton} onClick={resetAvailableComponents}>All</button>
            <button type="button" className="btn-ghost" style={s.smallButton} onClick={clearAvailableComponents}>None</button>
          </div>
        </div>
        <div style={s.componentOptions}>
          {COMPONENT_TYPES.map(type => {
            const enabled = availableComponents.includes(type)
            return (
              <button
                key={type}
                type="button"
                style={{ ...s.componentOption, ...(enabled ? s.componentOptionOn : s.componentOptionOff) }}
                onClick={() => updateAvailableComponents(type, !enabled)}
                aria-pressed={enabled}
              >
                <span style={s.optionName}>{COMPONENT_LABELS[type] ?? type}</span>
                <span style={{ ...s.optionBadge, ...(enabled ? s.optionBadgeOn : s.optionBadgeOff) }}>
                  {enabled ? 'On' : 'Off'}
                </span>
              </button>
            )
          })}
        </div>
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
  componentPicker: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-body)' },
  componentPickerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  componentPickerTitle: { fontWeight: 700, color: '#334155', fontSize: 13 },
  pickerActions: { display: 'flex', alignItems: 'center', gap: 6 },
  componentOptions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 },
  componentOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #cbd5e1', borderRadius: 7, padding: '8px 9px', background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)', color: '#334155', textAlign: 'left' },
  componentOptionOn: { borderColor: '#7c3aed', background: '#f5f3ff' },
  componentOptionOff: { opacity: 0.72 },
  optionName: { fontWeight: 650, fontSize: 13 },
  optionBadge: { borderRadius: 999, padding: '2px 7px', fontSize: 11, fontWeight: 700 },
  optionBadgeOn: { background: '#ede9fe', color: '#5b21b6' },
  optionBadgeOff: { background: '#f1f5f9', color: '#64748b' },
  smallButton: { padding: '4px 8px', fontSize: 12 },
  microToggle: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: '#475569' },
}
