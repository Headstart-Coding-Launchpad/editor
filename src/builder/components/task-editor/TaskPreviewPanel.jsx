import React, { useState } from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import { AnimatedPanelShell, CollapsedPanelRail, CollapseTabButton } from '../../../app/components/CollapsiblePanelControls'

/**
 * Wraps the Builder's inline student/quiz preview. When a `task` is supplied, also renders a
 * teacher/author-only "Authoring metadata" section (intent + task activity) above the preview.
 * This section is never rendered outside the Builder, so it is never reachable by an actual student.
 */
export default function TaskPreviewPanel({ task = null, draft = false, children }) {
  const [metaCollapsed, setMetaCollapsed] = useState(() => draft !== true)
  const intent = typeof task?.intent === 'string' ? task.intent.trim() : ''
  const taskActivity = typeof task?.taskActivity === 'string' ? task.taskActivity.trim() : ''
  const hasMeta = !!(intent || taskActivity)

  return (
    <div className="te-preview-panel">
      <div className="te-preview-header">
        <span className="te-preview-title">Student preview</span>
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
            style={s.railSpacing}
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
                  style={s.collapseBtn}
                />
              </div>
              {intent && (
                <div style={s.metaField}>
                  <span style={s.metaFieldLabel}>Authoring intent</span>
                  <MarkdownRenderer content={task.intent} disableCopy />
                </div>
              )}
              {taskActivity && (
                <div style={s.metaField}>
                  <span style={s.metaFieldLabel}>Task activity</span>
                  <p style={s.metaFieldText}>{task.taskActivity}</p>
                </div>
              )}
            </div>
          </AnimatedPanelShell>
        )
      )}

      {children}
    </div>
  )
}

const s = {
  railSpacing: {
    marginBottom: 10,
  },
  metaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    border: '1px dashed #d8b4fe',
    background: '#faf5ff',
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
  collapseBtn: {
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
}
