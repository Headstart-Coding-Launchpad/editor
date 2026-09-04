import React from 'react'

export default function BuilderToolbar({
  dirty,
  role,
  errors,
  saveStatus,
  hasNoTasks,
  onNew,
  onUpload,
  onPreview,
  onPrint,
  onDownload,
  onSave,
  onBack,
}) {
  return (
    <header style={s.topBar}>
      <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {dirty && <span style={s.dirtyDot} title="Unsaved changes" />}

        {role === 'admin' && (
          <button className="btn-ghost" style={s.btn} onClick={onBack}>
            Back to Admin
          </button>
        )}
        <button className="btn-ghost" style={s.btn} onClick={onNew}>
          New
        </button>
        <button className="btn-ghost" style={s.btn} onClick={onUpload}>
          Upload
        </button>
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
              background:
                saveStatus === 'done' ? '#16a34a' : saveStatus === 'error' ? '#ef4444' : undefined,
            }}
            onClick={onSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'done'
                ? 'Saved ✓'
                : saveStatus === 'error'
                  ? 'Save failed ✕'
                  : 'Save'}
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
  btn: { fontSize: 13, padding: '5px 12px' },
  btnPrimary: { fontSize: 13, padding: '5px 14px' },
}
