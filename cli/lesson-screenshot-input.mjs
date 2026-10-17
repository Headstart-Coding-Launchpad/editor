// `hsc lessons screenshot`: the pure half, with no browser or Firebase. It turns command-line
// options or a --spec file into a list of shots, and makes the lesson copy each shot renders
// (its code override applied). cli/lesson-screenshot.mjs drives the browser.

import { flattenTasks } from '../src/shared/taskUtils.js'
import { getTaskModuleType } from '../src/shared/composedLesson.js'
import { getModuleDefinition } from '../src/modules/definitions.js'

export const DEVICES = {
  desktop: { width: 1440, height: 900, hasTouch: false },
  tablet: { width: 1024, height: 768, hasTouch: true },
}

// Student views render on the no-session #/shot page. The others need a live session, so they
// run on a throwaway copy of the lesson with the test tutor and made-up students.
export const STUDENT_VIEW = 'student'
export const SESSION_VIEWS = ['student-live', 'tutor', 'tutor-grid', 'student-modal', 'shared-work']
export const VIEWS = [STUDENT_VIEW, ...SESSION_VIEWS]

// What part of the page to keep. `page` is the whole viewport.
export const CROPS = ['page', 'workspace', 'instructions', 'editor', 'output', 'console', 'stage']

// Each crop is the first visible element from its list (data-testid hooks in the app).
export const CROP_TEST_IDS = {
  workspace: ['task-workspace'],
  instructions: ['task-instructions'],
  editor: ['editor-panel', 'scratch-blocks'],
  output: ['stage-pane', 'scratch-stage', 'turtle-canvas', 'iframe-preview', 'output-panel'],
  console: ['output-panel', 'iframe-preview'],
  stage: ['stage-pane', 'scratch-stage', 'turtle-canvas'],
}

// The names request #75 used for views, read as a view plus a crop.
const VIEW_ALIASES = {
  'editor+output': { view: STUDENT_VIEW, crop: 'workspace' },
  editor: { view: STUDENT_VIEW, crop: 'editor' },
  output: { view: STUDENT_VIEW, crop: 'output' },
  stage: { view: STUDENT_VIEW, crop: 'stage' },
  'student-page': { view: STUDENT_VIEW, crop: 'page' },
  'tutor-page': { view: 'tutor', crop: 'page' },
}

export const DEFAULT_STUDENTS = ['Test Ava', 'Test Ben', 'Test Cara']

export function isSessionView(view) {
  return SESSION_VIEWS.includes(view)
}

export function findShotTask(lesson, taskRef) {
  const tasks = flattenTasks(lesson?.tasks ?? [])
  if (taskRef == null || taskRef === '') {
    throw new Error('Each shot needs a task id (--task, or "task" in the spec)')
  }
  const task = tasks.find((t) => String(t.id) === String(taskRef))
  if (!task) {
    const ids = tasks.map((t) => t.id).join(', ')
    throw new Error(`Task ${taskRef} is not in lesson ${lesson?.id ?? ''} (task ids: ${ids})`)
  }
  return task
}

const asList = (value) =>
  value == null ? [] : (Array.isArray(value) ? value : [value]).map((v) => String(v))

