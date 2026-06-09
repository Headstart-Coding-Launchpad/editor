import React from 'react'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import { VALUE_INPUT_DEFAULTS } from '../../../shared/scratch'

const SCRATCH_TOOLBOX_GROUPS = [
  {
    name: 'Events',
    colour: '#FFAB19',
    blocks: [
      ['event_whenflagclicked', 'when green flag clicked'],
      ['event_whenkeypressed', 'when key pressed'],
      ['event_whenthisspriteclicked', 'when sprite clicked'],
      ['event_whenbackdropswitchesto', 'when backdrop switches to'],
      ['event_broadcast', 'broadcast'],
      ['event_broadcastandwait', 'broadcast and wait'],
      ['event_whenbroadcastreceived', 'when I receive'],
    ],
  },
  {
    name: 'Motion',
    colour: '#4C97FF',
    blocks: [
      ['motion_movesteps', 'move steps'],
      ['motion_turnright', 'turn right'],
      ['motion_turnleft', 'turn left'],
      ['motion_pointindirection', 'point in direction'],
      ['motion_gotoxy', 'go to x/y'],
      ['motion_goto', 'go to'],
      ['motion_glidesecstoxy', 'glide to x/y'],
      ['motion_glideto', 'glide to'],
      ['motion_ifonedge_bounce', 'if on edge, bounce'],
      ['motion_setx', 'set x'],
      ['motion_sety', 'set y'],
      ['motion_changexby', 'change x'],
      ['motion_changeyby', 'change y'],
      ['motion_setrotationstyle', 'set rotation style'],
      ['motion_glidesecstoxy', 'glide secs to x/y'],
      ['motion_xposition', 'x position'],
      ['motion_yposition', 'y position'],
      ['motion_direction', 'direction'],
    ],
  },
  {
    name: 'Looks',
    colour: '#9966FF',
    blocks: [
      ['looks_sayforsecs', 'say for seconds'],
      ['looks_say', 'say'],
      ['looks_think', 'think'],
      ['looks_thinkforsecs', 'think for seconds'],
      ['looks_show', 'show'],
      ['looks_hide', 'hide'],
      ['looks_setsizeto', 'set size'],
      ['looks_changesizeby', 'change size'],
      ['looks_switchcostumeto', 'switch costume to'],
      ['looks_nextcostume', 'next costume'],
      ['looks_costumenumber', 'costume number'],
      ['looks_switchbackdropto', 'switch backdrop to'],
      ['looks_nextbackdrop', 'next backdrop'],
    ],
  },
  {
    name: 'Control',
    colour: '#FFAB19',
    blocks: [
      ['control_wait', 'wait'],
      ['control_repeat', 'repeat'],
      ['control_forever', 'forever'],
      ['control_if', 'if then'],
      ['control_if_else', 'if then else'],
      ['control_stop', 'stop all'],
    ],
  },
  {
    name: 'Sensing',
    colour: '#5CB1D6',
    blocks: [
      ['sensing_askandwait', 'ask and wait'],
      ['sensing_answer', 'answer'],
      ['sensing_keypressed', 'key pressed?'],
      ['sensing_mousedown', 'mouse down?'],
      ['sensing_touchingedge', 'touching edge?'],
      ['sensing_touchingobject', 'touching object?'],
    ],
  },
  {
    name: 'Operators',
    colour: '#59C059',
    blocks: [
      ['operator_equals', 'equals'],
      ['operator_gt', 'greater than'],
      ['operator_lt', 'less than'],
      ['operator_and', 'and'],
      ['operator_or', 'or'],
      ['operator_not', 'not'],
      ['operator_add', 'add'],
      ['operator_subtract', 'subtract'],
      ['operator_join', 'join'],
    ],
  },
  {
    name: 'Variables',
    colour: '#FF8C1A',
    blocks: [
      ['data_variable', 'variable'],
      ['data_setvariableto', 'set variable'],
      ['data_changevariableby', 'change variable'],
    ],
  },
  {
    name: 'Sound',
    colour: '#CF63CF',
    blocks: [
      ['sound_play', 'start sound'],
      ['sound_playuntildone', 'play sound until done'],
      ['sound_stopallsounds', 'stop all sounds'],
    ],
  },
]

