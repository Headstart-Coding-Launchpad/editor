import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import BadgeChip, { BadgeEmoji } from './BadgeChip'
import {
  createBadgeBulkId,
  listAwardableBadges,
  MANUAL_AWARD_REPLACES,
  resolveBadge,
} from '../../../badges/badgeDisplay'
import { catalogueBadgeSnapshot } from '../../../badges/catalogue'

function holds(decisions, studentId, badgeId) {
  return decisions?.[studentId]?.[badgeId]?.status === 'awarded'
}

function namesOf(students) {
  if (students.length <= 3) return students.map((st) => st.displayName).join(', ')
  return `${students.length} students`
}

/** The picker's sections, in order; a section with no badges isn't shown. */
export const BADGE_PICKER_GROUPS = Object.freeze([
  { id: 'rules', label: 'Suggested by rules', test: (badge) => !badge.tutorOnly },
  { id: 'tutor', label: 'Tutor-awarded', test: (badge) => badge.tutorOnly && !badge.catalogue },
  { id: 'admin', label: 'Admin badges', test: (badge) => !!badge.catalogue },
])

/**
 * The tutor's manual badge picker (docs/architecture/live-badges-plan.md, "Tutor experience"):
 * opened from a student's More → 🏅 Award badge, or from the grid's select mode for several
 * students at once. Lists every badge in three sections: "Suggested by rules" (registry
 * rule-backed), "Tutor-awarded" (registry tutor-only) and "Admin badges" (the Admin catalogue via
 * `catalogueBadges`, only when there are any). A badge every selected student already holds is
 * greyed.
 *
 * Select, then confirm: clicking a tile selects it (aria-pressed) and shows its blurb and exact
 * rule, and the Award button (disabled until a badge is selected) awards it (source 'manual').
 * Hovering a tile previews its rule until one is selected. Several students share one `bulkId`,
 * so the class sees one merged announcement. With one student it also lists their awarded badges
 * with Revoke (silent to the student).
 *
 * The overlay carries `ui-modal-backdrop`, as in StudentModal, so the global modal styles give it
 * a purple header and a light body. It is portalled to <body>: nested inside StudentModal's
 * backdrop, the global `.ui-modal-backdrop > div > div:first-child` header rule would paint this
 * whole card purple.
 *
 * @param {object} props
 * @param {{ anonymousId: string, displayName: string }[]} props.students who receives the award
 * @param {object} props.decisions the session's `badges` node
 * @param {object[]} [props.catalogueBadges] Admin-catalogue badges `{ id, emoji, title, blurb, archived }`
 * @param {string|number|null} [props.taskId] stored on the decision (the class's current task)
 * @param {Function} props.onDecideBadge useSession's decideBadge
 * @param {Function} [props.onRevokeBadge] useSession's revokeBadge (single student only)
 * @param {Function} props.onClose
 */
