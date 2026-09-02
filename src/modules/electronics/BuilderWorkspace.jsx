import React, { useEffect, useMemo, useState } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import {
  BOARD_SIZE_OPTIONS,
  COMPONENT_GROUPS,
  COMPONENT_LABELS,
  COMPONENT_TYPES,
  DEFAULT_AVAILABLE_COMPONENTS,
  DEFAULT_CIRCUIT,
  cloneCircuit,
  isMicrocontrollerSignalPin,
  makeNextGpioPinName,
  normalizeGpioPinName,
  normalizeAvailableComponents,
  normalizeMicrocontrollerPins,
  parseCircuit,
  pinRef,
} from './circuit'
import { CodeWorkspaceTabs, StageMetadataEditor } from '../../builder/components/task-editor/TaskEditorFields'
import { CodeEditor } from '../../shared/CodeEditor'
import { getStageRole } from '../../shared/taskUtils'
import { evaluateFeedbackCheckResults, evaluateSingleCheck, normalizeChecks } from '../checks'
import TaskCheckResults from '../../builder/components/task-editor/TaskCheckResults'

export default function BuilderWorkspace({
  task, onUpdate, codeTab, codeStages,
  handleCodeTabChange, handleAddStage, handleRemoveStage,
  resetToStarterBtn,
}) {
  const [checkResults, setCheckResults] = useState(null)
  const [incorrectCheckResults, setIncorrectCheckResults] = useState(null)

  // Editing the check (via electronics' CheckEditor) marks the task untested but doesn't
  // touch this component's state, so without this the pass/fail banner below would keep
  // showing results from before the edit.
  useEffect(() => {
    setCheckResults(null)
    setIncorrectCheckResults(null)
  }, [task.check])

  const stageMatch = codeTab?.match(/^stage_(\d+)$/)
  const activeStageIndex = stageMatch ? Number(stageMatch[1]) : null
  const activeStage = activeStageIndex !== null ? (codeStages?.[activeStageIndex] ?? null) : null
  const isSupportStage = activeStage != null && getStageRole(activeStage) === 'support'
  const activeCircuit = useMemo(() => {
    if (codeTab === 'complete') return parseCircuit(task.completeCircuit, task.starterCircuit ?? DEFAULT_CIRCUIT)
    if (stageMatch) return parseCircuit(codeStages?.[Number(stageMatch[1])]?.circuit, task.starterCircuit ?? DEFAULT_CIRCUIT)
    return parseCircuit(task.starterCircuit, DEFAULT_CIRCUIT)
  }, [codeTab, codeStages, task.completeCircuit, task.starterCircuit])
  const availableComponents = useMemo(() => normalizeAvailableComponents(task.availableComponents), [task.availableComponents])
  const activeMicrocontroller = activeCircuit.components.find(component => component.type === 'microcontroller') ?? null
  const microcontrollerPins = activeMicrocontroller ? normalizeMicrocontrollerPins(activeMicrocontroller.pins) : []
  const fixedMicrocontrollerPins = microcontrollerPins.filter(pin => !isMicrocontrollerSignalPin(pin))
  const gpioPins = microcontrollerPins.filter(isMicrocontrollerSignalPin)
  const activeBoardSize = useMemo(() => {
    const rows = Number(activeCircuit.board?.rows)
    const cols = Number(activeCircuit.board?.cols)
    return BOARD_SIZE_OPTIONS.find(option => option.rows === rows && option.cols === cols)?.id ?? 'custom'
  }, [activeCircuit.board?.cols, activeCircuit.board?.rows])

  function updateAvailableComponents(type, enabled) {
    const current = new Set(availableComponents)
    if (enabled) current.add(type)
    else current.delete(type)
    onUpdate({ ...task, availableComponents: COMPONENT_TYPES.filter(componentType => current.has(componentType)) })
  }

  function updateAvailableGroup(group, enabled) {
    const current = new Set(availableComponents)
    group.types.forEach(type => {
      if (enabled) current.add(type)
      else current.delete(type)
    })
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

  function replaceStage(idx, nextStage) {
    const stages = [...(task.codeStages ?? [])]
    stages[idx] = nextStage
    onUpdate({ ...task, codeStages: stages })
  }

  // Electronics has no Run action — evaluating checks against the currently-viewed tab's
  // circuit (mirroring Python/HTML's "Test checks") is the only way an author gets any
  // confidence a check will actually pass, and clears the Builder's "run the task to verify
  // it" warning for this type.
  function handleTestChecks() {
    const checksToEval = normalizeChecks(task.check)
    if (checksToEval.length === 0) return
    const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, '', { circuit: activeCircuit }) }))
    setCheckResults(results)
    setIncorrectCheckResults(null)
    onUpdate({ ...task, _checkTested: true })
    const feedbackResults = evaluateFeedbackCheckResults(task, '', { circuit: activeCircuit })
    if (feedbackResults.length > 0) setIncorrectCheckResults(feedbackResults)
  }

  function updateLegacyMicrocontrollerCode(code) {
    onUpdate({ ...task, microcontroller: { ...(task.microcontroller ?? {}), enabled: true, starterCode: code } })
  }

  function updateSupportCode(code) {
    if (activeStageIndex != null) replaceStage(activeStageIndex, { ...activeStage, code })
  }

  function updateBoardSize(sizeId) {
    const option = BOARD_SIZE_OPTIONS.find(item => item.id === sizeId)
    if (!option) return
    updateCircuit({
      ...activeCircuit,
      board: {
        ...(activeCircuit.board ?? {}),
        type: 'half-breadboard',
        rows: option.rows,
        cols: option.cols,
      },
    })
  }

  function updateMicrocontroller(nextComponent, nextWires = activeCircuit.wires, nextControls = activeCircuit.controls) {
    if (!activeMicrocontroller) return
    updateCircuit({
      ...activeCircuit,
      components: activeCircuit.components.map(component => component.id === activeMicrocontroller.id ? nextComponent : component),
      wires: nextWires,
      controls: nextControls,
    })
  }

  function addGpioPin() {
    if (!activeMicrocontroller) return
    const nextPin = makeNextGpioPinName(activeMicrocontroller.pins)
    const pins = normalizeMicrocontrollerPins([...(activeMicrocontroller.pins ?? []), nextPin])
    const control = activeCircuit.controls?.[activeMicrocontroller.id] ?? {}
    updateMicrocontroller(
      { ...activeMicrocontroller, pins },
      activeCircuit.wires,
      {
        ...(activeCircuit.controls ?? {}),
        [activeMicrocontroller.id]: {
          ...control,
          gpio: { ...(control.gpio ?? {}), [nextPin]: 0 },
        },
      },
    )
  }

  function renameGpioPin(oldPin, rawPin) {
    if (!activeMicrocontroller) return
    const nextPin = normalizeGpioPinName(rawPin)
    if (!nextPin || nextPin === oldPin) return
    const pins = normalizeMicrocontrollerPins(activeMicrocontroller.pins, [])
    if (pins.includes(nextPin)) return
    const oldRef = pinRef(activeMicrocontroller.id, oldPin)
    const nextRef = pinRef(activeMicrocontroller.id, nextPin)
    const nextWires = activeCircuit.wires.map(wire => ({
      ...wire,
      from: wire.from === oldRef ? nextRef : wire.from,
      to: wire.to === oldRef ? nextRef : wire.to,
    }))
    const control = activeCircuit.controls?.[activeMicrocontroller.id] ?? {}
    const gpio = { ...(control.gpio ?? {}) }
    if (Object.prototype.hasOwnProperty.call(gpio, oldPin)) {
      gpio[nextPin] = gpio[oldPin]
      delete gpio[oldPin]
    }
    updateMicrocontroller(
      { ...activeMicrocontroller, pins: pins.map(pin => pin === oldPin ? nextPin : pin) },
      nextWires,
      { ...(activeCircuit.controls ?? {}), [activeMicrocontroller.id]: { ...control, gpio } },
    )
  }

  function removeGpioPin(pin) {
    if (!activeMicrocontroller || gpioPins.length <= 1) return
    const ref = pinRef(activeMicrocontroller.id, pin)
    const pins = normalizeMicrocontrollerPins(activeMicrocontroller.pins, []).filter(item => item !== pin)
    const nextWires = activeCircuit.wires.filter(wire => wire.from !== ref && wire.to !== ref)
    const control = activeCircuit.controls?.[activeMicrocontroller.id] ?? {}
    const gpio = { ...(control.gpio ?? {}) }
    delete gpio[pin]
    updateMicrocontroller(
      { ...activeMicrocontroller, pins },
      nextWires,
      { ...(activeCircuit.controls ?? {}), [activeMicrocontroller.id]: { ...control, gpio } },
    )
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
        unifiedStages
      />
      {activeStage && (
        <div style={s.stageMetadataBar}>
          <span style={s.stageLabelText}>Stage label:</span>
          <input
            className="te-input"
            style={s.stageLabelInput}
            value={activeStage.label ?? ''}
            onChange={event => replaceStage(activeStageIndex, { ...activeStage, label: event.target.value })}
            placeholder={`Stage ${activeStageIndex + 1}`}
          />
          <StageMetadataEditor
            stage={activeStage}
            onChange={nextStage => replaceStage(activeStageIndex, nextStage)}
          />
        </div>
      )}
      {isSupportStage ? (
        <CodeEditor
          value={activeStage.code ?? ''}
          language="python"
          onChange={updateSupportCode}
          style={{ minHeight: 360, borderRadius: '0 0 8px 8px' }}
        />
      ) : <>
      <div style={s.workspace}>
        <ElectronicsWorkspace
          circuit={activeCircuit}
          onChange={updateCircuit}
          availableComponents={availableComponents}
          setupMode
          showCodeTab={task?.microcontroller?.enabled === true}
          code={task?.microcontroller?.starterCode ?? ''}
          onCodeChange={updateLegacyMicrocontrollerCode}
          title={codeTab === 'complete' ? 'Complete board' : codeTab?.startsWith('stage_') ? 'Stage board' : 'Starter board'}
        />
      </div>
      <label style={s.boardSizeField}>
        <span style={s.boardSizeLabel}>Breadboard size</span>
        <select value={activeBoardSize} onChange={event => updateBoardSize(event.target.value)} style={s.boardSizeSelect}>
          {activeBoardSize === 'custom' && <option value="custom">Custom ({activeCircuit.board?.rows ?? '?'} x {activeCircuit.board?.cols ?? '?'})</option>}
          {BOARD_SIZE_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>{option.label} ({option.rows} x {option.cols})</option>
          ))}
        </select>
      </label>
      {activeMicrocontroller && (
        <section style={s.gpioPanel}>
          <div style={s.gpioPanelHeader}>
            <div>
              <h4 style={s.gpioTitle}>Micro Controller GPIO</h4>
              <div style={s.fixedPins}>
                {fixedMicrocontrollerPins.map(pin => <span key={pin} style={s.fixedPin}>{pin}</span>)}
              </div>
            </div>
            <button type="button" className="btn-primary" style={s.addGpioButton} onClick={addGpioPin}>
              Add GPIO pin
            </button>
          </div>
          <div style={s.gpioRows}>
            {gpioPins.map(pin => (
              <div key={pin} style={s.gpioRow}>
                <input
                  defaultValue={pin}
                  onBlur={event => renameGpioPin(pin, event.target.value)}
                  style={s.gpioInput}
                  aria-label={`GPIO pin ${pin}`}
                />
                <button
                  type="button"
                  style={s.removeGpioButton}
                  disabled={gpioPins.length <= 1}
                  onClick={() => removeGpioPin(pin)}
                  aria-label={`Remove ${pin}`}
                  title={`Remove ${pin}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <div style={s.componentPicker}>
        <div style={s.componentPickerHeader}>
          <span style={s.componentPickerTitle}>Available components</span>
          <div style={s.pickerActions}>
            <button type="button" className="btn-ghost" style={s.smallButton} onClick={resetAvailableComponents}>All</button>
            <button type="button" className="btn-ghost" style={s.smallButton} onClick={clearAvailableComponents}>None</button>
          </div>
        </div>
        <div style={s.groupOptions} aria-label="Component groups">
          {COMPONENT_GROUPS.map(group => {
            const enabledCount = group.types.filter(type => availableComponents.includes(type)).length
            const allEnabled = enabledCount === group.types.length
            const enabled = enabledCount > 0
            return (
              <button
                key={group.id}
                type="button"
                style={{ ...s.groupOption, ...(allEnabled ? s.groupOptionOn : enabled ? s.groupOptionMixed : s.groupOptionOff) }}
                onClick={() => updateAvailableGroup(group, !allEnabled)}
                aria-pressed={allEnabled ? true : enabled ? 'mixed' : false}
                title={group.types.map(type => COMPONENT_LABELS[type] ?? type).join(', ')}
              >
                <span style={s.optionName}>{group.label}</span>
                <span style={{ ...s.optionBadge, ...(allEnabled ? s.optionBadgeOn : enabled ? s.optionBadgeMixed : s.optionBadgeOff) }}>
                  {allEnabled ? 'On' : enabled ? 'Some' : 'Off'}
                </span>
              </button>
            )
          })}
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
      <p style={s.microHint}>Add a Micro Controller component to enable the MicroPython tab. Select the component to edit its GPIO pins.</p>
      </>}
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
      <TaskCheckResults task={task} lessonType="electronics" checkResults={checkResults} incorrectCheckResults={incorrectCheckResults} />
    </div>
  )
}

// Semantic colours from docs/UI_STYLE_GUIDE.md; the rest of this file's chrome goes
// through the --colour-*/--ui-* tokens.
const MUTED = '#6b7280'
const DANGER_TEXT = '#991b1b'
const DANGER_BORDER = '#fecaca'
const INFO_TEXT = '#1e40af'
const INFO_BORDER = '#93c5fd'
const INFO_SURFACE = '#eff6ff'
const SUCCESS_TEXT = '#166534'
const SUCCESS_SURFACE = '#dcfce7'
const WARNING_TEXT = '#854d0e'
const WARNING_SURFACE = '#fef9c3'
const WARNING_BORDER = '#d97706'

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 520 },
  workspace: { height: 520, display: 'flex', minHeight: 0, border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius)', overflow: 'hidden' },
  boardSizeField: { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: MUTED },
  boardSizeLabel: { fontWeight: 700, color: 'var(--colour-text)' },
  boardSizeSelect: { border: '1px solid var(--ui-border-strong)', borderRadius: 'var(--ui-radius-sm)', background: 'var(--ui-surface)', color: 'var(--colour-text)', fontSize: 13, padding: '6px 8px' },
  gpioPanel: { border: '1px solid ' + INFO_BORDER, borderRadius: 'var(--ui-radius)', padding: 10, background: INFO_SURFACE, display: 'flex', flexDirection: 'column', gap: 9, fontFamily: 'var(--font-body)' },
  gpioPanelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  gpioTitle: { margin: '0 0 6px', fontSize: 14, color: INFO_TEXT },
  fixedPins: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  fixedPin: { border: '1px solid ' + INFO_BORDER, borderRadius: 5, background: 'var(--ui-surface)', color: INFO_TEXT, fontFamily: 'var(--font-code)', fontSize: 12, fontWeight: 700, padding: '3px 7px' },
  addGpioButton: { whiteSpace: 'nowrap', padding: '7px 12px', fontSize: 13 },
  gpioRows: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 },
  gpioRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 6, alignItems: 'center' },
  gpioInput: { minWidth: 0, border: '1px solid ' + INFO_BORDER, borderRadius: 'var(--ui-radius-sm)', background: 'var(--ui-surface)', color: 'var(--colour-text)', fontSize: 13, padding: '7px 8px', fontFamily: 'var(--font-code)' },
  removeGpioButton: { border: '1px solid ' + DANGER_BORDER, borderRadius: 'var(--ui-radius-sm)', background: 'var(--ui-surface)', color: DANGER_TEXT, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 8px' },
  componentPicker: { border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius)', padding: 10, background: 'var(--ui-surface)', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-body)' },
  componentPickerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  componentPickerTitle: { fontWeight: 700, color: 'var(--colour-text)', fontSize: 13 },
  pickerActions: { display: 'flex', alignItems: 'center', gap: 6 },
  groupOptions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 },
  groupOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--ui-border-strong)', borderRadius: 'var(--ui-radius-sm)', padding: '8px 9px', background: 'var(--ui-surface)', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', textAlign: 'left' },
  groupOptionOn: { borderColor: 'var(--colour-primary)', background: 'var(--ui-surface-tint)' },
  groupOptionMixed: { borderColor: WARNING_BORDER, background: WARNING_SURFACE },
  groupOptionOff: { opacity: 0.72 },
  componentOptions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 },
  componentOption: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--ui-border-strong)', borderRadius: 'var(--ui-radius-sm)', padding: '8px 9px', background: 'var(--ui-surface)', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', textAlign: 'left' },
  componentOptionOn: { borderColor: 'var(--colour-primary)', background: 'var(--ui-surface-tint)' },
  componentOptionOff: { opacity: 0.72 },
  optionName: { fontWeight: 650, fontSize: 13 },
  optionBadge: { borderRadius: 999, padding: '2px 7px', fontSize: 11, fontWeight: 700 },
  optionBadgeOn: { background: SUCCESS_SURFACE, color: SUCCESS_TEXT },
  optionBadgeMixed: { background: WARNING_SURFACE, color: WARNING_TEXT },
  optionBadgeOff: { background: 'var(--ui-surface-soft)', color: MUTED },
  smallButton: { padding: '4px 8px', fontSize: 12 },
  microHint: { margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: MUTED },
  stageMetadataBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--ui-surface-tint)', border: '1px solid var(--ui-border)', borderTop: 0, borderBottom: 0, flexWrap: 'wrap' },
  stageLabelText: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: MUTED, fontWeight: 600 },
  stageLabelInput: { width: 200, padding: '4px 8px', fontSize: '0.82rem' },
}
