import { findGroupForTask, findTaskById } from '../shared/taskUtils'

export function canCarryTaskContent(tasks, carryFromId, currentTaskId) {
  if (!carryFromId) return false
  const sourceTask = findTaskById(tasks, carryFromId)
  if (!sourceTask || sourceTask.taskType === 'quiz' || sourceTask.taskType === 'information') return false
  const sourceGroup = findGroupForTask(tasks, carryFromId)
  const currentGroup = findGroupForTask(tasks, currentTaskId)
  return sourceGroup?.id === currentGroup?.id
}

export function selectPythonTaskCode({ tasks, task, taskId, phase, readSavedCode }) {
  if (phase === 'solo') {
    const ownSaved = readSavedCode(taskId)
    if (ownSaved != null) return ownSaved.code ?? ''
  }

  let initial = task.starterCode ?? ''
  if (canCarryTaskContent(tasks, task.carryCodeFrom, taskId)) {
    const carried = readSavedCode(task.carryCodeFrom)
    if (carried?.code) initial = carried.code
  }
  return initial
}

export function selectHtmlTaskFiles({ tasks, task, taskId, phase, readSavedFile }) {
  return (task.starterFiles ?? []).map(file => {
    if (phase === 'solo') {
      const ownSaved = readSavedFile(taskId, file.name)
      if (ownSaved != null) return { ...file, content: ownSaved }
    }

    let content = file.content
    if (canCarryTaskContent(tasks, task.carryCodeFrom, taskId)) {
      const carried = readSavedFile(task.carryCodeFrom, file.name)
      if (carried != null) content = carried
    }
    return { ...file, content }
  })
}

export function selectScratchInitialProject({ tasks = null, task, taskId, readSavedCode }) {
  const saved = readSavedCode(taskId)
  let initialProject = saved?.state ?? null
  if (!initialProject && task?.carryBlocksFrom) {
    const carried = readSavedCode(task.carryBlocksFrom)
    initialProject = carried?.state ?? null
    if (!initialProject && tasks) {
      // No saved work to carry — fall back to the carry source's authored blocks,
      // following the carry chain (mirrors the filesystem carryFsFrom fallback).
      let resolveId = task.carryBlocksFrom
      while (resolveId != null) {
        const resolveTask = findTaskById(tasks, resolveId)
        if (!resolveTask) break
        const blocks = resolveTask.completeBlocks ?? resolveTask.starterBlocks
        if (blocks) { initialProject = blocks; break }
        resolveId = resolveTask.carryBlocksFrom ?? null
      }
    }
  }
  if (!initialProject) initialProject = task?.starterBlocks ?? null
  return initialProject
}

export function selectScratchToolboxSnippets({ task, activeStageIndex = null, disabled = false }) {
  if (disabled || !task) return { predefinedBlocks: null, prebuiltStacks: null }
  const activeStage = activeStageIndex != null ? task.codeStages?.[activeStageIndex] : null
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
