import React, { useState } from 'react'
import StudentCard from './StudentCard'
import StudentModal from './StudentModal'
import { findTaskById } from '../../shared/taskUtils'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'
import BadgeAwardDialog from './badges/BadgeAwardDialog'
import DropdownMenu from './student-modal/DropdownMenu'
import JoiningStudentsList from './JoiningStudentsList'
import ClassActivityStrip from './ClassActivityStrip'
import CommonHintsStrip from './CommonHintsStrip'
import ConfidenceSpreadStrip from './ConfidenceSpreadStrip'
import { getTaskActivity } from '../../activities/registry.pure.js'
import { confidenceSpreadEntries, tallyConfidenceSpread } from '../../shared/confidenceScale'
import { summariseCommonHints } from '../studentHints.js'
import { classActivities, summariseClassActivities } from '../studentActivity'

export default function StudentGrid({
  students = [],
  // [{ tempId, typedName, joinedAt }] from listJoiningStudents(session.joiningStudents)
  joiningStudents = [],
  onAdmitJoining,
  lesson,
  lessonId,
  session,
  topics,
  onRename,
  onRemove,
  onGoLive,
  onGoLiveForAll,
  onStopLive,
  onRemoteReset,
  onOverrideCheck,
  onDismissHelp,
  peerHelp = null,
  onSendToTopic,
  onSendTopicToAll,
  onTogglePaused,
  onSendToIndividual,
  onSendMessage,
  onSendVideoCallLink,
  onRequestTeacherEdit,
  onPushTeacherLiveCode,
  onCommitTeacherEdit,
  onCancelTeacherEdit,
  onRequestTeacherStage,
  onClearTeacherStage,
  onAddHighlight,
  onRemoveHighlight,
  onRevealSupportStage,
  onSetTeacherLiveReference,
  onPushTeacherPaneCommand,
  onTeacherAnswerEdit,
  onPushTileHighlight,
  onRemoveTileHighlights,
  onClearTileHighlights,
  onRemoteRun,
  onReadPendingShare,
  onApproveShare,
  onDeclineShare,
  onRequestShareSnapshot,
  onRequestFullscreenAll,
  onRequestFullscreenStudent,
  onNudgeStudent,
  onThumbsUpStudent,
  onShowResponse,
  onHideResponse,
  onSetShownResponseName,
  onNudgeAway,
  onSetAutoReveal,
  badgeSuggestions = null,
  onOpenBadgeSuggestions,
  onDecideBadge,
  onRevokeBadge,
  catalogueBadges = [],
  collapsed,
  onToggle,
}) {
  const joiningCount = joiningStudents.length
  const [expandedStudentId, setExpandedStudentId] = useState(null)
  const [showTopicsDialog, setShowTopicsDialog] = useState(false)
  const [fullscreenRequested, setFullscreenRequested] = useState(false)
  const [nudgedAway, setNudgedAway] = useState(false)
  const awayCount = students.filter((st) => st.online && st.windowFocused === false).length
  // Multi-award: select mode turns a card click into a selection toggle.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  // What each student is doing now (src/app/studentActivity.js): the cards' "Now:" lines and
  // the class strip above the grid, whose groups the teacher can click to outline those cards.
  const activities = classActivities({ session, peerHelp, topics, lesson })
  const activitySummary = summariseClassActivities({ session, activities })
  // Hints two or more students are being shown on this task (src/app/studentHints.js). Not
  // during a session sandbox, whose runs aren't scored against the task.
  const commonHints =
    session?.state === 'sandbox' ? [] : summariseCommonHints(students, session?.currentTaskId)
  // The class's spread on the current task's rating (a confidence check: activities with a
  // ratingScale), from each student's mirrored answer. Not during a session sandbox.
  const ratedTask =
    session?.state === 'sandbox' ? null : findTaskById(lesson?.tasks, session?.currentTaskId)
  const ratingScale = ratedTask ? getTaskActivity(ratedTask)?.ratingScale : null
  const confidenceSpread = ratingScale ? tallyConfidenceSpread(students, ratingScale) : null
  const [highlightedGroup, setHighlightedGroup] = useState(null)
  const highlightedIds = new Set(
    [...activitySummary, ...commonHints, ...confidenceSpreadEntries(confidenceSpread)].find(
      (entry) => entry.group === highlightedGroup
    )?.studentIds ?? []
  )
  const studentNames = Object.fromEntries(
    students.map((student) => [student.anonymousId, student.displayName])
  )

  const [showBadgeDialog, setShowBadgeDialog] = useState(false)
  const selectedStudents = students.filter((st) => selectedIds.has(st.anonymousId))
  const suggestionCount = badgeSuggestions?.suggestions?.length ?? 0
  const sessionLive = session?.state === 'active' || session?.state === 'sandbox'
  // The header's ⋯ menu: occasional class actions, kept off the always-visible line.
  const showNudgeItem = !!onNudgeAway && (sessionLive || awayCount > 0)
  const showSuggestionsItem = !!onOpenBadgeSuggestions && (sessionLive || suggestionCount > 0)
  const showSelectItem = !!onDecideBadge && students.length > 0
  const showReferenceItem = topics?.length > 0
  const hasClassMenu = showNudgeItem || showSuggestionsItem || showSelectItem || showReferenceItem
  const classMenuAttention =
    (showNudgeItem && awayCount > 0) || (showSuggestionsItem && suggestionCount > 0)

  function toggleSelected(studentId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setShowBadgeDialog(false)
  }

  function handleNudgeAway() {
    onNudgeAway?.()
    setNudgedAway(true)
    setTimeout(() => setNudgedAway(false), 2000)
  }

  function handleRequestFullscreenAll() {
    onRequestFullscreenAll?.()
    setFullscreenRequested(true)
    setTimeout(() => setFullscreenRequested(false), 2000)
  }

  const expandedIndex = students.findIndex((s) => s.anonymousId === expandedStudentId)
  const expandedStudent = expandedIndex >= 0 ? students[expandedIndex] : null

  function handleExpand(student) {
    onGoLive?.(student.anonymousId)
    setExpandedStudentId(student.anonymousId)
  }

  function handleClose() {
    onStopLive?.()
    setExpandedStudentId(null)
  }

  function handlePrev() {
    if (expandedIndex > 0) {
      const prevStudent = students[expandedIndex - 1]
      onGoLive?.(prevStudent.anonymousId)
      setExpandedStudentId(prevStudent.anonymousId)
    }
  }

  function handleNext() {
    if (expandedIndex < students.length - 1) {
      const nextStudent = students[expandedIndex + 1]
      onGoLive?.(nextStudent.anonymousId)
      setExpandedStudentId(nextStudent.anonymousId)
    }
  }

  const currentTask = findTaskById(lesson?.tasks, session?.currentTaskId)
  const hasCheck = currentTask?.check != null && session?.state !== 'sandbox'
  const passedCount = hasCheck ? students.filter((student) => student.checkPassed).length : 0
  // A crashed run counts as "errored", not "failed" (matching the cards' Error chip).
  const errorCount =
    session?.state !== 'sandbox'
      ? students.filter((student) => student.lastRunStatus === 'error' && !student.checkPassed)
          .length
      : 0
  const failedCount = hasCheck
    ? students.filter(
        (student) =>
          student.lastRunStatus != null && student.lastRunStatus !== 'error' && !student.checkPassed
      ).length
    : 0

  if (collapsed) {
    const runCount = students.filter((s) => s.lastRunStatus != null).length

    return (
      <div style={s.collapsedWrap}>
        <button style={s.collapseBtn} onClick={onToggle} title="Show Students">
          ‹
        </button>

        <div style={s.collapsedStat}>
          <span style={{ ...s.collapsedBadge, background: 'var(--colour-primary)' }}>
            {students.length}
          </span>
          <span style={s.collapsedStatLabel}>joined</span>
        </div>

        {joiningCount > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#f59e0b' }}>{joiningCount}</span>
            <span style={s.collapsedStatLabel}>joining</span>
          </div>
        )}

        {students.length > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#6b7280' }}>{runCount}</span>
            <span style={s.collapsedStatLabel}>run</span>
          </div>
        )}

        {students.length > 0 && hasCheck && passedCount > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: 'var(--colour-success)' }}>
              {passedCount}
            </span>
            <span style={s.collapsedStatLabel}>passed</span>
          </div>
        )}

        {students.length > 0 && hasCheck && failedCount > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: 'var(--colour-error)' }}>
              {failedCount}
            </span>
            <span style={s.collapsedStatLabel}>failed</span>
          </div>
        )}

        {students.length > 0 && errorCount > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#ea580c' }}>{errorCount}</span>
            <span style={s.collapsedStatLabel}>errored</span>
          </div>
        )}

        {suggestionCount > 0 && (
          <div style={s.collapsedStat} title="Badge suggestions waiting">
            <span style={{ ...s.collapsedBadge, background: 'var(--colour-primary)' }}>
              {suggestionCount}
            </span>
            <span style={s.collapsedStatLabel}>🏅</span>
          </div>
        )}

        <span style={s.collapsedLabel}>Students</span>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {/* One line, never wrapping: the title and count, Fullscreen All, a ⋯ menu for the
          occasional class actions (its dot means someone is Away or a badge suggestion is
          waiting) and the collapse arrow. */}
      <div style={s.header}>
        <span style={s.label}>
          Students <span style={s.labelCount}>({students.length})</span>
        </span>
        <div style={s.headerRight}>
          {joiningCount > 0 && (
            <span
              style={{ ...s.checkCountBadge, background: '#f59e0b' }}
              title={`${joiningCount} student${joiningCount === 1 ? '' : 's'} entering their name`}
            >
              {joiningCount} joining…
            </span>
          )}
          {hasCheck && passedCount > 0 && (
            <span
              style={{ ...s.checkCountBadge, background: 'var(--colour-success)' }}
              title="Students who passed the completion check"
            >
              ✓ {passedCount}
            </span>
          )}
          {hasCheck && failedCount > 0 && (
            <span
              style={{ ...s.checkCountBadge, background: 'var(--colour-error)' }}
              title="Students who failed the completion check"
            >
              ✕ {failedCount}
            </span>
          )}
          {errorCount > 0 && (
            <span
              style={{ ...s.checkCountBadge, background: '#ea580c' }}
              title="Students whose latest run crashed with an error"
            >
              ⚠ {errorCount}
            </span>
          )}
          {nudgedAway && (
            <span style={s.headerNote} role="status">
              ✓ Nudged
            </span>
          )}
          {onRequestFullscreenAll && students.length > 0 && (
            <button
              style={s.topicsBtn}
              onClick={handleRequestFullscreenAll}
              title="Ask all students to go fullscreen (each student must click a prompt to accept)"
            >
              {fullscreenRequested ? '✓ Requested' : '⛶ Fullscreen All'}
            </button>
          )}
          {hasClassMenu && (
            <DropdownMenu
              label="⋯"
              caret={false}
              buttonClassName=""
              buttonStyle={s.moreBtn}
              ariaLabel={
                classMenuAttention
                  ? 'More class actions (something needs attention)'
                  : 'More class actions'
              }
              title="More class actions"
              indicator={classMenuAttention}
              panelStyle={s.menuPanel}
            >
              {(close) => (
                <>
                  {showNudgeItem && (
                    <button
                      type="button"
                      style={s.menuItem}
                      disabled={awayCount === 0}
                      onClick={() => {
                        close()
                        handleNudgeAway()
                      }}
                      title="Flash the tab and chime for every student whose window isn't focused"
                    >
                      🔔 Nudge Away ({awayCount})
                    </button>
                  )}
                  {showSuggestionsItem && (
                    <button
                      type="button"
                      style={s.menuItem}
                      onClick={() => {
                        close()
                        onOpenBadgeSuggestions()
                      }}
                      title="Open the badge suggestions panel"
                      aria-label={`Badge suggestions: ${suggestionCount} pending`}
                    >
                      🏅 Suggestions ({suggestionCount})
                    </button>
                  )}
                  {showSelectItem && (
                    <button
                      type="button"
                      style={s.menuItem}
                      aria-pressed={selectMode}
                      onClick={() => {
                        close()
                        if (selectMode) exitSelectMode()
                        else setSelectMode(true)
                      }}
                      title="Select several students to award a badge to all of them at once"
                    >
                      {selectMode ? '☑ Done selecting' : '☑ Select'}
                    </button>
                  )}
                  {showReferenceItem && (
                    <button
                      type="button"
                      style={s.menuItem}
                      onClick={() => {
                        close()
                        setShowTopicsDialog(true)
                      }}
                      title="Open topic library"
                    >
                      📖 Reference
                    </button>
                  )}
                </>
              )}
            </DropdownMenu>
          )}
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Students">
            ›
          </button>
        </div>
      </div>

      <JoiningStudentsList joiningStudents={joiningStudents} onAdmit={onAdmitJoining} />

      {students.length === 0 ? (
        <div style={s.empty}>
          <p>
            {joiningCount > 0
              ? 'No one has joined yet. Wait for them to press Join, or pull them in above.'
              : 'No students yet.'}
          </p>
          {joiningCount === 0 && (
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 6 }}>
              Share the lesson link to invite students.
            </p>
          )}
        </div>
      ) : (
        <>
          {selectMode && (
            <div style={s.selectBar} role="toolbar" aria-label="Selected students">
              <span style={s.selectCount} aria-live="polite">
                {selectedStudents.length} selected
              </span>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.selectBtn}
                onClick={() =>
                  setSelectedIds(
                    selectedStudents.length === students.length
                      ? new Set()
                      : new Set(students.map((st) => st.anonymousId))
                  )
                }
              >
                {selectedStudents.length === students.length ? 'Clear' : 'All'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={s.selectBtn}
                disabled={selectedStudents.length === 0}
                onClick={() => setShowBadgeDialog(true)}
              >
                🏅 Award badge
              </button>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.selectBtn}
                onClick={exitSelectMode}
              >
                Done
              </button>
            </div>
          )}
          <ClassActivityStrip
            entries={activitySummary}
            names={studentNames}
            highlighted={highlightedIds.size > 0 ? highlightedGroup : null}
            onHighlight={setHighlightedGroup}
          />
          <CommonHintsStrip
            entries={commonHints}
            names={studentNames}
            highlighted={highlightedIds.size > 0 ? highlightedGroup : null}
            onHighlight={setHighlightedGroup}
          />
          <ConfidenceSpreadStrip
            spread={confidenceSpread}
            names={studentNames}
            highlighted={highlightedIds.size > 0 ? highlightedGroup : null}
            onHighlight={setHighlightedGroup}
          />
          <div style={s.grid}>
            {students.map((student) => (
              <StudentCard
                key={student.anonymousId}
                student={student}
                lesson={lesson}
                lessonId={lessonId}
                session={session}
                onRename={onRename}
                onRemove={onRemove}
                onExpand={handleExpand}
                onNudge={onNudgeStudent}
                onThumbsUp={onThumbsUpStudent}
                onShowResponse={onShowResponse}
                onHideResponse={onHideResponse}
                onSetShownResponseName={onSetShownResponseName}
                badgePendingCount={
                  badgeSuggestions?.pendingCountByStudent?.[student.anonymousId] ?? 0
                }
                badgeAwardedCount={
                  badgeSuggestions?.awardedCountByStudent?.[student.anonymousId] ?? 0
                }
                activities={activities[student.anonymousId] ?? []}
                highlighted={highlightedIds.has(student.anonymousId)}
                selectMode={selectMode}
                selected={selectedIds.has(student.anonymousId)}
                onToggleSelect={toggleSelected}
              />
            ))}
          </div>
        </>
      )}

      {showBadgeDialog && onDecideBadge && selectedStudents.length > 0 && (
        <BadgeAwardDialog
          students={selectedStudents.map((st) => ({
            anonymousId: st.anonymousId,
            displayName: st.displayName,
          }))}
          decisions={session?.badges ?? {}}
          catalogueBadges={catalogueBadges}
          taskId={session?.currentTaskId ?? null}
          onDecideBadge={onDecideBadge}
          onClose={() => setShowBadgeDialog(false)}
        />
      )}

      {onTogglePaused && (session?.state === 'active' || session?.state === 'sandbox') && (
        <div style={s.pauseRow}>
          <button
            className={session?.isPaused ? 'btn-paused' : 'btn-ghost-outline'}
            style={s.pauseBtn}
            onClick={onTogglePaused}
          >
            {session?.isPaused ? 'Resume Coding' : 'Pause Coding'}
          </button>
        </div>
      )}

      {showTopicsDialog && topics?.length > 0 && (
        <TopicLibraryDialog
          topics={topics}
          onClose={() => setShowTopicsDialog(false)}
          renderMarkdown={({ content, textScale, topicType }) => (
            <MarkdownRenderer content={content} textScale={textScale} topicType={topicType} />
          )}
          students={students}
          onSendToAll={onSendTopicToAll}
          onSendToIndividual={onSendToIndividual}
        />
      )}

      {expandedStudent && (
        <StudentModal
          student={expandedStudent}
          lesson={lesson}
          session={session}
          topics={topics}
          isLive={session?.activeStudentView === expandedStudent.anonymousId}
          isLiveForAll={session?.teacherLive?.sourceStudentId === expandedStudent.anonymousId}
          onGoLive={() => onGoLive?.(expandedStudent.anonymousId)}
          onGoLiveForAll={(mode) => onGoLiveForAll?.(expandedStudent, mode)}
          isLiveForAllPanel={session?.teacherLive?.mode === 'panel'}
          onStopLive={() => onStopLive?.()}
          onClose={handleClose}
          hasPrev={expandedIndex > 0}
          hasNext={expandedIndex < students.length - 1}
          onPrev={handlePrev}
          onNext={handleNext}
          onRemoteReset={onRemoteReset}
          onOverrideCheck={onOverrideCheck}
          onDismissHelp={onDismissHelp}
          peerHelp={peerHelp}
          onSendToTopic={onSendToTopic}
          onSendTopicToAll={onSendTopicToAll}
          onSendMessage={onSendMessage}
          onSendVideoCallLink={onSendVideoCallLink}
          onRequestTeacherEdit={onRequestTeacherEdit}
          onPushTeacherLiveCode={onPushTeacherLiveCode}
          onCommitTeacherEdit={onCommitTeacherEdit}
          onCancelTeacherEdit={onCancelTeacherEdit}
          onRequestTeacherStage={onRequestTeacherStage}
          onClearTeacherStage={onClearTeacherStage}
          onAddHighlight={onAddHighlight}
          onRemoveHighlight={onRemoveHighlight}
          onRevealSupportStage={onRevealSupportStage}
          onSetTeacherLiveReference={onSetTeacherLiveReference}
          onPushTeacherPaneCommand={onPushTeacherPaneCommand}
          onTeacherAnswerEdit={onTeacherAnswerEdit}
          onPushTileHighlight={onPushTileHighlight}
          onRemoveTileHighlights={onRemoveTileHighlights}
          onClearTileHighlights={onClearTileHighlights}
          onRemoteRun={onRemoteRun}
          onReadPendingShare={onReadPendingShare}
          onApproveShare={onApproveShare}
          onDeclineShare={onDeclineShare}
          onRequestShareSnapshot={onRequestShareSnapshot}
          onRequestFullscreen={onRequestFullscreenStudent}
          onNudge={onNudgeStudent}
          onThumbsUp={onThumbsUpStudent}
          onSetAutoReveal={onSetAutoReveal}
          onDecideBadge={onDecideBadge}
          onRevokeBadge={onRevokeBadge}
          catalogueBadges={catalogueBadges}
        />
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '0 10px 0 14px',
    height: 44,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    minWidth: 0,
    flexShrink: 0,
  },
  headerRight: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  label: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  labelCount: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    opacity: 0.85,
  },
  headerNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    opacity: 0.9,
  },
  moreBtn: {
    background: 'rgba(255,255,255,0.18)',
    border: 'none',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 8px',
    lineHeight: 1,
    borderRadius: 4,
  },
  menuPanel: { minWidth: 210, padding: 8, gap: 4 },
  menuItem: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  checkCountBadge: {
    color: '#fff',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
    gap: 7,
    alignContent: 'start',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    textAlign: 'center',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: 3,
  },
  topicsBtn: {
    background: 'rgba(255,255,255,0.18)',
    border: 'none',
    color: '#fff',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    borderRadius: 4,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  selectBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    padding: '6px 10px',
    background: 'var(--ui-surface-tint)',
    borderBottom: '1px solid var(--ui-border)',
  },
  selectCount: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--colour-primary)',
    marginRight: 'auto',
  },
  selectBtn: { fontSize: 12, padding: '4px 10px' },
  pauseRow: {
    flexShrink: 0,
    borderTop: '1px solid #e5e7eb',
    padding: '8px 10px',
    background: '#fafafa',
  },
  pauseBtn: {
    width: '100%',
    fontSize: '0.82rem',
    padding: '7px 12px',
  },
  collapsedWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    paddingTop: 8,
    gap: 8,
  },
  collapseBtn: {
    background: 'var(--colour-primary)',
    border: 'none',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    width: 28,
    height: 28,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  collapsedLabel: {
    writingMode: 'vertical-rl',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    color: 'var(--colour-primary)',
    opacity: 0.6,
    userSelect: 'none',
    marginTop: 4,
  },
  collapsedStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  collapsedBadge: {
    color: '#fff',
    borderRadius: 10,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    minWidth: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  collapsedStatLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: '#9ca3af',
    textAlign: 'center',
  },
}
