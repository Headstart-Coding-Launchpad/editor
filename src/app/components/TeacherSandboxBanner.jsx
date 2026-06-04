import React, { useState, useEffect } from 'react'

export default function TeacherSandboxBanner({
  staging,
  onCancel,
  onReset,
  onGoLive,
  onPush,
  onDeactivate,
  sandboxExplainer,
  onPushExplainer,
}) {
  const [explainerDraft, setExplainerDraft] = useState(sandboxExplainer ?? '')

  // Sync draft when the teacher re-opens sandbox after a previous session
  useEffect(() => {
    setExplainerDraft(sandboxExplainer ?? '')
  }, [sandboxExplainer])

  return (
    <div className="teacher-sandbox-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className="teacher-sandbox-banner__text">
          {staging
            ? 'Sandbox preview — students are still on the lesson'
            : 'Sandbox is LIVE — students can see this'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {staging ? (
            <>
              <button className="btn-ghost teacher-sandbox-banner__btn teacher-sandbox-banner__btn--warn" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn-ghost teacher-sandbox-banner__btn teacher-sandbox-banner__btn--warn" onClick={onReset}>
                Reset to Sandbox Starter
              </button>
              <button className="btn-primary teacher-sandbox-banner__btn" onClick={onGoLive}>
                Go Live &amp; Send to Students
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary teacher-sandbox-banner__btn" onClick={onPush}>
                Push to All
              </button>
              <button className="btn-ghost teacher-sandbox-banner__btn" onClick={onReset}>
                Reset to Sandbox Starter
              </button>
              <button className="btn-danger teacher-sandbox-banner__btn" onClick={onDeactivate}>
                Deactivate Sandbox
              </button>
            </>
          )}
        </div>
      </div>
      {!staging && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            className="sandbox-explainer-input"
            placeholder="Optional: type an explainer or instruction for students…"
            value={explainerDraft}
            onChange={e => setExplainerDraft(e.target.value)}
            rows={2}
          />
          <button
            className="btn-ghost teacher-sandbox-banner__btn"
            style={{ flexShrink: 0 }}
            onClick={() => onPushExplainer(explainerDraft)}
          >
            Push Explainer
          </button>
        </div>
      )}
    </div>
  )
}
