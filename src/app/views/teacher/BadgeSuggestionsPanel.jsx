import React, { useEffect, useMemo, useRef, useState } from 'react'
import BadgeChip from '../../components/badges/BadgeChip'
import { createBadgeBulkId, resolveBadge } from '../../../badges/badgeDisplay'
import { getRuleBackedBadges } from '../../../badges/registry'

// The tutor's live badge suggestions (docs/architecture/live-badges-plan.md, "Tutor
// experience"): a collapsible centre-column panel in the TaskRatingPanel pattern. Suggestions
// come from useBadgeSuggestions (recomputed from the session, never stored); only the tutor's
// decisions are written, through useSession's decideBadge (a write-if-absent transaction, so a
// second teacher tab or auto-award deciding first resolves as `committed: false`, which is not
// an error). The session's auto-award and sounds-off toggles live at the top.
//
// Awarding is one click and never modal. A row is hidden as soon as its decision is written,
// before the session snapshot drops the suggestion.

const keyOf = (suggestion) => `${suggestion.studentId}:${suggestion.badgeId}`

const AUTO_AWARD_TITLE = `Award these without a click: ${getRuleBackedBadges()
  .filter((badge) => badge.autoAwardable)
  .map((badge) => badge.title)
  .join(', ')}. Any award can be revoked.`

/**
 * @param {object} props
 * @param {object[]} props.suggestions useBadgeSuggestions().suggestions
 * @param {{ anonymousId: string, displayName: string }[]} props.students the roster, in grid order
 * @param {{ autoAward?: boolean, soundsOff?: boolean }|null} props.settings session.badgeSettings
 * @param {Function} props.onDecideBadge useSession's decideBadge
 * @param {Function} props.onSetBadgeSettings useSession's setBadgeSettings
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {number} [props.focusRequest] bump to open, scroll to and focus the panel
 */
