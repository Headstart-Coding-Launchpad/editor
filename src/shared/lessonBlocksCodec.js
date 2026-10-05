// Firestore caps nested map/array depth in a document at 20 levels. A Scratch
// script serializes as a chain of nested blocks (block.next.block.next.block...,
// and similarly for nested reporter inputs), so a script of ~20+ stacked blocks
// can exceed that cap and Firestore rejects the whole document write with
// "Message too deep. Max recursion depth reached for key 'fields'".
//
// Firestore also rejects arrays nested directly inside arrays. Arcade Kit pixel
// sprites store frames as an array of flat pixel arrays, so authored sprite art
// must be flattened at the Firestore boundary too.
//
// To avoid the cap, block trees (starterBlocks, completeBlocks, codeStages[].blocks, and
// each prebuiltStacks[].stack on a task or code stage) are stored as JSON strings in Firestore and
// expanded back into plain objects on read. Every other part of the app (the
// Blockly workspace, teacher/student sandboxes, print view, CLI validator,
// downloaded lesson files) keeps working with the expanded object in memory —
// only the Firestore read/write boundary needs to encode/decode.
//
// Reads are backward-compatible: lessons saved before this change have these
// fields stored as plain objects (they only failed to save if they were too
// deep, or included Arcade sprite art), so decode leaves non-string values
// untouched.

import { sealLesson, unsealLesson } from './lessonSeal.js'

const BLOCK_TREE_FIELDS = ['starterBlocks', 'completeBlocks']
const ARCADE_DESIGN_FIELDS = ['arcadeDesign', 'completeArcadeDesign']

// Scratch toolbox snippets: `prebuiltStacks: [{ id, stack }]` on a task and on each code
// stage. A stack is a root block whose `next.block` chain nests two levels per block, so a
// long snippet can exceed the depth cap too; only each entry's `stack` is stored as text.
function mapPrebuiltStacks(stacks, transformJsonField) {
  if (!Array.isArray(stacks)) return stacks
  return stacks.map((entry) =>
    entry && typeof entry === 'object' && entry.stack != null
      ? { ...entry, stack: transformJsonField(entry.stack) }
      : entry
  )
}

function mapTasks(tasks, transformJsonField) {
  if (!Array.isArray(tasks)) return tasks
  return tasks.map((task) => {
    if (!task || typeof task !== 'object') return task
    if (task.type === 'group') {
      return { ...task, subtasks: mapTasks(task.subtasks, transformJsonField) }
    }
    const next = { ...task }
    for (const field of BLOCK_TREE_FIELDS) {
      if (next[field] != null) next[field] = transformJsonField(next[field])
    }
    for (const field of ARCADE_DESIGN_FIELDS) {
      if (next[field] != null) next[field] = transformJsonField(next[field])
    }
    if (Array.isArray(next.prebuiltStacks))
      next.prebuiltStacks = mapPrebuiltStacks(next.prebuiltStacks, transformJsonField)
    if (Array.isArray(next.codeStages)) {
      next.codeStages = next.codeStages.map((stage) => {
        if (!stage || typeof stage !== 'object') return stage
        const encodedStage = { ...stage }
        if (encodedStage.blocks != null)
          encodedStage.blocks = transformJsonField(encodedStage.blocks)
        if (encodedStage.arcadeDesign != null)
          encodedStage.arcadeDesign = transformJsonField(encodedStage.arcadeDesign)
        if (Array.isArray(encodedStage.prebuiltStacks))
          encodedStage.prebuiltStacks = mapPrebuiltStacks(
            encodedStage.prebuiltStacks,
            transformJsonField
          )
        return encodedStage
      })
    }
    return next
  })
}

// Values that are already JSON strings are left as they are, so encoding is safe to repeat
// and lesson files that store workspaces as serialised text (as the Scratch authoring docs
// used to require) are not encoded twice.
function stringifyJsonField(v) {
  return typeof v === 'string' ? v : JSON.stringify(v)
}

// Blocks/designs only. Lesson writes use encodeLessonForFirestore (below), which also seals.
export function encodeLessonBlocksForFirestore(lesson) {
  if (!lesson?.tasks) return lesson
  return { ...lesson, tasks: mapTasks(lesson.tasks, stringifyJsonField) }
}

function safeParseJsonField(v) {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

// Blocks/designs only. Lesson reads use decodeLessonFromFirestore (below), which also unseals.
export function decodeLessonBlocksFromFirestore(lesson) {
  if (!lesson?.tasks) return lesson
  return { ...lesson, tasks: mapTasks(lesson.tasks, safeParseJsonField) }
}

// The full `lessons` collection boundary: block/design encoding plus answer sealing
// (src/shared/lessonSeal.js). Every write to `lessons/{id}` goes through encodeLessonForFirestore
// and every read through decodeLessonFromFirestore, so the rest of the app (and the CLI) only
// ever sees the plain task shape. Encoding runs blocks first, then seals; decoding reverses it.
export function encodeLessonForFirestore(lesson) {
  return sealLesson(encodeLessonBlocksForFirestore(lesson))
}

export function decodeLessonFromFirestore(doc) {
  return decodeLessonBlocksFromFirestore(unsealLesson(doc))
}
