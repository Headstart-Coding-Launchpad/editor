// How badges are shown and picked (docs/architecture/live-badges-plan.md, "Tutor experience").
// Pure and Node-safe: the tutor's panel and picker, the student's celebration and the report all
// resolve a badge id through here, so a registry badge and an Admin-catalogue badge (Firestore
// `badgeCatalogue`, PR 7) render the same way.
import { getBadgeDefinition, getBadgeDefinitions } from './registry.pure.js'

/** A manual award may replace a dismissal or a revoke; an existing award always wins. */
export const MANUAL_AWARD_REPLACES = Object.freeze(['dismissed', 'revoked'])

const CATALOGUE_RULE_TEXT = 'Catalogue badge: awarded by the tutor, never suggested.'
const UNKNOWN_EMOJI = '🏅'

/**
 * A catalogue entry (`{ id, emoji, title, blurb, archived }`) in the registry definitions' shape,
 * or null when it is unusable (no id, or an id a registry badge already owns).
 */
export function normaliseCatalogueBadge(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id) return null
  if (getBadgeDefinition(entry.id)) return null
  return {
    id: entry.id,
    emoji: entry.emoji || UNKNOWN_EMOJI,
    title: entry.title || entry.id,
    blurb: entry.blurb ?? '',
    ruleText: CATALOGUE_RULE_TEXT,
    rule: null,
    autoAwardable: false,
    tutorOnly: true,
    catalogue: true,
    archived: !!entry.archived,
  }
}

/**
 * The display fields for any badge id: the registry definition, else the catalogue entry
 * (archived ones included, so old awards still render), else the display snapshot stored on the
 * decision (`decision.badge`, written when a catalogue badge is awarded: students can't read the
 * Firestore catalogue), else a plain 🏅 placeholder.
 */
export function resolveBadge(badgeId, catalogueBadges = [], decision = null) {
  const builtIn = getBadgeDefinition(badgeId)
  if (builtIn) return builtIn
  for (const entry of catalogueBadges ?? []) {
    if (entry?.id === badgeId) return normaliseCatalogueBadge(entry)
  }
  const snapshot = decision?.badge
  if (snapshot?.emoji && snapshot?.title) {
    return normaliseCatalogueBadge({ ...snapshot, id: badgeId, archived: true })
  }
  return {
    id: badgeId,
    emoji: UNKNOWN_EMOJI,
    title: String(badgeId ?? 'Badge'),
    blurb: '',
    ruleText: CATALOGUE_RULE_TEXT,
    rule: null,
    autoAwardable: false,
    tutorOnly: true,
    catalogue: true,
    archived: true,
  }
}

/**
 * Every badge a tutor can award by hand, in picker order: the registry (rule-backed first, as
 * registered, then tutor-only), then the non-archived catalogue badges.
 */
export function listAwardableBadges(catalogueBadges = []) {
  const builtIn = getBadgeDefinitions()
  const catalogue = (catalogueBadges ?? [])
    .map(normaliseCatalogueBadge)
    .filter((badge) => badge && !badge.archived)
  return [...builtIn, ...catalogue]
}

/** The badge ids a student holds now (`awarded` decisions; revoked and dismissed aren't held). */
export function heldBadgeIds(decisions, studentId) {
  return Object.entries(decisions?.[studentId] ?? {})
    .filter(([, decision]) => decision?.status === 'awarded')
    .map(([badgeId]) => badgeId)
}

/**
 * A shared `bulkId` for one award given to several students at once, so the class sees one
 * merged announcement. `prefix` names the source ('bulk' for the tutor, 'auto' for auto-award).
 */
export function createBadgeBulkId(badgeId, prefix = 'bulk') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${badgeId}-${Date.now().toString(36)}${random}`
}
