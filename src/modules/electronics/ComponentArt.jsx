// How each part is drawn: the palette glyphs, the part on the board (including its
// live state and its on-canvas controls), and the inspector's state readout. These are
// pictures of real components, so their colours stay literal rather than tokenised.
// Extracted from ElectronicsWorkspace.jsx unchanged.
import React from 'react'
import { LED_COLOR_OPTIONS, getComponentResistanceOhms, normalizeMicrocontrollerPins } from './circuit'
import { normalizeRotation } from './boardGeometry'
import { formatCurrent, formatResistance, formatVoltage } from './format'
import { s } from './workspaceStyles'

export function ComponentStateSummary({ component, state }) {
  const rows = []
  if (component.type === 'battery') rows.push(['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.totalCurrentMa)])
  if (component.type === 'resistor') rows.push(['Value', formatResistance(state.resistanceOhms)], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'led') rows.push(['Brightness', `${state.brightness ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'lcd1602') rows.push(['Power', state.powered ? 'on' : 'off'], ['Backlight', state.backlight ? 'on' : 'off'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'rgb_led') rows.push(['Channels', state.channels?.join(', ') || 'off'], ['Brightness', `${state.brightness ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'motor') rows.push(['Speed', `${state.speed ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'servo_motor') rows.push(['Angle', `${state.angle ?? 90} deg`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'buzzer') rows.push(['Volume', `${state.volume ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'diode') rows.push(['Conducting', state.conducting ? 'yes' : 'no'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'transistor') rows.push(['Base signal', state.baseHigh ? 'high' : 'low'], ['Switched', state.switched ? 'on' : 'off'])
  if (component.type === 'sensor') rows.push(['Type', state.kind], ['Reading', `${state.value ?? 0}%`], ['Powered', state.powered ? 'yes' : 'no'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'microcontroller') rows.push(['Runtime', 'MicroPython'], ['GPIO pins', normalizeMicrocontrollerPins(component.pins).length])
  if (state.seriesResistanceOhms > 0) rows.push(['Series resistance', formatResistance(state.seriesResistanceOhms)])
  if (rows.length === 0) return null
  return (
    <dl style={s.stateList}>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={s.stateTerm}>{label}</dt>
          <dd style={s.stateValue}>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

export function LockGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="2.6" y="5" width="6.8" height="5.4" rx="1.4" fill="currentColor" />
    </svg>
  )
}

export function PaletteGlyph({ type }) {
  return (
    <svg viewBox="0 0 32 24" width="28" height="22" aria-hidden="true">
      {type === 'led' && <><circle cx="16" cy="10" r="6" fill="#f43f5e" /><path d="M10 18h12M12 18v4M20 18v4" stroke="#334155" strokeWidth="2" /></>}
      {type === 'battery' && <><rect x="5" y="7" width="21" height="12" rx="3" fill="#f8fafc" stroke="#64748b" strokeWidth="2" /><rect x="26" y="10" width="3" height="6" rx="1" fill="#64748b" /><text x="9" y="16" fontSize="11" fontWeight="700" fill="#111827">-</text><text x="18" y="16" fontSize="10" fontWeight="700" fill="#ef4444">+</text></>}
      {type === 'resistor' && <><path d="M2 12h7l2-5 4 10 4-10 4 10 2-5h5" fill="none" stroke="#334155" strokeWidth="2" /></>}
      {type === 'push_button' && <><rect x="7" y="12" width="18" height="7" rx="3" fill="#94a3b8" /><rect x="11" y="5" width="10" height="9" rx="3" fill="#38bdf8" /></>}
      {type === 'slide_switch' && <><rect x="5" y="8" width="22" height="10" rx="5" fill="#cbd5e1" /><circle cx="20" cy="13" r="5" fill="#475569" /></>}
      {type === 'potentiometer' && <><circle cx="16" cy="12" r="8" fill="#f59e0b" /><path d="M16 12l5-5" stroke="#7c2d12" strokeWidth="2" /></>}
      {type === 'motor' && <><circle cx="16" cy="12" r="8" fill="#e2e8f0" stroke="#475569" strokeWidth="2" /><path d="M16 4v16M8 12h16" stroke="#475569" strokeWidth="2" /></>}
      {type === 'servo_motor' && <><rect x="6" y="8" width="18" height="10" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" /><path d="M16 8V3M16 3l7 4" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'buzzer' && <><path d="M7 15h5l6 5V4l-6 5H7z" fill="#a78bfa" /><path d="M22 8c3 2 3 6 0 8" fill="none" stroke="#6d28d9" strokeWidth="2" /></>}
      {type === 'rgb_led' && <><circle cx="16" cy="10" r="7" fill="#f8fafc" stroke="#475569" strokeWidth="2" /><circle cx="12" cy="10" r="2.5" fill="#ef4444" /><circle cx="16" cy="10" r="2.5" fill="#16a34a" /><circle cx="20" cy="10" r="2.5" fill="#2563eb" /><path d="M9 19h14" stroke="#334155" strokeWidth="2" /></>}
      {type === 'lcd1602' && <><rect x="3" y="4" width="26" height="17" rx="2" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" /><rect x="6" y="7" width="20" height="8" rx="1" fill="#d9f99d" /><path d="M8 18v4M14 18v4M20 18v4M26 18v4" stroke="#334155" strokeWidth="1.5" /></>}
      {type === 'microcontroller' && <><rect x="6" y="4" width="20" height="16" rx="3" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" /><path d="M10 8h12M10 12h12M10 16h12" stroke="#0369a1" strokeWidth="1.5" /><path d="M3 7h5M3 17h5M24 7h5M24 17h5" stroke="#334155" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'transistor' && <><circle cx="16" cy="12" r="9" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" /><path d="M7 12h8M16 4v16M16 16l7 5" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'diode' && <><path d="M3 12h8M21 12h8" stroke="#334155" strokeWidth="2" /><path d="M11 6l10 6-10 6z" fill="#fbbf24" stroke="#92400e" strokeWidth="2" /><path d="M22 6v12" stroke="#92400e" strokeWidth="2" /></>}
      {type === 'sensor' && <><rect x="6" y="6" width="20" height="14" rx="4" fill="#dcfce7" stroke="#15803d" strokeWidth="2" /><path d="M11 15c2-5 4-5 6 0s4 5 6 0" fill="none" stroke="#15803d" strokeWidth="2" /></>}
      {type === 'terminal' && <><circle cx="16" cy="12" r="8" fill="#f8fafc" stroke="#64748b" strokeWidth="2" /><path d="M11 12h10" stroke="#64748b" strokeWidth="2" /></>}
    </svg>
  )
}

export function ComponentBody({ component, state, controls, readOnly, rotation = 0, onControl, onSlideStart }) {
  const pressed = controls.pressed === true
  const closed = controls.closed === true
  const value = Number(controls.value ?? component.props?.value ?? 50)
  const servoAngle = Number(controls.angle ?? component.props?.angle ?? 90)
  const outputLevel = Math.max(0.15, Math.min(1, state.level ?? 1))
  const motorDuration = `${Math.max(0.22, 1.1 - outputLevel * 0.75).toFixed(2)}s`
  const ledColor = LED_COLOR_OPTIONS.find(option => option.value === component.props?.color) ?? LED_COLOR_OPTIONS[0]
  const rgbColor = state.on ? state.color : '#e5e7eb'
  return (
    <svg style={{ ...s.componentDrawing, transform: `rotate(${normalizeRotation(rotation)}deg)` }} viewBox="0 0 112 70" aria-hidden="true">
      {component.type === 'battery' && (
        <>
          <path d="M0 35h20M98 35h14" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="20" y="18" width="72" height="34" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
          <rect x="92" y="28" width="6" height="14" rx="2" fill="#64748b" />
          <text x="35" y="40" fontSize="18" fontWeight="700" fill="#111827">-</text>
          <text x="70" y="40" fontSize="16" fontWeight="700" fill="#ef4444">+</text>
          <text x="56" y="61" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{formatVoltage(component.props?.voltage ?? 5)}</text>
        </>
      )}
      {component.type === 'led' && (
        <>
          <path d="M0 35h37M75 35h37" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="35" r="18" fill={state.on ? ledColor.fill : ledColor.offFill} stroke={ledColor.stroke} strokeWidth="3" opacity={state.on ? 0.55 + outputLevel * 0.45 : 1} />
          {state.on && <circle cx="56" cy="35" r="27" fill={ledColor.glow} opacity={0.08 + outputLevel * 0.22} />}
          <path d="M50 24l13 11-13 11z" fill="#fff" opacity="0.72" />
        </>
      )}
      {component.type === 'rgb_led' && (
        <>
          <path d="M20 62v-9M44 62v-9M68 62v-9M92 62v-9" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {state.on && <circle cx="56" cy="31" r="30" fill={rgbColor} opacity={0.12 + outputLevel * 0.2} />}
          <circle cx="56" cy="31" r="22" fill={rgbColor} stroke="#475569" strokeWidth="3" />
          <circle cx="48" cy="28" r="4" fill="#ef4444" opacity={state.channels?.includes('red') ? 1 : 0.25} />
          <circle cx="56" cy="28" r="4" fill="#16a34a" opacity={state.channels?.includes('green') ? 1 : 0.25} />
          <circle cx="64" cy="28" r="4" fill="#2563eb" opacity={state.channels?.includes('blue') ? 1 : 0.25} />
          <text x="56" y="47" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">RGB</text>
        </>
      )}
      {component.type === 'lcd1602' && (
        <>
          <path d="M16 62v-9M44 62v-9M68 62v-9M96 62v-9" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="8" y="8" width="96" height="48" rx="6" fill="#2563eb" stroke="#1e3a8a" strokeWidth="3" />
          <rect x="16" y="16" width="80" height="26" rx="2" fill={state.powered && state.backlight ? '#d9f99d' : '#334155'} stroke="#0f172a" strokeWidth="2" />
          {state.powered && state.backlight && (
            <>
              <text x="20" y="27" fontFamily="monospace" fontSize="8" fill="#1a2e05">{state.lines?.[0] ?? ''}</text>
              <text x="20" y="36" fontFamily="monospace" fontSize="8" fill="#1a2e05">{state.lines?.[1] ?? ''}</text>
            </>
          )}
          <text x="56" y="52" textAnchor="middle" fontSize="7" fontWeight="700" fill="#dbeafe">I²C 16×2</text>
        </>
      )}
      {component.type === 'microcontroller' && (
        <>
          <rect x="12" y="8" width="88" height="54" rx="8" fill="#e0f2fe" stroke="#0369a1" strokeWidth="3" />
          <rect x="38" y="20" width="36" height="24" rx="4" fill="#0f172a" />
          <path d="M46 28h20M46 35h20" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="82" cy="23" r="4" fill="#22c55e" opacity="0.9" />
          <text x="56" y="55" textAnchor="middle" fontSize="10" fontWeight="700" fill="#075985">{normalizeMicrocontrollerPins(component.pins).length} GPIO</text>
          <path d="M8 14h8M8 26h8M8 38h8M8 50h8M96 14h8M96 26h8M96 38h8M96 50h8" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {component.type === 'resistor' && (
        <>
          <path d="M0 35h30M82 35h30" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="30" y="20" width="52" height="30" rx="10" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          <rect x="41" y="21" width="5" height="28" fill="#ef4444" />
          <rect x="54" y="21" width="5" height="28" fill="#111827" />
          <rect x="67" y="21" width="5" height="28" fill="#2563eb" />
          <text x="56" y="62" textAnchor="middle" fontSize="10" fontWeight="700" fill="#713f12">{formatResistance(getComponentResistanceOhms(component))}</text>
        </>
      )}
      {component.type === 'push_button' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="30" width="56" height="22" rx="9" fill="#94a3b8" />
          <rect
            data-control-action
            x="41"
            y={pressed ? 17 : 10}
            width="30"
            height="24"
            rx="8"
            fill={pressed ? '#0284c7' : '#38bdf8'}
            stroke="#075985"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', true) } }}
            onPointerUp={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', false) } }}
            onPointerLeave={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', false) } }}
          />
        </>
      )}
      {component.type === 'slide_switch' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {/*
            The whole switch body toggles, not just the knob. A 10px-radius circle
            is a fussy target for a young student on a trackpad or a zoomed-out
            board, so the group owns the click and the track and knob inside it are
            purely visual. The leads stay outside the group - clicking a lead is a
            wiring gesture, not a flip.
          */}
          <g
            data-control-action
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={`${component.label} ${closed ? 'closed' : 'open'}`}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={event => { if (!readOnly) { event.stopPropagation(); onControl('closed', !closed) } }}
            onKeyDown={event => {
              if (readOnly || (event.key !== 'Enter' && event.key !== ' ')) return
              event.preventDefault()
              event.stopPropagation()
              onControl('closed', !closed)
            }}
          >
            <rect x="28" y="23" width="56" height="24" rx="12" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
            <circle cx={closed ? 70 : 42} cy="35" r="10" fill={closed ? '#16a34a' : '#475569'} />
          </g>
        </>
      )}
      {component.type === 'potentiometer' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect
            data-control-action
            x="20"
            y="25"
            width="72"
            height="10"
            rx="5"
            fill="#fde68a"
            stroke="#92400e"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'ew-resize' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onSlideStart?.(event) } }}
          />
          <rect x="21" y="26" width={Math.max(2, 70 * (Math.min(100, Math.max(0, value)) / 100))} height="8" rx="4" fill="#f59e0b" style={{ pointerEvents: 'none' }} />
          <circle
            data-control-action
            cx={20 + 72 * (Math.min(100, Math.max(0, value)) / 100)}
            cy="30"
            r="9"
            fill="#7c2d12"
            stroke="#fde68a"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'ew-resize' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onSlideStart?.(event) } }}
          />
          <text x="56" y="50" textAnchor="middle" fontSize="9" fontWeight="700" fill="#7c2d12" style={{ pointerEvents: 'none' }}>{Math.round(value)}%</text>
        </>
      )}
      {component.type === 'motor' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="17" width="56" height="36" rx="8" fill="#bae6fd" stroke="#0369a1" strokeWidth="2" />
          <circle cx="56" cy="35" r="14" fill="#f8fafc" stroke="#075985" strokeWidth="3">
            {state.on && <animateTransform attributeName="transform" type="rotate" from="0 56 35" to="360 56 35" dur={motorDuration} repeatCount="indefinite" />}
          </circle>
          <path d="M56 21v28M42 35h28" stroke="#075985" strokeWidth="3" strokeLinecap="round">
            {state.on && <animateTransform attributeName="transform" type="rotate" from="0 56 35" to="360 56 35" dur={motorDuration} repeatCount="indefinite" />}
          </path>
        </>
      )}
      {component.type === 'servo_motor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="24" y="25" width="64" height="30" rx="7" fill={state.on ? '#bfdbfe' : '#e2e8f0'} stroke="#2563eb" strokeWidth="3" />
          <circle cx="56" cy="40" r="9" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="3" />
          <path d="M56 40h27" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" transform={`rotate(${servoAngle - 90} 56 40)`} />
          <text x="56" y="20" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e3a8a">{servoAngle} deg</text>
        </>
      )}
      {component.type === 'buzzer' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M33 45h15l23 15V10L48 25H33z" fill="#c4b5fd" stroke="#6d28d9" strokeWidth="3" />
          <path d="M76 24c8 6 8 16 0 22" fill="none" stroke="#6d28d9" strokeWidth="3" opacity={state.on ? '1' : '0.35'} />
          {state.on && <path d="M84 16c13 10 13 28 0 38" fill="none" stroke="#a855f7" strokeWidth="3" opacity="0.75"><animate attributeName="opacity" values="0.2;1;0.2" dur="0.5s" repeatCount="indefinite" /></path>}
        </>
      )}
      {component.type === 'transistor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="32" r="25" fill={state.switched ? '#dcfce7' : '#e0f2fe'} stroke="#0369a1" strokeWidth="3" />
          <path d="M32 32h18M56 14v36M56 46l21 14" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 49l7 11-12-5" fill="#0369a1" />
          {state.switched && <path d="M74 16c9 8 9 23 0 31" fill="none" stroke="#16a34a" strokeWidth="3" opacity="0.8" />}
          <text x="56" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#075985">B</text>
        </>
      )}
      {component.type === 'diode' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M34 17l35 18-35 18z" fill={state.conducting ? '#fde68a' : '#fef3c7'} stroke="#92400e" strokeWidth="3" />
          <path d="M73 17v36" stroke="#92400e" strokeWidth="5" strokeLinecap="round" />
          {state.conducting && <path d="M42 35h22" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round"><animate attributeName="opacity" values="0.25;1;0.25" dur="0.65s" repeatCount="indefinite" /></path>}
        </>
      )}
      {component.type === 'sensor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="24" y="15" width="64" height="42" rx="9" fill={state.powered ? '#dcfce7' : '#f1f5f9'} stroke="#15803d" strokeWidth="3" />
          <path d="M36 42c7-24 13-24 20 0s13 24 20 0" fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
          <text x="56" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill="#166534">{state.kind ?? 'sensor'}</text>
          <text x="56" y="52" textAnchor="middle" fontSize="10" fontWeight="700" fill="#166534">{state.value ?? 0}%</text>
        </>
      )}
      {component.type === 'terminal' && (
        <>
          <circle cx="56" cy="35" r="23" fill="#f8fafc" stroke="#64748b" strokeWidth="3" />
          <path d="M42 35h28M56 21v45" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
