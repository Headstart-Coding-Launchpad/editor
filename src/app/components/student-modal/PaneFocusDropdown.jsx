import React, { useState } from 'react'
import DropdownMenu from './DropdownMenu'
import { getModuleDefinition } from '../../../modules/definitions'

// Which tabs/panels a teacher can highlight or force-switch, per lesson type. Every type
// gets "Instructions" (the info/explainer pane), plus the module's own
// `capabilities.focusPanes` — the tabs its StudentWorkspace wires into the highlight/force
// plumbing (Electronics' Breadboard/MicroPython via highlightedTabs/forcedTab, Scratch's
// Blocks/Stage via highlightedPanes/forcedPane). Other modules only expose Instructions for
// now; their own internal tabs (HTML files, Python console, …) aren't wired in yet.
const INSTRUCTIONS_PANE = { id: 'instructions', label: 'Instructions' }

export function getPaneOptionsForLessonType(lessonType) {
  return [INSTRUCTIONS_PANE, ...(getModuleDefinition(lessonType)?.capabilities.focusPanes ?? [])]
}

// The checkboxes plus Highlight / Switch buttons. StudentModal shows them as the Focus section of
// its More menu; PaneFocusDropdown wraps them in their own menu (TeacherView's whole-class
// version). `onDone` runs after either action, to close whichever menu holds them.
export function PaneFocusControls({ lessonType, onHighlight, onForce, onDone }) {
  const options = getPaneOptionsForLessonType(lessonType)
  const [checked, setChecked] = useState(() => new Set(['instructions']))
  const panes = Array.from(checked)

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <span style={s.heading}>Show on student screen:</span>
      <div style={s.optionsList}>
        {options.map((opt) => (
          <label key={opt.id} style={s.optionRow}>
            <input type="checkbox" checked={checked.has(opt.id)} onChange={() => toggle(opt.id)} />
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
          onDone?.()
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
          onDone?.()
        }}
        title="Immediately switches the student to these tabs — they're free to navigate away again after"
      >
        👉 Switch to this
      </button>
    </>
  )
}

// label/buttonStyle let TeacherView reuse this for the whole-class version with its own
// wording.
export default function PaneFocusDropdown({
  lessonType,
  onHighlight,
  onForce,
  label = 'Focus',
  buttonStyle,
}) {
  return (
    <DropdownMenu label={label} buttonClassName="btn-ghost" buttonStyle={buttonStyle}>
      {(close) => (
        <PaneFocusControls
          lessonType={lessonType}
          onHighlight={onHighlight}
          onForce={onForce}
          onDone={close}
        />
      )}
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
