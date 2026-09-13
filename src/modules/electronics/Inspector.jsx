// The right-hand panel: what is selected, what it is doing electrically, and the
// controls for changing it. Extracted from ElectronicsWorkspace.jsx unchanged - the
// handlers it calls arrive bundled as `actions` rather than as ten separate props.
import React from 'react'
import {
  BATTERY_VOLTAGE_OPTIONS,
  COMPONENT_DESCRIPTIONS,
  LED_COLOR_OPTIONS,
  RESISTOR_OPTIONS,
  WIRE_COLORS,
  getComponentResistanceOhms,
  getComponentState,
  isMicrocontrollerSignalPin,
  normalizeMicrocontrollerPins,
} from './circuit'
import { ComponentStateSummary } from './ComponentArt.jsx'
import { formatCurrent, formatVoltage } from './format'
import { s } from './workspaceStyles'

const SENSOR_KIND_OPTIONS = ['light', 'temperature', 'distance']

export default function Inspector({
  circuit,
  selected,
  selectedWire,
  selectedWireState,
  selectedStructureLocked,
  setupMode,
  readOnly,
  actions,
}) {
  const microcontrollerPins =
    selected?.type === 'microcontroller' ? normalizeMicrocontrollerPins(selected.pins) : []
  const selectedSupplyPins = microcontrollerPins.filter((pin) => !isMicrocontrollerSignalPin(pin))
  const selectedGpioPins = microcontrollerPins.filter(isMicrocontrollerSignalPin)

  return (
    <div style={s.inspector}>
      {selectedWire ? (
        <>
          <h3 style={s.inspectorTitle}>Wire</h3>
          <div style={s.wireDetails}>
            <span>{selectedWire.from}</span>
            <span>{selectedWire.to}</span>
          </div>
          {selectedWireState && (
            <dl style={s.stateList}>
              <dt style={s.stateTerm}>Voltage</dt>
              <dd style={s.stateValue}>{formatVoltage(selectedWireState.voltage)}</dd>
              <dt style={s.stateTerm}>Current</dt>
              <dd style={s.stateValue}>{formatCurrent(selectedWireState.currentMa)}</dd>
              <dt style={s.stateTerm}>Drop</dt>
              <dd style={s.stateValue}>{formatVoltage(selectedWireState.voltageDrop)}</dd>
              <dt style={s.stateTerm}>Direction</dt>
              <dd style={s.stateValue}>
                {selectedWireState.direction === 'reverse' ? 'reverse' : 'forward'}
              </dd>
            </dl>
          )}
          {setupMode && (
            <label style={s.toggle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={selectedWire.locked === true}
                onChange={(event) => actions.updateSelectedWireLocked(event.target.checked)}
              />
              Fixed for students
            </label>
          )}
          <label style={s.wireColorField}>
            <span style={s.wireColorLabel}>Wire colour</span>
            <select
              disabled={readOnly || (selectedWire.locked && !setupMode)}
              value={selectedWire.color ?? '#ef4444'}
              onChange={(event) => actions.updateSelectedWireColor(event.target.value)}
              style={s.wireColorSelect}
            >
              {WIRE_COLORS.filter((color) => color.value !== 'auto').map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={readOnly || (selectedWire.locked && !setupMode)}
            className="btn-danger"
            style={s.removeBtn}
            onClick={actions.removeSelected}
          >
            Delete wire
          </button>
        </>
      ) : selected ? (
        <>
          <h3 style={s.inspectorTitle}>{selected.label}</h3>
          {COMPONENT_DESCRIPTIONS[selected.type] && (
            <p style={s.componentDescription}>{COMPONENT_DESCRIPTIONS[selected.type]}</p>
          )}
          {setupMode && (
            <>
              <label style={s.field}>
                <span style={s.fieldLabel}>Label</span>
                <input
                  disabled={readOnly}
                  value={selected.label ?? ''}
                  onChange={(event) =>
                    actions.updateSelectedComponent({ label: event.target.value })
                  }
                  style={s.textInput}
                />
              </label>
              <label style={s.toggle}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={selected.locked === true}
                  onChange={(event) =>
                    actions.updateSelectedComponent({ locked: event.target.checked })
                  }
                />
                Fixed for students
              </label>
            </>
          )}
          <ComponentStateSummary
            component={selected}
            state={getComponentState(circuit, selected.id)}
          />
          {/* A fixed part cannot be rotated or deleted by a student, so the controls
              are left out rather than shown greyed. Its runtime controls stay - a
              fixed switch is still meant to be flipped. */}
          {!selectedStructureLocked && (
            <button
              disabled={readOnly}
              className="btn-ghost-outline"
              style={s.rotateBtn}
              onClick={actions.rotateSelectedComponent}
            >
              Rotate 90 deg
            </button>
          )}
          {selected.type === 'resistor' && (
            <label style={s.field}>
              <span style={s.fieldLabel}>Resistance</span>
              <select
                disabled={readOnly || selectedStructureLocked}
                value={getComponentResistanceOhms(selected)}
                onChange={(event) =>
                  actions.updateSelectedComponentProps({
                    resistanceOhms: Number(event.target.value),
                  })
                }
                style={s.wireColorSelect}
              >
                {RESISTOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected.type === 'led' && (
            <label style={s.field}>
              <span style={s.fieldLabel}>LED colour</span>
              <select
                disabled={readOnly || selectedStructureLocked}
                value={selected.props?.color ?? 'red'}
                onChange={(event) =>
                  actions.updateSelectedComponentProps({ color: event.target.value })
                }
                style={s.wireColorSelect}
              >
                {LED_COLOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected.type === 'battery' && (
            <label style={s.field}>
              <span style={s.fieldLabel}>Voltage</span>
              <select
                disabled={readOnly || selectedStructureLocked}
                value={Number(selected.props?.voltage ?? 5)}
                onChange={(event) =>
                  actions.updateSelectedComponentProps({ voltage: Number(event.target.value) })
                }
                style={s.wireColorSelect}
              >
                {BATTERY_VOLTAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected.type === 'slide_switch' && (
            <label style={s.toggle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={circuit.controls[selected.id]?.closed === true}
                onChange={(e) => actions.updateControlFor(selected.id, 'closed', e.target.checked)}
              />{' '}
              Closed
            </label>
          )}
          {selected.type === 'push_button' && (
            <label style={s.toggle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={circuit.controls[selected.id]?.pressed === true}
                onChange={(e) => actions.updateControlFor(selected.id, 'pressed', e.target.checked)}
              />{' '}
              Pressed
            </label>
          )}
          {selected.type === 'potentiometer' && (
            <label style={s.range}>
              Value{' '}
              <input
                type="range"
                disabled={readOnly}
                min="0"
                max="100"
                value={circuit.controls[selected.id]?.value ?? 50}
                onChange={(e) =>
                  actions.updateControlFor(selected.id, 'value', Number(e.target.value))
                }
              />
            </label>
          )}
          {selected.type === 'transistor' && (
            <label style={s.toggle}>
              <input
                type="checkbox"
                disabled={readOnly}
                checked={circuit.controls[selected.id]?.baseHigh === true}
                onChange={(e) =>
                  actions.updateControlFor(selected.id, 'baseHigh', e.target.checked)
                }
              />{' '}
              Base signal high
            </label>
          )}
          {selected.type === 'servo_motor' && (
            <label style={s.range}>
              Angle{' '}
              <input
                type="range"
                disabled={readOnly}
                min="0"
                max="180"
                value={circuit.controls[selected.id]?.angle ?? selected.props?.angle ?? 90}
                onChange={(e) =>
                  actions.updateControlFor(selected.id, 'angle', Number(e.target.value))
                }
              />
            </label>
          )}
          {selected.type === 'sensor' && (
            <>
              {setupMode && (
                <label style={s.field}>
                  <span style={s.fieldLabel}>Sensor type</span>
                  <select
                    disabled={readOnly || selectedStructureLocked}
                    value={selected.props?.kind ?? 'light'}
                    onChange={(event) =>
                      actions.updateSelectedComponentProps({ kind: event.target.value })
                    }
                    style={s.wireColorSelect}
                  >
                    {SENSOR_KIND_OPTIONS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label style={s.range}>
                Reading{' '}
                <input
                  type="range"
                  disabled={readOnly}
                  min="0"
                  max="100"
                  value={circuit.controls[selected.id]?.value ?? selected.props?.value ?? 50}
                  onChange={(e) =>
                    actions.updateControlFor(selected.id, 'value', Number(e.target.value))
                  }
                />
              </label>
            </>
          )}
          {selected.type === 'microcontroller' && (
            <div style={s.gpioEditor}>
              <div style={s.gpioPowerPins}>
                {selectedSupplyPins.map((pin) => (
                  <span key={pin} style={s.gpioPowerPin}>
                    {pin}
                  </span>
                ))}
              </div>
              <div style={s.gpioHeader}>
                <span style={s.fieldLabel}>Signal pins</span>
                {setupMode && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={s.smallInspectorBtn}
                    disabled={readOnly || selectedStructureLocked}
                    onClick={actions.addGpioPin}
                  >
                    Add pin
                  </button>
                )}
              </div>
              {/* Only setup mode can rename a pin, so only setup mode gets text
                  boxes. Students were shown disabled inputs that looked editable;
                  they read the pin names as the labels they are. */}
              {setupMode ? (
                <div style={s.gpioList}>
                  {selectedGpioPins.map((pin) => (
                    <div key={pin} style={s.gpioRow}>
                      <input
                        disabled={readOnly}
                        defaultValue={pin}
                        onBlur={(event) => actions.renameGpioPin(pin, event.target.value)}
                        style={s.gpioInput}
                      />
                      <button
                        type="button"
                        style={s.gpioRemove}
                        disabled={readOnly || selectedGpioPins.length <= 1}
                        onClick={() => actions.removeGpioPin(pin)}
                        title={`Remove ${pin}`}
                        aria-label={`Remove ${pin}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={s.gpioPowerPins}>
                  {selectedGpioPins.map((pin) => (
                    <span key={pin} style={s.gpioPowerPin}>
                      {pin}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!selectedStructureLocked && (
            <button
              disabled={readOnly}
              className="btn-danger"
              style={s.removeBtn}
              onClick={actions.removeSelected}
            >
              Delete part
            </button>
          )}
        </>
      ) : (
        <p style={s.emptySelection}>No selection</p>
      )}
    </div>
  )
}
