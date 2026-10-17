import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsTouchDevice } from '../../../shared/useIsTouchDevice'
import { topStudentSuggestion } from '../../../badges/suggestionRanking'

export const UNDO_MS = 6000

/**
 * One-tap award of a student's top-ranked suggested badge (docs/authoring/badges.md, "One-tap
 * award"). Used on the student card and in the one-student view. Tapping awards straight away
 * through the same `onDecideBadge` the suggestions panel uses (source 'rule', the rule's reason
 * and task), then shows an Undo toast for six seconds that calls the existing `onRevokeBadge`.
 *
 * With no suggestion it opens the normal picker (`onOpenPicker`) in the modal, and renders
 * nothing when there is no picker to open (the card, so the grid isn't cluttered).
 *
 * @param {object} props
 * @param {{ anonymousId: string, displayName: string }} props.student
 * @param {object[]} props.suggestions BadgeSuggestion[] (any students)
 * @param {object} [props.decisions] the session's `badges` node
 * @param {object[]} [props.catalogueBadges]
 * @param {string|number|null} [props.currentTaskId]
 * @param {Function} props.onDecideBadge useSession's decideBadge
 * @param {Function} [props.onRevokeBadge] useSession's revokeBadge
 * @param {Function} [props.onOpenPicker] opens BadgeAwardDialog when nothing is suggested
 * @param {'card'|'header'} [props.variant]
 */
export default function OneTapAwardButton({
  student,
  suggestions = [],
  decisions = {},
  catalogueBadges = [],
  currentTaskId = null,
  onDecideBadge,
  onRevokeBadge,
  onOpenPicker,
  variant = 'card',
}) {
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const touch = useIsTouchDevice()

  useEffect(() => () => clearTimeout(timer.current), [])

  const top = useMemo(
    () =>
      topStudentSuggestion({
        suggestions,
        studentId: student.anonymousId,
        decisions,
        catalogueBadges,
        currentTaskId,
      }),
    [suggestions, student.anonymousId, decisions, catalogueBadges, currentTaskId]
  )

  function showToast(next, ms = UNDO_MS) {
    clearTimeout(timer.current)
    setToast(next)
    timer.current = setTimeout(() => setToast(null), ms)
  }

  async function award() {
    if (!top || busy || !onDecideBadge) return
    setBusy(true)
    try {
      const result = await onDecideBadge(student.anonymousId, top.badgeId, {
        status: 'awarded',
        source: 'rule',
        reason: top.reason,
        taskId: top.taskId,
        announce: true,
        bulkId: null,
      })
      if (result?.committed === false) {
        showToast({ text: `${top.badge.title} was already decided.` }, 3000)
      } else {
        showToast({
          text: `${top.badge.emoji} ${top.badge.title} awarded to ${student.displayName}.`,
          badgeId: top.badgeId,
          title: top.badge.title,
        })
      }
    } catch {
      showToast({ text: `Couldn't award ${top.badge.title}. Check your connection.` }, 4000)
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    const current = toast
    if (!current?.badgeId) return
    setToast({ text: 'Undoing…' })
    try {
      await onRevokeBadge?.(student.anonymousId, current.badgeId)
      showToast({ text: `${current.title} taken back.` }, 3000)
    } catch {
      showToast({ text: `Couldn't undo ${current.title}. Check your connection.` }, 4000)
    }
  }

  const isCard = variant === 'card'
  let button = null
  if (top && onDecideBadge) {
    const label = `Award ${top.badge.title} to ${student.displayName}`
    const why = [top.reason, top.description].filter(Boolean).join(' · ')
    button = (
      <button
        type="button"
        className={isCard ? undefined : 'btn-secondary'}
        style={isCard ? { ...s.cardBtn, ...(touch ? s.touchMin : null) } : s.headerBtn}
        disabled={busy}
        aria-label={why ? `${label}. ${why}` : label}
        title={why ? `${label}\n${why}` : label}
        data-testid="one-tap-award"
        onClick={(event) => {
          event.stopPropagation()
          award()
        }}
      >
        <span aria-hidden="true">{top.badge.emoji}</span>{' '}
        <span style={s.btnText}>{busy ? 'Awarding…' : `Award ${top.badge.title}`}</span>
      </button>
    )
  } else if (!isCard && onOpenPicker) {
    button = (
      <button
        type="button"
        className="btn-secondary"
        style={s.headerBtn}
        data-testid="one-tap-award"
        onClick={onOpenPicker}
      >
        <span aria-hidden="true">🏅</span> Award badge
      </button>
    )
  }

  return (
    <>
      {button}
      {toast &&
        createPortal(
          <div role="status" style={s.toast} data-testid="award-toast">
            <span>{toast.text}</span>
            {toast.badgeId && onRevokeBadge && (
              <button type="button" style={s.undo} onClick={undo}>
                Undo
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

const s = {
  cardBtn: {
    background: '#f5f3ff',
    border: '1px solid var(--colour-primary)',
    color: 'var(--colour-primary-dark)',
    borderRadius: 999,
    fontSize: '0.72rem',
    lineHeight: 1.2,
    padding: '1px 8px',
    cursor: 'pointer',
    maxWidth: 170,
    minHeight: 24,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  },
  touchMin: { minHeight: 44, padding: '4px 12px' },
  headerBtn: {
    fontSize: 13,
    padding: '5px 12px',
    minHeight: 44,
    whiteSpace: 'nowrap',
    maxWidth: 220,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  btnText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 24,
    transform: 'translateX(-50%)',
    zIndex: 1300,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'var(--colour-ink-strong, #111827)',
    color: '#fff',
    borderRadius: 10,
    boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
    fontSize: '0.9rem',
    maxWidth: 'calc(100vw - 32px)',
  },
  undo: {
    minHeight: 44,
    minWidth: 64,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.6)',
    background: 'transparent',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
}
