import React from 'react'
import { createPortal } from 'react-dom'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import {
  BLOCK_DISPLAY_TEMPLATES,
  DEFAULT_TOOLBOX,
  VALUE_INPUT_DEFAULTS,
  buildAlwaysOpenToolbox,
  createScratchBlockStack,
  loadBlocklyModules,
  predefinedBlockToStack,
} from '../../../shared/scratch'
import { normalizeSequenceItem } from '../../../shared/scratchChecks'

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
      ['looks_costumenumbername', 'costume number/name'],
      ['looks_switchbackdropto', 'switch backdrop to'],
      ['looks_nextbackdrop', 'next backdrop'],
      ['looks_backdropnumbername', 'backdrop number/name'],
      ['looks_seteffectto', 'set effect to'],
      ['looks_changeeffectby', 'change effect by'],
      ['looks_cleargraphiceffects', 'clear graphic effects'],
    ],
  },
  {
    name: 'Control',
    colour: '#FFAB19',
    blocks: [
      ['control_wait', 'wait'],
      ['control_wait_until', 'wait until'],
      ['control_repeat', 'repeat'],
      ['control_repeat_until', 'repeat until'],
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
      ['sensing_distanceto', 'distance to'],
      ['sensing_timer', 'timer'],
      ['sensing_resettimer', 'reset timer'],
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
      ['operator_multiply', 'multiply'],
      ['operator_divide', 'divide'],
      ['operator_mod', 'mod'],
      ['operator_round', 'round'],
      ['operator_mathop', 'math operation'],
      ['operator_join', 'join'],
      ['operator_letter_of', 'letter of'],
      ['operator_length', 'length of'],
      ['operator_contains', 'contains'],
    ],
  },
  {
    name: 'Variables',
    colour: '#FF8C1A',
    blocks: [
      ['data_variable', 'variable'],
      ['data_setvariableto', 'set variable'],
      ['data_changevariableby', 'change variable'],
      ['data_showvariable', 'show variable'],
      ['data_hidevariable', 'hide variable'],
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

function blockColour(type) {
  const group = SCRATCH_TOOLBOX_GROUPS.find(g => g.blocks.some(([t]) => t === type))
  return group?.colour ?? '#6b7280'
}

export function ScratchBlockPicker({ value, onChange, allowedTypes = SCRATCH_ALL_BLOCK_TYPES, compact = false, placeholder = 'Choose block', fieldValues, onChangeFieldValues }) {
  const [open, setOpen] = React.useState(false)
  const [menuStyle, setMenuStyle] = React.useState(null)
  const wrapRef = React.useRef(null)
  const menuRef = React.useRef(null)
  const allowed = new Set(allowedTypes)
  const currentLabel = value ? blockLabel(value) : placeholder
  const currentColour = value ? blockColour(value) : '#6b7280'

  // Build inline template parts when fieldValues are active
  const inlineTemplate = fieldValues !== undefined ? BLOCK_DISPLAY_TEMPLATES[value] : null
  const inlineParts = React.useMemo(() => {
    if (!inlineTemplate) return null
    const parts = []
    const regex = /%(\d+)/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(inlineTemplate.message)) !== null) {
      const textBefore = inlineTemplate.message.slice(lastIndex, match.index).trim()
      if (textBefore) parts.push({ text: textBefore })
      const inputName = inlineTemplate.inputOrder[parseInt(match[1]) - 1]
      const shadow = VALUE_INPUT_DEFAULTS[value]?.[inputName]
      parts.push({ inputName, placeholder: String(shadow?.value ?? ''), isText: shadow?.type === 'text' })
      lastIndex = match.index + match[0].length
    }
    const tail = inlineTemplate.message.slice(lastIndex).trim()
    if (tail) parts.push({ text: tail })
    return parts
  }, [inlineTemplate, value])

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (wrapRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  React.useLayoutEffect(() => {
    if (!open) return
    function positionMenu() {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 8
      const gap = 4
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const width = Math.min(300, viewportWidth - margin * 2)
      const spaceBelow = viewportHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      const opensUp = spaceBelow < 240 && spaceAbove > spaceBelow
      const maxHeight = Math.max(160, Math.min(360, (opensUp ? spaceAbove : spaceBelow) - gap))
      const left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin)
      const top = opensUp
        ? Math.max(margin, rect.top - maxHeight - gap)
        : Math.min(rect.bottom + gap, viewportHeight - maxHeight - margin)
      setMenuStyle({ left, top, width, maxHeight })
    }
    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open])

  function choose(type) {
    onChange(type)
    setOpen(false)
  }

  const menu = open ? createPortal(
    <div
      className="te-scratch-block-menu"
      role="listbox"
      ref={menuRef}
      style={menuStyle ?? { visibility: 'hidden' }}
    >
      {SCRATCH_TOOLBOX_GROUPS.map(group => {
        const blocks = group.blocks.filter(([type]) => allowed.has(type))
        if (!blocks.length) return null
        return (
          <div key={group.name} className="te-scratch-block-menu__group">
            <div className="te-scratch-block-menu__title">{group.name}</div>
            {blocks.map(([type, label]) => (
              <button
                key={type}
                type="button"
                className="te-scratch-block-menu__item"
                style={{ backgroundColor: group.colour }}
                onClick={() => choose(type)}
                role="option"
                aria-selected={value === type}
              >
                {label}
              </button>
            ))}
          </div>
        )
      })}
    </div>,
    document.body
  ) : null

  const chipClass = compact ? 'te-scratch-block-chip te-scratch-block-chip--compact' : 'te-scratch-block-chip'

  return (
    <div className="te-scratch-block-picker" ref={wrapRef}>
      {inlineParts ? (
        <div
          className={chipClass}
          style={{ backgroundColor: currentColour, display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
          aria-expanded={open}
        >
          {inlineParts.map((part, i) =>
            part.inputName ? (
              <input
                key={i}
                type="text"
                className={`te-scratch-inline-input${part.isText ? ' te-scratch-inline-input--text' : ''}${compact ? ' te-scratch-inline-input--compact' : ''}`}
                value={fieldValues?.[part.inputName] ?? ''}
                onChange={e => {
                  const fv = { ...fieldValues }
                  if (e.target.value === '') delete fv[part.inputName]
                  else fv[part.inputName] = e.target.value
                  onChangeFieldValues?.(fv)
                }}
                onClick={e => e.stopPropagation()}
                placeholder={part.placeholder}
              />
            ) : (
              <span key={i} style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>{part.text}</span>
            )
          )}
        </div>
      ) : (
        <button
          type="button"
          className={chipClass}
          style={{ backgroundColor: currentColour }}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          {currentLabel}
        </button>
      )}
      {menu}
    </div>
  )
}

function defaultInputValuesForBlock(type) {
  const inputs = {}
  for (const [name, shadow] of Object.entries(VALUE_INPUT_DEFAULTS[type] ?? {})) {
    inputs[name] = shadow.value
  }
  return inputs
}

function newStack(type) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    label: blockLabel(type),
    stack: createScratchBlockStack(type, defaultInputValuesForBlock(type)),
  }
}

