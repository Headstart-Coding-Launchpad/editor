import DropdownMenu from './DropdownMenu'
import { listHighlightTargets, moduleHasHighlightTargets } from '../../../shared/controlHighlight'

// The tutor's "Highlight ▸" choices: pulse one control (Run, Stop, the green flag, a Costumes
// tab, a block category) on the student's screen (src/shared/controlHighlight.js). The list is
// the module's `capabilities.highlightTargets` for the task on screen; `lessonType` must be
// that task's effective type (composed lessons), never lesson.type.
// StudentModal shows the controls in its More menu (one student); ControlHighlightDropdown wraps
// them in their own menu for TeacherView (the whole class).
export function hasControlHighlightTargets(lessonType) {
  return moduleHasHighlightTargets(lessonType)
}

export function ControlHighlightControls({ lessonType, onHighlight, onClear, onDone }) {
  const targets = listHighlightTargets(lessonType)
  const plain = targets.filter((target) => !target.group)
  const groups = []
  for (const target of targets) {
    if (!target.group) continue
    let group = groups.find((entry) => entry.label === target.group)
    if (!group) {
      group = { label: target.group, targets: [] }
      groups.push(group)
    }
    group.targets.push(target)
  }

  function pick(id) {
    onHighlight(id)
    onDone?.()
  }

  return (
    <>
      <span style={s.heading}>Pulse on the student screen:</span>
      <div style={s.list}>
        {plain.map((target) => (
          <button
            key={target.id}
            type="button"
            style={s.item}
            onClick={() => pick(target.id)}
            title={`Pulses the ${target.label} for 20 seconds, or until it's used`}
          >
            ✨ {target.label}
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <div key={group.label} style={s.group}>
          <span style={s.heading}>{group.label}</span>
          <div style={s.chips}>
            {group.targets.map((target) => (
              <button
                key={target.id}
                type="button"
                style={s.chip}
                onClick={() => pick(target.id)}
                title={`Pulses the ${target.label} heading in the block palette`}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {onClear && (
        <button
          type="button"
          style={{ ...s.item, color: '#6b7280' }}
          onClick={() => {
            onClear()
            onDone?.()
          }}
        >
          Stop highlighting
        </button>
      )}
    </>
  )
}

export default function ControlHighlightDropdown({
  lessonType,
  onHighlight,
  onClear,
  label = 'Highlight ▸',
  buttonStyle,
}) {
  if (!hasControlHighlightTargets(lessonType)) return null
  return (
    <DropdownMenu label={label} buttonClassName="btn-ghost" buttonStyle={buttonStyle}>
      {(close) => (
        <ControlHighlightControls
          lessonType={lessonType}
          onHighlight={onHighlight}
          onClear={onClear}
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingBottom: 4,
  },
  item: {
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    color: '#374151',
    border: 'none',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingBottom: 4,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: 260,
  },
  chip: {
    padding: '4px 9px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 999,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
}