function positiveInt(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a whole number above 0`)
  return n
}

// One student in a session shot: a name and, optionally, what they do on the task.
function normaliseStudent(raw, index) {
  const s = typeof raw === 'string' ? { name: raw } : { ...(raw ?? {}) }
  const name = String(s.name ?? DEFAULT_STUDENTS[index] ?? `Test Student ${index + 1}`).trim()
  if (!/^Test\b/.test(name)) {
    // Made-up students only, and obviously so: a screenshot must never show a real child.
    throw new Error(`Student "${name}": session students must be made up and start with "Test"`)
  }
  return {
    name,
    code: s.code == null ? null : String(s.code),
    run: s.run === true,
    inputs: asList(s.inputs),
    share: s.share === true,
  }
}

/**
 * Validates one shot and fills in its defaults. `raw` is a --spec entry or the command-line
 * options; `defaults` are command-line options that apply to every spec entry.
 */
export function normaliseShot(raw, defaults = {}) {
  const merged = { ...defaults, ...raw }
  let view = merged.view ?? STUDENT_VIEW
  let crop = merged.crop
  if (VIEW_ALIASES[view]) {
    crop = crop ?? VIEW_ALIASES[view].crop
    view = VIEW_ALIASES[view].view
  }
  if (!VIEWS.includes(view)) {
    throw new Error(`Unknown view "${view}". Use one of: ${VIEWS.join(', ')}`)
  }
  crop = crop ?? 'page'
  if (!CROPS.includes(crop)) {
    throw new Error(`Unknown crop "${crop}". Use one of: ${CROPS.join(', ')}`)
  }
  if (!isSessionView(view) && merged.tutorClick != null) {
    throw new Error('tutorClick needs a session view')
  }
  if (isSessionView(view) && crop !== 'page' && view !== 'student-live') {
    throw new Error(`View "${view}" is always captured whole; leave out crop`)
  }

  const deviceName = merged.device ?? 'desktop'
  const device = DEVICES[deviceName]
  if (!device) throw new Error(`Unknown device "${deviceName}". Use desktop or tablet`)
  const width = merged.width != null ? positiveInt(merged.width, 'width') : device.width
  const height = merged.height != null ? positiveInt(merged.height, 'height') : device.height

  const code = merged.code == null ? null : String(merged.code)
  const codeStage = merged.codeStage == null ? null : String(merged.codeStage)
  if (code != null && codeStage != null) {
    throw new Error('Pass code or codeStage, not both')
  }

  const studentsRaw = merged.students ?? (isSessionView(view) ? DEFAULT_STUDENTS.slice(0, 2) : [])
  const students = (Array.isArray(studentsRaw) ? studentsRaw : [studentsRaw]).map(normaliseStudent)
  if (isSessionView(view) && students.length === 0) {
    throw new Error(`View "${view}" needs at least one made-up student`)
  }
  const names = new Set()
  for (const s of students) {
    if (names.has(s.name)) throw new Error(`Student "${s.name}" is listed twice`)
    names.add(s.name)
  }
  if (view === 'shared-work' && !students.some((s) => s.share)) {
    // Someone has to share for the gallery to show anything.
    students[0].share = true
  }
  // The gallery reads best through a classmate's eyes (no "(you)").
  const defaultStudent =
    view === 'shared-work'
      ? (students.find((s) => !s.share) ?? students[0])?.name
      : students[0]?.name
  const student = merged.student == null ? (defaultStudent ?? null) : String(merged.student)
  if (isSessionView(view) && !names.has(student)) {
    throw new Error(`Student "${student}" is not in this shot's students`)
  }

  const wait = merged.wait == null ? null : Number(merged.wait)
  if (wait != null && !(Number.isFinite(wait) && wait >= 0)) {
    throw new Error('wait must be a number of milliseconds')
  }

  return {
    task: merged.task == null ? null : String(merged.task),
    openTask: merged.openTask == null ? null : String(merged.openTask),
    view,
    crop,
    width,
    height,
    hasTouch: merged.touch != null ? merged.touch === true : device.hasTouch,
    code,
    codeStage,
    run: merged.run === true,
    inputs: asList(merged.inputs),
    click: asList(merged.click),
    tutorClick: asList(merged.tutorClick),
    wait,
    students,
    student,
    out: merged.out == null ? null : String(merged.out),
  }
}

export function normaliseShots(spec, defaults = {}) {
  const list = Array.isArray(spec) ? spec : spec?.shots
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('The spec must be a JSON array of shots (or { "shots": [...] })')
  }
  return list.map((raw, i) => {
    try {
      return normaliseShot(raw, defaults)
    } catch (e) {
      throw new Error(
        `Shot ${i + 1}${raw?.task != null ? ` (task ${raw.task})` : ''}: ${e.message}`
      )
    }
  })
}

// The task a shot shows: its openTask (e.g. the task after the one an image belongs to), else
// its task.
export function shotTaskId(shot) {
  return shot.openTask ?? shot.task
}

export function shotFileName(shot) {
  const parts = [`task ${shotTaskId(shot)}`]
  if (shot.view !== STUDENT_VIEW) parts.push(shot.view)
  if (shot.crop !== 'page') parts.push(shot.crop)
  if (shot.width !== DEVICES.desktop.width || shot.height !== DEVICES.desktop.height) {
    parts.push(`${shot.width}x${shot.height}`)
  }
  return `${parts.join(' - ')}.png`
}

