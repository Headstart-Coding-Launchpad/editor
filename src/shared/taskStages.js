// Pure code-stage helpers (no imports), split out of taskUtils.js so Node-safe module
// definitions (src/modules/<type>/definition.js) can use them without importing taskUtils,
// which itself reads the module definitions. taskUtils re-exports everything here.

// Code stages now have one purpose each. `core`, `extension`, and `solution`
// remain understood so existing lessons keep loading, but the builder only
// creates the three roles below.
export const STAGE_ROLES = ['starter', 'support', 'complete']
const LEGACY_STAGE_ROLE_ALIASES = {
  core: 'support',
  extension: 'support',
  solution: 'complete',
}

// Who opened a support-stage reference (supportRevealLog entries):
// 'teacher-auto' is the teacher's per-student "every task" reference.
export const SUPPORT_REVEAL_SOURCES = ['student', 'teacher', 'teacher-auto']

// students.{id}.autoRevealStage values: the first support stage, every support
// stage, or the complete (solution) stage.
export const AUTO_REVEAL_MODES = ['first', 'support', 'solution']

export function isValidStageRole(role) {
  return (
    STAGE_ROLES.includes(role) ||
    Object.prototype.hasOwnProperty.call(LEGACY_STAGE_ROLE_ALIASES, role)
  )
}

export function getStageRole(stage) {
  if (LEGACY_STAGE_ROLE_ALIASES[stage?.role]) return LEGACY_STAGE_ROLE_ALIASES[stage.role]
  return isValidStageRole(stage?.role) ? stage.role : 'support'
}

export function isRevealableStage(stage) {
  return getStageRole(stage) === 'support'
}

export function getRevealableStages(task) {
  return (task?.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => isRevealableStage(stage))
}

function getStagesByRole(task, role) {
  return (task?.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => getStageRole(stage) === role)
}

export function getStarterStages(task) {
  return getStagesByRole(task, 'starter')
}

export function getStarterStage(task) {
  return getStarterStages(task)[0] ?? null
}

export function getCompleteStage(task) {
  return getStagesByRole(task, 'complete')[0] ?? null
}

// Returns the next Support stage after the latest stage already shown. This
// keeps support references progressing in authored stage order.
export function getNextRevealableStage(task, revealedStageIndexes = []) {
  const revealed = revealedStageIndexes.map(Number).filter(Number.isInteger)
  const latestRevealedIndex = revealed.length ? Math.max(...revealed) : -1
  return getRevealableStages(task).find(({ index }) => index > latestRevealedIndex) ?? null
}
