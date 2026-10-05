// Node-safe badge registry: every built-in badge's definition (./definitions/<id>.js). Imported by
// the CLI (`lessons capabilities`), lesson validation, the badge engine and reports. The UI
// registry (registry.js) is what React code imports.
//
// To add a badge: create src/badges/definitions/<id>.js and add one import here, in the order
// the tutor's picker should list it. badgeRegistry.test.js checks every file is registered.
// Manual-only badges an admin adds (Firestore `badgeCatalogue`) are not in this registry.
import bugHunter from './definitions/bug_hunter.js'
import codeBuilder from './definitions/code_builder.js'
import codeDetective from './definitions/code_detective.js'
import challengeSolver from './definitions/challenge_solver.js'
import quizMaster from './definitions/quiz_master.js'
import codeFixer from './definitions/code_fixer.js'
import persistence from './definitions/persistence.js'
import resourcefulCoder from './definitions/resourceful_coder.js'
import keyboardWizard from './definitions/keyboard_wizard.js'
import readyToCode from './definitions/ready_to_code.js'
import problemSolver from './definitions/problem_solver.js'
import experimenter from './definitions/experimenter.js'
import creativeCoder from './definitions/creative_coder.js'
import comedyCoder from './definitions/comedy_coder.js'
import focusedCoder from './definitions/focused_coder.js'
import projectExplorer from './definitions/project_explorer.js'
import knowledgeBuilder from './definitions/knowledge_builder.js'
import helpfulCoder from './definitions/helpful_coder.js'
import codeArranger from './definitions/code_arranger.js'
import autocompleteAce from './definitions/autocomplete_ace.js'
import earlyBird from './definitions/early_bird.js'
import greatQuestion from './definitions/great_question.js'
import sharpShooter from './definitions/sharp_shooter.js'
import wordWizard from './definitions/word_wizard.js'
import designMaster from './definitions/design_master.js'
import independentCoder from './definitions/independent_coder.js'
import honestCheckIn from './definitions/honest_check_in.js'
import braveCoder from './definitions/brave_coder.js'
import growingCoder from './definitions/growing_coder.js'
import comebackCoder from './definitions/comeback_coder.js'
import showAndTell from './definitions/show_and_tell.js'
import greatAnswer from './definitions/great_answer.js'
import codeTeacher from './definitions/code_teacher.js'
import teacherTrap from './definitions/teacher_trap.js'
import tidyCoder from './definitions/tidy_coder.js'
import edgeExplorer from './definitions/edge_explorer.js'
import finisher from './definitions/finisher.js'
import carefulChecker from './definitions/careful_checker.js'

const BADGES = [
  bugHunter,
  codeBuilder,
  codeDetective,
  challengeSolver,
  quizMaster,
  codeFixer,
  persistence,
  resourcefulCoder,
  keyboardWizard,
  readyToCode,
  codeArranger,
  autocompleteAce,
  earlyBird,
  helpfulCoder,
  problemSolver,
  experimenter,
  creativeCoder,
  comedyCoder,
  focusedCoder,
  projectExplorer,
  knowledgeBuilder,
  greatQuestion,
  sharpShooter,
  wordWizard,
  designMaster,
  independentCoder,
  honestCheckIn,
  braveCoder,
  growingCoder,
  comebackCoder,
  showAndTell,
  greatAnswer,
  codeTeacher,
  teacherTrap,
  tidyCoder,
  edgeExplorer,
  finisher,
  carefulChecker,
]

const BY_ID = new Map()
const EMOJI = new Set()
for (const badge of BADGES) {
  if (BY_ID.has(badge.id)) throw new Error(`Duplicate badge id "${badge.id}"`)
  if (EMOJI.has(badge.emoji)) throw new Error(`Duplicate badge emoji "${badge.emoji}"`)
  BY_ID.set(badge.id, badge)
  EMOJI.add(badge.emoji)
}

export const BADGE_IDS = Object.freeze(BADGES.map((badge) => badge.id))

export function getBadgeDefinitions() {
  return [...BADGES]
}

export function getBadgeDefinition(id) {
  return BY_ID.get(id) ?? null
}

/** Badges a rule can suggest, in registry order. */
export function getRuleBackedBadges() {
  return BADGES.filter((badge) => badge.rule)
}

/** Badges only a tutor awards (no rule). */
export function getTutorOnlyBadges() {
  return BADGES.filter((badge) => !badge.rule)
}

/** Badges a task's `badgeHints.suggest` may name: their rule reads the task's pattern. */
export function getHintableBadges() {
  return BADGES.filter((badge) => badge.rule?.hintable)
}

/** Pattern id → the badges whose rule triggers on it (docs/authoring/badges.md). */
export function getBadgesByPattern() {
  const map = {}
  for (const badge of BADGES) {
    for (const pattern of badge.rule?.patterns ?? []) {
      map[pattern] = [...(map[pattern] ?? []), badge.id]
    }
  }
  return map
}

/** Task format → the badges whose rule triggers on it ('code_arrange' → 🧩 Code Arranger). */
export function getBadgesByFormat() {
  const map = {}
  for (const badge of BADGES) {
    for (const format of badge.rule?.formats ?? []) {
      map[format] = [...(map[format] ?? []), badge.id]
    }
  }
  return map
}
