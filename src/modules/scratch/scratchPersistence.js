// Scratch workspace serialization and workspace-state migration utilities.
// Exported migration helpers are tested directly in scratchPersistence.test.js.

export function saveWorkspace(Blockly, workspace) {
  return Blockly.serialization.workspaces.save(workspace)
}

export function loadWorkspace(Blockly, workspace, state) {
  Blockly.serialization.workspaces.load(migrateVariableFields(migrateBroadcastState(state)), workspace)
}

// Converts old input_value+shadow format for broadcast blocks to the new field_input format.
// Needed for workspaces saved before the broadcast block definition changed.
export function migrateBroadcastState(state) {
  if (!state?.blocks?.blocks) return state
  const clone = JSON.parse(JSON.stringify(state))
  for (const block of clone.blocks.blocks) migrateBroadcastBlock(block)
  return clone
}

function migrateBroadcastBlock(block) {
  if (!block) return
  if (block.type === 'event_broadcast' || block.type === 'event_broadcastandwait') {
    const text = block.inputs?.BROADCAST_INPUT?.shadow?.fields?.TEXT
    if (text != null && block.fields?.BROADCAST_INPUT == null) {
      block.fields = { ...(block.fields ?? {}), BROADCAST_INPUT: String(text) }
      delete block.inputs.BROADCAST_INPUT
      if (!Object.keys(block.inputs).length) delete block.inputs
    }
  }
  if (block.next?.block) migrateBroadcastBlock(block.next.block)
  for (const inp of Object.values(block.inputs ?? {})) {
    if (inp?.block) migrateBroadcastBlock(inp.block)
  }
}

// Converts old field_variable format { id, name } to plain name string for field_dropdown.
export function migrateVariableFields(state) {
  if (!state?.blocks?.blocks?.length) return state
  const varMap = {}
  for (const v of state.variables ?? []) {
    if (v.id && v.name) varMap[v.id] = v.name
  }
  const clone = JSON.parse(JSON.stringify(state))
  delete clone.variables
  for (const block of clone.blocks.blocks) migrateVariableBlock(block, varMap)
  return clone
}

function migrateVariableBlock(block, varMap) {
  if (!block) return
  if (block.type === 'data_variable' || block.type === 'data_setvariableto' || block.type === 'data_changevariableby') {
    const field = block.fields?.VARIABLE
    if (field && typeof field === 'object') {
      block.fields.VARIABLE = field.name ?? varMap[field.id] ?? 'score'
    } else if (typeof field === 'string' && varMap[field]) {
      block.fields.VARIABLE = varMap[field]
    }
  }
  if (block.next?.block) migrateVariableBlock(block.next.block, varMap)
  for (const inp of Object.values(block.inputs ?? {})) {
    if (inp?.block) migrateVariableBlock(inp.block, varMap)
    if (inp?.shadow) migrateVariableBlock(inp.shadow, varMap)
  }
}
