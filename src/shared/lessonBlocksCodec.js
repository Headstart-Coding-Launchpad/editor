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
// To avoid the cap, block trees are stored as JSON strings in Firestore and
// expanded back into plain objects on read. Every other part of the app (the
// Blockly workspace, teacher/student sandboxes, print view, CLI validator,
// downloaded lesson files) keeps working with the expanded object in memory —
// only the Firestore read/write boundary needs to encode/decode.
//
// Reads are backward-compatible: lessons saved before this change have these
// fields stored as plain objects (they only failed to save if they were too
// deep, or included Arcade sprite art), so decode leaves non-string values
// untouched.

const BLOCK_TREE_FIELDS = ['starterBlocks', 'completeBlocks']
const ARCADE_DESIGN_FIELDS = ['arcadeDesign', 'completeArcadeDesign']

function mapTasks(tasks, transformJsonField) {
  if (!Array.isArray(tasks)) return tasks
  return tasks.map(task => {
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
    if (Array.isArray(next.codeStages)) {
      next.codeStages = next.codeStages.map(stage => {
        if (!stage || typeof stage !== 'object') return stage
        const encodedStage = { ...stage }
        if (encodedStage.blocks != null) encodedStage.blocks = transformJsonField(encodedStage.blocks)
        if (encodedStage.arcadeDesign != null) encodedStage.arcadeDesign = transformJsonField(encodedStage.arcadeDesign)
        return encodedStage
      })
    }
    return next
  })
}

// Call on a lesson (or { tasks } fragment) right before setDoc/updateDoc.
export function encodeLessonBlocksForFirestore(lesson) {
  if (!lesson?.tasks) return lesson
  return { ...lesson, tasks: mapTasks(lesson.tasks, JSON.stringify) }
}

function safeParseJsonField(v) {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

// Call on the result of getDoc/getDocs/onSnapshot right after reading .data().
export function decodeLessonBlocksFromFirestore(lesson) {
  if (!lesson?.tasks) return lesson
  return { ...lesson, tasks: mapTasks(lesson.tasks, safeParseJsonField) }
}
