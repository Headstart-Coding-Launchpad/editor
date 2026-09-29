import { validateLessonCore } from '../src/shared/lessonValidation.js'

// CLI lesson validation. The rules and their wording are shared with the Builder
// (src/shared/lessonValidation.js, each module definition's validateTask and the activity
// registry); this file only adds the CLI's own extras. See ADR 0008.

// CLI-only: lessons published from the CLI go straight to the lesson list, whose entry
// screen shows the description.
function requireDescription(lesson, errors) {
  if (!lesson.description || !String(lesson.description).trim()) {
    errors.push('description is required')
  }
}

export function validateLessonForMcp(lesson) {
  const { errors, warnings } = validateLessonCore(lesson, { envelope: requireDescription })
  return { valid: errors.length === 0, errors, warnings }
}
