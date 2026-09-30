// What a student's screen does with the tutor's badge decisions
// (docs/architecture/live-badges-plan.md, "Student experience"). Pure and Node-safe:
// useBadgeCelebrations owns the timers and React state, and this module decides which awards are
// new, who gets the celebration card, which toasts the class sees and how a bulk award merges.
import { resolveBadge } from './badgeDisplay.js'

/** How many class toasts may wait (the one showing included) before new ones are dropped. */
export const CLASS_TOAST_QUEUE_CAP = 5
/** How long the recipient's card shows before it docks into the Coding moments pill. */
export const CELEBRATION_CARD_MS = 2500
/** How long the dock (shrink into the pill) takes. */
export const CELEBRATION_DOCK_MS = 600
/** How long a class toast shows: on a student's screen, and on the presentation window. */
export const CLASS_TOAST_MS = 3000
export const PRESENTATION_TOAST_MS = 4000

/**
 * One award's identity. `decidedAt` is part of it, so a badge revoked and then awarded again is
 * a new award (and celebrated again) while the same stored award never is.
 */
export function awardKey(studentId, badgeId, decision) {
  return `${studentId}/${badgeId}/${decision?.decidedAt ?? ''}`
}

/** Every `awarded` decision in the session's `badges` node, oldest first. */
export function listAwards(decisions) {
  const awards = []
  for (const [studentId, byBadge] of Object.entries(decisions ?? {})) {
    for (const [badgeId, decision] of Object.entries(byBadge ?? {})) {
      if (decision?.status !== 'awarded') continue
      awards.push({
        key: awardKey(studentId, badgeId, decision),
        studentId,
        badgeId,
        decision,
      })
    }
  }
  return awards.sort((a, b) => (a.decision.decidedAt ?? 0) - (b.decision.decidedAt ?? 0))
}

/** The keys of every award present now: the load baseline, so a reload never replays one. */
export function collectAwardKeys(decisions) {
  return new Set(listAwards(decisions).map((award) => award.key))
}

/** Awards not in `seenKeys`, oldest first. */
export function findNewAwards(decisions, seenKeys) {
  return listAwards(decisions).filter((award) => !seenKeys.has(award.key))
}

/**
 * A student's own coding moments, oldest first: `[{ badgeId, badge, decision }]`, with `badge`
 * resolved for display. Revoked and dismissed decisions aren't moments, so they drop out silently.
 */
export function listMyMoments(decisions, studentId, catalogueBadges = []) {
  if (!studentId) return []
  return listAwards({ [studentId]: decisions?.[studentId] }).map(({ badgeId, decision }) => ({
    badgeId,
    badge: resolveBadge(badgeId, catalogueBadges, decision),
    decision,
  }))
}

/** True while the award behind a queued card is still held (a revoke drops the card unseen). */
export function isStillAwarded(decisions, award) {
  const decision = decisions?.[award.studentId]?.[award.badgeId]
  return (
    decision?.status === 'awarded' &&
    awardKey(award.studentId, award.badgeId, decision) === award.key
  )
}

/**
 * Folds newly arrived awards into the class toast queue.
 *
 * - Only `announce: true` awards toast, and never on the recipient's own screen (they get the
 *   card). A bulk award the viewer is part of doesn't toast for them at all.
 * - Awards sharing a `bulkId` merge into one toast, even when they arrive over several snapshots:
 *   a later piece joins the queued (or showing) toast. A bulk whose toast has already finished
 *   (`finishedBulkIds`) doesn't toast again; a bulk the viewer turns out to be part of is added to
 *   that set (the one side effect here).
 * - New toasts beyond `cap` (the one showing included) are dropped, so a backlog never builds.
 *
 * Toast: `{ id, badgeId, badge, bulkId, recipientIds: [], names: [] }` (`badge`: a catalogue
 * badge's display snapshot, or null). Returns a new queue.
 */
export function mergeClassToasts(
  queue,
  newAwards,
  { viewerId = null, students = {}, finishedBulkIds = new Set(), cap = CLASS_TOAST_QUEUE_CAP } = {}
) {
  let next = queue.map((toast) => ({ ...toast }))
  for (const award of newAwards) {
    const bulkId = award.decision?.bulkId ?? null
    const isViewer = viewerId != null && award.studentId === viewerId
    if (bulkId) {
      if (isViewer) {
        // The viewer is one of the recipients: their card replaces the class toast.
        next = next.filter((toast) => toast.bulkId !== bulkId)
        finishedBulkIds.add(bulkId)
        continue
      }
      if (finishedBulkIds.has(bulkId) || !award.decision?.announce) continue
      const existing = next.find((toast) => toast.bulkId === bulkId)
      if (existing) {
        if (!existing.recipientIds.includes(award.studentId)) {
          existing.recipientIds.push(award.studentId)
          existing.names.push(studentName(students, award.studentId))
        }
        continue
      }
    } else if (isViewer || !award.decision?.announce) {
      continue
    }
    if (next.length >= cap) continue
    next.push({
      id: bulkId ?? award.key,
      badgeId: award.badgeId,
      // A catalogue badge's display snapshot (resolveBadge's `decision.badge`), for classmates.
      badge: award.decision?.badge ?? null,
      bulkId,
      recipientIds: [award.studentId],
      names: [studentName(students, award.studentId)],
    })
  }
  return next
}

function studentName(students, studentId) {
  return students?.[studentId]?.displayName || 'A coder'
}

/** The toast's text: "Alex · Bug Hunter", or "Keyboard Wizard · 12 coders" for a bulk award. */
export function classToastLabel(toast, badge) {
  const title = badge?.title ?? 'Badge'
  if (toast.recipientIds.length > 1) return `${title} · ${toast.recipientIds.length} coders`
  return `${toast.names[0] ?? 'A coder'} · ${title}`
}
