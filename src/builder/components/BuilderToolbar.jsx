import React from 'react'

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }

const STAGE_TRANSITIONS = {
  ideas:    [{ label: 'Move to Details', next: 'details', primary: true }],
  details:  [{ label: 'Submit for Review', next: 'review', primary: true }],
  review:   [{ label: 'Request Changes', next: 'details', primary: false }, { label: 'Approve', next: 'approved', primary: true }],
  approved: [{ label: 'Mark Published', next: 'published', primary: true }],
  published: [],
}

export default function BuilderToolbar({
  dirty,
  role,
  errors,
  publishStatus,
  hasNoTasks,
  stage,
  onSetStage,
  onNew,
  onUpload,
  onPreview,
  onPrint,
  onDownload,
  onPublish,
  onBack,
}) {
  const currentStage = stage ?? 'published'
  const stageColor = STAGE_COLORS[currentStage] ?? '#6b7280'
  const stageLabel = STAGE_LABELS[currentStage] ?? currentStage
  const transitions = STAGE_TRANSITIONS[currentStage] ?? []

  return (
    <header style={s.topBar}>
      <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {dirty && <span style={s.dirtyDot} title="Unsaved changes" />}

        <span style={{ ...s.stageBadge, background: stageColor }}>
          {stageLabel}
        </span>

        {transitions.map(({ label, next, primary }) => (
          <button
            key={next}
            type="button"
            className={primary ? 'btn-primary' : 'btn-ghost'}
            style={primary ? { ...s.btnPrimary, background: STAGE_COLORS[next] } : s.btn}
            onClick={() => onSetStage?.(next)}
          >
            {label}
          </button>
        ))}

        {role === 'admin' && (
          <button className="btn-ghost" style={s.btn} onClick={onBack}>
            Back to Admin
          </button>
        )}
        <button className="btn-ghost" style={s.btn} onClick={onNew}>New</button>
        <button className="btn-ghost" style={s.btn} onClick={onUpload}>Upload</button>
        <button
          className="btn-ghost"
          style={s.btn}
          onClick={onPreview}
          disabled={hasNoTasks}
          title={hasNoTasks ? 'Add at least one task to preview' : 'Preview as student'}
        >
          Preview
        </button>
        <button
          className="btn-ghost"
          style={s.btn}
          onClick={onPrint}
          disabled={hasNoTasks}
          title={hasNoTasks ? 'Add at least one task to print' : 'Print lesson reference'}
        >
          Print
        </button>
        <button
          className="btn-primary"
          style={s.btnPrimary}
          onClick={onDownload}
          disabled={errors.length > 0}
        >
          Download JSON
        </button>
        {role === 'admin' && (
          <button
            className="btn-primary"
            style={{
              ...s.btnPrimary,
              background: publishStatus === 'done' ? '#16a34a' : publishStatus === 'error' ? '#ef4444' : undefined,
            }}
            onClick={onPublish}
            disabled={errors.length > 0 || publishStatus === 'publishing'}
          >
            {publishStatus === 'publishing' ? 'Publishing…'
              : publishStatus === 'done' ? 'Published ✓'
              : publishStatus === 'error' ? 'Publish failed ✕'
              : 'Publish to Firestore'}
          </button>
        )}
      </div>
    </header>
  )
}

const s = {
  topBar: {
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 52,
    flexShrink: 0,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#ffffff',
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--colour-secondary)',
    display: 'inline-block',
  },
  stageBadge: {
    padding: '3px 9px',
    borderRadius: 5,
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btn: { fontSize: 13, padding: '5px 12px' },
  btnPrimary: { fontSize: 13, padding: '5px 14px' },
}
