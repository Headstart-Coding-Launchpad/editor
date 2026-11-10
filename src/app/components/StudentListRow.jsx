import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import StudentCard from './StudentCard'
import { ageWords, IDLE_AFTER_MS, outputStub, rowOutputText } from '../studentList.js'
import { hintPlainText, readHintOffer, readStudentHint } from '../studentHints.js'
import { exampleOpenCount } from '../../shared/exampleOpens'
import { studentHealthChip, studentHealthProblem } from '../../shared/studentHealth'

// One student in the tutor's compact list (sketch v2, Ryan OK 8 Nov 2026): a 28px row with the
// presence marker, name, up to 3 glyphs, a grey output stub and one status word or live cue; a
// second 16px line only for a notable state. Clicking the row opens it in place (where they are,
// their last output, 2 chips, Thumbs up / Open / More); More folds out everything the old card
// showed (StudentCard variant="detail"). The ⋯ menu holds every other action. Tutor screen only.

const EDGE = {
  help: 'var(--colour-warning)',
  stuck: 'var(--colour-error)',
  error: '#f43f5e',
  failed: '#9ca3af',
  finished: 'var(--colour-success)',
  away: 'repeating-linear-gradient(180deg, #f59e0b 0 4px, transparent 4px 7px)',
  online: '#3b82f6',
  offline: 'transparent',
}

const STATUS_COLOUR = {
  help: 'var(--colour-warning-text)',
  stuck: 'var(--colour-error-text)',
  error: '#be123c',
  failed: '#6b7280',
  finished: 'var(--colour-success-text)',
  away: 'var(--colour-warning-text)',
  offline: '#9ca3af',
  online: '#6b7280',
}

// Where the student is (Task 2 of 7), for the opened row.
function taskPosition(lesson, taskId) {
  const tasks = Array.isArray(lesson?.tasks) ? lesson.tasks : []
  const index = tasks.findIndex((task) => String(task?.id) === String(taskId))
  return index >= 0 ? `Task ${index + 1} of ${tasks.length}` : null
}

// The code pane is not on their screen (a small screen showing another tab, or a pane closed).
// HTML editors report file names as panes, so those count as code.
function codePaneHidden(student, { isCodeTask }) {
  const panes = student?.visiblePanes
  if (!isCodeTask || !Array.isArray(panes) || panes.length === 0) return false
  return !panes.some((pane) => pane === 'code' || pane === 'blocks' || String(pane).includes('.'))
}

// The row's own clock for "2m", "idle 3m": ticks every 30 s inside each row, so the tick never
// re-renders the whole student panel.
function useNow(everyMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

// True for 4 s after a new activity report lands. The value already there when the list opens
// is not a fresh report, so it never lights every row at once.
function useTyping(lastActivityAt) {
  const [typing, setTyping] = useState(false)
  const firstRef = useRef(lastActivityAt)
  useEffect(() => {
    if (!lastActivityAt || lastActivityAt === firstRef.current) return undefined
    firstRef.current = null
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 4000)
    return () => clearTimeout(t)
  }, [lastActivityAt])
  return typing
}

function TypingPulse() {
  return (
    <span className="activity-dots" role="img" aria-label="Typing now" title="Typing now">
      <span />
      <span />
      <span />
    </span>
  )
}

// The row's one status word (or live cue): { text, title }, or { typing: true }.
function rowStatusWords(state, { now, since, lastRunAt, activityAt, typing }) {
  const age = (ts) => ageWords(ts, now)
  switch (state.status) {
    case 'help':
      return {
        text: `✋ Needs help${since ? ` · ${age(since)}` : ''}`,
        title: 'Asked for help',
      }
    case 'stuck':
      return state.stuck?.kind === 'error'
        ? {
            text: `Stuck ⚠${state.stuck.count}`,
            title: `Same error ${state.stuck.count} runs in a row${state.stuck.error ? `: ${state.stuck.error}` : ''}`,
          }
        : {
            text: `Stuck ✗${state.stuck?.count ?? ''}`,
            title: `Failed the check ${state.stuck?.count} times in a row`,
          }
    case 'error':
      return { text: `⚠ Error ${age(lastRunAt)}`.trim(), title: 'Their last run crashed' }
    case 'failed':
      return {
        text: `✗ Failed ${age(lastRunAt)}`.trim(),
        title: 'Their last run did not pass the check',
      }
    case 'finished':
      return { text: '✓ Finished', title: 'Finished: their last run passed the check' }
    case 'away':
      return {
        text: `Away${since ? ` ${age(since)}` : ''}`,
        title: "Away: the student's tab is not focused",
      }
    case 'offline':
      return { text: 'Offline', title: 'Offline' }
    default:
      if (typing) return { typing: true }
      if (activityAt && now - activityAt >= IDLE_AFTER_MS) {
        return { text: `idle ${age(activityAt)}`, title: 'No typing or clicks for a while' }
      }
      if (lastRunAt) return { text: `tried ${age(lastRunAt)}`, title: 'Last ran their code' }
      return { text: '', title: '' }
  }
}

