// The HTML Inspector's task field (`inspector`), its properties list and the live-sync state
// shape. Pure and Node-safe: the module definition validates through it and the UI reads it.
//
//   inspector: {
//     enabled: true,           // show the Inspect button on the preview (off unless set)
//     open: true,              // start with inspect mode on
//     focus: '.card p',        // pre-select the first element this selector matches
//     show: [box, cascade, layout],   // the panel's sections (default: all three)
//   }

export const INSPECTOR_SECTIONS = Object.freeze(['box', 'cascade', 'layout'])
export const INSPECTOR_KEYS = Object.freeze(['enabled', 'open', 'focus', 'show'])
export const INSPECTOR_FOCUS_MAX = 200

// The properties "Why this …?" can explain, plain words first. `longhands` are what a rule
// actually sets (a `margin` rule sets all four sides); `inherited` properties pass from a parent
// to its children when nothing sets them directly.
export const INSPECTOR_PROPERTIES = Object.freeze([
  { key: 'color', label: 'text colour', longhands: ['color'], inherited: true },
  { key: 'background-color', label: 'background colour', longhands: ['background-color'] },
  { key: 'font-size', label: 'text size', longhands: ['font-size'], inherited: true },
  { key: 'font-family', label: 'font', longhands: ['font-family'], inherited: true },
  { key: 'font-weight', label: 'boldness', longhands: ['font-weight'], inherited: true },
  { key: 'text-align', label: 'text alignment', longhands: ['text-align'], inherited: true },
  {
    key: 'margin',
    label: 'margin',
    longhands: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  },
  {
    key: 'padding',
    label: 'padding',
    longhands: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  },
  {
    key: 'border',
    label: 'border',
    longhands: [
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
      'border-top-style',
      'border-right-style',
      'border-bottom-style',
      'border-left-style',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
    ],
  },
  { key: 'width', label: 'width', longhands: ['width'] },
  { key: 'height', label: 'height', longhands: ['height'] },
  { key: 'display', label: 'display', longhands: ['display'] },
  { key: 'position', label: 'position', longhands: ['position'] },
  { key: 'flex-direction', label: 'flex direction', longhands: ['flex-direction'] },
  { key: 'justify-content', label: 'justify content', longhands: ['justify-content'] },
  { key: 'align-items', label: 'align items', longhands: ['align-items'] },
  { key: 'gap', label: 'gap', longhands: ['row-gap', 'column-gap'] },
  {
    key: 'grid-template-columns',
    label: 'grid columns',
    longhands: ['grid-template-columns'],
  },
])

export const DEFAULT_INSPECTOR_PROPERTY = 'color'

export function getInspectorProperty(key) {
  return (
    INSPECTOR_PROPERTIES.find((prop) => prop.key === key) ??
    INSPECTOR_PROPERTIES.find((prop) => prop.key === DEFAULT_INSPECTOR_PROPERTY)
  )
}

/**
 * The task's inspector settings, normalised, or null when the task doesn't turn it on.
 * `show` keeps only known sections, in the order given; an empty or missing list shows all.
 */
export function getInspectorConfig(task) {
  const raw = task?.inspector
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.enabled !== true) return null
  const show = Array.isArray(raw.show)
    ? raw.show.filter(
        (section, i, list) => INSPECTOR_SECTIONS.includes(section) && list.indexOf(section) === i
      )
    : []
  return {
    enabled: true,
    open: raw.open === true,
    focus: typeof raw.focus === 'string' && raw.focus.trim() ? raw.focus.trim() : null,
    show: show.length > 0 ? show : [...INSPECTOR_SECTIONS],
  }
}

/**
 * The live-sync state (teacherLive.inspector) — `{ on, selector, property }` — cleaned, or null
 * when the inspector is off and nothing is selected. Small on purpose: a selector path, not DOM.
 */
export function normalizeInspectorLiveState(state) {
  if (!state || typeof state !== 'object') return null
  const on = state.on === true
  const selector =
    typeof state.selector === 'string' && state.selector.length <= 500 ? state.selector : null
  const property = INSPECTOR_PROPERTIES.some((prop) => prop.key === state.property)
    ? state.property
    : null
  if (!on && !selector) return null
  return { on, selector, property }
}
