// Builder helpers for a task's optional `badgeHints` (docs/authoring/badges.md), used by the task
// editor's Badge hints field. Pure.
import { getBadgesByPattern } from '../badges/registry'
import { getTaskActivityPatternId } from '../shared/taskActivity'

const PATTERN_BADGES = getBadgesByPattern()

export function listBadgeHints(hints, key) {
  const list = hints?.[key]
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []
}

/**
 * The next `badgeHints` after toggling `badgeId` in `key` ('suggest' | 'suppress'). A badge sits
 * in one list at most, and an empty `badgeHints` is dropped (undefined), as the YAML leaves it out.
 */
export function toggleBadgeHint(hints, key, badgeId) {
  const other = key === 'suggest' ? 'suppress' : 'suggest'
  const current = listBadgeHints(hints, key)
  const nextList = current.includes(badgeId)
    ? current.filter((id) => id !== badgeId)
    : [...current, badgeId]
  const next = {
    [key]: nextList,
    [other]: listBadgeHints(hints, other).filter((id) => id !== badgeId),
  }
  const out = {}
  if (next.suggest.length) out.suggest = next.suggest
  if (next.suppress.length) out.suppress = next.suppress
  return Object.keys(out).length ? out : undefined
}

/** The badges a task's taskActivity pattern can trigger by itself (docs/authoring/badges.md). */
export function patternBadgesFor(task) {
  const pattern = getTaskActivityPatternId(task)
  return pattern ? (PATTERN_BADGES[pattern] ?? []) : []
}
