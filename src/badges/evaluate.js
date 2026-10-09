// The badge engine: runs every rule-backed badge over a class's timelines and returns the
// suggestions the tutor sees (docs/architecture/live-badges-plan.md, "Architecture").
// Suggestions are never stored: they are recomputed from the session, so they survive a reload,
// and only decisions (awarded / dismissed / revoked) are written. Pure and deterministic.
import { getBadgeDefinition, getRuleBackedBadges } from './registry.pure.js'
import { buildBadgeLessonIndex } from './lessonIndex.js'
import { resolveBadgeOptions } from './badgeOptions.js'

const timeKey = (at) => (at == null || !Number.isFinite(at) ? Infinity : at)

// Stable: candidates with the same (or no) time keep the rule's order.
function sortByTime(candidates) {
  return candidates
    .map((found, i) => ({ found, i }))
    .sort((a, b) => {
      const x = timeKey(a.found.at)
      const y = timeKey(b.found.at)
      return x === y ? a.i - b.i : x < y ? -1 : 1
    })
    .map(({ found }) => found)
}

/**
 * @typedef {object} BadgeSuggestion
 * @property {string} badgeId
 * @property {string} studentId
 * @property {string|number|null} taskId the lesson task it came from (null for a sandbox)
 * @property {string|null} taskTitle that task's title from the lesson index ("Task n" when it
 *   has none), looked up from `taskId` for every badge, so the tutor always sees which task a
 *   suggestion came from (suggestionTaskLabel in ./badgeDisplay.js); null when there is no task
 * @property {string} reason the badge's reasonText, ready to store on the decision
 * @property {'task'|'sandbox'|'personal'} context
 * @property {number|null} at when it happened (for ordering; null when unknown)
 */

/**
 * @param {object} input
 * @param {{ [studentId: string]: import('./timeline.js').TimelineEvent[] }} input.timelines
 *   one timeline per student on the current roster (see filterTimelinesToRoster)
 * @param {object} input.lesson the (possibly session-edited) lesson
 * @param {{ [studentId: string]: { [badgeId: string]: { status, decidedAt } } }} [input.decisions]
 *   the session's `badges` node: any decision on a badge removes that student's suggestion
 * @param {object} [input.options]
 * @param {string|number} [input.options.currentTaskId] the class's current task (Quiz Master
 *   evaluates a group once the class has moved past it)
 * @param {boolean} [input.options.sessionEnded] every quiz group is complete
 * @param {object} [input.options.badgeOptions] overrides the lesson's `badgeOptions`
 * @param {string[]} [input.options.badgeIds] only evaluate these badges
 * @returns {BadgeSuggestion[]} in registry order, then time order
 */
export function evaluateBadgeRules({ timelines, lesson, decisions = {}, options = {} }) {
  const index = buildBadgeLessonIndex(lesson)
  const ruleOptions = {
    ...resolveBadgeOptions(lesson, options.badgeOptions),
    currentTaskId: options.currentTaskId ?? null,
    sessionEnded: !!options.sessionEnded,
  }
  const badges = options.badgeIds
    ? options.badgeIds.map(getBadgeDefinition).filter((badge) => badge?.rule)
    : getRuleBackedBadges()

  const suggestions = []
  for (const badge of badges) {
    const seen = new Set()
    const candidates = badge.rule.evaluate({
      badgeId: badge.id,
      timelines: timelines ?? {},
      index,
      decisions: decisions ?? {},
      options: ruleOptions,
    })
    for (const found of sortByTime(candidates)) {
      // At most once per student per badge, and never once the tutor has decided.
      if (seen.has(found.studentId)) continue
      seen.add(found.studentId)
      if (decisions?.[found.studentId]?.[badge.id]) continue
      suggestions.push({
        badgeId: badge.id,
        studentId: found.studentId,
        taskId: found.taskId,
        taskTitle: index.get(found.taskId)?.title ?? null,
        reason: badge.reasonText(found.values),
        context: found.context,
        at: found.at ?? null,
      })
    }
  }
  return suggestions
}