const SCRATCH_BLOCK_OPTIONS = SCRATCH_TOOLBOX_GROUPS.flatMap(group => group.blocks)
const SCRATCH_ALL_BLOCK_TYPES = SCRATCH_BLOCK_OPTIONS.map(([type]) => type)

function buildScratchToolboxXml(selectedTypes) {
  const selected = new Set(selectedTypes)
  const categories = SCRATCH_TOOLBOX_GROUPS.map(group => {
    const blocks = group.blocks
      .filter(([type]) => selected.has(type))
      .map(([type]) => `<block type="${type}"/>`)
      .join('')

    if (!blocks) return ''
    return `<category name="${group.name}" colour="${group.colour}">${blocks}</category>`
  }).join('')

  return `<xml>${categories}</xml>`
}

function parseScratchToolboxXml(toolbox) {
  if (!toolbox) return SCRATCH_ALL_BLOCK_TYPES
  if (typeof DOMParser === 'undefined') return []

  try {
    const parsed = new DOMParser().parseFromString(toolbox, 'text/xml')
    if (parsed.querySelector('parsererror')) return []
    return Array.from(parsed.querySelectorAll('block'))
      .map(block => block.getAttribute('type'))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function ScratchToolboxPicker({ toolbox, onChange }) {
  const usesAllBlocks = !toolbox
  const selectedTypes = new Set(parseScratchToolboxXml(toolbox))

  function setSelected(nextSelected) {
    onChange(buildScratchToolboxXml(nextSelected))
  }

  function toggleBlock(type, checked) {
    const next = new Set(selectedTypes)
    if (checked) next.add(type)
    else next.delete(type)
    setSelected(next)
  }

  function toggleGroup(group, checked) {
    const next = new Set(selectedTypes)
    for (const [type] of group.blocks) {
      if (checked) next.add(type)
      else next.delete(type)
    }
    setSelected(next)
  }

  return (
    <div className="te-toolbox-picker">
      <label className="te-toolbox-all-row">
        <input
          type="checkbox"
          checked={usesAllBlocks}
          onChange={e => onChange(e.target.checked ? '' : buildScratchToolboxXml([]))}
        />
        <span>All blocks</span>
      </label>

      <div className={usesAllBlocks ? 'te-toolbox-disabled' : 'te-toolbox-groups'}>
        {SCRATCH_TOOLBOX_GROUPS.map(group => {
          const groupTypes = group.blocks.map(([type]) => type)
          const checkedCount = groupTypes.filter(type => selectedTypes.has(type)).length
          const groupChecked = checkedCount === groupTypes.length

          return (
            <div key={group.name} className="te-toolbox-group">
              <label className="te-toolbox-group__header">
                <input
                  type="checkbox"
                  checked={groupChecked}
                  disabled={usesAllBlocks}
                  onChange={e => toggleGroup(group, e.target.checked)}
                />
                <span className="te-toolbox-group__swatch" style={{ background: group.colour }} />
                <span>{group.name}</span>
              </label>
              <div className="te-toolbox-block-grid">
                {group.blocks.map(([type, label]) => (
                  <label key={type} className="te-toolbox-block-item">
                    <input
                      type="checkbox"
                      checked={usesAllBlocks || selectedTypes.has(type)}
                      disabled={usesAllBlocks}
                      onChange={e => toggleBlock(type, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Predefined Blocks Editor ──────────────────────────────────────────────────

// Block input metadata derived from VALUE_INPUT_DEFAULTS
function getBlockInputFields(type) {
  const defaults = VALUE_INPUT_DEFAULTS[type]
  if (!defaults) return []
  return Object.entries(defaults).map(([name, shadow]) => ({
    name,
    inputType: shadow.type === 'math_number' ? 'number' : 'text',
    defaultValue: shadow.value,
  }))
}

// Blocks that have configurable inputs (exclude pure dropdowns)
const PREDEFINED_ELIGIBLE_TYPES = Object.keys(VALUE_INPUT_DEFAULTS)

function newPredefinedBlock(type) {
  const fields = getBlockInputFields(type)
  const inputs = {}
  for (const f of fields) inputs[f.name] = f.defaultValue
  return { id: Math.random().toString(36).slice(2), type, inputs }
}

function blockLabel(type) {
  const found = SCRATCH_BLOCK_OPTIONS.find(([t]) => t === type)
  return found ? found[1] : type
}

export function PredefinedBlocksEditor({ predefinedBlocks = [], toolbox = '', onChange }) {
  const [newBlock, setNewBlock] = React.useState(null)

  // Only offer block types that are both in the toolbox and have configurable inputs
  const toolboxTypes = new Set(parseScratchToolboxXml(toolbox))
  const eligibleTypes = PREDEFINED_ELIGIBLE_TYPES.filter(t =>
    !toolbox || toolboxTypes.has(t)
  )

  React.useEffect(() => {
    setNewBlock(null)
  }, [toolbox])

  function startAdding() {
    setNewBlock(newPredefinedBlock(eligibleTypes[0] ?? ''))
  }

  function handleNewTypeChange(type) {
    setNewBlock(newPredefinedBlock(type))
  }

  function confirmAdd() {
    if (!newBlock) return
    onChange([...predefinedBlocks, newBlock])
    setNewBlock(null)
  }

  function remove(id) {
    onChange(predefinedBlocks.filter(pb => pb.id !== id))
  }

  function updateInput(id, inputName, value) {
    onChange(predefinedBlocks.map(pb =>
      pb.id === id ? { ...pb, inputs: { ...pb.inputs, [inputName]: value } } : pb
    ))
  }

  function updateNewInput(inputName, value) {
    setNewBlock(b => ({ ...b, inputs: { ...b.inputs, [inputName]: value } }))
  }

  if (eligibleTypes.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#9ca3af', margin: '4px 0 0' }}>
        No eligible blocks in the current toolbox. Enable blocks with configurable inputs to add predefined versions.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {predefinedBlocks.map(pb => {
        const fields = getBlockInputFields(pb.type)
        return (
          <div key={pb.id} className="te-predefined-block-row">
            <span className="te-predefined-block-label">{blockLabel(pb.type)}</span>
            {fields.map(f => (
              <label key={f.name} className="te-predefined-block-field">
                <span className="te-predefined-block-field-name">{f.name.toLowerCase()}</span>
                <input
                  className="te-input"
                  type={f.inputType}
                  value={pb.inputs[f.name] ?? f.defaultValue}
                  onChange={e => updateInput(pb.id, f.name, f.inputType === 'number' ? Number(e.target.value) : e.target.value)}
                  style={{ width: f.inputType === 'number' ? 64 : 100 }}
                />
              </label>
            ))}
            <button type="button" className="te-check-remove-btn" onClick={() => remove(pb.id)} title="Remove">×</button>
          </div>
        )
      })}

      {newBlock ? (
        <div className="te-predefined-block-row te-predefined-block-row--adding">
          <select
            className="te-select"
            value={newBlock.type}
            onChange={e => handleNewTypeChange(e.target.value)}
          >
            {eligibleTypes.map(t => (
              <option key={t} value={t}>{blockLabel(t)}</option>
            ))}
          </select>
          {getBlockInputFields(newBlock.type).map(f => (
            <label key={f.name} className="te-predefined-block-field">
              <span className="te-predefined-block-field-name">{f.name.toLowerCase()}</span>
              <input
                className="te-input"
                type={f.inputType}
                value={newBlock.inputs[f.name] ?? f.defaultValue}
                onChange={e => updateNewInput(f.name, f.inputType === 'number' ? Number(e.target.value) : e.target.value)}
                style={{ width: f.inputType === 'number' ? 64 : 100 }}
              />
            </label>
          ))}
          {getBlockInputFields(newBlock.type).length === 0 && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af' }}>No configurable inputs</span>
          )}
          <button type="button" className="btn-ghost-outline" style={{ padding: '4px 10px', fontSize: '0.82rem' }} onClick={confirmAdd}>Add</button>
          <button type="button" className="btn-ghost-outline" style={{ padding: '4px 10px', fontSize: '0.82rem' }} onClick={() => setNewBlock(null)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="te-add-check-btn" onClick={startAdding}>
          + Add predefined block
        </button>
      )}
    </div>
  )
}

// ── Check editors ─────────────────────────────────────────────────────────────

function ScratchCheckListEditor({ checks, onChange, sprites }) {
  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => i === index ? updated : c))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    onChange([...checks, { type: 'block_used', evaluation: 'manual', opcode: 'motion_movesteps' }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {checks.length > 1 && (
            <span className="te-check-index" style={{ paddingTop: 10 }}>#{index + 1}</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ScratchCheckEditor
              check={check}
              onChange={updated => updateCheck(index, updated)}
              sprites={sprites}
            />
          </div>
          {checks.length > 1 && (
            <button type="button" className="te-check-remove-btn" onClick={() => removeCheck(index)} title="Remove check">×</button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost te-add-check-btn" onClick={addCheck}>
        + Add check
      </button>
    </div>
  )
}

const SPRITE_PROPERTIES = ['x', 'y', 'size', 'direction', 'visible']
const COMPARISON_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
]

function describeCheck(check, sprites) {
  const spriteName = check.spriteName ?? sprites[0]?.name ?? 'Sprite 1'
  const propLabel = check.property ?? 'x'
  const evalLabel = check.evaluation === 'after_run' ? 'After running' : 'When checked manually'

  switch (check.type) {
    case 'block_used': {
      const found = SCRATCH_BLOCK_OPTIONS.find(([t]) => t === check.opcode)
      const label = found ? found[1] : check.opcode
      return `Workspace must contain a "${label}" block`
    }
    case 'sprite_property': {
      const opLabel = COMPARISON_OPERATORS.find(o => o.value === check.operator)?.label ?? check.operator
      return `${evalLabel}: ${spriteName}'s ${propLabel} must be ${opLabel} ${check.value}`
    }
    case 'variable_equals':
      return `${evalLabel}: variable "${check.variableName ?? 'score'}" must equal ${check.value}`
    case 'sprite_property_delta': {
      const opLabel = COMPARISON_OPERATORS.find(o => o.value === check.operator)?.label ?? check.operator
      return `After running: ${spriteName}'s ${propLabel} must have changed by ${opLabel} ${check.value}`
    }
    case 'sprite_property_changed':
      return `After running: ${spriteName}'s ${propLabel} must have changed`
    default:
      return ''
  }
}

function ScratchCheckEditor({ check, onChange, sprites = [{ id: 'sprite1', name: 'Sprite 1' }] }) {
  const type = check.type ?? 'block_used'

  function changeType(nextType) {
    const hint = check.hint ? { hint: check.hint } : {}
    if (nextType === 'sprite_property') {
      onChange({ type: 'sprite_property', evaluation: 'after_run', spriteName: sprites[0]?.name ?? 'Sprite 1', property: 'x', operator: 'greater_than', value: 50, ...hint })
      return
    }
    if (nextType === 'variable_equals') {
      onChange({ type: 'variable_equals', evaluation: 'manual', variableName: 'score', value: 10, ...hint })
      return
    }
    if (nextType === 'sprite_property_delta') {
      onChange({ type: 'sprite_property_delta', evaluation: 'after_run', spriteName: sprites[0]?.name ?? 'Sprite 1', property: 'x', operator: 'greater_than', value: 10, ...hint })
      return
    }
    if (nextType === 'sprite_property_changed') {
      onChange({ type: 'sprite_property_changed', evaluation: 'after_run', spriteName: sprites[0]?.name ?? 'Sprite 1', property: 'x', ...hint })
      return
    }
    onChange({ type: 'block_used', evaluation: 'manual', opcode: 'motion_movesteps', ...hint })
  }

  const preview = describeCheck(check, sprites)

  return (
    <div className="te-scratch-check-editor">
      {/* Row 1: type + evaluation */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select className="te-select" value={type} onChange={e => changeType(e.target.value)}>
          <option value="block_used">Uses block</option>
          <option value="sprite_property">Sprite property</option>
          <option value="variable_equals">Variable equals</option>
          <option value="sprite_property_delta">Sprite property changed by</option>
          <option value="sprite_property_changed">Sprite property changed</option>
        </select>
        <select
          className="te-select"
          value={check.evaluation ?? (type === 'block_used' ? 'manual' : 'after_run')}
          onChange={e => onChange({ ...check, evaluation: e.target.value })}
        >
          <option value="manual">manual</option>
          <option value="after_run">after run</option>
        </select>
      </div>

      {/* Row 2: type-specific fields */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {type === 'block_used' ? (
          <select
            className="te-select"
            value={check.opcode ?? ''}
            onChange={e => onChange({ ...check, opcode: e.target.value })}
          >
            {SCRATCH_BLOCK_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        ) : type === 'variable_equals' ? (
          <>
            <input
              className="te-input"
              value={check.variableName ?? 'score'}
              onChange={e => onChange({ ...check, variableName: e.target.value })}
              placeholder="Variable name"
            />
            <input
              className="te-input"
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Expected value"
            />
          </>
        ) : type === 'sprite_property_changed' ? (
          <>
            <select
              className="te-select"
              value={check.spriteName ?? sprites[0]?.name ?? 'Sprite 1'}
              onChange={e => onChange({ ...check, spriteName: e.target.value })}
            >
              {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
            </select>
            <select
              className="te-select"
              value={check.property ?? 'x'}
              onChange={e => onChange({ ...check, property: e.target.value })}
            >
              {SPRITE_PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </>
        ) : (
          /* sprite_property and sprite_property_delta share the same fields */
          <>
            <select
              className="te-select"
              value={check.spriteName ?? sprites[0]?.name ?? 'Sprite 1'}
              onChange={e => onChange({ ...check, spriteName: e.target.value })}
            >
              {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
            </select>
            <select
              className="te-select"
              value={check.property ?? 'x'}
              onChange={e => onChange({ ...check, property: e.target.value })}
            >
              {SPRITE_PROPERTIES.filter(p => type === 'sprite_property_delta' ? p !== 'visible' : true).map(p =>
                <option key={p} value={p}>{p}</option>
              )}
            </select>
            <select
              className="te-select"
              value={check.operator ?? 'equals'}
              onChange={e => onChange({ ...check, operator: e.target.value })}
            >
              {COMPARISON_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              className="te-input"
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Value"
              style={{ width: 80 }}
            />
          </>
        )}
      </div>

      {/* Row 3: preview */}
      {preview && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', margin: '2px 0 0' }}>
          {preview}
        </p>
      )}

      {/* Row 4: hint markdown editor */}
      <MarkdownFieldEditor
        height={180}
        minHeight={140}
        ariaLabel="Scratch check hint Markdown editor views"
        value={check.hint ?? ''}
        onChange={value => onChange({ ...check, hint: value })}
        placeholder="Suggestion shown in the completion banner when this check fails..."
        lessonType="scratch"
      />
    </div>
  )
}

export function VariableManager({ variables, onChange }) {
  const vars = variables ?? []

  function addVariable() {
    onChange([...vars, { name: `var${vars.length + 1}`, showOnStage: false }])
  }

  function removeVariable(index) {
    onChange(vars.filter((_, i) => i !== index))
  }

  function updateVariable(index, updates) {
    onChange(vars.map((v, i) => i === index ? { ...v, ...updates } : v))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {vars.map((v, i) => (
        <div key={i} className="te-variable-row">
          <input
            className="te-input"
            style={{ flex: 1, minWidth: 0 }}
            value={v.name}
            onChange={e => updateVariable(i, { name: e.target.value })}
            placeholder="Variable name"
          />
          <label className="te-variable-stage-label" title="Show on stage">
            <input
              type="checkbox"
              checked={!!v.showOnStage}
              onChange={e => updateVariable(i, { showOnStage: e.target.checked })}
            />
            <span>Stage</span>
          </label>
          <button
            type="button"
            className="te-check-remove-btn"
            style={{ marginTop: 0 }}
            onClick={() => removeVariable(i)}
            title="Remove variable"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost te-add-check-btn" onClick={addVariable}>
        + Add variable
      </button>
    </div>
  )
}

export { ScratchCheckListEditor, ScratchCheckEditor, buildScratchToolboxXml, parseScratchToolboxXml }
