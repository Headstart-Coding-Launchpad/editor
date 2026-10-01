import React, { useState, useEffect } from 'react'
import { findTaskById, deriveTaskContext } from '../../shared/taskUtils'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { getModuleDefinition } from '../../modules/definitions'
import PresenceBadge from './PresenceBadge'
import { formatTimeAgo } from '../../shared/timeAgo'
import { formatTaskItemProgress, getTaskItemProgress } from '../taskItemProgress'
import { readActivityAnswer, summarizeActivityAnswer } from '../../activities/state.js'
import { getTaskActivityUi } from '../../activities/registry.js'
import ActivityDeviceBadge from '../../activities/ui/ActivityDeviceBadge.jsx'

const formatLastRun = formatTimeAgo

// Matches the pane ids each module's StudentWorkspace/LessonTaskContent report — see
// visiblePanes in LessonTaskContent.jsx. Ids with no entry here (e.g. HTML file names)
// pass through as-is via the ?? fallback below.
const VISIBLE_PANE_LABELS = {
  instructions: 'Info',
  blocks: 'Blocks',
  stage: 'Stage',
  breadboard: 'Breadboard',
  code: 'Code',
  console: 'Console',
  sprites: 'Sprites',
  tilemaps: 'Tilemaps',
  running: 'Running',
  preview: 'Preview',
}
function formatVisiblePanes(panes) {
  return panes.map((p) => VISIBLE_PANE_LABELS[p] ?? p).join(' + ')
}

