// The teacher's view of Template Module work: TeacherView's Starter / stage / Complete tabs and
// sandbox (`displayState` from definition.getDisplayState; editable only in the sandbox, where
// `onChange` updates the teacher's sandbox work), and StudentModal's mirror of a watched student
// (capabilities.studentMirror 'view'). A shared workspace snapshot renders it read-only too.
// TODO(new-module): render the module's real workspace read-only here.
export default function TemplateModuleTeacherLiveView({ displayState, readOnly, onChange }) {
  return (
    <textarea
      aria-label="Template Module work"
      style={s.textarea}
      value={typeof displayState === 'string' ? displayState : ''}
      readOnly={readOnly || !onChange}
      spellCheck={false}
      onChange={(event) => onChange?.(event.target.value)}
    />
  )
}

const s = {
  textarea: {
    flex: 1,
    minHeight: 220,
    padding: 12,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 15,
    border: '1px solid var(--colour-border, #cbd5e1)',
    borderRadius: '0 0 8px 8px',
    resize: 'vertical',
  },
}
