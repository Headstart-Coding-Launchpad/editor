import { findTaskById, getStarterStage } from '../shared/taskUtils'

export function canCarryTaskContent(tasks, carryFromId, currentTaskId) {
  if (!carryFromId) return false
  const sourceTask = findTaskById(tasks, carryFromId)
  if (!sourceTask || sourceTask.taskType === 'quiz' || sourceTask.taskType === 'information')
    return false
  return sourceTask.id !== currentTaskId
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key)
}

function buildCarryFallbackRecord({
  taskId,
  field,
  requestedSourceTaskId,
  resolvedSourceTaskId,
  skippedSourceTaskIds,
}) {
  if (resolvedSourceTaskId == null || resolvedSourceTaskId === requestedSourceTaskId) return null
  return {
    taskId,
    field,
    requestedSourceTaskId,
    resolvedSourceTaskId,
    skippedSourceTaskIds,
  }
}

export function resolveSavedCarrySource({
  tasks,
  taskId,
  carryFromId,
  carryField,
  readSavedState,
  hasSavedState,
}) {
  if (!canCarryTaskContent(tasks, carryFromId, taskId)) {
    return { saved: null, sourceTaskId: null, fallback: null }
  }

  const skippedSourceTaskIds = []
  const seen = new Set([taskId])
  let resolveId = carryFromId

  while (resolveId != null && !seen.has(resolveId)) {
    seen.add(resolveId)
    const sourceTask = findTaskById(tasks, resolveId)
    if (!sourceTask || sourceTask.taskType === 'quiz' || sourceTask.taskType === 'information')
      break

    const saved = readSavedState(resolveId)
    if (hasSavedState(saved)) {
      return {
        saved,
        sourceTaskId: resolveId,
        fallback: buildCarryFallbackRecord({
          taskId,
          field: carryField,
          requestedSourceTaskId: carryFromId,
          resolvedSourceTaskId: resolveId,
          skippedSourceTaskIds,
        }),
      }
    }

    skippedSourceTaskIds.push(resolveId)
    resolveId = sourceTask[carryField] ?? null
  }

  return { saved: null, sourceTaskId: null, fallback: null }
}

function notifyCarryFallback(onCarryFallback, fallback) {
  if (fallback) onCarryFallback?.(fallback)
}

export function selectPythonTaskCode({
  tasks,
  task,
  taskId,
  phase,
  readSavedCode,
  onCarryFallback,
}) {
  if (phase === 'solo') {
    const ownSaved = readSavedCode(taskId)
    if (ownSaved != null) return ownSaved.code ?? ''
  }

  let initial = getStarterStage(task)?.stage?.code ?? task.starterCode ?? ''
  const carried = resolveSavedCarrySource({
    tasks,
    taskId,
    carryFromId: task.carryCodeFrom,
    carryField: 'carryCodeFrom',
    readSavedState: readSavedCode,
    hasSavedState: (saved) => saved != null && hasOwn(saved, 'code'),
  })
  if (carried.saved != null) {
    initial = carried.saved.code ?? ''
    notifyCarryFallback(onCarryFallback, carried.fallback)
  }
  return initial
}

export function selectHtmlTaskFiles({
  tasks,
  task,
  taskId,
  phase,
  readSavedFile,
  onCarryFallback,
}) {
  const fileFallbacks = []
  const starterFiles = getStarterStage(task)?.stage?.files ?? task.starterFiles ?? []
  const files = starterFiles.map((file) => {
    if (phase === 'solo') {
      const ownSaved = readSavedFile(taskId, file.name)
      if (ownSaved != null) return { ...file, content: ownSaved }
    }

    let content = file.content
    const carried = resolveSavedCarrySource({
      tasks,
      taskId,
      carryFromId: task.carryCodeFrom,
      carryField: 'carryCodeFrom',
      readSavedState: (sourceTaskId) => readSavedFile(sourceTaskId, file.name),
      hasSavedState: (saved) => saved != null,
    })
    if (carried.saved != null) {
      content = carried.saved
      if (carried.fallback) {
        fileFallbacks.push({ filename: file.name, ...carried.fallback })
      }
    }
    return { ...file, content }
  })

  if (fileFallbacks.length > 0) {
    const resolvedSourceIds = [
      ...new Set(fileFallbacks.map((fallback) => fallback.resolvedSourceTaskId)),
    ]
    const skippedIds = [
      ...new Set(fileFallbacks.flatMap((fallback) => fallback.skippedSourceTaskIds ?? [])),
    ]
    onCarryFallback?.({
      taskId,
      field: 'carryCodeFrom',
      requestedSourceTaskId: task.carryCodeFrom,
      resolvedSourceTaskId: resolvedSourceIds.length === 1 ? resolvedSourceIds[0] : null,
      skippedSourceTaskIds: skippedIds,
      files: fileFallbacks.map(
        ({ filename, requestedSourceTaskId, resolvedSourceTaskId, skippedSourceTaskIds }) => ({
          filename,
          requestedSourceTaskId,
          resolvedSourceTaskId,
          skippedSourceTaskIds,
        })
      ),
    })
  }

  return files
}

