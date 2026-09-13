import React from 'react'

const messageStyles = {
  muted: { color: '#9ca3af' },
  error: { color: '#dc2626' },
}

export function AdminSection({ title, subtitle, children, as: Component = 'section', style }) {
  return (
    <Component style={{ ...styles.section, ...style }}>
      {(title || subtitle) && (
        <div style={styles.titleRow}>
          {title && <h2 style={styles.title}>{title}</h2>}
          {subtitle && <span style={styles.subtitle}>{subtitle}</span>}
        </div>
      )}
      {children}
    </Component>
  )
}

export function AdminTable({ headers, children, colgroup, style }) {
  return (
    <table style={{ ...styles.table, ...style }}>
      {colgroup}
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={header || `col-${index}`} style={styles.th}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function AdminCell({ children, style, colSpan }) {
  return (
    <td style={{ ...styles.td, ...style }} colSpan={colSpan}>
      {children}
    </td>
  )
}

export function AdminMessage({ tone = 'muted', children }) {
  return (
    <p style={{ ...styles.message, ...(messageStyles[tone] || messageStyles.muted) }}>{children}</p>
  )
}

export function AdminBadge({ children, style }) {
  return <span style={{ ...styles.badge, ...style }}>{children}</span>
}

export function AdminLessonIdPill({ children }) {
  return <span style={styles.lessonIdPill}>{children}</span>
}

export const adminUiStyles = {
  lessonCell: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn: { padding: '4px 10px', fontSize: '0.82rem' },
  filterInput: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    padding: '7px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    maxWidth: 320,
  },
  strongText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
  },
  linkText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--colour-primary)',
    textDecoration: 'none',
  },
}

const styles = {
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  titleRow: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  subtitle: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#6b7280' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  message: { fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  lessonIdPill: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.75rem',
    color: '#6b7280',
    background: '#f3f4f6',
    borderRadius: 4,
    padding: '1px 6px',
  },
}
