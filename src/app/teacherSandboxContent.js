import { findTaskById } from '../shared/taskUtils'
import { cloneFiles, cloneScratchState, decodeSessionFiles, parseScratchState } from '../shared/workspaceData'
import { DEFAULT_FS } from '../shared/filesystem'
import { decodeFileKey } from '../shared/fileKeys'

function cloneFs(fs) {
  if (!fs || typeof fs !== 'object') return DEFAULT_FS
  return JSON.parse(JSON.stringify(fs))
}

function getTask(lesson, taskId) {
  return findTaskById(lesson?.tasks, taskId)
}

export function getSandboxStarterCode({
  lesson,
  taskId,
  session,
  draftCode,
  currentCode,
  preferDraft = true,
}) {
  const task = getTask(lesson, taskId)
  if (preferDraft && draftCode != null) return draftCode
  if (session?.state === 'sandbox' && session.sandboxCode != null) return session.sandboxCode
  if (lesson?.sandboxStarter != null) return lesson.sandboxStarter
  if (currentCode) return currentCode
  return task?.starterCode ?? ''
}

export function getSandboxStarterFiles({
  lesson,
  taskId,
  session,
  draftFiles,
  currentFiles,
  preferDraft = true,
}) {
  const task = getTask(lesson, taskId)
  if (preferDraft && draftFiles?.length > 0) return cloneFiles(draftFiles)
  const liveFiles = session?.state === 'sandbox'
    ? decodeSessionFiles(session.sandboxFiles, decodeFileKey)
    : []
  if (liveFiles.length > 0) return cloneFiles(liveFiles)
  if (lesson?.sandboxStarterFiles?.length > 0) return cloneFiles(lesson.sandboxStarterFiles)
  if (currentFiles.length > 0) return cloneFiles(currentFiles)
  return cloneFiles(task?.starterFiles ?? [])
}

export function getSandboxStarterScratch({
  lesson,
  taskId,
  session,
  draftState,
  currentState,
  preferDraft = true,
}) {
  const task = getTask(lesson, taskId)
  if (preferDraft && draftState) return cloneScratchState(draftState)
  if (session?.state === 'sandbox' && session.sandboxCode != null) {
    return parseScratchState(session.sandboxCode)
  }
  if (currentState) return currentState
  return task?.starterBlocks ?? null
}

export function getSandboxConfiguredCode({ lesson, taskId }) {
  const task = getTask(lesson, taskId)
  return lesson?.sandboxStarter ?? task?.starterCode ?? ''
}

export function getSandboxConfiguredFiles({ lesson, taskId }) {
  const task = getTask(lesson, taskId)
  if (lesson?.sandboxStarterFiles?.length > 0) return cloneFiles(lesson.sandboxStarterFiles)
  return cloneFiles(task?.starterFiles ?? [])
}

export function getSandboxConfiguredScratch({ lesson, taskId }) {
  const task = getTask(lesson, taskId)
  if (lesson?.sandboxStarter != null) return parseScratchState(lesson.sandboxStarter)
  return cloneScratchState(task?.starterBlocks ?? null)
}

export function getSandboxStarterFs({
  lesson,
  taskId,
  session,
  draftFs,
  currentFs,
  preferDraft = true,
}) {
  const task = getTask(lesson, taskId)
  if (preferDraft && draftFs) return cloneFs(draftFs)
  if (session?.state === 'sandbox' && session.sandboxCode != null) {
    try { return JSON.parse(session.sandboxCode) } catch {}
  }
  if (currentFs) return cloneFs(currentFs)
  return cloneFs(task?.starterFs ?? DEFAULT_FS)
}

export function getSandboxConfiguredFs({ lesson, taskId }) {
  const task = getTask(lesson, taskId)
  if (lesson?.sandboxStarterFs != null) return cloneFs(lesson.sandboxStarterFs)
  return cloneFs(task?.starterFs ?? DEFAULT_FS)
}
