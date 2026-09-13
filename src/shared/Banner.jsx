import React from 'react'

function hexToRgb(hex) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '0,0,0'
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

export default function Banner({ accent, color, style, children }) {
  const rgb = hexToRgb(accent)
  return (
    <div
      style={{
        background: `rgba(${rgb},0.08)`,
        borderBottom: `1px solid rgba(${rgb},0.2)`,
        padding: '8px 16px',
        fontSize: 13,
        color,
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'var(--font-body)',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