export default function StudentCard({
  student,
  lesson,
  lessonId,
  session,
  topics,
  onRename,
  onRemove,
  onExpand,
  onNudge,
  onThumbsUp,
  badgePendingCount = 0,
  badgeAwardedCount = 0,
  selectMode = false,
  selected = false,
  onToggleSelect,
}) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(student.displayName)
  const [isActive, setIsActive] = useState(false)
  const [nudged, setNudged] = useState(false)
  const [thumbsUpSent, setThumbsUpSent] = useState(false)
  const pasteRecord = student.pasteLog?.[session?.currentTaskId] ?? null
  const [, setTick] = useState(0)

  // Show typing dots for 4 seconds after lastActivityAt updates, then clear
  useEffect(() => {
    if (!student.lastActivityAt) return
    setIsActive(true)
    const t = setTimeout(() => setIsActive(false), 4000)
    return () => clearTimeout(t)
  }, [student.lastActivityAt])

  // Refresh "X ago" label every 30 seconds
  useEffect(() => {
    if (!student.lastRunAt) return
    const interval = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(interval)
  }, [student.lastRunAt])

  function handleRename(e) {
    e.preventDefault()
    onRename?.(student.anonymousId, nameValue.trim() || student.displayName)
    setEditing(false)
  }

  const currentTask = findTaskById(lesson?.tasks, session?.currentTaskId)
  const isSubmitMode = currentTask?.interactionMode === 'submit'
  // Composed lessons carry `type: 'composed'`, so the module flags have to come from the
  // task's own moduleType — deriveTaskContext reads lesson.type directly. StudentModal
  // resolves the same way; without this every code task in a composed lesson (27 of the
  // 28 published lessons) fell through to the HTML fallback and showed "No run yet".
  const taskLesson = getEffectiveLessonForTask(lesson, currentTask)
  const {
    moduleType,
    isQuiz,
    isInformation,
    isActivity: isActivityTask,
    activity,
    isSessionSandbox,
  } = deriveTaskContext(taskLesson, currentTask, session)
  // Hosted activity (quizzes included): the card shows the activity's own summary of
  // currentAnswer — its CardSummary (the quizzes' answer / rating / progress) or one line.
  const isActivity = isActivityTask && !isSessionSandbox
  // Information and activity/quiz tasks have no explainer/workspace panes, so a
  // visiblePanes report left over from the previous task is meaningless there — hide it
  // (a session sandbox always shows the workspace, whatever task it's parked on).
  const showsVisiblePanes =
    (isSessionSandbox || (!isInformation && !isActivityTask)) &&
    Array.isArray(student.visiblePanes) &&
    student.visiblePanes.length > 0
  const activityUi = isActivity ? getTaskActivityUi(currentTask) : null
  const activitySummary =
    isActivity && !activityUi?.CardSummary
      ? summarizeActivityAnswer(currentTask, student.currentAnswer)
      : null
  const activityState = isActivity ? readActivityAnswer(currentTask, student.currentAnswer) : null
  const activitySubmitted = isActivity && student.lastRunStatus === 'submitted'
  // What the card shows for the module's work (capabilities.cardSummary): the first lines of
  // console output (python, arcade, electronics), whether blocks were edited (scratch) or the
  // file tree changed (filesystem); anything else gets the generic "HTML project" line.
  const cardSummary = getModuleDefinition(moduleType)?.capabilities.cardSummary ?? null
  const hasConsoleOutput = cardSummary === 'output'
  const itemProgress = isSessionSandbox ? null : getTaskItemProgress(currentTask, student)
  // A rating (confidence check) is never right or wrong, so it has no pass/fail badge.
  const isNeverMarked = activity?.completion === 'none'

  // The dot is presence, which is what a dot beside a name means everywhere else. It
  // used to carry run status while the pill next to it carried presence - two dots one
  // row apart answering different questions, so an idle-but-connected student read as
  // half offline. Run status is already in the output snippet and the pass/fail badge.
  // While the session is waiting the dot still shows real presence; the "Waiting" badge
  // below (PresenceBadge) carries the waiting state.
  const presenceState = student.online ? 'online' : 'offline'
  const statusColour =
    presenceState === 'online' ? 'var(--colour-success)' : 'var(--colour-muted-soft)'
  const presenceTitle =
    (session?.state === 'waiting' ? 'Waiting for the lesson to start · ' : '') +
    (presenceState === 'online' ? 'Connected now' : 'Offline')

  // Confidence tasks have no pass/fail check — teacher just sees the submitted level
  // For match/fill_blank quizzes and activities, checkPassed comes from the activity's own
  // marking rather than task.check.
  // Sandbox runs aren't scored against the task the session was on, so there is no
  // pass/fail to show (a stale result from before the sandbox would read as "failed").
  const hasCheck =
    !isNeverMarked &&
    !isSessionSandbox &&
    (currentTask?.check != null || (activitySubmitted && student.checkPassed != null))
  const checkAttempted = student.lastRunStatus != null
  const hasActiveOverride = !!student.checkOverridePushedAt
  const supportRevealCount = Object.keys(
    session?.supportRevealLog?.[student.anonymousId]?.[currentTask?.id] ?? {}
  ).length
  const checkPassed =
    hasCheck &&
    (hasActiveOverride ? student.checkOverridePassed === true : student.checkPassed === true)
  const checkFailed =
    hasCheck &&
    (hasActiveOverride
      ? student.checkOverridePassed === false
      : checkAttempted && student.checkPassed !== true)
  const checkCardStyle = student.needsHelp
    ? s.cardNeedsHelp
    : checkPassed
      ? s.cardCheckPassed
      : checkFailed
        ? s.cardCheckFailed
        : null

  // Every card opens the student modal, information tasks included: the modal shows the task
  // itself and keeps the badge, nudge, message and video-call controls a teacher still needs.
  const openStudent = () => onExpand?.(student)
  // Select mode (the grid's multi-award): the whole card toggles selection instead of opening.
  const activate = () => {
    if (selectMode) onToggleSelect?.(student.anonymousId)
    else openStudent()
  }
  const badgeLabel = [
    badgeAwardedCount > 0
      ? `${badgeAwardedCount} badge${badgeAwardedCount === 1 ? '' : 's'} awarded`
      : null,
    badgePendingCount > 0 ? 'badge suggestion waiting' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    // The card is the click target. A dedicated full-width Expand button cost ~45px on
    // every card - over half the height budget - was the loudest thing on the wall, and
    // was identical on all eight, so it carried nothing about the student it belonged to.
    <div
      style={{
        ...s.card,
        ...checkCardStyle,
        ...s.cardClickable,
        ...(selectMode && selected ? s.cardSelected : null),
      }}
      className="card"
      role={selectMode ? 'checkbox' : 'button'}
      aria-checked={selectMode ? selected : undefined}
      tabIndex={0}
      aria-label={selectMode ? `Select ${student.displayName}` : `Expand ${student.displayName}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      }}
    >
      {/* Header row */}
      <div style={s.header}>
        <div style={s.nameRow}>
          {selectMode && (
            <span
              style={{ ...s.selectBox, ...(selected ? s.selectBoxOn : null) }}
              aria-hidden="true"
            >
              {selected ? '✓' : ''}
            </span>
          )}
          <span style={{ ...s.statusDot, background: statusColour }} title={presenceTitle} />
          {editing ? (
            <form
              onSubmit={handleRename}
              style={s.nameForm}
              onClick={(event) => event.stopPropagation()}
            >
              <input
                style={s.nameInput}
                value={nameValue}
                autoFocus
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleRename}
              />
            </form>
          ) : (
            <span style={s.name} title={student.displayName}>
              {student.displayName}
            </span>
          )}
          {/* Teacher-only: StudentCard is only ever rendered in the teacher's grid. */}
          {(badgeAwardedCount > 0 || badgePendingCount > 0) && (
            <span
              style={s.badgeCount}
              title={`${badgeLabel} (only you see this)`}
              role="img"
              aria-label={badgeLabel}
              data-testid="badge-count"
            >
              🏅{badgeAwardedCount > 0 ? ` ${badgeAwardedCount}` : ''}
              {badgePendingCount > 0 && <span style={s.badgeDot} data-testid="badge-pending-dot" />}
            </span>
          )}
          {!isQuiz && !isInformation && !isActivity && student.lastRunAt && (
            <span style={s.lastRunLabel} title="Last run">
              ▶ {formatLastRun(student.lastRunAt)}
            </span>
          )}
          <button
            style={s.pencil}
            onClick={(event) => {
              event.stopPropagation()
              setEditing((e) => !e)
            }}
            title="Rename student"
          >
            ✏️
          </button>
          <button
            style={s.removeBtn}
            onClick={(event) => {
              event.stopPropagation()
              if (window.confirm(`Remove ${student.displayName} from the session?`)) {
                onRemove?.(student.anonymousId)
              }
            }}
            title="Remove student"
          >
            ✕
          </button>
        </div>
        <div style={s.badgeRow}>
          {/* Online is the default and is already carried by the status dot; only an
              exception (offline, or still waiting to join) is worth a badge. */}
          {!(student.online && session?.state !== 'waiting') && (
            <PresenceBadge student={student} session={session} />
          )}
          {student.online && student.windowFocused === false && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeAway }}
              title="Student's tab is not focused"
            >
              Away
            </span>
          )}
          {onNudge && student.online && student.windowFocused === false && (
            <button
              style={s.nudgeBtn}
              onClick={(event) => {
                event.stopPropagation()
                onNudge(student.anonymousId)
                setNudged(true)
                setTimeout(() => setNudged(false), 2000)
              }}
              title="Nudge: flash this student's tab and play a chime"
              aria-label={`Nudge ${student.displayName}`}
            >
              {nudged ? '✓' : '🔔'}
            </button>
          )}
          {onThumbsUp && student.online && (
            <button
              style={{ ...s.thumbsUpBtn, ...(thumbsUpSent ? s.thumbsUpBtnSent : null) }}
              disabled={thumbsUpSent}
              onClick={(event) => {
                event.stopPropagation()
                onThumbsUp(student.anonymousId)
                setThumbsUpSent(true)
                setTimeout(() => setThumbsUpSent(false), 2000)
              }}
              title="Send a 👍: tells this student they're on the right track"
              aria-label={`Send ${student.displayName} a thumbs up`}
            >
              {thumbsUpSent ? '✓' : '👍'}
            </button>
          )}
          {pasteRecord?.count > 0 && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgePasted }}
              title={`Pasted ${pasteRecord.chars} characters into the editor on this task`}
            >
              📋 Pasted{pasteRecord.count > 1 ? ` ×${pasteRecord.count}` : ''}
            </span>
          )}
          {student.isFullscreen && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeFullscreen }}
              title="Student is in fullscreen mode"
            >
              ⛶ Fullscreen
            </span>
          )}
          {isActive && (
            <span className="activity-dots" title="Student is active">
              <span />
              <span />
              <span />
            </span>
          )}
          {checkPassed && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgePassed }}
              title="Completion check passed"
            >
              <span style={s.checkBadgeIcon}>✓</span>
              Passed
            </span>
          )}
          {checkFailed && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeFailed }}
              title="Completion check failed"
            >
              <span style={s.checkBadgeIcon}>✕</span>
              Failed
            </span>
          )}
          {hasActiveOverride && (
            <span
              style={{
                ...s.checkBadge,
                ...(student.checkOverridePassed
                  ? s.checkBadgeOverridePassed
                  : s.checkBadgeOverrideFailed),
              }}
              title="Check overridden by teacher"
            >
              <span style={s.checkBadgeIcon}>{student.checkOverridePassed ? '✓' : '✕'}</span>
              Override
            </span>
          )}
          {student.inPersonalSandbox && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeSandbox }}
              title="Student is in their personal sandbox"
            >
              Sandbox
            </span>
          )}
          {student.needsHelp && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeHelp }}
              title="Student has requested help"
            >
              Help
            </span>
          )}
          {student.shareRequestedAt != null && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeShare }}
              title="Student wants to share their workspace with the class — open them to review it"
            >
              Sharing
            </span>
          )}
          {student.online && student.viewingShareId && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeShare }}
              title={`Viewing ${session?.sharedWorkspaces?.[student.viewingShareId]?.sharerName ?? "a classmate's"} shared work`}
            >
              👀{' '}
              {session?.sharedWorkspaces?.[student.viewingShareId]?.sharerName ?? 'Viewing share'}
            </span>
          )}
          {supportRevealCount > 0 && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeSupport }}
              title="Student has opened support reference"
            >
              Support {supportRevealCount > 1 ? supportRevealCount : ''}
            </span>
          )}
          {student.currentTopicId &&
            (() => {
              const topic = topics?.find((t) => t.id === student.currentTopicId)
              return (
                <span
                  style={{ ...s.checkBadge, ...s.checkBadgeTopic }}
                  title={`Student has topic "${topic?.title ?? student.currentTopicId}" open`}
                >
                  📖 {topic?.title ?? student.currentTopicId}
                </span>
              )
            })()}
          {showsVisiblePanes && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeView }}
              title={`Student can currently see: ${formatVisiblePanes(student.visiblePanes)}`}
            >
              👀 {formatVisiblePanes(student.visiblePanes)}
            </span>
          )}
          {student.teacherAssistedTaskId != null &&
            String(student.teacherAssistedTaskId) === String(session?.currentTaskId) && (
              <span
                style={{ ...s.checkBadge, ...s.checkBadgeView }}
                title="You edited this student's answer on this task"
                data-testid="teacher-assisted"
              >
                ✏️ Assisted
              </span>
            )}
          {itemProgress && (
            <span
              style={{ ...s.checkBadge, ...s.checkBadgeView }}
              title="Items the student has filled in (and got right, where marked per item)"
              data-testid="item-progress"
            >
              🧩 {formatTaskItemProgress(itemProgress)}
            </span>
          )}
        </div>
      </div>

      {/* Output / preview snippet */}
      {isInformation ? (
        <div style={s.iframeThumb}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Information task</span>
        </div>
      ) : isActivity ? (
        activityUi?.CardSummary ? (
          <div style={s.quizAnswer}>
            <activityUi.CardSummary
              task={currentTask}
              raw={student.currentAnswer}
              state={activityState}
              submitted={activitySubmitted}
              passed={student.checkPassed}
            />
          </div>
        ) : (
          <div style={s.quizAnswer} data-testid="activity-summary">
            <span
              style={{
                ...s.matchSummaryText,
                ...(activitySummary?.tone === 'success'
                  ? { color: 'var(--colour-success-text)' }
                  : null),
              }}
            >
              {activitySummary?.text ?? 'Activity'}
            </span>
            <ActivityDeviceBadge state={activityState} />
          </div>
        )
      ) : hasConsoleOutput ? (
        isSubmitMode ? (
          <pre style={s.snippet}>
            {student.lastRunStatus === 'submitted' ? (
              (student.currentCode ?? '').split('\n').slice(0, 2).join('\n') || (
                <span style={{ color: '#9ca3af' }}>No code yet</span>
              )
            ) : (
              <span style={{ color: '#9ca3af' }}>Waiting for submission</span>
            )}
          </pre>
        ) : (
          <pre style={s.snippet}>
            {(student.currentOutput ?? '').split('\n').slice(0, 2).join('\n') || (
              <span style={{ color: '#9ca3af' }}>No output yet</span>
            )}
          </pre>
        )
      ) : cardSummary === 'blocks' ? (
        <div style={s.iframeThumb}>
          <span style={{ color: student.currentCode ? '#6b7280' : '#9ca3af', fontSize: 12 }}>
            {student.currentCode ? 'Blocks edited' : 'No blocks yet'}
          </span>
        </div>
      ) : cardSummary === 'fs' ? (
        <div style={s.iframeThumb}>
          <span style={{ color: student.currentCode ? '#6b7280' : '#9ca3af', fontSize: 12 }}>
            {student.currentCode ? 'Filesystem project' : 'No changes yet'}
          </span>
        </div>
      ) : (
        <div style={s.iframeThumb}>
          {student.currentFiles ? (
            <span style={{ color: '#6b7280', fontSize: 12 }}>HTML project</span>
          ) : (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>No run yet</span>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
    minWidth: 0,
    // A left edge is the one channel card state uses. It previously fired three at once -
    // a 3px border all round, a tinted fill and a coloured glow - which made a student who
    // had finished exactly as loud as one who was stuck.
    borderLeft: '3px solid transparent',
  },
  cardClickable: {
    cursor: 'pointer',
  },
  cardSelected: {
    outline: '2px solid var(--colour-primary)',
    outlineOffset: -2,
    background: 'var(--ui-surface-tint)',
  },
  selectBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: '1.5px solid var(--ui-border-strong)',
    background: 'var(--ui-surface)',
    color: 'var(--colour-text-on-primary)',
    fontSize: '0.7rem',
    fontWeight: 700,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectBoxOn: {
    background: 'var(--colour-primary)',
    borderColor: 'var(--colour-primary)',
  },
  badgeCount: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--colour-muted)',
    flexShrink: 0,
    paddingRight: 4,
  },
  badgeDot: {
    position: 'absolute',
    top: -1,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--colour-secondary)',
    boxShadow: '0 0 0 1.5px var(--ui-surface)',
  },
  // Finished is quiet-positive: the loud states should be the ones that want you to
  // walk over.
  cardCheckPassed: {
    borderLeftColor: 'var(--colour-success)',
  },
  cardCheckFailed: {
    borderLeftColor: 'var(--colour-error)',
  },
  cardNeedsHelp: {
    borderLeftColor: 'var(--colour-warning)',
    background: 'var(--colour-warning-bg)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    minWidth: 0,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    minWidth: 0,
    flexWrap: 'wrap',
    // Empty on a quiet card, so it collapses rather than reserving a row. A student
    // carrying Help + Failed + Support genuinely needs more space than an idle one.
    rowGap: 3,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pencil: {
    background: 'transparent',
    border: 'none',
    padding: '0 2px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    opacity: 0.5,
    borderRadius: 4,
  },
  checkBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 999,
    fontFamily: 'var(--font-body)',
    fontSize: '0.66rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    lineHeight: 1,
    flexShrink: 0,
  },
  checkBadgePassed: {
    background: '#22c55e',
    color: '#fff',
  },
  checkBadgeFailed: {
    background: '#ef4444',
    color: '#fff',
  },
  checkBadgeSandbox: {
    background: '#7c3aed',
    color: '#fff',
  },
  checkBadgeHelp: {
    background: '#f59e0b',
    color: '#fff',
  },
  checkBadgeSupport: {
    background: '#2563eb',
    color: '#fff',
  },
  checkBadgeShare: {
    background: '#0d9488',
    color: '#fff',
  },
  checkBadgeTopic: {
    background: '#0ea5e9',
    color: '#fff',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  },
  checkBadgeView: {
    background: '#f3f4f6',
    color: '#4b5563',
    border: '1px solid #d1d5db',
    textTransform: 'none',
    letterSpacing: 0,
  },
  checkBadgeAway: {
    background: '#f3f4f6',
    color: '#6b7280',
    border: '1px solid #d1d5db',
  },
  checkBadgePasted: {
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
  },
  nudgeBtn: {
    background: '#fffbeb',
    border: '1px solid #f59e0b',
    borderRadius: 999,
    fontSize: '0.72rem',
    lineHeight: 1.2,
    padding: '1px 6px',
    cursor: 'pointer',
  },
  thumbsUpBtn: {
    background: '#ecfdf5',
    border: '1px solid #10b981',
    borderRadius: 999,
    fontSize: '0.72rem',
    lineHeight: 1.2,
    padding: '1px 6px',
    cursor: 'pointer',
  },
  thumbsUpBtnSent: { cursor: 'default', opacity: 0.7 },
  checkBadgeFullscreen: {
    background: '#0284c7',
    color: '#fff',
  },
  checkBadgeOverridePassed: {
    background: 'rgba(34,197,94,0.12)',
    color: '#16a34a',
    border: '1.5px solid #22c55e',
  },
  checkBadgeOverrideFailed: {
    background: 'rgba(239,68,68,0.12)',
    color: '#dc2626',
    border: '1.5px solid #ef4444',
  },
  checkBadgeIcon: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.22)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    lineHeight: 1,
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    padding: '0 2px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    opacity: 0.4,
    color: '#ef4444',
    borderRadius: 4,
    lineHeight: 1,
    flexShrink: 0,
  },
  nameForm: { flex: 1, display: 'flex' },
  nameInput: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    fontWeight: 600,
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    padding: '0 2px',
  },
  snippet: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'var(--ui-surface-neutral-sunk)',
    borderRadius: 6,
    padding: '5px 7px',
    margin: 0,
    maxHeight: 36,
    overflow: 'hidden',
    color: 'var(--colour-text)',
  },
  iframeThumb: {
    height: 30,
    background: 'var(--ui-surface-neutral-sunk)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizAnswer: {
    minHeight: 54,
    background: 'var(--ui-surface-neutral-sunk)',
    borderRadius: 6,
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  matchSummaryText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  lastRunLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.66rem',
    color: 'var(--colour-muted-soft)',
    fontWeight: 500,
    flexShrink: 0,
  },
}
