// Live badge suggestions for the teacher (docs/architecture/live-badges-plan.md, "Architecture").
// Suggestions are never stored: they are recomputed from the session snapshot (so they survive a
// teacher reload), and only the tutor's decisions are written (`decideBadge` in useSession).
import { useEffect, useMemo, useRef } from 'react'
import { evaluateBadgeRules } from '../../badges/evaluate.js'
import { getBadgeDefinition } from '../../badges/registry.pure.js'
import {
  badgeEvaluationInputKey,
  buildLiveTimelines,
  liveBadgeLesson,
} from '../../badges/liveTimeline.js'

const EMPTY = Object.freeze({
  suggestions: Object.freeze([]),
  suggestionsByStudent: Object.freeze({}),
  pendingCountByStudent: Object.freeze({}),
  awardedCountByStudent: Object.freeze({}),
  decisions: Object.freeze({}),
})

/**
 * The derived views of a suggestion list and the session's `badges` decisions. Pure.
 * `awardedCountByStudent` counts `awarded` decisions only (a revoked badge isn't held).
 */
export function groupBadgeSuggestions(suggestions, decisions = {}) {
  const suggestionsByStudent = {}
  for (const suggestion of suggestions) {
    ;(suggestionsByStudent[suggestion.studentId] ??= []).push(suggestion)
  }
  const pendingCountByStudent = Object.fromEntries(
    Object.entries(suggestionsByStudent).map(([studentId, list]) => [studentId, list.length])
  )
  const awardedCountByStudent = {}
  for (const [studentId, byBadge] of Object.entries(decisions ?? {})) {
    const awarded = Object.values(byBadge ?? {}).filter((d) => d?.status === 'awarded').length
    if (awarded > 0) awardedCountByStudent[studentId] = awarded
  }
  return { suggestionsByStudent, pendingCountByStudent, awardedCountByStudent }
}

/**
 * The badge rules' suggestions for the current session, for the teacher's UI.
 *
 * Memoised on serialised keys, not object identity: `snap.val()` rebuilds the session on every
 * write (and TeacherView's session-edited lesson with it), so the rules only re-run when a
 * rostered student's badge inputs, the decisions, the current task, the ended state or the
 * lesson's content actually change. Equal inputs return the same objects.
 *
 * @param {object} input
 * @param {object|null} input.session the `sessions/{lessonId}` value
 * @param {object|null} input.lesson the session-edited lesson (Edit Lesson overrides applied)
 * @param {boolean} [input.enabled=true] false returns the empty result without evaluating
 * @param {object[]} [input.topics] the Topic Library's topics, for Resourceful Coder's reason
 * @returns {{
 *   suggestions: import('../../badges/evaluate.js').BadgeSuggestion[],
 *   suggestionsByStudent: { [studentId: string]: import('../../badges/evaluate.js').BadgeSuggestion[] },
 *   pendingCountByStudent: { [studentId: string]: number },
 *   awardedCountByStudent: { [studentId: string]: number },
 *   decisions: { [studentId: string]: { [badgeId: string]: object } },
 * }}
 */
// `peerHelp`: the teacher's read of peer help (usePeerHelp().allPeerHelp), for Helpful Coder.
export function useBadgeSuggestions({
  session,
  lesson,
  enabled = true,
  topics = null,
  peerHelp = null,
}) {
  const active = !!enabled && !!session && !!lesson

  // One lesson object per distinct lesson content, and one topic list per distinct set of titles
  // (both are rebuilt on unrelated renders).
  const lessonKey = useMemo(() => (lesson ? JSON.stringify(lesson) : ''), [lesson])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const badgeLesson = useMemo(() => liveBadgeLesson(lesson), [lessonKey])
  const topicsKey = Array.isArray(topics)
    ? JSON.stringify(topics.map((topic) => [topic?.id, topic?.title]))
    : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTopics = useMemo(() => topics, [topicsKey])

  const inputKey = active ? badgeEvaluationInputKey(session, peerHelp) : ''

  return useMemo(
    () => {
      if (!active) return EMPTY
      const decisions = session.badges ?? {}
      const suggestions = evaluateBadgeRules({
        timelines: buildLiveTimelines({
          session,
          lesson: badgeLesson,
          topics: stableTopics,
          peerHelp,
        }),
        lesson: badgeLesson,
        decisions,
        options: {
          currentTaskId: session.currentTaskId ?? null,
          sessionEnded: session.state === 'ended',
        },
      })
      return { suggestions, decisions, ...groupBadgeSuggestions(suggestions, decisions) }
    },
    // `session` and `peerHelp` are read through `inputKey`, which serialises every part used here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, inputKey, badgeLesson, stableTopics]
  )
}

const suggestionKey = (suggestion) => `${suggestion.studentId}:${suggestion.badgeId}`

/**
 * The suggestions auto-award should decide now: `autoAwardable` badges only, not already tried
 * in this tab (`attempted`, a Set of `studentId:badgeId`). Pure.
 */
export function pickAutoAwards(suggestions, attempted = new Set()) {
  return (suggestions ?? []).filter(
    (suggestion) =>
      getBadgeDefinition(suggestion.badgeId)?.autoAwardable &&
      !attempted.has(suggestionKey(suggestion))
  )
}

/**
 * The `decideBadge` decision for an auto-award. Several students given the same badge in one
 * pass share a `bulkId`, so the class sees one merged announcement.
 */
export function autoAwardDecision(suggestion, bulkId = null) {
  return {
    status: 'awarded',
    source: 'auto',
    reason: suggestion.reason ?? null,
    taskId: suggestion.taskId ?? null,
    announce: true,
    bulkId,
  }
}

/**
 * Awards `autoAwardable` suggestions while the tutor's **Auto-award high-confidence badges**
 * toggle (`badgeSettings.autoAward`) is on. `decideBadge` is write-if-absent, so two teacher tabs
 * (or an auto-award racing a dismissal) still write one decision. Within this tab each
 * student/badge is tried once: an award in flight (or one that failed, e.g. before the rules
 * are deployed) is not re-fired on the next session write. Turning the toggle off and on again
 * retries.
 *
 * @param {object} input
 * @param {object[]} input.suggestions from useBadgeSuggestions
 * @param {{ autoAward?: boolean }|null} input.settings the session's `badgeSettings`
 * @param {(studentId, badgeId, decision) => Promise} input.decideBadge from useSession
 */
export function useBadgeAutoAward({ suggestions, settings, decideBadge }) {
  const attemptedRef = useRef(new Set())
  const autoAward = !!settings?.autoAward

  useEffect(() => {
    if (!autoAward) {
      attemptedRef.current = new Set()
      return
    }
    if (typeof decideBadge !== 'function') return
    const picked = pickAutoAwards(suggestions, attemptedRef.current)
    if (picked.length === 0) return

    const byBadge = new Map()
    for (const suggestion of picked) {
      if (!byBadge.has(suggestion.badgeId)) byBadge.set(suggestion.badgeId, [])
      byBadge.get(suggestion.badgeId).push(suggestion)
    }
    const stamp = Date.now()
    for (const [badgeId, group] of byBadge) {
      const bulkId = group.length > 1 ? `auto-${badgeId}-${stamp}` : null
      for (const suggestion of group) {
        attemptedRef.current.add(suggestionKey(suggestion))
        Promise.resolve(
          decideBadge(suggestion.studentId, badgeId, autoAwardDecision(suggestion, bulkId))
        ).catch((error) => {
          console.warn('Auto-award failed', error)
        })
      }
    }
  }, [autoAward, suggestions, decideBadge])
}
