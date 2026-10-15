import { Field } from './TaskEditorFields'
import { INSPECTOR_SECTIONS } from '../../../modules/html/inspector/config'

const SECTION_TEXT = {
  box: 'Box model: margin, border, padding and content, with px sizes',
  cascade: '"Why this …?": every rule that sets a property, the winner and why the rest lose',
  layout: 'Layout: flex axes, gaps and grid lines',
}

// The task's `inspector` field (src/modules/html/inspector/config.js): the HTML Inspector on the
// preview. Off unless enabled; the other settings are kept only while it's on.
export default function InspectorField({ task, onUpdate }) {
  const inspector = task.inspector && typeof task.inspector === 'object' ? task.inspector : null
  const enabled = inspector?.enabled === true
  const show = Array.isArray(inspector?.show) ? inspector.show : []

  function patch(changes) {
    const next = { ...(inspector ?? {}), enabled: true, ...changes }
    for (const key of Object.keys(next)) {
      if (next[key] === undefined) delete next[key]
    }
    onUpdate({ ...task, inspector: next })
  }

  return (
    <Field label="HTML Inspector">
      <label
        className={
          enabled ? 'te-option-toggle-card te-option-toggle-card--active' : 'te-option-toggle-card'
        }
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            e.target.checked ? patch({}) : onUpdate({ ...task, inspector: undefined })
          }
          className="te-option-choice-input"
        />
        <span className="te-option-choice-title">Show the Inspector on the preview</span>
        <span
          className={
            enabled
              ? 'te-option-choice-text te-option-choice-text--active'
              : 'te-option-choice-text'
          }
        >
          Students point at part of their page to see its boxes, which CSS rule won, and flex or
          grid lines.
        </span>
      </label>
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={inspector.open === true}
              onChange={(e) => patch({ open: e.target.checked ? true : undefined })}
            />
            Start with inspect mode on
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Pre-select an element (CSS selector, optional)</span>
            <input
              type="text"
              className="te-input"
              value={inspector.focus ?? ''}
              placeholder=".card p"
              maxLength={200}
              onChange={(e) => patch({ focus: e.target.value.trim() ? e.target.value : undefined })}
            />
          </label>
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 4 }}>Sections (none ticked shows all three)</legend>
            {INSPECTOR_SECTIONS.map((section) => (
              <label key={section} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={show.includes(section)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? INSPECTOR_SECTIONS.filter((key) => key === section || show.includes(key))
                      : show.filter((key) => key !== section)
                    patch({ show: next.length > 0 ? next : undefined })
                  }}
                />
                {SECTION_TEXT[section]}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </Field>
  )
}