function RowMenu({ name, groups, onOpenChange }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target)) return
      if (buttonRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // Fixed to the viewport, so the list's scroll box never clips it. It opens to the left of the
  // student panel, level with the row, so the list itself stays in view; kept on screen.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const button = buttonRef.current.getBoundingClientRect()
    const row = buttonRef.current.closest('[data-testid="student-row"]')?.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? 0
    const width = panelRef.current?.offsetWidth ?? 0
    const viewH = window.innerHeight || 768
    const left = (row?.left ?? button.left) - width - 8
    const top = Math.min(Math.max(8, button.top - 24), Math.max(8, viewH - height - 8))
    setPos(
      left >= 8
        ? { top, left }
        : { top: Math.min(button.bottom + 4, Math.max(8, viewH - height - 8)), left: 8 }
    )
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        style={{ ...s.kebab, ...(open ? s.kebabOpen : null) }}
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Actions for ${name}`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Actions for ${name}`}
          className="ui-popover"
          style={{
            ...s.menu,
            ...(pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {groups
            .filter((group) => group.items.some(Boolean))
            .map((group) => (
              <div key={group.label} style={s.menuGroup}>
                <div style={s.menuGroupLabel}>{group.label}</div>
                {group.items.filter(Boolean).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    style={{ ...s.menuItem, ...(item.danger ? s.menuItemDanger : null) }}
                    disabled={item.disabled}
                    title={item.title}
                    onClick={() => {
                      setOpen(false)
                      item.onClick()
                    }}
                  >
                    <span aria-hidden="true" style={s.menuIcon}>
                      {item.icon}
                    </span>
                    <span style={s.menuLabel}>{item.label}</span>
                    {item.note && <span style={s.menuNote}>{item.note}</span>}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </>
  )
}

export default function StudentListRow({
  student,
  state,
  lesson,
  session,
  // When this tutor screen first saw the help request / Away (for "Needs help · 2m", "Away 4m").
  since = null,
  // When the student was last seen typing, clicking or running (tutor clock).
  activityAt = null,
  helpAcked = false,
  onAckHelp,
  open = false,
  onToggleOpen,
  onOpenStudent,
  onThumbsUp,
  onNudge,
  onRename,
  onRemove,
  onAwardBadge,
  onSendHint,
  onSendMessage,
  onRequestFullscreen,
  onOpenSideQuest,
  onOpenRoster,
  selectMode = false,
  selected = false,
  onToggleSelect,
  highlighted = false,
  live = false,
  activities = [],
  rosterUnmatched = false,
  carryWaiting = false,
  badgePendingCount = 0,
  isCodeTask = false,
  isInformation = false,
  // Everything StudentCard needs for the More fold.
  cardProps = {},
}) {
  const name = student.displayName
  const id = student.anonymousId
  const taskId = session?.currentTaskId ?? null
  const [hover, setHover] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const [thumbsSent, setThumbsSent] = useState(false)
  const [nudged, setNudged] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rowRef = useRef(null)
  // Set once a rename is saved or cancelled, so a blur that follows Enter or Escape (the box
  // unmounting) never saves again or saves the discarded text.
  const renameDoneRef = useRef(true)
  const typing = useTyping(student.lastActivityAt)
  const now = useNow()

  useEffect(() => {
    if (!open) setMoreOpen(false)
  }, [open])

  const sandbox = session?.state === 'sandbox'
  const shownHint = sandbox ? null : readStudentHint(student, taskId)
  const shownOffer = sandbox ? null : readHintOffer(student, taskId)
  const paste = student.pasteLog?.[taskId] ?? null
  const supportCount = Object.keys(session?.supportRevealLog?.[id]?.[taskId] ?? {}).length
  const examplesOpened = exampleOpenCount(session, id, taskId)
  const sideQuest = activities.find((activity) => activity.kind === 'side_quest') ?? null
  const output = rowOutputText(student, { isInformation })
  const stub = outputStub(output)
  const words = rowStatusWords(state, {
    now,
    since,
    lastRunAt: student.lastRunAt,
    activityAt,
    typing,
  })
  const offline = state.presence === 'offline'
  const showHover = hover && !selectMode && !renaming

  const glyphs = [
    shownHint || shownOffer
      ? {
          key: 'hint',
          icon: '💬',
          label: shownHint ? 'Hint showing' : 'Hint offered',
        }
      : null,
    paste?.count > 0 ? { key: 'paste', icon: '📋', label: 'Pasted code' } : null,
    badgePendingCount > 0 ? { key: 'badge', icon: '🏅', label: 'Badge suggestion waiting' } : null,
  ].filter(Boolean)

  // Python stuck / screen error on their screen (students/{id}/health, R3): first on the second
  // line and the opened row's chips.
  const healthProblem = studentHealthProblem(student)
  const healthChip = studentHealthChip(healthProblem)

  // The one second line, most useful first.
  const note = healthChip
    ? {
        icon: healthChip.icon,
        text:
          healthProblem === 'python_stuck'
            ? 'Python stuck: their code is safe, they see Reload'
            : 'Screen error: they see Try again',
        health: healthProblem,
      }
    : shownHint
      ? {
          icon: '💬',
          text: `${shownHint.source === 'override' ? 'Your hint' : 'Hint showing'}: “${hintPlainText(shownHint.text)}”`,
        }
      : paste?.count > 0
        ? {
            icon: '📋',
            text: `Pasted${paste.count > 1 ? ` ×${paste.count}` : ''}, ${paste.chars ?? 0} characters${paste.lastAt ? ` · ${ageWords(paste.lastAt, now)} ago` : ''}`.replace(
              ' · now ago',
              ' · just now'
            ),
          }
        : codePaneHidden(student, { isCodeTask })
          ? { icon: '🙈', text: 'Code pane not on their screen' }
          : sideQuest
            ? { icon: sideQuest.icon, text: sideQuest.text }
            : null

  function startRename() {
    setNameValue(name)
    renameDoneRef.current = false
    setRenaming(true)
  }

  function finishRename(save) {
    if (renameDoneRef.current) return
    renameDoneRef.current = true
    const next = nameValue.trim()
    if (save && next && next !== name) onRename?.(id, next)
    setNameValue(name)
    setRenaming(false)
  }

  function sendThumbsUp() {
    onThumbsUp?.(id)
    setThumbsSent(true)
    setTimeout(() => setThumbsSent(false), 2000)
  }

  function activate() {
    if (renaming) return
    if (selectMode) onToggleSelect?.(id)
    else onToggleOpen?.(id)
  }

  const canThumbsUp = !!onThumbsUp && !!student.online
  const thumbsButton = (compact) => (
    <button
      type="button"
      style={compact ? s.hoverBtn : s.actionBtn}
      disabled={thumbsSent}
      aria-label={compact ? `Send ${name} a thumbs up` : undefined}
      title={`Send ${name} a thumbs up`}
      onClick={(event) => {
        event.stopPropagation()
        sendThumbsUp()
      }}
    >
      {thumbsSent ? '✓' : '👍'}
      {!compact && (thumbsSent ? ' Sent' : ' Thumbs up')}
    </button>
  )
  const openButton = (compact) => (
    <button
      type="button"
      style={compact ? s.hoverBtn : s.actionBtn}
      aria-label={`Open ${name}`}
      title={`Open ${name}: their screen, live`}
      onClick={(event) => {
        event.stopPropagation()
        onOpenStudent?.(student)
      }}
    >
      👁{!compact && ' Open'}
    </button>
  )

  const menuGroups = [
    {
      label: 'Encourage',
      items: [
        onThumbsUp && {
          icon: '👍',
          label: 'Thumbs up',
          disabled: !student.online,
          note: student.online ? null : 'only when online',
          onClick: sendThumbsUp,
        },
        onAwardBadge && {
          icon: '🏅',
          label: 'Award badge',
          note: badgePendingCount > 0 ? `${badgePendingCount} suggested` : null,
          onClick: () => onAwardBadge(student),
        },
      ],
    },
    {
      label: 'Help this student',
      items: [
        onSendHint &&
          !isInformation && {
            icon: '💡',
            label: 'Send hint',
            title: "Put your words on the student's hint banner",
            onClick: () => onSendHint(student),
          },
        onSendMessage && {
          icon: '✉',
          label: 'Message',
          title: 'Send this student a pop-up message',
          onClick: () => onSendMessage(student),
        },
        onNudge && {
          icon: '🔔',
          label: nudged ? 'Nudged' : 'Nudge',
          disabled: !(student.online && student.windowFocused === false),
          note: student.online && student.windowFocused === false ? null : 'only when Away',
          onClick: () => {
            onNudge(id)
            setNudged(true)
            setTimeout(() => setNudged(false), 2000)
          },
        },
        onRequestFullscreen && {
          icon: '⛶',
          label: 'Ask to go fullscreen',
          disabled: !student.online,
          onClick: () => onRequestFullscreen(id),
        },
      ],
    },
    {
      label: 'Their screen',
      items: [
        { icon: '👁', label: 'Open student', onClick: () => onOpenStudent?.(student) },
        sideQuest &&
          onOpenSideQuest && {
            icon: '🗺️',
            label: 'See their side-quest',
            onClick: () => onOpenSideQuest(id),
          },
      ],
    },
    {
      label: 'Edit',
      items: [
        onRename && {
          icon: '✏️',
          label: 'Rename student',
          onClick: startRename,
        },
        onOpenRoster &&
          (rosterUnmatched || carryWaiting) && {
            icon: '👥',
            label: 'Match them to the class list',
            note: carryWaiting ? 'waiting for earlier work' : 'not matched',
            onClick: () => onOpenRoster(),
          },
        onRemove && {
          icon: '✕',
          label: 'Remove student',
          note: 'asks first',
          danger: true,
          onClick: () => {
            if (window.confirm(`Remove ${name} from the session?`)) onRemove(id)
          },
        },
      ],
    },
  ]

  // At most two chips in the opened row: Sharing, the hint, a fail streak, an override.
  const failStreak = Number(shownHint?.failStreak) || 0
  const chips = [
    healthChip
      ? {
          text: `${healthChip.icon} ${healthChip.label}`,
          title: healthChip.title,
          style: healthProblem === 'python_stuck' ? s.chipPythonStuck : s.chipScreenError,
        }
      : null,
    student.shareRequestedAt != null ? { text: '📤 Sharing', style: s.chipShare } : null,
    shownHint || shownOffer
      ? {
          text:
            shownHint?.source === 'override'
              ? '💬 Your hint'
              : shownHint
                ? '💬 Hint shown'
                : '💬 Hint offered',
          title: shownHint
            ? `They see: “${hintPlainText(shownHint.text)}”`
            : 'Hint offered, not opened yet',
          style: s.chipHint,
        }
      : null,
    failStreak > 1 && state.status !== 'stuck'
      ? { text: `Failed ${failStreak} times in a row`, style: s.chipGrey }
      : null,
    student.checkOverridePushedAt
      ? {
          text: student.checkOverridePassed ? 'Override: passed' : 'Override: failed',
          style: s.chipGrey,
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 2)
  const moreHasFlag = paste?.count > 0 || supportCount > 0 || examplesOpened > 0

  const where = [
    taskPosition(lesson, taskId),
    typing
      ? 'typing now'
      : student.lastRunAt
        ? `${student.lastRunStatus === 'error' ? 'error' : 'ran'} ${ageWords(student.lastRunAt, now) === 'now' ? 'just now' : `${ageWords(student.lastRunAt, now)} ago`}`
        : activityAt && now - activityAt >= IDLE_AFTER_MS
          ? `idle ${ageWords(activityAt, now)}`
          : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const marker = selectMode ? (
    <span style={{ ...s.selectBox, ...(selected ? s.selectBoxOn : null) }} aria-hidden="true">
      {selected ? '✓' : ''}
    </span>
  ) : (
    <span
      aria-hidden="true"
      title={offline ? 'Offline' : state.presence === 'away' ? 'Away' : 'Connected now'}
      style={{
        ...s.diamond,
        ...(offline ? s.diamondOffline : state.presence === 'away' ? s.diamondAway : null),
      }}
    />
  )

  return (
    <div
      ref={rowRef}
      style={{
        ...s.row,
        ...(state.status === 'help' ? s.rowHelp : null),
        ...(offline ? s.rowOffline : null),
        ...(open ? s.rowOpen : null),
        ...(selectMode && selected ? s.rowSelected : null),
        ...(highlighted ? s.rowHighlighted : null),
      }}
      data-testid="student-row"
      data-student-id={id}
      data-student-name={name}
      data-status={state.status}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span aria-hidden="true" style={{ ...s.edge, background: EDGE[state.status] }} />
      <div style={s.line}>
        {renaming ? (
          // Outside the row's button, so clicking or typing in the box never toggles the row.
          <div style={s.main} data-testid="row-main">
            {marker}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                finishRename(true)
              }}
              style={s.renameForm}
            >
              <input
                style={s.renameInput}
                value={nameValue}
                aria-label={`Rename ${name}`}
                autoFocus
                onChange={(event) => setNameValue(event.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Escape') finishRename(false)
                }}
              />
            </form>
          </div>
        ) : (
          <div
            style={s.main}
            data-testid="row-main"
            role={selectMode ? 'checkbox' : 'button'}
            aria-checked={selectMode ? selected : undefined}
            aria-expanded={selectMode ? undefined : open}
            aria-label={
              selectMode ? `Select ${name}` : `${name}${words.text ? `: ${words.text}` : ''}`
            }
            tabIndex={0}
            onClick={activate}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                activate()
              }
            }}
          >
            {marker}
            <span
              style={s.name}
              title={cardProps.rosterName ? `${name}: class list ${cardProps.rosterName}` : name}
            >
              {name}
            </span>
            {live && (
              <span style={s.liveTag} title="You are watching this student live">
                LIVE
              </span>
            )}
            {glyphs.slice(0, 3).map((glyph) => (
              <span
                key={glyph.key}
                style={s.glyph}
                role="img"
                aria-label={glyph.label}
                title={glyph.label}
              >
                {glyph.icon}
              </span>
            ))}
            {!showHover && (
              <>
                {/* A help row's status and I'm on it leave no room for a useful stub. */}
                <span style={s.stub} title={output || undefined}>
                  {state.status === 'help' ? '' : stub}
                </span>
                <span
                  style={{ ...s.status, color: STATUS_COLOUR[state.status] }}
                  title={words.title || undefined}
                  data-testid="row-status"
                >
                  {words.typing ? <TypingPulse /> : words.text}
                </span>
              </>
            )}
            {showHover && <span style={s.stub} />}
          </div>
        )}
        {showHover && (
          <span style={s.hoverBtns}>
            {canThumbsUp && thumbsButton(true)}
            {openButton(true)}
          </span>
        )}
        {state.status === 'help' && !helpAcked && onAckHelp && (
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.onIt}
            title="Move this down the list until something changes for this student"
            onClick={(event) => {
              event.stopPropagation()
              onAckHelp(id)
            }}
          >
            I&apos;m on it
          </button>
        )}
        <RowMenu name={name} groups={menuGroups} onOpenChange={setMenuOpen} />
      </div>
      {note && !open && (
        <div
          style={{ ...s.note, ...(note.health ? s.noteHealth : null) }}
          data-testid="row-note"
          title={note.text}
        >
          <span aria-hidden="true">{note.icon}</span> {note.text}
        </div>
      )}
      {showHover && output && !open && !menuOpen && (
        <RowTooltip anchor={rowRef} text={output} error={student.lastRunStatus === 'error'} />
      )}
      {open && (
        <div style={s.open} data-testid="row-open">
          {where && <div style={s.where}>{where}</div>}
          {output && (
            <div
              style={{
                ...s.outputBox,
                ...(student.lastRunStatus === 'error' ? s.outputBoxError : null),
              }}
              title={output}
            >
              {output}
            </div>
          )}
          {note && note.icon !== '💬' && (
            <div style={s.openNote}>
              <span aria-hidden="true">{note.icon}</span> {note.text}
            </div>
          )}
          {chips.length > 0 && (
            <div style={s.chips}>
              {chips.map((chip) => (
                <span key={chip.text} style={{ ...s.chip, ...chip.style }} title={chip.title}>
                  {chip.text}
                </span>
              ))}
            </div>
          )}
          <div style={s.actions}>
            {canThumbsUp && thumbsButton(false)}
            {openButton(false)}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              style={s.moreBtn}
              aria-expanded={moreOpen}
              aria-label={`${moreOpen ? 'Less' : 'More'} about ${name}`}
              onClick={(event) => {
                event.stopPropagation()
                setMoreOpen((v) => !v)
              }}
            >
              {moreOpen ? 'Less ▴' : 'More ▾'}
              {moreHasFlag && (
                <span
                  style={s.moreDot}
                  data-testid="more-dot"
                  title="Pasted code, a support reference or an example is inside"
                />
              )}
            </button>
          </div>
          {moreOpen && (
            <div style={s.more} data-testid="row-more">
              <StudentCard
                {...cardProps}
                student={student}
                lesson={lesson}
                session={session}
                variant="detail"
                onOpenSideQuest={onOpenSideQuest}
                onOpenRoster={onOpenRoster}
                rosterUnmatched={rosterUnmatched}
                carryWaiting={carryWaiting}
                badgePendingCount={badgePendingCount}
                activities={activities}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The hover preview of the last output, fixed under the row so the list never clips it.
function RowTooltip({ anchor, text, error }) {
  const [pos, setPos] = useState(null)
  const tipRef = useRef(null)
  // Placed on open, and again whenever the list (or the page) scrolls or the window resizes, so
  // it stays under its row.
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect) return
      // Above the row when there is no room below it.
      const height = tipRef.current?.offsetHeight ?? 0
      const below = rect.bottom + 2
      const top =
        height && below + height > (window.innerHeight || 768) - 8 ? rect.top - height - 2 : below
      setPos({ top, left: rect.left + 12, width: rect.width - 24 })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])
  return (
    <div
      ref={tipRef}
      role="tooltip"
      data-testid="row-tooltip"
      style={{ ...s.tooltip, ...(pos ?? { visibility: 'hidden' }) }}
    >
      <div style={s.tooltipLabel}>Last output</div>
      <div style={{ ...s.tooltipText, ...(error ? { color: '#fda4af' } : null) }}>{text}</div>
    </div>
  )
}

const s = {
  row: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--ui-surface, #fff)',
    border: '1px solid var(--ui-border, #e5e7eb)',
    borderRadius: 6,
    paddingLeft: 6,
    minWidth: 0,
    flexShrink: 0,
  },
  rowHelp: { background: 'var(--colour-warning-bg)', borderColor: '#fcd34d' },
  rowOffline: { opacity: 0.6 },
  rowOpen: {
    borderColor: 'var(--colour-primary)',
    boxShadow: '0 2px 10px rgba(98,34,204,0.12)',
  },
  rowSelected: { outline: '2px solid var(--colour-primary)', outlineOffset: -2 },
  rowHighlighted: { outline: '3px solid var(--colour-secondary)', outlineOffset: 1 },
  edge: {
    position: 'absolute',
    left: -1,
    top: -1,
    bottom: -1,
    width: 4,
    borderRadius: '6px 0 0 6px',
  },
  line: { display: 'flex', alignItems: 'center', height: 28, gap: 2, minWidth: 0 },
  main: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
    paddingLeft: 2,
  },
  diamond: {
    width: 7,
    height: 7,
    flexShrink: 0,
    transform: 'rotate(45deg)',
    background: '#374151',
    border: '1.5px solid #374151',
    boxSizing: 'border-box',
  },
  diamondAway: { background: 'transparent', borderColor: '#d97706' },
  diamondOffline: { background: 'transparent', borderColor: '#9ca3af' },
  selectBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1.5px solid var(--ui-border-strong)',
    background: 'var(--ui-surface)',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectBoxOn: { background: 'var(--colour-primary)', borderColor: 'var(--colour-primary)' },
  name: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.84rem',
    color: 'var(--colour-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 96,
    flexShrink: 1,
  },
  renameForm: { flex: 1, display: 'flex', minWidth: 0 },
  renameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    fontWeight: 700,
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    padding: '0 2px',
  },
  liveTag: {
    fontSize: '0.6rem',
    fontWeight: 800,
    color: '#fff',
    background: 'var(--colour-primary)',
    borderRadius: 3,
    padding: '1px 4px',
    flexShrink: 0,
  },
  glyph: { fontSize: '0.72rem', lineHeight: 1, flexShrink: 0 },
  stub: {
    flex: 1,
    minWidth: 0,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.68rem',
    color: '#9ca3af',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  status: {
    flexShrink: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.74rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    paddingRight: 2,
  },
  hoverBtns: { display: 'flex', gap: 3, flexShrink: 0 },
  hoverBtn: {
    height: 22,
    minWidth: 26,
    padding: '0 5px',
    border: '1px solid var(--ui-border-strong, #d1d5db)',
    borderRadius: 5,
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.78rem',
    lineHeight: 1,
  },
  onIt: { fontSize: 11, padding: '2px 6px', height: 22, flexShrink: 0, whiteSpace: 'nowrap' },
  kebab: {
    width: 22,
    height: 22,
    flexShrink: 0,
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#6b7280',
    fontWeight: 800,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  kebabOpen: { background: 'var(--colour-primary)', color: '#fff' },
  note: {
    height: 16,
    lineHeight: '14px',
    fontSize: '0.68rem',
    color: '#6b7280',
    paddingLeft: 14,
    paddingRight: 6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: -3,
    marginBottom: 2,
  },
  // A Python stuck / screen error line reads as a problem, not a passing note.
  noteHealth: { color: '#b45309', fontWeight: 700 },
  open: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: '0 6px 7px 4px',
    cursor: 'default',
  },
  where: { fontSize: '0.74rem', fontWeight: 600, color: 'var(--colour-ink-strong, #374151)' },
  outputBox: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    background: 'var(--ui-surface-neutral-sunk, #f3f4f6)',
    borderRadius: 5,
    padding: '3px 6px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    maxHeight: 36,
    overflow: 'hidden',
  },
  outputBoxError: { background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' },
  openNote: { fontSize: '0.7rem', color: '#6b7280', overflowWrap: 'anywhere' },
  chips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  chip: {
    fontSize: '0.66rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
  },
  chipShare: { background: '#0d9488', color: '#fff' },
  chipHint: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
  chipPythonStuck: { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' },
  chipScreenError: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  chipGrey: { background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' },
  actions: { display: 'flex', alignItems: 'center', gap: 5 },
  actionBtn: {
    height: 26,
    padding: '0 9px',
    border: '1px solid rgba(98,34,204,0.3)',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-primary-dark)',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.74rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  moreBtn: {
    position: 'relative',
    height: 26,
    padding: '0 8px',
    border: 'none',
    background: 'transparent',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.74rem',
    cursor: 'pointer',
  },
  moreDot: {
    position: 'absolute',
    top: 3,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#f59e0b',
  },
  more: { borderTop: '1px dashed var(--ui-border-strong, #d1d5db)', paddingTop: 6 },
  menu: {
    position: 'fixed',
    zIndex: 1000,
    width: 232,
    background: '#fff',
    border: '1px solid var(--colour-primary)',
    borderRadius: 8,
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    padding: '4px 0',
    display: 'flex',
    flexDirection: 'column',
  },
  menuGroup: {
    display: 'flex',
    flexDirection: 'column',
    padding: '3px 0',
    borderTop: '1px solid #f3f4f6',
  },
  menuGroupLabel: {
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#6b7280',
    padding: '3px 12px 2px',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '4px 12px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  menuItemDanger: { color: '#dc2626' },
  menuIcon: { width: 16, textAlign: 'center', flexShrink: 0 },
  menuLabel: { flex: 1 },
  menuNote: { fontSize: '0.64rem', color: '#9ca3af', whiteSpace: 'nowrap' },
  tooltip: {
    position: 'fixed',
    zIndex: 1000,
    background: '#1f2937',
    color: '#fff',
    borderRadius: 6,
    padding: '6px 9px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    pointerEvents: 'none',
  },
  tooltipLabel: {
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  tooltipText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    maxHeight: 80,
    overflow: 'hidden',
  },
}
