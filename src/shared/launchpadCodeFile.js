export const LAUNCHPAD_CODE_FILE_FORMAT = 'headstart-launchpad-code'
export const LAUNCHPAD_CODE_FILE_VERSION = 1
export const LAUNCHPAD_CODE_FILE_EXTENSION = '.launchpad'

function normaliseTask(task, index) {
  if (!task || typeof task !== 'object' || typeof task.code !== 'string') return null
  return {
    id: task.id ?? `task-${index + 1}`,
    title: typeof task.title === 'string' && task.title.trim()
      ? task.title.trim()
      : `Python code ${index + 1}`,
    code: task.code,
  }
}

export function createLaunchpadCodeFile(tasks, { exportedAt = new Date().toISOString() } = {}) {
  const normalisedTasks = tasks.map(normaliseTask).filter(Boolean)
  if (normalisedTasks.length === 0) throw new Error('There is no Python code to save.')

  return {
    format: LAUNCHPAD_CODE_FILE_FORMAT,
    version: LAUNCHPAD_CODE_FILE_VERSION,
    language: 'python',
    exportedAt,
    tasks: normalisedTasks,
  }
}

export function parseLaunchpadCodeFile(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not a valid LaunchPad code file.')
  }

  if (!parsed || parsed.format !== LAUNCHPAD_CODE_FILE_FORMAT || parsed.version !== LAUNCHPAD_CODE_FILE_VERSION || parsed.language !== 'python') {
    throw new Error('That file is not a supported LaunchPad Python code file.')
  }

  if (!Array.isArray(parsed.tasks)) {
    throw new Error('That LaunchPad file does not contain any Python code.')
  }

  try {
    return createLaunchpadCodeFile(parsed.tasks, { exportedAt: parsed.exportedAt })
  } catch {
    throw new Error('That LaunchPad file does not contain any Python code.')
  }
}

export function makeLaunchpadFilename(name = 'my-python-code') {
  const safeName = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${safeName || 'my-python-code'}${LAUNCHPAD_CODE_FILE_EXTENSION}`
}

export function downloadLaunchpadCodeFile(codeFile, name) {
  const blob = new Blob([JSON.stringify(codeFile, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = makeLaunchpadFilename(name)
  anchor.click()
  // Deferred: revoking synchronously can abort the download in some browsers
  // before they've started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