export default function BadgeSuggestionsPanel({
  suggestions = [],
  students = [],
  settings = null,
  onDecideBadge,
  onSetBadgeSettings,
  open,
  onOpenChange,
  focusRequest = 0,
}) {
  const headerRef = useRef(null)
  const [announceOff, setAnnounceOff] = useState(() => new Set())
  const [pending, setPending] = useState(() => new Map())
  const [done, setDone] = useState(() => new Set())
  const [notice, setNotice] = useState(null)
  const [settingsBusy, setSettingsBusy] = useState(false)

  useEffect(() => {
    if (!focusRequest) return
    onOpenChange?.(true)
    headerRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    headerRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  // Forget hidden rows once the snapshot has dropped them (a later suggestion for the same
  // student and badge can't happen: any decision removes it for the lesson).
  const liveKeys = useMemo(() => new Set(suggestions.map(keyOf)), [suggestions])
  useEffect(() => {
    setDone((prev) => {
      const next = new Set([...prev].filter((key) => liveKeys.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [liveKeys])

  const visible = suggestions.filter((suggestion) => !done.has(keyOf(suggestion)))
  const nameOf = (studentId) =>
    students.find((st) => st.anonymousId === studentId)?.displayName ?? 'Student'

  const order = new Map(students.map((st, i) => [st.anonymousId, i]))
  const groups = (() => {
    const byStudent = new Map()
    for (const suggestion of visible) {
      if (!byStudent.has(suggestion.studentId)) byStudent.set(suggestion.studentId, [])
      byStudent.get(suggestion.studentId).push(suggestion)
    }
    return [...byStudent.entries()].sort(
      ([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)
    )
  })()

  // Badges suggested to two or more students: "Award all" gives them one shared bulkId.
  const bulk = (() => {
    const byBadge = new Map()
    for (const suggestion of visible) {
      if (!byBadge.has(suggestion.badgeId)) byBadge.set(suggestion.badgeId, [])
      byBadge.get(suggestion.badgeId).push(suggestion)
    }
    return [...byBadge.entries()].filter(([, list]) => list.length > 1)
  })()

  function setPendingKeys(keys, value) {
    setPending((prev) => {
      const next = new Map(prev)
      for (const key of keys) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }

  // Writes one decision per suggestion; returns how many were already decided elsewhere.
  async function decide(list, status, { announce = true, bulkId = null } = {}) {
    const keys = list.map(keyOf)
    if (keys.some((key) => pending.has(key))) return
    setPendingKeys(keys, status)
    setNotice(null)
    const results = await Promise.allSettled(
      list.map((suggestion) =>
        onDecideBadge(suggestion.studentId, suggestion.badgeId, {
          status,
          source: 'rule',
          reason: suggestion.reason ?? null,
          taskId: suggestion.taskId ?? null,
          announce: status === 'awarded' ? announce : false,
          bulkId,
        })
      )
    )
    setPendingKeys(keys, null)
    const written = list.filter((_, i) => results[i].status === 'fulfilled')
    setDone((prev) => new Set([...prev, ...written.map(keyOf)]))
    const taken = written.filter(
      (suggestion) => results[list.indexOf(suggestion)].value?.committed === false
    )
    if (written.length < list.length) {
      setNotice({ tone: 'error', text: "Couldn't save that decision. Check your connection." })
    } else if (taken.length > 0) {
      const first = taken[0]
      const badge = resolveBadge(first.badgeId)
      setNotice({
        tone: 'info',
        text:
          taken.length === 1
            ? `${nameOf(first.studentId)}'s ${badge.title} was already decided in another tab.`
            : `${taken.length} of those were already decided in another tab.`,
      })
    }
  }

  function toggleAnnounce(key) {
    setAnnounceOff((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function changeSetting(updates) {
    setSettingsBusy(true)
    try {
      await onSetBadgeSettings?.(updates)
    } catch {
      setNotice({ tone: 'error', text: "Couldn't change that setting. Check your connection." })
    } finally {
      setSettingsBusy(false)
    }
  }

  const count = visible.length
  const autoAward = !!settings?.autoAward

  return (
    <section style={s.wrap} aria-label="Badge suggestions">
      <button
        ref={headerRef}
        type="button"
        style={{ ...s.header, ...(open ? s.headerOpen : s.headerClosed) }}
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
        aria-controls="badge-suggestions-body"
      >
        <span style={s.title}>🏅 Badge suggestions</span>
        {autoAward && <span style={s.autoTag}>Auto-award on</span>}
        <span aria-live="polite" style={count > 0 ? s.countPill : s.countMuted}>
          {count > 0 ? `${count} pending` : 'None pending'}
        </span>
        <span style={s.chevron} aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div id="badge-suggestions-body" style={s.body}>
          <div style={s.settingsRow}>
            <label style={s.toggle} title={AUTO_AWARD_TITLE}>
              <input
                type="checkbox"
                checked={autoAward}
                disabled={settingsBusy || !onSetBadgeSettings}
                onChange={(event) => changeSetting({ autoAward: event.target.checked })}
              />
              Auto-award high-confidence badges
            </label>
            <label style={s.toggle} title="Silence the badge chime on every student's screen">
              <input
                type="checkbox"
                checked={!!settings?.soundsOff}
                disabled={settingsBusy || !onSetBadgeSettings}
                onChange={(event) => changeSetting({ soundsOff: event.target.checked })}
              />
              Sounds off
            </label>
          </div>

          <div role="status">
            {notice && (
              <div style={{ ...s.notice, ...(notice.tone === 'error' ? s.noticeError : null) }}>
                {notice.text}
              </div>
            )}
          </div>

          {count === 0 ? (
            <p style={s.empty}>
              No suggestions right now. Rules suggest badges as students work, and you can award any
              badge from a student&apos;s More menu.
            </p>
          ) : (
            <>
              {bulk.length > 0 && (
                <div style={s.bulkBox}>
                  {bulk.map(([badgeId, list]) => {
                    const badge = resolveBadge(badgeId)
                    const bulkKey = `bulk:${badgeId}`
                    const busy = list.some((suggestion) => pending.has(keyOf(suggestion)))
                    return (
                      <div key={badgeId} style={s.row}>
                        <BadgeChip badge={badge} title={badge.ruleText} />
                        <span style={s.reason}>
                          {list.map((suggestion) => nameOf(suggestion.studentId)).join(', ')}
                        </span>
                        <label style={s.announce}>
                          <input
                            type="checkbox"
                            checked={!announceOff.has(bulkKey)}
                            onChange={() => toggleAnnounce(bulkKey)}
                            aria-label={`Announce ${badge.title} to class`}
                          />
                          Announce
                        </label>
                        <button
                          type="button"
                          className="btn-primary"
                          style={s.actionBtn}
                          disabled={busy}
                          onClick={() =>
                            decide(list, 'awarded', {
                              announce: !announceOff.has(bulkKey),
                              bulkId: createBadgeBulkId(badgeId),
                            })
                          }
                        >
                          {busy ? 'Awarding…' : `Award all (${list.length})`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {groups.map(([studentId, list]) => (
                <div key={studentId} style={s.group}>
                  <div style={s.studentName}>{nameOf(studentId)}</div>
                  {list.map((suggestion) => {
                    const key = keyOf(suggestion)
                    const badge = resolveBadge(suggestion.badgeId)
                    const busy = pending.get(key)
                    return (
                      <div key={key} style={s.row} data-testid={`badge-suggestion-${key}`}>
                        <BadgeChip badge={badge} title={badge.ruleText} />
                        <span style={s.reason}>{suggestion.reason}</span>
                        <label style={s.announce}>
                          <input
                            type="checkbox"
                            checked={!announceOff.has(key)}
                            onChange={() => toggleAnnounce(key)}
                            aria-label={`Announce ${badge.title} for ${nameOf(studentId)} to class`}
                          />
                          Announce
                        </label>
                        <button
                          type="button"
                          className="btn-primary"
                          style={s.actionBtn}
                          disabled={!!busy}
                          aria-label={`Award ${badge.title} to ${nameOf(studentId)}`}
                          onClick={() =>
                            decide([suggestion], 'awarded', { announce: !announceOff.has(key) })
                          }
                        >
                          {busy === 'awarded' ? 'Awarding…' : 'Award'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-outline"
                          style={s.actionBtn}
                          disabled={!!busy}
                          aria-label={`Dismiss ${badge.title} for ${nameOf(studentId)}`}
                          onClick={() => decide([suggestion], 'dismissed')}
                        >
                          {busy === 'dismissed' ? 'Dismissing…' : 'Dismiss'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

const s = {
  wrap: {
    flexShrink: 0,
    background: 'var(--ui-surface)',
    border: '1px solid var(--ui-border-neutral)',
    borderRadius: 'var(--ui-radius)',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    background: 'var(--ui-surface-neutral)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerClosed: { borderRadius: 'var(--ui-radius)' },
  headerOpen: {
    borderRadius: 'var(--ui-radius) var(--ui-radius) 0 0',
    borderBottom: '1px solid var(--ui-border-neutral)',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.03em',
    color: 'var(--colour-primary)',
    marginRight: 'auto',
  },
  autoTag: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--colour-muted)',
  },
  countPill: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--colour-text-on-primary)',
    background: 'var(--colour-primary)',
    borderRadius: 999,
    padding: '2px 8px',
  },
  countMuted: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: 'var(--colour-muted-soft)',
  },
  chevron: { fontSize: '0.65rem', color: 'var(--colour-muted-soft)', flexShrink: 0 },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 14px',
    maxHeight: 320,
    overflowY: 'auto',
    fontFamily: 'var(--font-body)',
    borderRadius: '0 0 var(--ui-radius) var(--ui-radius)',
  },
  settingsRow: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px' },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  notice: {
    fontSize: '0.8rem',
    padding: '6px 10px',
    borderRadius: 'var(--ui-radius-sm)',
    background: 'var(--colour-info-bg)',
    color: 'var(--colour-info-text)',
  },
  noticeError: { background: 'var(--colour-error-bg)', color: 'var(--colour-error-text)' },
  empty: { margin: 0, fontSize: '0.82rem', color: 'var(--colour-muted)' },
  bulkBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
    background: 'var(--ui-surface-tint)',
    borderRadius: 'var(--ui-radius-sm)',
  },
  group: { display: 'flex', flexDirection: 'column', gap: 4 },
  studentName: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--colour-ink-strong)',
    borderTop: '1px solid var(--ui-border-neutral)',
    paddingTop: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px 8px',
    fontSize: '0.82rem',
  },
  reason: { flex: '1 1 160px', minWidth: 0, color: 'var(--colour-muted)' },
  announce: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.74rem',
    color: 'var(--colour-muted)',
    cursor: 'pointer',
  },
  actionBtn: { fontSize: 12, padding: '4px 10px' },
}
