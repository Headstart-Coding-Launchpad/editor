import React, { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { HELP_BUTTON_LABEL } from './peerHelp/helpLabel'

// Auto-dismiss delay for the popup — long enough to read, short enough not to linger
// and block the workspace behind it once a student has moved on.
const AUTO_DISMISS_MS = 45000

export default function CheckFeedbackBanner({
  passed,
  failureMessage = 'Not quite, try again!',
  successMessage = 'Correct!',
  suggestion,
  onShowCodeStage,
  stageActionLabel = 'Move to next stage',
  stageActionConfirm,
  onPreviewCompleteCode,
  onShowCompleteCode,
  // The load button's words: a Complete stage's change view shows only part of the code, so
  // there it reads "Replace my code with this" (it still loads the whole stage).
  showCompleteCodeLabel = 'Load complete code into my editor',
  onGoPersonalSandbox,
  // The tutor's own "Send hint": a calm 💡 note from the tutor, not a failed check.
  fromTutor = false,
  // Close a pass banner now (the bonus quest card has taken its place, at its 10s cap). It stays
  // closed until the next check remounts the banner.
  closeIfPassed = false,
  // Told whether a pass banner is on screen (true), or has gone (false: closed, timed out,
  // unmounted), so the bonus quest card can wait for it.
  onPassShownChange,
  // Docked in the page (the calm Scratch screen's hint, ScratchHintDock) instead of a popup: no
  // auto-dismiss, no ×, no "Still stuck?" line. `help` ({ onAsk, requested }, only where the
  // top-bar Help shows) adds an "✋ Ask for help" button instead.
  docked = false,
  help = null,
}) {
  const hint = String(suggestion ?? '').trim()
  const [dismissed, setDismissed] = useState(false)

  // Callers remount this component (via a `key` tied to the check result) whenever a new
  // check/stage event actually happens, so this timer — and any earlier dismissal — is
  // naturally reset for a genuinely new popup rather than carried over from a stale one.
  useEffect(() => {
    if (docked) return undefined
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [docked])

  useEffect(() => {
    if (closeIfPassed && passed) setDismissed(true)
  }, [closeIfPassed, passed])

  const passShown = !!passed && !fromTutor && !dismissed
  const onPassShownChangeRef = useRef(onPassShownChange)
  onPassShownChangeRef.current = onPassShownChange
  useEffect(() => {
    onPassShownChangeRef.current?.(passShown)
  }, [passShown])
  useEffect(() => () => onPassShownChangeRef.current?.(false), [])

  if (dismissed) return null

  // Motion: a fail banner wobbles each time it appears; a pass banner pops in while its ✓ spins
  // once. Callers remount this per check (see above), which replays the one-shot class.
  return (
    <div
      className={`${docked ? '' : 'check-feedback-popup '}${passed || fromTutor ? 'motion-pop-in' : 'motion-wobble'}`}
      style={{
        ...s.banner,
        ...(docked ? s.docked : null),
        ...(passed ? s.pass : fromTutor ? s.tutor : s.fail),
      }}
      role="status"
    >
      {!docked && (
        <button
          type="button"
          style={s.closeBtn}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
      <div style={s.row}>
        <span
          className={passed ? 'motion-spin-once' : undefined}
          style={{
            ...s.icon,
            background: passed ? '#166534' : fromTutor ? '#1e40af' : '#92400e',
          }}
        >
          {passed ? '✓' : fromTutor ? '💡' : '!'}
        </span>
        <div style={s.text}>
          {fromTutor && !passed && <div style={s.tutorLabel}>Hint from your tutor</div>}
          {passed ? (
            <>
              <div>{successMessage}</div>
              {hint && (
                <MarkdownRenderer
                  content={hint}
                  style={{ color: 'inherit', fontSize: '0.9em', fontWeight: 600 }}
                />
              )}
            </>
          ) : hint ? (
            <MarkdownRenderer content={hint} style={{ color: 'inherit', fontSize: 'inherit' }} />
          ) : (
            <div>{failureMessage}</div>
          )}
        </div>
      </div>
      {!passed && onShowCodeStage && (
        <div style={s.actionRow}>
          <span style={s.completePrompt}>Want a hint?</span>
          <button
            type="button"
            style={s.actionLink}
            onClick={() => {
              if (!stageActionConfirm || window.confirm(stageActionConfirm)) onShowCodeStage()
            }}
          >
            {stageActionLabel}
          </button>
        </div>
      )}
      {!passed && onPreviewCompleteCode && (
        <div style={s.actionRow}>
          <span style={s.completePrompt}>Want to see the complete code?</span>
          <button type="button" style={s.actionLink} onClick={onPreviewCompleteCode}>
            See complete code
          </button>
        </div>
      )}
      {!passed && onShowCompleteCode && (
        <div style={s.actionRow}>
          <span style={s.completePrompt}>Ready to use it?</span>
          <button type="button" style={s.actionLink} onClick={onShowCompleteCode}>
            {showCompleteCodeLabel}
          </button>
        </div>
      )}
      {!passed && !docked && (
        <span style={s.helpNote}>
          Still stuck? Tap “{HELP_BUTTON_LABEL}” at the top of the page.
        </span>
      )}
      {!passed && docked && help && <AskForHelpButton help={help} />}
      {passed && onGoPersonalSandbox && (
        <button type="button" style={s.sandboxLink} onClick={onGoPersonalSandbox}>
          Test further in Personal Sandbox
        </button>
      )}
    </div>
  )
}

export const ASK_FOR_HELP_LABEL = '✋ Ask for help'
export const HELP_REQUESTED_LABEL = '✋ Help requested'

// The student's ✋ Help away from the top bar (the calm screen's docked hint): `help.onAsk` is the
// very handler the top-bar Help button calls; once asked it reads "Help requested".
export function AskForHelpButton({ help, style }) {
  return (
    <button
      type="button"
      style={{ ...s.askHelp, ...style }}
      onClick={help.onAsk}
      disabled={!!help.requested}
    >
      {help.requested ? HELP_REQUESTED_LABEL : ASK_FOR_HELP_LABEL}
    </button>
  )
}

const s = {
  // In the page, not floating: no shadow, no room kept for the ×.
  docked: {
    position: 'relative',
    padding: '12px 14px',
    boxShadow: 'none',
    borderRadius: 10,
  },
  askHelp: {
    alignSelf: 'flex-start',
    minHeight: 44,
    padding: '6px 12px',
    border: '1px solid currentColor',
    borderRadius: 8,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 14,
    color: 'inherit',
    cursor: 'pointer',
  },
  // Floating and out of document flow, so it never affects page layout, and auto-dismisses
  // (see AUTO_DISMISS_MS). Where it sits lives in `.check-feedback-popup` (src/index.css):
  // the bottom-left corner, clear of the Run button, the file tabs, the top of the student's
  // code and the output, and smaller on a tablet. Bottom-right is kept for peer help.
  banner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 34px 12px 14px',
    borderRadius: 12,
    border: '1px solid',
    boxShadow: '0 12px 32px rgba(15,23,42,0.2)',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
  },
  pass: {
    background: '#dcfce7',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  tutor: {
    background: '#eff6ff',
    borderColor: '#bfdbfe',
    color: '#1e3a8a',
  },
  tutorLabel: {
    fontSize: '0.8em',
    fontWeight: 700,
    marginBottom: 2,
  },
  fail: {
    background: '#fffbeb',
    borderColor: '#fde68a',
    color: '#92400e',
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 8,
    background: 'none',
    border: 'none',
    padding: 4,
    lineHeight: 1,
    fontSize: '1.15rem',
    color: 'inherit',
    opacity: 0.6,
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontSize: '0.86rem',
    lineHeight: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  completePrompt: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: '#92400e',
  },
  actionLink: {
    background: 'none',
    border: 'none',
    padding: '2px 0',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#92400e',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  sandboxLink: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    padding: '2px 0',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#166534',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  helpNote: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.8rem',
    color: '#92400e',
    opacity: 0.85,
  },
}
