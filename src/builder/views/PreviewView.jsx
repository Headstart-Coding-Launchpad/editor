import React, { useState } from 'react'
import StudentView from '../../app/views/StudentView'
import TeacherFeedbackModal from '../../app/components/TeacherFeedbackModal'
import { useAuth } from '../../auth/useAuth'
import { flattenTasks } from '../../shared/taskUtils'
import { MarkdownRenderer } from '../../shared/markdown'
import { AnimatedPanelShell, CollapsedPanelRail, CollapseTabButton } from '../../app/components/CollapsiblePanelControls'

// This view is only reachable from the Builder (`/builder`, a teacher/author workflow operating
// on a locally-loaded lesson draft) — never from the student-facing `/lesson/:lessonId` route.
// Authoring metadata (intent, task activity) is therefore safe to render here, strictly for the
// person already editing this lesson; it must never be added to StudentView itself.
export default function PreviewView({ lesson, onClose, initialTaskId = null }) {
  const { user } = useAuth()
  const [currentTaskId, setCurrentTaskId] = useState(initialTaskId ?? null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [metaCollapsed, setMetaCollapsed] = useState(true)

  const flatTasks = flattenTasks(lesson?.tasks ?? [])
  const currentTask = flatTasks.find(t => t.id === currentTaskId) ?? null
  const intent = typeof currentTask?.intent === 'string' ? currentTask.intent.trim() : ''
  const taskActivity = typeof currentTask?.taskActivity === 'string' ? currentTask.taskActivity.trim() : ''
  const hasMeta = !!(intent || taskActivity)

  return (
    <div style={s.page}>
      <div style={s.banner}>
        <span style={s.bannerText}>This is a preview — changes are not saved</span>
        <div style={s.bannerActions}>
          <button className="btn-ghost" style={s.feedbackBtn} onClick={() => setShowFeedback(true)}>
            Feedback
          </button>
          <button className="btn-secondary" style={s.backBtn} onClick={() => onClose(currentTaskId)}>
            Go back to Builder
          </button>
        </div>
      </div>

      {hasMeta && (
        metaCollapsed ? (
          <CollapsedPanelRail
            onClick={() => setMetaCollapsed(false)}
            label="Authoring metadata"
            direction="down"
            orientation="horizontal"
            title="Show authoring metadata"
            ariaLabel="Show authoring metadata"
            style={s.metaRailCollapsed}
          />
        ) : (
          <AnimatedPanelShell animate>
            <div style={s.metaSection}>
              <div style={s.metaHeader}>
                <span style={s.metaHeaderLabel}>Authoring metadata (author-only)</span>
                <CollapseTabButton
                  onClick={() => setMetaCollapsed(true)}
                  direction="left"
                  title="Collapse authoring metadata"
                  ariaLabel="Collapse authoring metadata"
                  style={s.metaCollapseBtn}
                />
              </div>
              <div style={s.metaBody}>
                {intent && (
                  <div style={s.metaField}>
                    <span style={s.metaFieldLabel}>Authoring intent</span>
                    <MarkdownRenderer content={currentTask.intent} disableCopy />
                  </div>
                )}
                {taskActivity && (
                  <div style={s.metaField}>
                    <span style={s.metaFieldLabel}>Task activity</span>
                    <p style={s.metaFieldText}>{currentTask.taskActivity}</p>
                  </div>
                )}
              </div>
            </div>
          </AnimatedPanelShell>
        )
      )}

      <div style={s.studentWrap}>
        <StudentView
          lesson={lesson}
          soloMode
          allowUnrestrictedTaskNavigation
          previewMode
          initialTaskId={initialTaskId}
          onTaskChange={setCurrentTaskId}
        />
      </div>

      {showFeedback && (
        <TeacherFeedbackModal
          lessonId={lesson?.id ?? ''}
          lessonTitle={lesson?.title ?? ''}
          currentTaskId={currentTaskId}
          currentTaskTitle={currentTask?.title ?? null}
          teacherEmail={user?.email ?? ''}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  banner: {
    background: 'var(--colour-secondary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 40,
    flexShrink: 0,
    gap: 12,
  },
  bannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  bannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  metaRailCollapsed: {
    flexShrink: 0,
    margin: '10px 16px 0',
    width: 'auto',
  },
  metaSection: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    margin: '10px 16px 0',
    borderRadius: 8,
    border: '1px dashed #d8b4fe',
    background: '#faf5ff',
    maxHeight: '35vh',
  },
  metaBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 0,
    overflowY: 'auto',
  },
  metaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaHeaderLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--colour-primary)',
  },
  metaCollapseBtn: {
    width: 26,
    fontSize: 15,
  },
  metaField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  metaFieldLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.76rem',
    color: '#6b5b7d',
  },
  metaFieldText: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    lineHeight: 1.5,
  },
  feedbackBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  backBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  studentWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
