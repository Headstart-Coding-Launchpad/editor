import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function CheckFeedbackBanner({
  passed,
  failureMessage = 'Not quite, try again!',
  successMessage = 'Correct!',
  suggestion,
  onShowCodeStage,
  onPreviewCompleteCode,
  onShowCompleteCode,
  onGoPersonalSandbox,
  onNeedHelp,
}) {
  const hint = String(suggestion ?? '').trim()

  return (
    <div style={{ ...s.banner, ...(passed ? s.pass : s.fail) }} role="status">
      <span style={{ ...s.icon, background: passed ? '#166534' : '#92400e' }}>{passed ? '✓' : '!'}</span>
      <div style={s.text}>
        {passed ? successMessage : (
          hint
            ? <MarkdownRenderer content={hint} style={{ color: 'inherit', fontSize: 'inherit' }} />
            : <div>{failureMessage}</div>
        )}
      </div>
      {!passed && onShowCodeStage && (
        <span style={s.completePrompt}>Want a hint?</span>
      )}
      {!passed && onShowCodeStage && (
        <button type="button" style={s.actionLink} onClick={onShowCodeStage}>
          Move to next stage
        </button>
      )}
      {!passed && onPreviewCompleteCode && (
        <span style={s.completePrompt}>Want to see the complete code?</span>
      )}
      {!passed && onPreviewCompleteCode && (
        <button type="button" style={s.actionLink} onClick={onPreviewCompleteCode}>
          See complete code
        </button>
      )}
      {!passed && onShowCompleteCode && (
        <span style={s.completePrompt}>Ready to use it?</span>
      )}
      {!passed && onShowCompleteCode && (
        <button type="button" style={s.actionLink} onClick={onShowCompleteCode}>
          Load complete code into my editor
        </button>
      )}
      {!passed && onNeedHelp && (
        <button type="button" style={s.helpBtn} onClick={onNeedHelp}>
          Need Help
        </button>
      )}
      {passed && onGoPersonalSandbox && (
        <button type="button" style={s.sandboxLink} onClick={onGoPersonalSandbox}>
          Test further in Personal Sandbox
        </button>
      )}
    </div>
  )
}

const s = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    fontWeight: 700,
  },
  pass: {
    background: '#dcfce7',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  fail: {
    background: '#fffbeb',
    borderColor: '#fde68a',
    color: '#92400e',
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
  suggestion: {
    fontWeight: 600,
    lineHeight: 1.35,
  },
  completePrompt: {
    flexShrink: 1,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: '#92400e',
  },
  actionLink: {
    flexShrink: 0,
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
  helpBtn: {
    flexShrink: 0,
    background: '#f59e0b',
    border: 'none',
    padding: '5px 12px',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#fff',
    cursor: 'pointer',
  },
}
