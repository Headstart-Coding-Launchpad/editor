import React, { useState, useEffect } from 'react'
import { getQuizOptionText, CONFIDENCE_COLOURS } from './QuizTask'
import { InlineMarkdown } from '../../shared/markdown'
import { findTaskById, deriveTaskContext } from '../../shared/taskUtils'
import PresenceBadge from './PresenceBadge'

function formatLastRun(ts) {
  if (!ts) return null
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 10) return 'Just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// Matches the pane ids each module's StudentWorkspace/LessonTaskContent report — see
// visiblePanes in LessonTaskContent.jsx. Ids with no entry here (e.g. HTML file names)
// pass through as-is via the ?? fallback below.
const VISIBLE_PANE_LABELS = {
  instructions: 'Info', blocks: 'Blocks', stage: 'Stage',
  breadboard: 'Breadboard', code: 'Code', console: 'Console',
  sprites: 'Sprites', tilemaps: 'Tilemaps', running: 'Running', preview: 'Preview',
}
function formatVisiblePanes(panes) {
  return panes.map(p => VISIBLE_PANE_LABELS[p] ?? p).join(' + ')
}

export default function StudentCard({ student, lesson, lessonId, session, topics, onRename, onRemove, onExpand }) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(student.displayName)
  const [isActive, setIsActive] = useState(false)
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
    const interval = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(interval)
  }, [student.lastRunAt])

  function handleRename(e) {
    e.preventDefault()
    onRename?.(student.anonymousId, nameValue.trim() || student.displayName)
    setEditing(false)
  }

  const currentTask = findTaskById(lesson?.tasks, session?.currentTaskId)
  const isSubmitMode = currentTask?.interactionMode === 'submit'
  const { isPython, isFilesystem, isQuiz, isInformation, isSessionSandbox } = deriveTaskContext(lesson, currentTask, session)
  const quizType = isQuiz ? (currentTask?.quizType ?? 'multiple_choice') : null
  const isShortAnswer = quizType === 'short_answer'
  const isMatchOrFillBlank = quizType === 'match' || quizType === 'fill_blank'
  const isConfidence = quizType === 'confidence'
  const quizAnswerText = isQuiz && !isShortAnswer && !isMatchOrFillBlank && !isConfidence ? getQuizOptionText(currentTask, student.currentAnswer) : ''
  const quizSubmitted = isQuiz && student.lastRunStatus === 'submitted'
  const confidenceLevel = isConfidence && student.currentAnswer ? parseInt(student.currentAnswer) : null

  const statusColour = isConfidence && confidenceLevel >= 1 && confidenceLevel <= 5
    ? CONFIDENCE_COLOURS[confidenceLevel - 1]
    : quizSubmitted && student.checkPassed === true  ? '#22c55e' :
      quizSubmitted && student.checkPassed === false  ? '#ef4444' :
      student.lastRunStatus === 'success'   ? '#22c55e' :
      student.lastRunStatus === 'error'     ? '#ef4444' :
      student.lastRunStatus === 'submitted' ? '#3b82f6' : '#9ca3af'

  // Confidence tasks have no pass/fail check — teacher just sees the submitted level
  // For match/fill_blank quizzes, checkPassed comes from internal quiz logic rather than task.check
  const hasCheck = !isConfidence && (currentTask?.check != null || (isQuiz && quizSubmitted && student.checkPassed != null))
  const checkAttempted = student.lastRunStatus != null
  const hasActiveOverride = !!student.checkOverridePushedAt
  const supportRevealCount = Object.keys(session?.supportRevealLog?.[student.anonymousId]?.[currentTask?.id] ?? {}).length
  const checkPassed = hasCheck && (hasActiveOverride ? student.checkOverridePassed === true : student.checkPassed === true)
  const checkFailed = hasCheck && (hasActiveOverride ? student.checkOverridePassed === false : (checkAttempted && student.checkPassed !== true))
  const checkCardStyle = checkPassed
    ? s.cardCheckPassed
    : checkFailed
    ? s.cardCheckFailed
    : student.needsHelp
    ? s.cardNeedsHelp
    : null
  const hasAnswer = student.currentAnswer != null && student.currentAnswer !== ''

  return (
    <div style={{ ...s.card, ...checkCardStyle }} className="card">
      {/* Header row */}
      <div style={s.header}>
        <div style={s.nameRow}>
          <span style={{ ...s.statusDot, background: statusColour }} />
          {editing ? (
            <form onSubmit={handleRename} style={s.nameForm}>
              <input
                style={s.nameInput}
                value={nameValue}
                autoFocus
                onChange={e => setNameValue(e.target.value)}
                onBlur={handleRename}
              />
            </form>
          ) : (
            <span style={s.name} title={student.displayName}>{student.displayName}</span>
          )}
          <button
            style={s.pencil}
            onClick={() => setEditing(e => !e)}
            title="Rename student"
          >
            ✏️
          </button>
          <button
            style={s.removeBtn}
            onClick={() => {
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
          <PresenceBadge student={student} session={session} />
          {student.online && student.windowFocused === false && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeAway }} title="Student's tab is not focused">
              Away
            </span>
          )}
          {student.isFullscreen && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeFullscreen }} title="Student is in fullscreen mode">
              ⛶ Fullscreen
            </span>
          )}
          {isActive && (
            <span className="activity-dots" title="Student is active">
              <span /><span /><span />
            </span>
          )}
          {checkPassed && (
            <span style={{ ...s.checkBadge, ...s.checkBadgePassed }} title="Completion check passed">
              <span style={s.checkBadgeIcon}>✓</span>
              Passed
            </span>
          )}
          {checkFailed && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeFailed }} title="Completion check failed">
              <span style={s.checkBadgeIcon}>✕</span>
              Failed
            </span>
          )}
          {hasActiveOverride && (
            <span
              style={{ ...s.checkBadge, ...(student.checkOverridePassed ? s.checkBadgeOverridePassed : s.checkBadgeOverrideFailed) }}
              title="Check overridden by teacher"
            >
              <span style={s.checkBadgeIcon}>{student.checkOverridePassed ? '✓' : '✕'}</span>
              Override
            </span>
          )}
          {student.inPersonalSandbox && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeSandbox }} title="Student is in their personal sandbox">
              Sandbox
            </span>
          )}
          {student.needsHelp && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeHelp }} title="Student has requested help">
              Help
            </span>
          )}
          {supportRevealCount > 0 && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeSupport }} title="Student has opened support reference">
              Support {supportRevealCount > 1 ? supportRevealCount : ''}
            </span>
          )}
          {student.currentTopicId && (() => {
            const topic = topics?.find(t => t.id === student.currentTopicId)
            return (
              <span style={{ ...s.checkBadge, ...s.checkBadgeTopic }} title={`Student has topic "${topic?.title ?? student.currentTopicId}" open`}>
                📖 {topic?.title ?? student.currentTopicId}
              </span>
            )
          })()}
          {Array.isArray(student.visiblePanes) && student.visiblePanes.length > 0 && (
            <span style={{ ...s.checkBadge, ...s.checkBadgeView }} title={`Student can currently see: ${formatVisiblePanes(student.visiblePanes)}`}>
              👀 {formatVisiblePanes(student.visiblePanes)}
            </span>
          )}
        </div>
      </div>

      {/* Output / preview snippet */}
      {isInformation ? (
        <div style={s.iframeThumb}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Information task</span>
        </div>
      ) : isQuiz && !isSessionSandbox ? (
        <div style={s.quizAnswer}>
          {hasAnswer ? (
            isConfidence ? (
              <span style={{ ...s.confidenceBadge, background: confidenceLevel >= 1 && confidenceLevel <= 5 ? CONFIDENCE_COLOURS[confidenceLevel - 1] : '#9ca3af' }}>
                {confidenceLevel}/5
              </span>
            ) : isShortAnswer ? (
              <span style={s.shortAnswerText}>{student.currentAnswer}</span>
            ) : isMatchOrFillBlank ? (
              <span style={s.matchSummaryText}>
                {student.checkPassed === true
                  ? '✓ All correct'
                  : student.checkPassed === false && quizSubmitted
                  ? '✗ Some incorrect'
                  : quizSubmitted
                  ? 'Answered'
                  : 'In progress…'}
              </span>
            ) : (
              <>
                <span style={s.quizAnswerId}>{student.currentAnswer}</span>
                <span style={s.quizAnswerText}>
                  {quizAnswerText ? <InlineMarkdown content={quizAnswerText} /> : 'Selected answer'}
                </span>
              </>
            )
          ) : (
            <span style={{ color: '#9ca3af', fontSize: 12 }}>No answer yet</span>
          )}
        </div>
      ) : isPython ? (
        isSubmitMode ? (
          <pre style={s.snippet}>
            {student.lastRunStatus === 'submitted'
              ? (student.currentCode ?? '').split('\n').slice(0, 3).join('\n') || <span style={{ color: '#9ca3af' }}>No code yet</span>
              : <span style={{ color: '#9ca3af' }}>Waiting for submission</span>}
          </pre>
        ) : (
          <pre style={s.snippet}>{(student.currentOutput ?? '').split('\n').slice(0, 3).join('\n') || <span style={{ color: '#9ca3af' }}>No output yet</span>}</pre>
        )
      ) : isFilesystem ? (
        <div style={s.iframeThumb}>
          <span style={{ color: student.currentCode ? '#6b7280' : '#9ca3af', fontSize: 12 }}>
            {student.currentCode ? 'Filesystem project' : 'No changes yet'}
          </span>
        </div>
      ) : (
        <div style={s.iframeThumb}>
          {student.currentFiles
            ? <span style={{ color: '#6b7280', fontSize: 12 }}>HTML project</span>
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>No run yet</span>}
        </div>
      )}

      {/* Last run indicator for code tasks */}
      {!isQuiz && !isInformation && student.lastRunAt && (
        <div style={s.lastRunRow}>
          <span style={s.lastRunLabel}>▶ {formatLastRun(student.lastRunAt)}</span>
        </div>
      )}

      {/* Expand button — not shown for information tasks */}
      {!isInformation && (
        <button
          className="btn-secondary"
          style={s.expandBtn}
          onClick={() => onExpand?.(student)}
        >
          Expand
        </button>
      )}
    </div>
  )
}

