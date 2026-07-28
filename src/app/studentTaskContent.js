import { findTaskById, getStarterStage } from '../shared/taskUtils'

export function canCarryTaskContent(tasks, carryFromId, currentTaskId) {
  if (!carryFromId) return false
  const sourceTask = findTaskById(tasks, carryFromId)
  if (!sourceTask || sourceTask.taskType === 'quiz' || sourceTask.taskType === 'information') return false
  return sourceTask.id !== currentTaskId
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key)
}

function buildCarryFallbackRecord({ taskId, field, requestedSourceTaskId, resolvedSourceTaskId, skippedSourceTaskIds }) {
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
    if (!sourceTask || sourceTask.taskType === 'quiz' || sourceTask.taskType === 'information') break

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

export function selectPythonTaskCode({ tasks, task, taskId, phase, readSavedCode, onCarryFallback }) {
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
    hasSavedState: saved => saved != null && hasOwn(saved, 'code'),
  })
  if (carried.saved != null) {
    initial = carried.saved.code ?? ''
    notifyCarryFallback(onCarryFallback, carried.fallback)
  }
  return initial
}

export function selectHtmlTaskFiles({ tasks, task, taskId, phase, readSavedFile, onCarryFallback }) {
  const fileFallbacks = []
  const starterFiles = getStarterStage(task)?.stage?.files ?? task.starterFiles ?? []
  const files = starterFiles.map(file => {
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
      readSavedState: sourceTaskId => readSavedFile(sourceTaskId, file.name),
      hasSavedState: saved => saved != null,
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
    const resolvedSourceIds = [...new Set(fileFallbacks.map(fallback => fallback.resolvedSourceTaskId))]
    const skippedIds = [...new Set(fileFallbacks.flatMap(fallback => fallback.skippedSourceTaskIds ?? []))]
    onCarryFallback?.({
      taskId,
      field: 'carryCodeFrom',
      requestedSourceTaskId: task.carryCodeFrom,
      resolvedSourceTaskId: resolvedSourceIds.length === 1 ? resolvedSourceIds[0] : null,
      skippedSourceTaskIds: skippedIds,
      files: fileFallbacks.map(({ filename, requestedSourceTaskId, resolvedSourceTaskId, skippedSourceTaskIds }) => ({
        filename,
        requestedSourceTaskId,
        resolvedSourceTaskId,
        skippedSourceTaskIds,
      })),
    })
  }

  return files
}

export function selectScratchInitialProject({ tasks = null, task, taskId, readSavedCode, onCarryFallback }) {
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
      hasSavedState: state => state != null && hasOwn(state, 'state'),
    })
    if (carried.saved != null) {
      initialProject = carried.saved.state ?? null
      notifyCarryFallback(onCarryFallback, carried.fallback)
    }
  }
  if (!initialProject) initialProject = getStarterStage(task)?.stage?.blocks ?? task?.starterBlocks ?? null
  return initialProject
}

export function selectScratchToolboxSnippets({ task, activeStageIndex = null, disabled = false }) {
  if (disabled || !task) return { predefinedBlocks: null, prebuiltStacks: null }
  const activeStage = activeStageIndex != null
    ? task.codeStages?.[activeStageIndex]
    : getStarterStage(task)?.stage
  const predefinedBlocks = [
    ...(task.predefinedBlocks ?? []),
    ...(activeStage?.predefinedBlocks ?? []),
  ]
  const prebuiltStacks = [
    ...(task.prebuiltStacks ?? []),
    ...(activeStage?.prebuiltStacks ?? []),
  ]
  return {
    predefinedBlocks: predefinedBlocks.length ? predefinedBlocks : null,
    prebuiltStacks: prebuiltStacks.length ? prebuiltStacks : null,
  }
}