export function selectScratchInitialProject({
  tasks = null,
  task,
  taskId,
  readSavedCode,
  onCarryFallback,
}) {
  const saved = readSavedCode(taskId)
  if (saved != null && hasOwn(saved, 'state')) return saved.state ?? null

  let initialProject = null
  if (!tasks && task?.carryBlocksFrom) {
    const carried = readSavedCode(task.carryBlocksFrom)
    if (carried != null && hasOwn(carried, 'state')) initialProject = carried.state ?? null
  } else {
    const carried = resolveSavedCarrySource({
      tasks,
      taskId,
      carryFromId: task?.carryBlocksFrom,
      carryField: 'carryBlocksFrom',
      readSavedState: readSavedCode,
      hasSavedState: (state) => state != null && hasOwn(state, 'state'),
    })
    if (carried.saved != null) {
      initialProject = carried.saved.state ?? null
      notifyCarryFallback(onCarryFallback, carried.fallback)
    }
  }
  if (!initialProject)
    initialProject = getStarterStage(task)?.stage?.blocks ?? task?.starterBlocks ?? null
  return initialProject
}

export function selectScratchToolboxSnippets({ task, activeStageIndex = null, disabled = false }) {
  if (disabled || !task) return { predefinedBlocks: null, prebuiltStacks: null }
  const activeStage =
    activeStageIndex != null ? task.codeStages?.[activeStageIndex] : getStarterStage(task)?.stage
  const predefinedBlocks = [
    ...(task.predefinedBlocks ?? []),
    ...(activeStage?.predefinedBlocks ?? []),
  ]
  const prebuiltStacks = [...(task.prebuiltStacks ?? []), ...(activeStage?.prebuiltStacks ?? [])]
  return {
    predefinedBlocks: predefinedBlocks.length ? predefinedBlocks : null,
    prebuiltStacks: prebuiltStacks.length ? prebuiltStacks : null,
  }
}

// ─── Teacher remote reset ───────────────────────────────────────────────────

// A teacher can push this student's editor back to a known state. The action names the
// state: 'starter', 'complete', or 'stage_<n>' for one of the task's authored code stages.
// ('reveal_stage_<n>' is handled separately — it reveals a stage rather than replacing
// the student's work.)
function stageForAction(task, action) {
  const match = String(action ?? '').match(/^stage_(\d+)$/)
  if (!match) return { stage: null, stageIndex: null }
  const stageIndex = parseInt(match[1], 10)
  return { stage: (task?.codeStages ?? [])[stageIndex] ?? null, stageIndex }
}

/**
 * Resolves what a remote-reset action should put in front of the student, as the shape
 * that lesson type's workspace holds:
 *
 *   python / arcade   { code }
 *   html              { files, entryFile }
 *   scratch           { blocks, stageIndex }   stageIndex is the stage to make active
 *   filesystem        { fs }
 *   electronics       { circuit }
 *
 * Returns null for an unknown lesson type. Pure — the caller applies the result.
 */
export function resolveRemoteResetTarget(task, action, lessonType, defaults = {}) {
  if (!task || !action) return null
  const { stage } = stageForAction(task, action)
  const starter = getStarterStage(task)?.stage

  switch (lessonType) {
    case 'python':
    case 'arcade': {
      if (action === 'complete') return { code: task.completeCode ?? '' }
      if (action === 'starter') return { code: starter?.code ?? task.starterCode ?? '' }
      return { code: stage?.code ?? starter?.code ?? task.starterCode ?? '' }
    }
    case 'html': {
      if (action === 'complete') {
        return {
          files: task.completeFiles ?? [],
          entryFile: task.completeEntryFile ?? task.entryFile,
        }
      }
      if (action === 'starter') {
        return {
          files: starter?.files ?? task.starterFiles ?? [],
          entryFile: starter?.entryFile ?? task.entryFile,
        }
      }
      return {
        files: stage?.files ?? starter?.files ?? task.starterFiles ?? [],
        entryFile: stage?.entryFile ?? starter?.entryFile ?? task.entryFile,
      }
    }
    case 'scratch': {
      // Only a stage reset leaves a stage active; starter and complete clear it.
      if (action === 'complete') return { blocks: task.completeBlocks ?? null, stageIndex: null }
      if (action === 'starter') {
        return { blocks: starter?.blocks ?? task.starterBlocks ?? null, stageIndex: null }
      }
      const { stage: staged, stageIndex } = stageForAction(task, action)
      return {
        blocks: staged?.blocks ?? task.starterBlocks ?? null,
        stageIndex: staged ? stageIndex : null,
      }
    }
    case 'filesystem': {
      if (action === 'complete') return { fs: task.completeFs ?? task.starterFs ?? defaults.fs }
      if (action === 'starter') return { fs: task.starterFs ?? defaults.fs }
      return { fs: stage?.fs ?? task.starterFs ?? defaults.fs }
    }
    case 'electronics': {
      if (action === 'complete') {
        return { circuit: task.completeCircuit ?? task.starterCircuit ?? defaults.circuit }
      }
      if (action === 'starter') {
        return { circuit: starter?.circuit ?? task.starterCircuit ?? defaults.circuit }
      }
      return { circuit: stage?.circuit ?? task.starterCircuit ?? defaults.circuit }
    }
    default:
      return null
  }
}