const s = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    minWidth: 0,
  },
  cardCheckPassed: {
    border: '3px solid #22c55e',
    background: '#f0fdf4',
    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.16), 0 8px 18px rgba(22, 101, 52, 0.14)',
  },
  cardCheckFailed: {
    border: '3px solid #ef4444',
    background: '#fef2f2',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.16), 0 8px 18px rgba(127, 29, 29, 0.14)',
  },
  cardNeedsHelp: {
    border: '3px solid #f59e0b',
    background: '#fffbeb',
    boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.2), 0 8px 18px rgba(120, 53, 15, 0.14)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
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
    gap: 6,
    width: '100%',
    minWidth: 0,
    flexWrap: 'wrap',
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
    padding: '3px 7px',
    borderRadius: 999,
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
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
    background: '#f5f5f5',
    borderRadius: 6,
    padding: '6px 8px',
    margin: 0,
    maxHeight: 54,
    overflow: 'hidden',
    color: 'var(--colour-text)',
  },
  iframeThumb: {
    height: 54,
    background: '#f5f5f5',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizAnswer: {
    minHeight: 54,
    background: '#f5f5f5',
    borderRadius: 6,
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  quizAnswerId: {
    width: 24,
    height: 24,
    borderRadius: 5,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '0.78rem',
  },
  quizAnswerText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.3,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  shortAnswerText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    color: 'var(--colour-text)',
    fontWeight: 500,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontStyle: 'italic',
  },
  matchSummaryText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  confidenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 8,
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  lastRunRow: {
    display: 'flex',
    alignItems: 'center',
  },
  lastRunLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: '#9ca3af',
    fontWeight: 500,
  },
  expandBtn: {
    fontSize: 12,
    padding: '5px 0',
    width: '100%',
  },
}
