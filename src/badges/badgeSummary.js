// The class wall: a session's coding moments grouped by badge, never by student
// (docs/architecture/live-badges-plan.md, "Badge Summary task"). The Badge Summary task shows it
// live, and the session report's Coding moments section and "Copy class summary" read it too.
// Names only, no counts, so the layout never invites comparison. Pure and Node-safe.
import { listAwardableBadges, resolveBadge } from './badgeDisplay.js'
import { listAwards } from './celebration.js'

/** The Badge Summary task's heading, and the first line of the copied class summary. */
export const CLASS_WALL_TITLE = "Today's Coding Moments"

// Wall order: the picker's badge order (registry, then catalogue), then any other badge id.
function badgeOrder(catalogueBadges) {
  return new Map(listAwardableBadges(catalogueBadges).map((badge, i) => [badge.id, i]))
}

/**
 * Groups awards into wall rows, one per badge, in picker order. `awards` is a list of
 * `{ badgeId, name, decision? }` in the order names should appear (a name appears once per
 * badge); a decision's catalogue snapshot names a badge the catalogue list doesn't hold.
 * @returns {{ badgeId: string, badge: object, names: string[] }[]}
 */
export function groupClassWall(awards, catalogueBadges = []) {
  const rows = new Map()
  for (const { badgeId, name, decision } of awards ?? []) {
    if (!badgeId || !name) continue
    const row = rows.get(badgeId) ?? {
      badgeId,
      badge: resolveBadge(badgeId, catalogueBadges, decision),
      names: [],
    }
    if (!row.names.includes(name)) row.names.push(name)
    rows.set(badgeId, row)
  }
  const order = badgeOrder(catalogueBadges)
  const rank = (badgeId) => order.get(badgeId) ?? Infinity
  const compare = (x, y) => (x === y ? 0 : x < y ? -1 : 1)
  return [...rows.values()].sort(
    (a, b) => compare(rank(a.badgeId), rank(b.badgeId)) || compare(a.badgeId, b.badgeId)
  )
}

/**
 * The live class wall from the session's `badges` decisions: every `awarded` decision (revoked
 * and dismissed ones drop out), names from `nameFor(studentId)`, oldest award first within a
 * badge. A student `nameFor` returns nothing for is left out.
 */
export function buildClassWall(decisions, { nameFor = () => null, catalogueBadges = [] } = {}) {
  const awards = listAwards(decisions).map(({ studentId, badgeId, decision }) => ({
    badgeId,
    name: nameFor(studentId) || null,
    decision,
  }))
  return groupClassWall(awards, catalogueBadges)
}

/** A display name from the session roster, or a friendly placeholder. */
export function rosterNameFor(students) {
  return (studentId) => students?.[studentId]?.displayName || 'A coder'
}

/**
 * The class wall as plain text for the clipboard, grouped by badge:
 * "Today's Coding Moments\n🐛 Bug Hunter: Alex, Sam\n…". An empty wall gives just the heading
 * and a line saying so.
 */
export function classWallText(wall, { title = CLASS_WALL_TITLE } = {}) {
  const lines = (wall ?? []).map(
    (row) =>
      `${row.badge?.emoji ?? '🏅'} ${row.badge?.title ?? row.badgeId}: ${row.names.join(', ')}`
  )
  return [title, ...(lines.length > 0 ? lines : ['No coding moments were awarded.'])].join('\n')
}

/**
 * The session report's class wall: each (anonymised) student's awarded badges grouped by badge,
 * named by `studentLabel`. The emoji and title stored in the report win, so a catalogue badge
 * archived since still shows as it was.
 */
export function reportClassWall(report, catalogueBadges = []) {
  const stored = new Map()
  const awards = (report?.students ?? []).flatMap((student) =>
    (student.badges ?? []).map((badge) => {
      if (!stored.has(badge.badgeId)) stored.set(badge.badgeId, badge)
      return { badgeId: badge.badgeId, name: student.studentLabel }
    })
  )
  return groupClassWall(awards, catalogueBadges).map((row) => {
    const saved = stored.get(row.badgeId)
    return {
      ...row,
      badge: {
        ...row.badge,
        emoji: saved?.emoji || row.badge.emoji,
        title: saved?.title || row.badge.title,
      },
    }
  })
}