function normalizeStackForEditor(stack) {
  if (!stack?.type) return null
  const clone = JSON.parse(JSON.stringify(stack))
  stripRuntimeBlockFields(clone)
  return clone
}

function stripRuntimeBlockFields(block) {
  delete block.id
  delete block.x
  delete block.y
  for (const input of Object.values(block.inputs ?? {})) {
    if (input.block) stripRuntimeBlockFields(input.block)
    if (input.shadow) stripRuntimeBlockFields(input.shadow)
  }
  if (block.next?.block) stripRuntimeBlockFields(block.next.block)
}

function ScratchStackWorkspace({ stack, toolbox, onChange }) {
  const hostRef = React.useRef(null)
  const workspaceRef = React.useRef(null)
  const suppressRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    async function init() {
      const { Blockly } = await loadBlocklyModules()
      if (cancelled || !hostRef.current) return
      const ws = Blockly.inject(hostRef.current, {
        toolbox: buildAlwaysOpenToolbox(toolbox || DEFAULT_TOOLBOX),
        renderer: 'zelos',
        grid: { spacing: 20, length: 2, colour: '#e5e7eb', snap: true },
        zoom: { startScale: 0.7 },
        trashcan: true,
      })
      workspaceRef.current = ws
      const initial = normalizeStackForEditor(stack)
      if (initial) {
        try {
          suppressRef.current = true
          Blockly.serialization.workspaces.load({ blocks: { blocks: [initial] } }, ws)
          requestAnimationFrame(() => { suppressRef.current = false })
        } catch {
          suppressRef.current = false
        }
      }
      ws.addChangeListener(() => {
        if (suppressRef.current) return
        const state = Blockly.serialization.workspaces.save(ws)
        const next = normalizeStackForEditor(state?.blocks?.blocks?.[0])
        if (next) onChange(next)
      })
      Blockly.svgResize(ws)
    }
    init()
    return () => {
      cancelled = true
      workspaceRef.current?.dispose?.()
      workspaceRef.current = null
    }
  }, [toolbox])

  return <div className="te-stack-workspace" ref={hostRef} />
}

