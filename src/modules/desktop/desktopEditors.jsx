import { FS_CHECK_DEFINITIONS } from '../filesystem/checks.js'
import { DESKTOP_CHECK_DEFINITIONS } from './checks.js'
import {
  INPUT_CHECK_DEFINITIONS,
  INPUT_GESTURES,
  INPUT_MODIFIERS,
  INPUT_SHORTCUT_VIA,
} from '../../shared/input/checks.js'
import { INPUT_TARGET_KINDS } from '../../shared/input/targetSummary.js'

const CHECK_DEFINITIONS = {
  ...FS_CHECK_DEFINITIONS,
  ...DESKTOP_CHECK_DEFINITIONS,
  ...INPUT_CHECK_DEFINITIONS,
}

// Starting fields when an author switches a check to an input_* type.
const INPUT_CHECK_DEFAULTS = {
  input_gesture: { gesture: 'double_click' },
  input_shortcut: { combo: 'ctrl+c', via: 'keyboard' },
  input_modifier: { modifier: 'shift' },
}

const GESTURE_LABELS = {
  click: 'Click',
  double_click: 'Double-click',
  right_click: 'Right-click',
  drag: 'Drag',
  scroll: 'Scroll',
  hover: 'Hover',
}
const TARGET_KIND_LABELS = {
  file: 'File',
  folder: 'Folder',
  window: 'Window',
  icon: 'Desktop icon',
}
const VIA_LABELS = {
  keyboard: 'Keyboard only',
  menu: 'Menu or toolbar only',
  any: 'Keyboard or menu',
}
const MODIFIER_LABELS = { shift: 'Shift for capitals', caps_lock: 'Caps Lock for capitals' }
const CHECK_TYPE_OPTIONS = Object.keys(CHECK_DEFINITIONS).map((type) => ({
  value: type,
  label: CHECK_DEFINITIONS[type].subject,
}))

const s = {
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '6px 10px',
    border: '1px solid var(--ui-border)',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  smallBtn: {
    background: 'none',
    border: '1px solid var(--ui-border)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 5px',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
  },
}

function fieldsFor(type) {
  return CHECK_DEFINITIONS[type]?.fields ?? []
}

function operatorsFor(type) {
  return CHECK_DEFINITIONS[type]?.operators ?? []
}

