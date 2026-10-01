// Lesson authoring rules for badges, run by the shared lesson validation
// (src/shared/lessonValidation.js) so the CLI and the Builder agree. Lessons define no badges:
// the envelope's `badgeOptions` tunes the built-in rules and a task's `badgeHints` adds or
// suppresses a badge on that task (docs/authoring/badges.md). Messages are listed in
// docs/authoring/validation-errors.md. Pure.
import { isPlainObject } from '../shared/textUtils.js'
import { BADGE_OPTION_SPECS, isValidBadgeOptionValue } from './badgeOptions.js'
import { getBadgeDefinition } from './registry.pure.js'

const BADGE_HINT_KEYS = ['suggest', 'suppress']

/** The envelope's `badgeOptions`. */
export function validateBadgeOptions(lesson, errors, warnings) {
  const value = lesson?.badgeOptions
  if (value == null) return
  if (!isPlainObject(value)) {
    errors.push('badgeOptions must be an object when provided')
    return
  }
  for (const [key, option] of Object.entries(value)) {
    const spec = BADGE_OPTION_SPECS[key]
    if (!spec) {
      warnings.push(`badgeOptions.${key} is not a badge option and is ignored`)
      continue
    }
    if (isValidBadgeOptionValue(key, option)) continue
    if (spec.kind === 'fraction') errors.push(`badgeOptions.${key} must be a number from 0 to 1`)
    else if (spec.kind === 'count') {
      errors.push(`badgeOptions.${key} must be a whole number of at least 1`)
    } else if (spec.kind === 'minutes') {
      errors.push(`badgeOptions.${key} must be a positive number of minutes`)
    } else errors.push(`badgeOptions.${key} must be a positive number of seconds`)
  }
}

/** A task's `badgeHints`. `n` is the task's 1-based position (the "Task n" in messages). */
export function validateBadgeHints(task, n, errors, warnings) {
  const hints = task?.badgeHints
  if (hints == null) return
  if (!isPlainObject(hints)) {
    errors.push(`Task ${n} badgeHints must be an object with suggest and/or suppress lists`)
    return
  }
  for (const key of Object.keys(hints)) {
    if (!BADGE_HINT_KEYS.includes(key)) {
      errors.push(`Task ${n} badgeHints only takes suggest and suppress (found "${key}")`)
    }
  }
  for (const key of BADGE_HINT_KEYS) {
    const list = hints[key]
    if (list == null) continue
    if (!Array.isArray(list) || list.some((id) => typeof id !== 'string')) {
      errors.push(`Task ${n} badgeHints.${key} must be a list of badge ids`)
      continue
    }
    for (const id of list) {
      const badge = getBadgeDefinition(id)
      if (!badge) {
        errors.push(`Task ${n} badgeHints.${key} names an unknown badge "${id}"`)
      } else if (key === 'suggest' && !badge.rule?.hintable) {
        errors.push(
          `Task ${n} badgeHints.suggest names "${id}", which a task's pattern can't trigger`
        )
      } else if (key === 'suppress' && !badge.rule) {
        warnings.push(
          `Task ${n} badgeHints.suppress names "${id}", a tutor-only badge that is never suggested`
        )
      }
    }
  }
}
