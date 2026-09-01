import React, { useState } from 'react'
import StudentCard from './StudentCard'
import StudentModal from './StudentModal'
import { findTaskById } from '../../shared/taskUtils'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'


export default function StudentGrid({ students = [], joiningCount = 0, lesson, lessonId, session, topics, onRename, onRemove, onGoLive, onGoLiveForAll, onStopLive, onRemoteReset, onOverrideCheck, onDismissHelp, onSendToTopic, onSendTopicToAll, onTogglePaused, onSendToIndividual, onSendMessage, onSendVideoCallLink, onRequestTeacherEdit, onPushTeacherLiveCode, onCommitTeacherEdit, onCancelTeacherEdit, onRequestTeacherStage, onClearTeacherStage, onAddHighlight, onRemoveHighlight, onRevealSupportStage, onPushTeacherPaneCommand, onRequestFullscreenAll, collapsed, onToggle }) {
  const [expandedStudentId, setExpandedStudentId] = useState(null)
  const [showTopicsDialog, setShowTopicsDialog] = useState(false)
  const [fullscreenRequested, setFullscreenRequested] = useState(false)

  function handleRequestFullscreenAll() {
    onRequestFullscreenAll?.()
    setFullscreenRequested(true)
    setTimeout(() => setFullscreenRequested(false), 2000)
  }

  const expandedIndex = students.findIndex(s => s.anonymousId === expandedStudentId)
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
  const hasCheck = currentTask?.check != null
  const passedCount = hasCheck ? students.filter(student => student.checkPassed).length : 0
  const failedCount = hasCheck ? students.filter(student => student.lastRunStatus != null && !student.checkPassed).length : 0

  if (collapsed) {
    const runCount    = students.filter(s => s.lastRunStatus != null).length

    return (
      <div style={s.collapsedWrap}>
        <button style={s.collapseBtn} onClick={onToggle} title="Show Students">‹</button>

        <div style={s.collapsedStat}>
          <span style={{ ...s.collapsedBadge, background: 'var(--colour-primary)' }}>{students.length}</span>
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

        {students.length > 0 && hasCheck && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#22c55e' }}>{passedCount}</span>
            <span style={s.collapsedStatLabel}>passed</span>
          </div>
        )}

        {students.length > 0 && hasCheck && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#ef4444' }}>{failedCount}</span>
            <span style={s.collapsedStatLabel}>failed</span>
          </div>
        )}

        <span style={s.collapsedLabel}>Students</span>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.label}>Students</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {joiningCount > 0 && (
            <span style={{ ...s.checkCountBadge, background: '#f59e0b' }} title={`${joiningCount} student${joiningCount === 1 ? '' : 's'} entering their name`}>
              {joiningCount} joining…
            </span>
          )}
          {hasCheck && (
            <>
              <span style={{ ...s.checkCountBadge, background: '#22c55e' }} title="Students who passed the completion check">✓ {passedCount}</span>
              <span style={{ ...s.checkCountBadge, background: '#ef4444' }} title="Students who failed the completion check">✕ {failedCount}</span>
            </>
          )}
          <span style={s.count}>{students.length}</span>
          {onRequestFullscreenAll && students.length > 0 && (
            <button
              style={s.topicsBtn}
              onClick={handleRequestFullscreenAll}
              title="Ask all students to go fullscreen (each student must click a prompt to accept)"
            >
              {fullscreenRequested ? '✓ Requested' : '⛶ Fullscreen All'}
            </button>
          )}
          {topics?.length > 0 && (
            <button style={s.topicsBtn} onClick={() => setShowTopicsDialog(true)} title="Open topic library">📖</button>
          )}
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Students">›</button>
        </div>
      </div>

      {students.length === 0 ? (
        <div style={s.empty}>
          <p>{joiningCount > 0 ? `${joiningCount} student${joiningCount === 1 ? '' : 's'} entering their name…` : 'No students yet.'}</p>
          {joiningCount === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 6 }}>Share the lesson link to invite students.</p>}
        </div>
      ) : (
        <div style={s.grid}>
          {students.map(student => (
            <StudentCard
              key={student.anonymousId}
              student={student}
              lesson={lesson}
              lessonId={lessonId}
              session={session}
              topics={topics}
              onRename={onRename}
              onRemove={onRemove}
              onExpand={handleExpand}
            />
          ))}
        </div>
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
          renderMarkdown={({ content, textScale, topicType }) => <MarkdownRenderer content={content} textScale={textScale} topicType={topicType} />}
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
          onGoLiveForAll={() => onGoLiveForAll?.(expandedStudent)}
          onStopLive={() => onStopLive?.()}
          onClose={handleClose}
          hasPrev={expandedIndex > 0}
          hasNext={expandedIndex < students.length - 1}
          onPrev={handlePrev}
          onNext={handleNext}
          onRemoteReset={onRemoteReset}
          onOverrideCheck={onOverrideCheck}
          onDismissHelp={onDismissHelp}
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
          onPushTeacherPaneCommand={onPushTeacherPaneCommand}
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
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  count: {
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  checkCountBadge: {
    color: '#fff',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    lineHeight: 1.25,
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 10,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
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
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
    borderRadius: 4,
  },
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