function stageCode(task, stageRef) {
  const stages = Array.isArray(task.codeStages) ? task.codeStages : []
  const byRole = stages.find((s) => s?.role === stageRef)
  const byIndex = /^\d+$/.test(stageRef) ? stages[Number(stageRef)] : null
  const byLabel = stages.find((s) => s?.label === stageRef)
  const stage = byRole ?? byIndex ?? byLabel ?? null
  if (stage) return stage
  // Legacy single-field complete code.
  if (stageRef === 'complete') {
    if (task.completeCode != null) return { code: task.completeCode }
    if (task.completeFiles != null) return { files: task.completeFiles }
    if (task.completeBlocks != null) return { blocks: task.completeBlocks }
  }
  if (stageRef === 'starter') return null
  const labels = stages.map((s, i) => s?.label ?? s?.role ?? i).join(', ')
  throw new Error(`Task ${task.id} has no code stage "${stageRef}" (stages: ${labels || 'none'})`)
}

// How a module's starter is written, read from its definition (as useStudentCodeState's
// loadWorkSlotTask does): blocks for a workspace-owned module (Scratch), files for a per-file one
// (HTML), code for the other code modules (Python, Turtle, Arcade).
function starterShape(type) {
  const definition = getModuleDefinition(type)
  if (definition?.workSlot?.workspaceOwned) return 'blocks'
  if (definition?.storage?.layout === 'perFile') return 'files'
  if (definition?.workSlot?.kind === 'code') return 'code'
  return null
}

// Puts `content` in as the task's starter, so the student view opens on it.
function setStarter(task, shape, content) {
  const next = { ...task }
  delete next.carryCodeFrom
  delete next.carryCodeFromLesson
  delete next.carryBlocksFrom
  delete next.carryBlocksFromLesson
  const others = (Array.isArray(task.codeStages) ? task.codeStages : []).filter(
    (s) => s?.role !== 'starter'
  )

  if (shape === 'blocks') {
    if (content.blocks == null) throw new Error(`Task ${task.id}: this task needs blocks`)
    next.starterBlocks = content.blocks
    if (content.prebuiltStacks != null) next.prebuiltStacks = content.prebuiltStacks
    next.codeStages = [{ role: 'starter', label: 'Starter', blocks: content.blocks }, ...others]
    return next
  }

  if (shape === 'files') {
    const entry = task.entryFile ?? 'index.html'
    const base = Array.isArray(task.starterFiles) ? task.starterFiles : []
    let files = content.files
    if (!files && content.code != null) {
      const hasEntry = base.some((f) => f?.name === entry)
      files = hasEntry
        ? base.map((f) => (f?.name === entry ? { ...f, content: content.code } : f))
        : [{ name: entry, type: 'html', content: content.code }, ...base]
    }
    if (!Array.isArray(files)) throw new Error(`Task ${task.id}: this task needs files or code`)
    next.starterFiles = files
    next.codeStages = others
    return next
  }

  if (content.code == null) throw new Error(`Task ${task.id}: this task type needs code`)
  next.starterCode = content.code
  next.codeStages = [{ role: 'starter', label: 'Starter', code: content.code }, ...others]
  return next
}

// Groups hold their tasks in `subtasks` (flattenTaskTree in src/shared/taskUtils.js).
export function replaceTask(tasks, id, update) {
  return tasks.map((t) => {
    if (t?.type === 'group') {
      return { ...t, subtasks: replaceTask(t.subtasks ?? [], id, update) }
    }
    return String(t?.id) === String(id) ? update(t) : t
  })
}

/**
 * The lesson a student-view shot renders: a copy with the shot's code (or code stage) put in as
 * the starter of the task it shows. The stored lesson is never changed.
 */
export function prepareShotLesson(lesson, shot) {
  const id = shotTaskId(shot)
  const task = findShotTask(lesson, id)
  if (shot.code == null && shot.codeStage == null) return lesson
  const type = getTaskModuleType(lesson, task) ?? lesson.type
  const shape = starterShape(type)
  if (!shape) throw new Error(`Task ${task.id}: code and code stages don't apply to ${type} tasks`)
  const content =
    shot.code != null
      ? shape === 'blocks'
        ? { blocks: JSON.parse(shot.code) }
        : { code: shot.code }
      : stageCode(task, shot.codeStage)
  if (content == null) return lesson
  return {
    ...lesson,
    tasks: replaceTask(lesson.tasks, task.id, (t) => setStarter(t, shape, content)),
  }
}

// A code value from the command line or a spec: text as it is, or "@path" to read a file
// (relative to `dir`: the spec's folder, or the working folder for --code).
export async function readSpecCode(value, dir, readFile) {
  if (typeof value !== 'string' || !value.startsWith('@')) return value
  const { resolve } = await import('node:path')
  return readFile(resolve(dir, value.slice(1)))
}
