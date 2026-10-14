// Small read-only pieces the module share viewers (`/share/:id`) are built from.
import { CodeEditor } from '../CodeEditor'

export function ShareCode({ code, language = 'python', title = 'Code' }) {
  return (
    <section style={s.panel} aria-label={title}>
      <h2 style={s.heading}>{title}</h2>
      <div style={s.editor}>
        <CodeEditor value={code ?? ''} language={language} readOnly />
      </div>
    </section>
  )
}

export function ShareOutput({ output, title = 'Output' }) {
  if (!output) return null
  return (
    <section style={s.panel} aria-label={title}>
      <h2 style={s.heading}>{title}</h2>
      <pre style={s.output}>{output}</pre>
    </section>
  )
}

export function SharePanel({ title, children }) {
  return (
    <section style={s.panel} aria-label={title}>
      {title && <h2 style={s.heading}>{title}</h2>}
      {children}
    </section>
  )
}

export const shareStyles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
    gap: 16,
    alignItems: 'start',
  },
}

const s = {
  panel: {
    background: 'var(--colour-surface, #fff)',
    border: '1px solid var(--colour-border, #e5e7eb)',
    borderRadius: 10,
    padding: 12,
    minWidth: 0,
  },
  heading: {
    margin: '0 0 8px',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-title)',
  },
  editor: {
    border: '1px solid var(--colour-border, #e5e7eb)',
    borderRadius: 6,
    overflow: 'auto',
    maxHeight: '70vh',
  },
  output: {
    margin: 0,
    padding: 10,
    background: '#111827',
    color: '#e5e7eb',
    borderRadius: 6,
    maxHeight: 320,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.85rem',
  },
}
