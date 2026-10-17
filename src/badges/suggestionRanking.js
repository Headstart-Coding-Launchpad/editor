import { resolveBadge } from './badgeDisplay'

// Ranking for the tutor's one-tap award (docs/authoring/badges.md, "One-tap award"). Pure: it
// reads the rule engine's BadgeSuggestion list (badgeId, studentId, taskId, reason, at) and the
// session's badge decisions, and never writes anything.

/** How many students hold (status 'awarded') each badge in the class. */
export function classHolderCounts(decisions = {}) {
  const counts = {}
  for (const byBadge of Object.values(decisions ?? {})) {
    for (const [badgeId, decision] of Object.entries(byBadge ?? {})) {
      if (decision?.status === 'awarded') counts[badgeId] = (counts[badgeId] ?? 0) + 1
    }
  }
  return counts
}

/**
 * One student's pending suggestions, best first, each with a one-line description and the rule's
 * reason. Order: a rule that matched on the class's current task first, then the most recent
 * match (`at`; unknown last), then the badge fewer classmates hold, then badge id (stable).
 *
 * @param {object} input
 * @param {object[]} input.suggestions BadgeSuggestion[] (any students)
 * @param {string} input.studentId
 * @param {object} [input.decisions] the session's `badges` node (skips ones already decided)
 * @param {object[]} [input.catalogueBadges] Admin-catalogue badges (for descriptions)
 * @param {string|number|null} [input.currentTaskId]
 * @returns {{ badgeId: string, badge: object, description: string, reason: string|null,
 *   taskId: string|number|null, at: number|null, holders: number }[]}
 */
export function rankStudentSuggestions({
  suggestions = [],
  studentId,
  decisions = {},
  catalogueBadges = [],
  currentTaskId = null,
}) {
  const holders = classHolderCounts(decisions)
  const seen = new Set()
  const rows = []
  for (const suggestion of suggestions ?? []) {
    if (!suggestion || suggestion.studentId !== studentId || seen.has(suggestion.badgeId)) continue
    if (decisions?.[studentId]?.[suggestion.badgeId]?.status) continue
    seen.add(suggestion.badgeId)
    const badge = resolveBadge(suggestion.badgeId, catalogueBadges)
    const reason = typeof suggestion.reason === 'string' ? suggestion.reason.trim() : ''
    const at = suggestion.at == null ? NaN : Number(suggestion.at)
    rows.push({
      badgeId: suggestion.badgeId,
      badge,
      description: badge.blurb || '',
      reason: reason || null,
      taskId: suggestion.taskId ?? null,
      at: Number.isFinite(at) ? at : null,
      holders: holders[suggestion.badgeId] ?? 0,
    })
  }
  const onCurrent = (row) =>
    currentTaskId != null && row.taskId != null && String(row.taskId) === String(currentTaskId)
  return rows.sort(
    (a, b) =>
      Number(onCurrent(b)) - Number(onCurrent(a)) ||
      (b.at ?? -1) - (a.at ?? -1) ||
      a.holders - b.holders ||
      String(a.badgeId).localeCompare(String(b.badgeId))
  )
}

/** The top-ranked suggestion for a student, or null. */
export function topStudentSuggestion(input) {
  return rankStudentSuggestions(input)[0] ?? null
}
