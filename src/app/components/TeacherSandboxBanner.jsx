import React, { useState, useEffect } from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'

export default function TeacherSandboxBanner({
  staging,
  onCancel,
  onReset,
  onGoLive,
  onPush,
  onDeactivate,
  sandboxExplainer,
  onPushExplainer,
  lessonType,
}) {
  const [explainerDraft, setExplainerDraft] = useState(sandboxExplainer ?? '')

  // Sync draft when the teacher re-opens sandbox after a previous session
  useEffect(() => {
    setExplainerDraft(sandboxExplainer ?? '')
  }, [sandboxExplainer])

  function handleGoLive() {
    if (explainerDraft) onPushExplainer(explainerDraft)
    onGoLive()
  }

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
              <button className="btn-primary teacher-sandbox-banner__btn" onClick={handleGoLive}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MarkdownFieldEditor
          value={explainerDraft}
          onChange={setExplainerDraft}
          ariaLabel="Sandbox explainer editor"
          placeholder="Optional: write an instruction or explainer for students…"
          height={180}
          minHeight={140}
          lessonType={lessonType}
        />
        {!staging && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-ghost teacher-sandbox-banner__btn"
              onClick={() => onPushExplainer(explainerDraft)}
            >
              Push Explainer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
