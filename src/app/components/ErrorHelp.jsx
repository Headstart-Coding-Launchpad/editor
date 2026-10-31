import React, { useMemo, useState } from 'react'
import { ERROR_RUNG_LABELS, explainPythonError } from '../../shared/pythonErrors.js'
import { MarkdownRenderer } from '../../shared/markdown'

/**
 * Plain-words help under a crashed run's output (Hub #225; src/shared/pythonErrors.js): what
 * went wrong and where, then a hint ladder the child opens one rung at a time: where to look,
 * the idea, an example with comments, and the fix last. The raw Python error stays in the
 * output above. Renders nothing for an error we have no help for. Remount it (key) for each
 * new error so the ladder starts closed again.
 */
export default function ErrorHelp({ output, code }) {
  const help = useMemo(() => explainPythonError(output, { code }), [output, code])
  const [open, setOpen] = useState(0)
  if (!help) return null
  const last = help.rungs.length
  const nextLabel =
    open === 0 ? 'Give me a clue' : open === last - 1 ? 'Show me the fix' : 'Another clue'
  return (
    <div style={s.wrap} data-testid="error-help" role="note" aria-label="What went wrong">
      <div style={s.title}>
        <span aria-hidden="true">⚠</span> {help.title}
        {help.line ? <span style={s.line}> · line {help.line}</span> : null}
      </div>
      {open > 0 && (
        <ol style={s.rungs}>
          {help.rungs.slice(0, open).map((rung, i) => (
            <li key={i} style={s.rung} data-testid={`error-help-rung-${i}`}>
              <span style={s.label}>{ERROR_RUNG_LABELS[i]}</span>
              <MarkdownRenderer content={rung} topicType={null} disableCopy showLibrary={false} />
            </li>
          ))}
        </ol>
      )}
      {open < last && (
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.more}
          onClick={() => setOpen((n) => Math.min(n + 1, last))}
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    margin: '8px',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--colour-error-edge)',
    background: 'var(--colour-error-bg)',
    color: 'var(--colour-error-text)',
    fontSize: '0.95rem',
  },
  title: { fontWeight: 700 },
  line: { fontWeight: 400 },
  rungs: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  rung: { color: 'var(--colour-ink-strong)' },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    color: 'var(--colour-error-text)',
  },
  more: { alignSelf: 'flex-start', minHeight: 36, fontSize: '0.9rem' },
}