export function PrebuiltStacksEditor({ prebuiltStacks = [], predefinedBlocks = [], toolbox = '', onChange }) {
  const [editingStackId, setEditingStackId] = React.useState(null)
  const toolboxTypes = new Set(parseScratchToolboxXml(toolbox))
  const eligibleTypes = SCRATCH_ALL_BLOCK_TYPES.filter(t => !toolbox || toolboxTypes.has(t))

  const legacyStacks = (predefinedBlocks ?? [])
    .map((pb, index) => predefinedBlockToStack({ ...pb, id: pb.id ?? `legacy-${index}` }))
    .filter(Boolean)
  const stacks = [...legacyStacks, ...(prebuiltStacks ?? [])]

  // Close editor if the stack being edited was removed
  React.useEffect(() => {
    if (editingStackId && !stacks.find(s => s.id === editingStackId)) {
      setEditingStackId(null)
    }
  })

  function addStack(type) {
    const s = newStack(type)
    onChange([...stacks, s])
    setEditingStackId(s.id)
  }

  function remove(id) {
    onChange(stacks.filter(stack => stack.id !== id))
  }

  function updateStack(id, updates) {
    onChange(stacks.map(stack => stack.id === id ? { ...stack, ...updates } : stack))
  }

  if (eligibleTypes.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#9ca3af', margin: '4px 0 0' }}>
        No blocks are available in the current toolbox. Enable blocks to add prebuilt stacks.
      </p>
    )
  }

  const editingStack = stacks.find(s => s.id === editingStackId)

  return (
    <div className="te-prebuilt-stack-editor">
      {stacks.map(pb => {
        const type = pb.stack?.type ?? 'motion_movesteps'
        return (
          <div key={pb.id} className="te-prebuilt-stack-row">
            <span
              className="te-scratch-block-chip te-scratch-block-chip--compact"
              style={{ backgroundColor: blockColour(type), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {blockLabel(type)}
            </span>
            <button
              type="button"
              className="btn-ghost-outline"
              style={{ padding: '2px 8px', fontSize: '0.78rem', flexShrink: 0 }}
              onClick={() => setEditingStackId(pb.id)}
            >
              Edit
            </button>
            <button type="button" className="te-check-remove-btn" onClick={() => remove(pb.id)} title="Remove stack">×</button>
          </div>
        )
      })}

      <div className="te-prebuilt-stack-add">
        <ScratchBlockPicker
          value={null}
          onChange={addStack}
          allowedTypes={eligibleTypes}
          compact
          placeholder="+ Add stack"
        />
      </div>

      {editingStack && createPortal(
        <div
          className="te-stack-edit-overlay"
          onPointerDown={e => { if (e.target === e.currentTarget) setEditingStackId(null) }}
        >
          <div className="te-stack-edit-modal">
            <div className="te-stack-edit-modal__header">
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem' }}>
                Edit prebuilt stack: {blockLabel(editingStack.stack?.type ?? '')}
              </span>
              <button type="button" className="btn-ghost" onClick={() => setEditingStackId(null)}>Done</button>
            </div>
            <ScratchStackWorkspace
              key={`edit-${editingStackId}`}
              stack={editingStack.stack}
              toolbox={toolbox}
              onChange={stack => updateStack(editingStackId, { stack })}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

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
      const fvEntries = check.fieldValues ? Object.entries(check.fieldValues).filter(([, v]) => v !== '') : []
      const values = fvEntries.length > 0 ? ` (${fvEntries.map(([k, v]) => `${k.toLowerCase()}=${v}`).join(', ')})` : ''
      return `Workspace must contain a "${label}" block${values}`
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
    case 'blocks_in_order': {
      const labels = (check.sequence ?? [])
        .map(item => {
          const { opcode, fieldValues } = normalizeSequenceItem(item)
          const found = SCRATCH_BLOCK_OPTIONS.find(([t]) => t === opcode)
          const label = found ? found[1] : opcode
          const fvEntries = fieldValues ? Object.entries(fieldValues).filter(([, v]) => v !== '') : []
          const values = fvEntries.length > 0 ? ` (${fvEntries.map(([k, v]) => `${k.toLowerCase()}=${v}`).join(', ')})` : ''
          return label + values
        })
        .join(' → ')
      const spriteLabel = check.spriteName ?? 'Any sprite'
      return `${spriteLabel}: workspace must contain the sequence: ${labels}`
    }
    case 'block_count': {
      const found = SCRATCH_BLOCK_OPTIONS.find(([t]) => t === check.opcode)
      const opLabel = COMPARISON_OPERATORS.find(o => o.value === check.operator)?.label ?? check.operator
      return `Workspace must have "${found?.[1] ?? check.opcode}" block count ${opLabel} ${check.value}`
    }
    case 'variable_compare': {
      const opLabel = COMPARISON_OPERATORS.find(o => o.value === check.operator)?.label ?? check.operator
      return `${evalLabel}: variable "${check.variableName ?? 'score'}" must be ${opLabel} ${check.value}`
    }
    case 'costume_is':
      return `${evalLabel}: ${spriteName}'s costume must be "${check.value}"`
    case 'block_run': {
      const found = SCRATCH_BLOCK_OPTIONS.find(([t]) => t === check.opcode)
      const fvEntries = check.fieldValues ? Object.entries(check.fieldValues).filter(([, v]) => v !== '') : []
      const values = fvEntries.length > 0 ? ` (${fvEntries.map(([k, v]) => `${k.toLowerCase()}=${v}`).join(', ')})` : ''
      return `After running: a "${found?.[1] ?? check.opcode}" block must have been executed${values}`
    }
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
    if (nextType === 'blocks_in_order') {
      onChange({ type: 'blocks_in_order', evaluation: 'manual', sequence: ['event_whenflagclicked', 'motion_movesteps'], ...hint })
      return
    }
    if (nextType === 'block_count') {
      onChange({ type: 'block_count', evaluation: 'manual', opcode: 'motion_movesteps', operator: 'equals', value: 1, ...hint })
      return
    }
    if (nextType === 'variable_compare') {
      onChange({ type: 'variable_compare', evaluation: 'after_run', variableName: 'score', operator: 'greater_than', value: 0, ...hint })
      return
    }
    if (nextType === 'costume_is') {
      onChange({ type: 'costume_is', evaluation: 'after_run', spriteName: sprites[0]?.name ?? 'Sprite 1', value: 'costume2', ...hint })
      return
    }
    if (nextType === 'block_run') {
      onChange({ type: 'block_run', evaluation: 'after_run', opcode: 'motion_movesteps', ...hint })
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
          <option value="blocks_in_order">Blocks in order</option>
          <option value="block_count">Block count</option>
          <option value="block_run">Block was run</option>
          <option value="sprite_property">Sprite property</option>
          <option value="sprite_property_delta">Sprite property changed by</option>
          <option value="sprite_property_changed">Sprite property changed</option>
          <option value="costume_is">Costume is</option>
          <option value="variable_equals">Variable equals</option>
          <option value="variable_compare">Variable compare</option>
        </select>
        {type !== 'block_run' && (
          <select
            className="te-select"
            value={check.evaluation ?? (type === 'block_used' || type === 'blocks_in_order' || type === 'block_count' ? 'manual' : 'after_run')}
            onChange={e => onChange({ ...check, evaluation: e.target.value })}
          >
            <option value="manual">manual</option>
            <option value="after_run">after run</option>
          </select>
        )}
      </div>

      {/* Row 2: type-specific fields */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {type === 'block_used' || type === 'block_run' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ScratchBlockPicker
              value={check.opcode ?? 'motion_movesteps'}
              onChange={opcode => onChange({ ...check, opcode, fieldValues: undefined })}
              fieldValues={check.fieldValues}
              onChangeFieldValues={fv => onChange({ ...check, fieldValues: fv })}
            />
            {VALUE_INPUT_DEFAULTS[check.opcode ?? 'motion_movesteps'] && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!check.fieldValues}
                  onChange={e => onChange({ ...check, fieldValues: e.target.checked ? {} : undefined })}
                />
                Require specific values
              </label>
            )}
          </div>
        ) : type === 'block_count' ? (
          <>
            <select
              className="te-select"
              value={check.spriteName ?? ''}
              onChange={e => onChange({ ...check, spriteName: e.target.value || undefined })}
            >
              <option value="">Any sprite</option>
              {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
            </select>
            <ScratchBlockPicker
              value={check.opcode ?? 'motion_movesteps'}
              onChange={opcode => onChange({ ...check, opcode })}
              compact
            />
            <select
              className="te-select"
              value={check.operator ?? 'equals'}
              onChange={e => onChange({ ...check, operator: e.target.value })}
            >
              {COMPARISON_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              className="te-input"
              type="number"
              value={check.value ?? 1}
              onChange={e => onChange({ ...check, value: Number(e.target.value) })}
              style={{ width: 64 }}
            />
          </>
        ) : type === 'blocks_in_order' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <select
              className="te-select"
              value={check.spriteName ?? ''}
              onChange={e => onChange({ ...check, spriteName: e.target.value || undefined })}
              style={{ alignSelf: 'flex-start' }}
            >
              <option value="">Any sprite</option>
              {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
            </select>
            {(check.sequence ?? ['motion_movesteps']).map((seqItem, idx) => {
              const { opcode, fieldValues } = normalizeSequenceItem(seqItem)
              const hasInputs = !!VALUE_INPUT_DEFAULTS[opcode]
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9ca3af', minWidth: 20 }}>
                    {idx + 1}.
                  </span>
                  <ScratchBlockPicker
                    value={opcode}
                    onChange={nextOpcode => {
                      const next = [...(check.sequence ?? [])]
                      next[idx] = nextOpcode
                      onChange({ ...check, sequence: next })
                    }}
                    fieldValues={fieldValues !== null ? fieldValues : undefined}
                    onChangeFieldValues={fv => {
                      const next = [...(check.sequence ?? [])]
                      next[idx] = { opcode, fieldValues: fv }
                      onChange({ ...check, sequence: next })
                    }}
                    compact
                  />
                  {hasInputs && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer', flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={fieldValues !== null}
                        onChange={e => {
                          const next = [...(check.sequence ?? [])]
                          next[idx] = e.target.checked ? { opcode, fieldValues: {} } : opcode
                          onChange({ ...check, sequence: next })
                        }}
                      />
                      values
                    </label>
                  )}
                  <button
                    type="button"
                    className="te-check-remove-btn"
                    disabled={(check.sequence ?? []).length <= 1}
                    onClick={() => onChange({ ...check, sequence: (check.sequence ?? []).filter((_, i) => i !== idx) })}
                    title="Remove"
                  >×</button>
                </div>
              )
            })}
            <button
              type="button"
              className="btn-ghost te-add-check-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => onChange({ ...check, sequence: [...(check.sequence ?? []), SCRATCH_BLOCK_OPTIONS[0][0]] })}
            >+ Add block</button>
          </div>
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
        ) : type === 'variable_compare' ? (
          <>
            <input
              className="te-input"
              value={check.variableName ?? 'score'}
              onChange={e => onChange({ ...check, variableName: e.target.value })}
              placeholder="Variable name"
            />
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
              placeholder="Expected value"
              style={{ width: 80 }}
            />
          </>
        ) : type === 'costume_is' ? (
          <>
            <select
              className="te-select"
              value={check.spriteName ?? sprites[0]?.name ?? 'Sprite 1'}
              onChange={e => onChange({ ...check, spriteName: e.target.value })}
            >
              {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
            </select>
            <input
              className="te-input"
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Costume name"
              style={{ width: 120 }}
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