function DesktopSingleCheckEditor({ check, onChange, onRemove, feedbackEditor = false }) {
  const type = CHECK_DEFINITIONS[check.type] ? check.type : 'fs_path'
  const fields = fieldsFor(type)
  const operators = operatorsFor(type)

  function setField(field, val) {
    onChange({ ...check, [field]: val })
  }

  function changeType(nextType) {
    const operator = operatorsFor(nextType)[0]
    onChange({
      type: nextType,
      ...(operator ? { operator } : {}),
      ...(INPUT_CHECK_DEFAULTS[nextType] ?? {}),
      ...(fieldsFor(nextType).includes('itemType') ? { itemType: 'file' } : {}),
      ...(fieldsFor(nextType).includes('appIds') ? { appIds: ['', ''] } : {}),
      hint: check.hint,
      ...(feedbackEditor
        ? { mode: check.mode ?? 'blocking', show: check.show ?? 'after_attempt' }
        : {}),
    })
  }

  return (
    <div
      style={{
        border: '1px solid var(--ui-border)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
        background: '#fff',
      }}
    >
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}
      >
        <select
          value={type}
          onChange={(e) => changeType(e.target.value)}
          style={{ ...s.input, flex: '1 1 160px', fontSize: '0.82rem' }}
        >
          {CHECK_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {operators.length > 1 && (
          <select
            value={check.operator ?? operators[0]}
            onChange={(e) => setField('operator', e.target.value)}
            style={{ ...s.input, flex: '1 1 140px', fontSize: '0.82rem' }}
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {op.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#dc2626',
            fontSize: '1rem',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {fields.includes('path') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Path
            <input
              value={check.path ?? ''}
              onChange={(e) => setField('path', e.target.value)}
              placeholder="/Documents/notes.txt"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('itemType') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Item type
            <select
              value={check.itemType ?? 'file'}
              onChange={(e) => setField('itemType', e.target.value)}
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              <option value="file">File</option>
              <option value="dir">Folder</option>
              {type === 'fs_path' && <option value="any">Either</option>}
            </select>
          </label>
        )}

        {fields.includes('value') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {type === 'fs_file_content' ? 'Expected content' : 'Expected count'}
            <input
              value={check.value ?? ''}
              onChange={(e) => setField('value', e.target.value)}
              style={{ ...s.input, fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('flags') && (check.operator ?? '').includes('regex') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Regex flags (optional)
            <input
              value={check.flags ?? ''}
              onChange={(e) => setField('flags', e.target.value)}
              placeholder="e.g. i, m, s"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('dir') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Parent folder
            <input
              value={check.dir ?? '/'}
              onChange={(e) => setField('dir', e.target.value)}
              placeholder="/Documents/"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('appId') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            App
            <input
              value={check.appId ?? ''}
              onChange={(e) => setField('appId', e.target.value)}
              placeholder="fileManager"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('appIds') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <label
              style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
            >
              App A
              <input
                value={check.appIds?.[0] ?? ''}
                onChange={(e) => setField('appIds', [e.target.value, check.appIds?.[1] ?? ''])}
                placeholder="fileManager"
                style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
              />
            </label>
            <label
              style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}
            >
              App B
              <input
                value={check.appIds?.[1] ?? ''}
                onChange={(e) => setField('appIds', [check.appIds?.[0] ?? '', e.target.value])}
                placeholder="textEditor"
                style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
              />
            </label>
          </div>
        )}

        {fields.includes('gesture') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Gesture
            <select
              aria-label="Gesture"
              value={check.gesture ?? 'double_click'}
              onChange={(e) =>
                onChange({
                  ...check,
                  gesture: e.target.value,
                  ...(e.target.value === 'drag' ? {} : { dropTargetKind: undefined }),
                })
              }
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              {INPUT_GESTURES.map((gesture) => (
                <option key={gesture} value={gesture}>
                  {GESTURE_LABELS[gesture]}
                </option>
              ))}
            </select>
          </label>
        )}

        {fields.includes('targetKind') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            On
            <select
              aria-label="Gesture target"
              value={check.targetKind ?? ''}
              onChange={(e) => setField('targetKind', e.target.value || undefined)}
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              <option value="">Anything</option>
              {INPUT_TARGET_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TARGET_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
        )}

        {fields.includes('dropTargetKind') && check.gesture === 'drag' && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Dropped onto
            <select
              aria-label="Drop target"
              value={check.dropTargetKind ?? ''}
              onChange={(e) => setField('dropTargetKind', e.target.value || undefined)}
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              <option value="">Anywhere</option>
              {INPUT_TARGET_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TARGET_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
        )}

        {fields.includes('combo') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Shortcut
            <input
              aria-label="Shortcut"
              value={check.combo ?? ''}
              onChange={(e) => setField('combo', e.target.value)}
              placeholder="ctrl+c"
              style={{ ...s.input, fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
            />
          </label>
        )}

        {fields.includes('via') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Used from
            <select
              aria-label="Shortcut used from"
              value={check.via ?? 'keyboard'}
              onChange={(e) => setField('via', e.target.value)}
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              {INPUT_SHORTCUT_VIA.map((via) => (
                <option key={via} value={via}>
                  {VIA_LABELS[via]}
                </option>
              ))}
            </select>
          </label>
        )}

        {fields.includes('modifier') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            Key
            <select
              aria-label="Modifier"
              value={check.modifier ?? 'shift'}
              onChange={(e) =>
                onChange({
                  ...check,
                  modifier: e.target.value,
                  ...(e.target.value === 'shift' ? {} : { notCapsLock: undefined }),
                })
              }
              style={{ ...s.input, fontSize: '0.82rem' }}
            >
              {INPUT_MODIFIERS.map((modifier) => (
                <option key={modifier} value={modifier}>
                  {MODIFIER_LABELS[modifier]}
                </option>
              ))}
            </select>
          </label>
        )}

        {fields.includes('notCapsLock') && (check.modifier ?? 'shift') === 'shift' && (
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={!!check.notCapsLock}
              onChange={(e) => setField('notCapsLock', e.target.checked || undefined)}
            />
            Fail if Caps Lock was used for a capital
          </label>
        )}

        {fields.includes('strict') && (
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={!!check.strict}
              onChange={(e) => setField('strict', e.target.checked || undefined)}
            />
            Mouse only (no touch-screen equivalent)
          </label>
        )}

        {fields.includes('min') && (
          <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
            At least (times)
            <input
              aria-label="At least (times)"
              type="number"
              min={1}
              value={check.min ?? ''}
              onChange={(e) =>
                setField('min', e.target.value === '' ? undefined : Number(e.target.value))
              }
              placeholder="1"
              style={{ ...s.input, fontSize: '0.82rem' }}
            />
          </label>
        )}

        {feedbackEditor && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="te-select"
              value={check.mode ?? 'blocking'}
              onChange={(e) => setField('mode', e.target.value)}
              title="Feedback behaviour"
            >
              <option value="blocking">Blocking</option>
              <option value="nudge">Nudge</option>
            </select>
            <select
              className="te-select"
              value={check.show === 'on_pause' ? 'on_idle' : (check.show ?? 'after_attempt')}
              onChange={(e) => setField('show', e.target.value)}
              title="When to show feedback"
            >
              <option value="after_attempt">After attempt</option>
              <option value="on_idle">On idle</option>
            </select>
          </div>
        )}

        <label style={{ ...s.label, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Hint (optional)
          <input
            value={check.hint ?? ''}
            onChange={(e) => setField('hint', e.target.value || undefined)}
            placeholder="Shown to the student when this check fails…"
            style={{ ...s.input, fontSize: '0.82rem' }}
          />
        </label>
      </div>
    </div>
  )
}

export function DesktopCheckListEditor({ checks, onChange, feedbackEditor = false }) {
  const safeChecks = Array.isArray(checks) ? checks : checks ? [checks] : []

  function handleChange(i, updated) {
    const next = [...safeChecks]
    next[i] = updated
    onChange(next)
  }

  function handleRemove(i) {
    const next = safeChecks.filter((_, idx) => idx !== i)
    onChange(next.length === 0 ? null : next)
  }

  function handleAdd() {
    const nextCheck = { type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }
    const next = [
      ...safeChecks,
      feedbackEditor ? { ...nextCheck, mode: 'blocking', show: 'after_attempt' } : nextCheck,
    ]
    onChange(next)
  }

  return (
    <div>
      {safeChecks.map((c, i) => (
        <DesktopSingleCheckEditor
          key={i}
          check={c}
          onChange={(updated) => handleChange(i, updated)}
          onRemove={() => handleRemove(i)}
          feedbackEditor={feedbackEditor}
        />
      ))}
      <button
        onClick={handleAdd}
        style={{ ...s.smallBtn, fontSize: '0.82rem', padding: '4px 10px' }}
      >
        + Add check
      </button>
    </div>
  )
}
