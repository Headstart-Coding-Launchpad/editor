import React, { useMemo, useState } from 'react'
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

/**
 * The tutor's manual badge picker (docs/architecture/live-badges-plan.md, "Tutor experience"):
 * opened from a student's More → 🏅 Award badge, or from the grid's select mode for several
 * students at once. Lists every badge (registry rule-backed and tutor-only, then the Admin
 * catalogue via `catalogueBadges`); a badge every selected student already holds is greyed.
 * Hovering or focusing a badge shows its exact rule. One click awards (source 'manual'); several
 * students share one `bulkId`, so the class sees one merged announcement. With one student it
 * also lists their awarded badges with Revoke (silent to the student).
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
  const [detailId, setDetailId] = useState(null)

  const badges = useMemo(() => listAwardableBadges(catalogueBadges), [catalogueBadges])
  const single = students.length === 1 ? students[0] : null
  const held = single
    ? Object.entries(decisions?.[single.anonymousId] ?? {})
        .filter(([, decision]) => decision?.status === 'awarded')
        .map(([badgeId, decision]) => ({
          badge: resolveBadge(badgeId, catalogueBadges, decision),
          decision,
        }))
    : []
  const detail = detailId ? badges.find((badge) => badge.id === detailId) : null

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
    } else if (committed.length < targets.length) {
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

  return (
    <div
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
      <div role="dialog" aria-modal="true" aria-labelledby="badge-award-title" style={s.dialog}>
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
                />
                Announce to class
              </label>
            </div>
            <div style={s.grid}>
              {badges.map((badge) => {
                const holders = students.filter((st) =>
                  holds(decisions, st.anonymousId, badge.id)
                ).length
                const allHold = students.length > 0 && holders === students.length
                const busy = pending.has(badge.id)
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
                      ...(detailId === badge.id ? s.optionActive : null),
                    }}
                    aria-disabled={allHold || busy}
                    title={hint}
                    onMouseEnter={() => setDetailId(badge.id)}
                    onFocus={() => setDetailId(badge.id)}
                    onClick={() => {
                      if (!allHold) handleAward(badge)
                    }}
                    data-testid={`badge-option-${badge.id}`}
                  >
                    <BadgeEmoji badge={badge} size="1.15rem" />
                    <span style={s.optionTitle}>{badge.title}</span>
                    {allHold && <span style={s.optionState}>Awarded</span>}
                    {busy && <span style={s.optionState}>Awarding…</span>}
                  </button>
                )
              })}
            </div>
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
                <span style={s.muted}>Hover or focus a badge to see its rule.</span>
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
      </div>
    </div>
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
    borderRadius: 10,
    width: 'min(560px, 100%)',
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
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
    fontFamily: 'var(--font-body)',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--colour-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  muted: { fontSize: '0.82rem', color: 'var(--colour-muted-soft)' },
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
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 6,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    padding: '6px 10px',
    background: 'var(--ui-surface)',
    border: '1px solid var(--ui-border)',
    borderRadius: 'var(--ui-radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    color: 'var(--colour-text)',
    transition: 'background var(--ui-motion), border-color var(--ui-motion)',
  },
  optionActive: { borderColor: 'var(--ui-border-strong)', background: 'var(--ui-surface-tint)' },
  optionHeld: { opacity: 0.45, cursor: 'default' },
  optionTitle: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optionState: { fontSize: '0.68rem', color: 'var(--colour-muted)', flexShrink: 0 },
  detail: {
    minHeight: 44,
    padding: '8px 10px',
    background: 'var(--ui-surface-soft)',
    borderRadius: 'var(--ui-radius-sm)',
    fontSize: '0.8rem',
    color: 'var(--colour-text)',
  },
  ruleText: { marginTop: 3, color: 'var(--colour-muted)' },
  notice: {
    fontSize: '0.82rem',
    padding: '6px 10px',
    borderRadius: 'var(--ui-radius-sm)',
    background: 'var(--colour-info-bg)',
    color: 'var(--colour-info-text)',
  },
  noticeError: { background: 'var(--colour-error-bg)', color: 'var(--colour-error-text)' },
}
