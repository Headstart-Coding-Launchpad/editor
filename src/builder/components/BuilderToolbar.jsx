import React from 'react'

export default function BuilderToolbar({
  dirty,
  role,
  advanced = false,
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
  user = null,
  onAccount,
}) {
  return (
    <header style={s.topBar}>
      <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {dirty && <span style={s.dirtyDot} title="Unsaved changes" />}

        <button className="btn-ghost" style={s.btn} onClick={onBack}>
          {role === 'admin' ? '← Back to Admin' : '← Back to app'}
        </button>
        {user && (
          <button className="btn-ghost" style={s.btn} onClick={onAccount}>
            Account
          </button>
        )}
        <button className="btn-ghost" style={s.btn} onClick={onNew}>
          All lessons
        </button>
        {advanced && (
          <button className="btn-ghost" style={s.btn} onClick={onUpload}>
            Upload file
          </button>
        )}
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
          Download lesson file
        </button>
        {role === 'admin' && (
          <button
            className={
              saveStatus === 'done'
                ? 'btn-success'
                : saveStatus === 'error'
                  ? 'btn-danger'
                  : 'btn-primary'
            }
            style={s.btnPrimary}
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
