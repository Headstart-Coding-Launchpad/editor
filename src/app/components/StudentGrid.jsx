import React, { useEffect, useState } from 'react'
import { useLatestRef } from '../hooks/useLatestRef'
import StudentCard from './StudentCard'
import StudentModal from './StudentModal'
import { findTaskById } from '../../shared/taskUtils'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'
import BadgeAwardDialog from './badges/BadgeAwardDialog'
import DropdownMenu from './student-modal/DropdownMenu'
import JoiningStudentsList from './JoiningStudentsList'
import ShareRequestsBanner from './ShareRequestsBanner'
import { useExtraClassToolsOn } from '../../shared/extraClassToolsSetting'
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
  onSetCopyCodeOverride,
  onPushTeacherControlHighlight,
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
  // { studentId, at } from TeacherView's side-quest panel: open that student's side-quest.
  openSideQuestRequest = null,
  // Tutor-only class roster status (summariseRosterStatus in src/shared/roster/rosterModel.js,
  // plus `needsClass` while a stock lesson's class isn't chosen) and the Match students opener.
  rosterStatus = null,
  onOpenRoster,
}) {
  const [showExtraTools] = useExtraClassToolsOn()
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
  const showRosterItem = !!onOpenRoster
  const unmatchedCount = rosterStatus?.unmatchedIds?.length ?? 0
  const unmatchedIds = new Set(rosterStatus?.unmatchedIds ?? [])
  // Held on a cross-lesson carry task until their earlier-lesson work is found.
  const carryWaitingIds = new Set(rosterStatus?.carryWaitingIds ?? [])
  const hasClassMenu =
    showNudgeItem || showSuggestionsItem || showSelectItem || showReferenceItem || showRosterItem
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
    setSideQuestViewRequest(null)
  }

  // Opens a student's modal on their side-quest: their card's 🗺️ chip, or the side-quest panel
  // in TeacherView (`openSideQuestRequest`: { studentId, at }, a fresh object each click).
  const [sideQuestViewRequest, setSideQuestViewRequest] = useState(null)
  function handleOpenSideQuest(studentId) {
    if (!studentId) return
    // The modal lives in the open grid.
    if (collapsed) onToggle?.()
    onGoLive?.(studentId)
    setExpandedStudentId(studentId)
    setSideQuestViewRequest(Date.now())
  }
  const handleOpenSideQuestRef = useLatestRef(handleOpenSideQuest)
  useEffect(() => {
    if (openSideQuestRequest?.studentId) {
      handleOpenSideQuestRef.current(openSideQuestRequest.studentId)
    }
  }, [openSideQuestRequest, handleOpenSideQuestRef])

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
    const helpCount = students.filter((st) => st.needsHelp).length
    const shareCount = students.filter((st) => st.shareRequestedAt != null).length

    // The whole rail opens the panel (a tablet folds the grid here by default), and the
    // button at the top says so in words, not just an arrow.
    return (
      <div
        style={s.collapsedWrap}
        onClick={onToggle}
        data-testid="student-grid-rail"
        title="Show the students panel"
      >
        <button
          type="button"
          style={s.collapseBtn}
          onClick={(event) => {
            event.stopPropagation()
            onToggle?.()
          }}
          title="Show Students"
          aria-label="Show the students panel"
        >
          <span aria-hidden="true">‹</span>
          <span style={s.collapseBtnText}>Show</span>
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

        {/* Asks that need the tutor, so a folded panel never hides them. */}
        {helpCount > 0 && (
          <div style={s.collapsedStat} title="Students asking for help">
            <span style={{ ...s.collapsedBadge, background: '#f59e0b' }}>{helpCount}</span>
            <span style={s.collapsedStatLabel}>✋ help</span>
          </div>
        )}
        {shareCount > 0 && (
          <div style={s.collapsedStat} title="Students who want to share their work">
            <span style={{ ...s.collapsedBadge, background: '#0d9488' }}>{shareCount}</span>
            <span style={s.collapsedStatLabel}>📤 share</span>
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

  // The header's ⋯ menu (occasional class actions).
  const classMenu = (
    <DropdownMenu
      label="⋯"
      caret={false}
      buttonClassName=""
      buttonStyle={s.moreBtn}
      ariaLabel={
        classMenuAttention ? 'More class actions (something needs attention)' : 'More class actions'
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
          {showRosterItem && (
            <button
              type="button"
              style={s.menuItem}
              onClick={() => {
                close()
                onOpenRoster()
              }}
              title="Match each student to their name on the class list"
            >
              👥 Match students
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
  )

  // The status row under the title: count chips and Fullscreen All.
  const hasStatusRow =
    joiningCount > 0 ||
    (!!onOpenRoster &&
      (unmatchedCount > 0 || !!rosterStatus?.needsClass || carryWaitingIds.size > 0)) ||
    (hasCheck && (passedCount > 0 || failedCount > 0)) ||
    errorCount > 0 ||
    nudgedAway ||
    (!!onRequestFullscreenAll && students.length > 0)

  return (
    <div style={s.wrap} data-testid="student-grid">
      {/* Two rows, so nothing prints over the title at any panel width (HSC Audit, Visual
          Review #3). The title line holds the title and count, a ⋯ menu for the occasional
          class actions (its dot means someone is Away or a badge suggestion is waiting) and
          the collapse arrow. The status row under it holds the count chips and Fullscreen
          All, and wraps rather than overlapping. */}
      <div style={s.header}>
        <span style={s.label}>
          Students <span style={s.labelCount}>({students.length})</span>
        </span>
        <div style={s.headerRight}>
          {hasClassMenu && classMenu}
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Students">
            ›
          </button>
        </div>
      </div>

      {hasStatusRow && (
        <div style={s.statusRow} data-testid="student-grid-status-row">
          {joiningCount > 0 && (
            <span
              style={{ ...s.checkCountBadge, background: '#f59e0b' }}
              title={`${joiningCount} student${joiningCount === 1 ? '' : 's'} entering their name`}
            >
              {joiningCount} joining…
            </span>
          )}
          {onOpenRoster &&
            (unmatchedCount > 0 || rosterStatus?.needsClass || carryWaitingIds.size > 0) && (
              <button
                type="button"
                style={{ ...s.checkCountBadge, ...s.rosterChip }}
                onClick={onOpenRoster}
                title={[
                  rosterStatus?.needsClass
                    ? 'Pick the class you are teaching, to save students’ work to the class list'
                    : 'Students not yet matched to the class list (their work is not being saved)',
                  carryWaitingIds.size > 0
                    ? `${carryWaitingIds.size} waiting for their work from an earlier lesson`
                    : null,
                ]
                  .filter(Boolean)
                  .join('. ')}
              >
                👥 {rosterStatus?.needsClass ? 'Pick class' : `${unmatchedCount} unmatched`}
                {carryWaitingIds.size > 0 ? ` · ⏳ ${carryWaitingIds.size}` : ''}
              </button>
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
          <span style={s.statusSpacer} aria-hidden="true" />
          {onRequestFullscreenAll && students.length > 0 && (
            <button
              style={s.topicsBtn}
              onClick={handleRequestFullscreenAll}
              title="Ask all students to go fullscreen (each student must click a prompt to accept)"
            >
              {fullscreenRequested ? '✓ Requested' : '⛶ Fullscreen All'}
            </button>
          )}
        </div>
      )}

      <JoiningStudentsList joiningStudents={joiningStudents} onAdmit={onAdmitJoining} />
      {onReadPendingShare && (
        <ShareRequestsBanner
          students={students}
          onReview={handleExpand}
          onDecline={onDeclineShare}
        />
      )}

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
                badgeSuggestionList={badgeSuggestions?.suggestions ?? []}
                catalogueBadges={catalogueBadges}
                onDecideBadge={onDecideBadge}
                onRevokeBadge={onRevokeBadge}
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
                onOpenSideQuest={handleOpenSideQuest}
                highlighted={highlightedIds.has(student.anonymousId)}
                selectMode={selectMode}
                selected={selectedIds.has(student.anonymousId)}
                onToggleSelect={toggleSelected}
                rosterName={rosterStatus?.namesByStudent?.[student.anonymousId] ?? null}
                rosterUnmatched={unmatchedIds.has(student.anonymousId)}
                carryWaiting={carryWaitingIds.has(student.anonymousId)}
                onOpenRoster={onOpenRoster}
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
          suggestions={badgeSuggestions?.suggestions ?? []}
          taskId={session?.currentTaskId ?? null}
          onDecideBadge={onDecideBadge}
          onClose={() => setShowBadgeDialog(false)}
        />
      )}

      {/* Hidden unless "Show extra class tools" is on, but always shown while paused so the
          tutor can resume. */}
      {onTogglePaused &&
        (showExtraTools || session?.isPaused) &&
        (session?.state === 'active' || session?.state === 'sandbox') && (
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
          onSetCopyCodeOverride={onSetCopyCodeOverride}
          onPushTeacherControlHighlight={onPushTeacherControlHighlight}
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
          badgeSuggestions={badgeSuggestions?.suggestions ?? []}
          sideQuestViewRequest={sideQuestViewRequest}
          rosterName={rosterStatus?.namesByStudent?.[expandedStudent.anonymousId] ?? null}
          typingEntries={
            rosterStatus?.typingEntriesByStudent?.[expandedStudent.anonymousId] ?? null
          }
          carryWaiting={carryWaitingIds.has(expandedStudent.anonymousId)}
          onUseCarryStarter={
            rosterStatus?.onUseCarryStarter
              ? () => rosterStatus.onUseCarryStarter([expandedStudent.anonymousId])
              : null
          }
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
    flexShrink: 0,
  },
  // Under the title: the count chips (left) and Fullscreen All (right). Wraps onto a second
  // line in a narrow panel instead of overlapping.
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 10px',
    background: 'var(--colour-primary-dark)',
    color: '#fff',
    flexShrink: 0,
  },
  statusSpacer: { flex: 1, minWidth: 0 },
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
  rosterChip: {
    background: '#0f766e',
    border: 'none',
    cursor: 'pointer',
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
    cursor: 'pointer',
  },
  // At least 40px each way, so it is easy to tap on a tablet.
  collapseBtn: {
    background: 'var(--colour-primary)',
    border: 'none',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    width: 40,
    minHeight: 44,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    padding: '4px 0',
    lineHeight: 1,
  },
  collapseBtnText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    fontWeight: 700,
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
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--colour-muted)',
    textAlign: 'center',
  },
}
