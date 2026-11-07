import React, { useMemo } from 'react'
import { getCodeLanguageLabel } from '../../shared/codeLanguages'
import { copyAnchorRows } from '../../shared/stageChange'
import { ChangeHunk } from './ChangeLines'

// `after` / `before`: the task's copyAfter / copyBefore, the exact text of the line the typed
// lines go after (or, for a change at the top, before). With one, the panel shows that line
// dimmed and the typed lines in green with +, like a Complete stage's change view. `starter`: the
// task's starter code (starterCodeOf); a typed line that only extends one of its lines shows only
// the extension (request 135).
export default function CopyCodePanel({ code, language = 'python', after, before, starter }) {
  const text = typeof code === 'string' ? code : ''
  const anchored = useMemo(
    () => copyAnchorRows({ code: text, after, before, starter }),
    [text, after, before, starter]
  )

  if (!text.trim()) return null

  const languageLabel = getCodeLanguageLabel(language)

  return (
    <section
      style={s.panel}
      aria-label={`${languageLabel} reference code`}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={s.header}>
        {/* Says what to do, not where it is: lesson text pointing at "the panel above" read
            wrongly beside the instructions. Lessons can name it: the "Type this out" box. */}
        <span style={s.title}>⌨️ Type this out</span>
      </div>
      {anchored ? (
        <div style={s.anchored}>
          <ChangeHunk anchor={anchored.anchor} rows={anchored.rows} />
        </div>
      ) : (
        <pre style={s.pre}>
          <code style={s.code}>{text}</code>
        </pre>
      )}
    </section>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    maxHeight: 240,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    marginBottom: 8,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 10px',
    background: '#eef2f7',
    borderBottom: '1px solid #cbd5e1',
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#334155',
    lineHeight: 1.2,
  },
  pre: {
    margin: 0,
    padding: '11px 12px',
    overflow: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.55,
    fontSize: 13,
    color: '#111827',
  },
  anchored: { minHeight: 0, overflow: 'auto', padding: '8px 0' },
  code: {
    fontFamily: 'var(--font-code)',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "calt" 0',
  },
}
