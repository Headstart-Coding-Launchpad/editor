import React from 'react'

const INK_TOOLS = Object.freeze([
  {
    id: 'pointer',
    icon: '🔴',
    label: 'Pointer',
    title: 'Show the class a pointer dot (Esc to stop)',
  },
  { id: 'ink', icon: '✏️', label: 'Ink', title: 'Draw marks that fade away (Esc to stop)' },
  {
    id: 'highlight',
    icon: '🖍️',
    label: 'Highlight',
    title: 'Select text to highlight it for everyone; click a highlight to remove it (Esc to stop)',
  },
])

// Floating tool picker (bottom centre), shown only in the teacher's Presentation window while an information
// task or a code task's explainer is on screen (LiveInkProvider decides).
export default function PresentationInkToolbar({ tool, onToolChange, onClear, canClear }) {
  return (
    <div className="live-ink-toolbar" role="toolbar" aria-label="Presentation annotations">
      {INK_TOOLS.map((item) => {
        const active = tool === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={active ? 'live-ink-toolbar__btn is-active' : 'live-ink-toolbar__btn'}
            aria-pressed={active}
            title={item.title}
            onClick={() => onToolChange(active ? null : item.id)}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
          </button>
        )
      })}
      <button
        type="button"
        className="live-ink-toolbar__btn"
        title="Clear every highlight and mark"
        onClick={onClear}
        disabled={!canClear}
      >
        Clear
      </button>
    </div>
  )
}