export default function BadgeAwardDialog({
  students = [],
  decisions = {},
  catalogueBadges = [],
  taskId = null,
  onDecideBadge,
  onRevokeBadge,
  onClose,
}) {
  const [announce, setAnnounce] = useState(true)
  const [pending, setPending] = useState(() => new Set())
  const [notice, setNotice] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)

  const badges = useMemo(() => listAwardableBadges(catalogueBadges), [catalogueBadges])
  const groups = useMemo(
    () =>
      BADGE_PICKER_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        badges: badges.filter(group.test),
      })).filter((group) => group.badges.length > 0),
    [badges]
  )
  const single = students.length === 1 ? students[0] : null
  const held = single
    ? Object.entries(decisions?.[single.anonymousId] ?? {})
        .filter(([, decision]) => decision?.status === 'awarded')
        .map(([badgeId, decision]) => ({
          badge: resolveBadge(badgeId, catalogueBadges, decision),
          decision,
        }))
    : []

  function holdersOf(badge) {
    return students.filter((st) => holds(decisions, st.anonymousId, badge.id)).length
  }

  const selected = selectedId ? badges.find((badge) => badge.id === selectedId) : null
  const detailId = selectedId ?? hoverId
  const detail = detailId ? badges.find((badge) => badge.id === detailId) : null
  const selectedAllHold =
    !!selected && students.length > 0 && holdersOf(selected) === students.length
  const selectedBusy = !!selected && pending.has(selected.id)

  function mark(key, on) {
    setPending((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function handleAward(badge) {
    const targets = students.filter((st) => !holds(decisions, st.anonymousId, badge.id))
    if (targets.length === 0 || pending.has(badge.id)) return
    const bulkId = targets.length > 1 ? createBadgeBulkId(badge.id) : null
    mark(badge.id, true)
    setNotice(null)
    const results = await Promise.allSettled(
      targets.map((st) =>
        onDecideBadge(
          st.anonymousId,
          badge.id,
          {
            status: 'awarded',
            source: 'manual',
            reason: null,
            taskId,
            announce,
            bulkId,
            // Students can't read the Admin catalogue, so a catalogue badge travels with its
            // emoji, title and blurb (null for a registry badge).
            badge: catalogueBadgeSnapshot(badge),
          },
          { replaceStatuses: [...MANUAL_AWARD_REPLACES] }
        )
      )
    )
    mark(badge.id, false)
    // committed: false means another tab (or auto-award) decided first; that isn't an error.
    const committed = targets.filter(
      (_, i) => results[i].status === 'fulfilled' && results[i].value?.committed
    )
    const failed = results.filter((result) => result.status === 'rejected').length
    if (failed > 0) {
      setNotice({ tone: 'error', text: `Couldn't award ${badge.title}. Check your connection.` })
      return
    }
    setSelectedId(null)
    if (committed.length < targets.length) {
      setNotice({
        tone: 'info',
        text:
          committed.length === 0
            ? `${badge.title} was already awarded (another tab got there first).`
            : `${badge.emoji} ${badge.title} awarded to ${namesOf(committed)}; the rest already had it.`,
      })
    } else {
      setNotice({
        tone: 'ok',
        text: `${badge.emoji} ${badge.title} awarded to ${namesOf(targets)}.`,
      })
    }
  }

  async function handleRevoke(badge) {
    const key = `revoke:${badge.id}`
    if (!single || pending.has(key)) return
    mark(key, true)
    setNotice(null)
    try {
      const result = await onRevokeBadge?.(single.anonymousId, badge.id)
      setNotice({
        tone: 'info',
        text:
          result?.committed === false ? `${badge.title} was not held.` : `${badge.title} revoked.`,
      })
    } catch {
      setNotice({ tone: 'error', text: `Couldn't revoke ${badge.title}. Check your connection.` })
    } finally {
      mark(key, false)
    }
  }

  let awardLabel = 'Award'
  if (selectedBusy) awardLabel = 'Awarding…'
  else if (selectedAllHold) awardLabel = 'Already awarded'
  else if (selected) awardLabel = `Award ${selected.emoji} ${selected.title}`

  return createPortal(
    <div
      className="ui-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-award-title"
      style={s.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      onKeyDown={(event) => {
        // Stop here so the student modal behind this one stays open.
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose?.()
        }
      }}
    >
      <div style={s.dialog}>
        <div style={s.header}>
          <span id="badge-award-title" style={s.titleText}>
            🏅 Award badge · {namesOf(students)}
          </span>
          <button
            type="button"
            style={s.closeBtn}
            onClick={onClose}
            aria-label="Close badge picker"
            autoFocus
          >
            ✕
          </button>
        </div>

        <div style={s.body}>
          {single && (
            <section aria-label={`${single.displayName}'s badges`} style={s.section}>
              <div style={s.sectionLabel}>Awarded this lesson</div>
              {held.length === 0 ? (
                <div style={s.muted}>None yet.</div>
              ) : (
                <ul style={s.heldList}>
                  {held.map(({ badge }) => {
                    const busy = pending.has(`revoke:${badge.id}`)
                    return (
                      <li key={badge.id} style={s.heldRow}>
                        <BadgeChip badge={badge} title={badge.blurb} />
                        <button
                          type="button"
                          className="btn-ghost-outline"
                          style={s.smallBtn}
                          disabled={busy || !onRevokeBadge}
                          onClick={() => handleRevoke(badge)}
                          aria-label={`Revoke ${badge.title}`}
                          title="Remove this badge. The student is not told."
                        >
                          {busy ? 'Revoking…' : 'Revoke'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          <section aria-label="Choose a badge" style={s.section}>
            <div style={s.pickerHead}>
              <span style={s.sectionLabel}>Choose a badge</span>
              <label style={s.announce}>
                <input
                  type="checkbox"
                  checked={announce}
                  onChange={(event) => setAnnounce(event.target.checked)}
                  style={s.announceBox}
                />
                Announce to class
              </label>
            </div>
            {groups.map((group) => (
              <div
                key={group.id}
                role="group"
                aria-labelledby={`badge-group-${group.id}`}
                style={s.group}
              >
                <div id={`badge-group-${group.id}`} style={s.groupLabel}>
                  {group.label}
                </div>
                <div style={s.grid}>
                  {group.badges.map((badge) => {
                    const holders = holdersOf(badge)
                    const allHold = students.length > 0 && holders === students.length
                    const busy = pending.has(badge.id)
                    const isSelected = selectedId === badge.id
                    const hint = [
                      badge.blurb,
                      badge.ruleText,
                      holders > 0 && students.length > 1
                        ? `Held by ${holders} of ${students.length}.`
                        : null,
                    ]
                      .filter(Boolean)
                      .join('\n')
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        style={{
                          ...s.option,
                          ...(allHold ? s.optionHeld : null),
                          ...(isSelected ? s.optionSelected : null),
                        }}
                        aria-pressed={isSelected}
                        aria-disabled={allHold || busy}
                        title={hint}
                        onMouseEnter={() => setHoverId(badge.id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={() => setSelectedId(isSelected ? null : badge.id)}
                        data-testid={`badge-option-${badge.id}`}
                      >
                        <BadgeEmoji badge={badge} size="1.25rem" />
                        <span style={s.optionTitle}>{badge.title}</span>
                        {allHold && <span style={s.optionState}>Awarded</span>}
                        {busy && <span style={s.optionState}>Awarding…</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={s.detail} data-testid="badge-rule-detail">
              {detail ? (
                <>
                  <strong>
                    {detail.emoji} {detail.title}
                  </strong>
                  {detail.blurb ? ` · ${detail.blurb}` : ''}
                  <div style={s.ruleText}>{detail.ruleText}</div>
                </>
              ) : (
                <span style={s.muted}>Select a badge to see what it&apos;s for.</span>
              )}
            </div>
          </section>

          <div role="status">
            {notice && (
              <div style={{ ...s.notice, ...(notice.tone === 'error' ? s.noticeError : null) }}>
                {notice.text}
              </div>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button type="button" className="btn-ghost-outline" style={s.footerBtn} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={s.footerBtn}
            disabled={!selected || selectedAllHold || selectedBusy}
            onClick={() => selected && handleAward(selected)}
            data-testid="badge-award-confirm"
          >
            {awardLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    borderRadius: 10,
    width: 'min(760px, 100%)',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--ui-shadow)',
    overflow: 'hidden',
  },
  header: {
    background: 'var(--colour-primary)',
    color: 'var(--colour-text-on-primary)',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  titleText: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.98rem',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'var(--colour-text-on-primary)',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  body: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
    background: 'var(--ui-surface)',
    fontFamily: 'var(--font-body)',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--colour-ink-strong)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  muted: { fontSize: '0.84rem', color: 'var(--colour-muted)' },
  heldList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  heldRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: '0.86rem',
  },
  smallBtn: { fontSize: 12, padding: '3px 10px' },
  pickerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  announce: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.86rem',
    fontWeight: 600,
    color: 'var(--colour-ink-strong)',
    cursor: 'pointer',
  },
  announceBox: { width: 16, height: 16, accentColor: 'var(--colour-primary)', cursor: 'pointer' },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  groupLabel: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--colour-primary-dark)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 6,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '6px 10px',
    background: 'var(--ui-surface)',
    border: '1px solid var(--ui-border-neutral-strong)',
    borderRadius: 'var(--ui-radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: 'var(--colour-ink-strong)',
    transition: 'background var(--ui-motion), border-color var(--ui-motion)',
  },
  optionSelected: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--ui-surface-tint)',
    boxShadow: 'inset 0 0 0 1px var(--colour-primary)',
  },
  optionHeld: { opacity: 0.5 },
  // Full names: a long title wraps onto a second line rather than being cut off.
  optionTitle: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
  optionState: { fontSize: '0.7rem', color: 'var(--colour-muted)', flexShrink: 0 },
  detail: {
    minHeight: 48,
    padding: '8px 10px',
    background: 'var(--ui-surface-soft)',
    border: '1px solid var(--ui-border)',
    borderRadius: 'var(--ui-radius-sm)',
    fontSize: '0.84rem',
    color: 'var(--colour-ink-strong)',
  },
  ruleText: { marginTop: 3, color: 'var(--colour-muted)' },
  notice: {
    fontSize: '0.84rem',
    padding: '6px 10px',
    borderRadius: 'var(--ui-radius-sm)',
    background: 'var(--colour-info-bg)',
    color: 'var(--colour-info-text)',
  },
  noticeError: { background: 'var(--colour-error-bg)', color: 'var(--colour-error-text)' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid var(--ui-border)',
    background: 'var(--ui-surface-soft)',
    flexShrink: 0,
  },
  footerBtn: { fontSize: 13, padding: '7px 16px' },
}
