import React, { useState } from 'react'
import DropdownMenu from './DropdownMenu'

// Which tabs/panels a teacher can highlight or force-switch, per lesson type. Every type
// gets "Instructions" (the info/explainer pane); Electronics and Scratch additionally get
// the module-specific tab pairs this feature was built for (Breadboard/MicroPython,
// Blocks/Stage) — see ElectronicsWorkspace's highlightedTabs/forcedTab and
// ScratchWorkspace's highlightedPanes/forcedPane props. Other lesson types only expose
// Instructions for now; their own internal tabs (HTML files, Python console, …) aren't
// wired into the highlight/force plumbing yet.
const PANE_OPTIONS_BY_TYPE = {
  electronics: [
    { id: 'instructions', label: 'Instructions' },
    { id: 'breadboard', label: 'Breadboard' },
    { id: 'code', label: 'MicroPython' },
  ],
  scratch: [
    { id: 'instructions', label: 'Instructions' },
    { id: 'blocks', label: 'Blocks' },
    { id: 'stage', label: 'Stage' },
  ],
}
const DEFAULT_PANE_OPTIONS = [{ id: 'instructions', label: 'Instructions' }]

export function getPaneOptionsForLessonType(lessonType) {
  return PANE_OPTIONS_BY_TYPE[lessonType] ?? DEFAULT_PANE_OPTIONS
}

// label/buttonStyle let TeacherView reuse this for the whole-class version with its own
// wording, while StudentModal uses the defaults for the per-student version.
export default function PaneFocusDropdown({
  lessonType,
  onHighlight,
  onForce,
  label = 'Focus',
  buttonStyle,
}) {
  const options = getPaneOptionsForLessonType(lessonType)
  const [checked, setChecked] = useState(() => new Set(['instructions']))

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <DropdownMenu label={label} buttonClassName="btn-ghost" buttonStyle={buttonStyle}>
      {(close) => {
        const panes = Array.from(checked)
        return (
          <>
            <span style={s.heading}>Show on student screen:</span>
            <div style={s.optionsList}>
              {options.map((opt) => (
                <label key={opt.id} style={s.optionRow}>
                  <input
                    type="checkbox"
                    checked={checked.has(opt.id)}
                    onChange={() => toggle(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              style={s.actionBtn}
              disabled={panes.length === 0}
              onClick={() => {
                onHighlight(panes)
                close()
              }}
              title="Draws a pulsing glow on these tabs without changing what the student is looking at"
            >
              ✨ Highlight
            </button>
            <button
              type="button"
              style={{
                ...s.actionBtn,
                background: 'var(--colour-primary)',
                color: '#fff',
                borderColor: 'var(--colour-primary)',
              }}
              disabled={panes.length === 0}
              onClick={() => {
                onForce(panes)
                close()
              }}
              title="Immediately switches the student to these tabs — they're free to navigate away again after"
            >
              👉 Switch to this
            </button>
          </>
        )
      }}
    </DropdownMenu>
  )
}

const s = {
  heading: {
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBottom: 4,
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    color: '#374151',
    cursor: 'pointer',
    padding: '3px 2px',
  },
  actionBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
