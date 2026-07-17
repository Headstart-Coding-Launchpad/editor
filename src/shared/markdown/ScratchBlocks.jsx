import React from 'react'

function darkenColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 45)
  const g = Math.max(0, ((num >> 8) & 0xff) - 45)
  const b = Math.max(0, (num & 0xff) - 45)
  return `rgb(${r},${g},${b})`
}

function contrastTextColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = num >> 16
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.58 ? '#1f2937' : '#ffffff'
}

function categorize(text) {
  const t = text.trim().toLowerCase()
  const unwrapped = t.replace(/^<+\s*/, '').replace(/\s*>+$/, '').trim()
  if (!t) return null

  if (t.startsWith('when ')) return { color: '#FFAB19', hat: true }
  if (t.startsWith('broadcast ')) return { color: '#FFAB19' }

  if (t.startsWith('wait ') || t === 'stop all') return { color: '#FFAB19' }
  if (
    t === 'forever' || t.startsWith('repeat ') ||
    (t.startsWith('if ') && t.includes(' then')) || t === 'else'
  ) return { color: '#FFAB19', c: true }
  if (t === 'end') return null

  if (
    t === 'x position' || t === 'y position' || t === 'direction' ||
    t.startsWith('move ') || t.startsWith('turn ') || t.startsWith('go to') ||
    t.startsWith('glide ') || t === 'if on edge, bounce' ||
    t.startsWith('point in direction') ||
    t.startsWith('set rotation style') ||
    t.startsWith('set x') || t.startsWith('set y') ||
    t.startsWith('change x by') || t.startsWith('change y by')
  ) return { color: '#4C97FF' }

  if (
    t.startsWith('say ') || t.startsWith('think ') ||
    t === 'show' || t === 'hide' ||
    t.startsWith('set size') || t.startsWith('change size') ||
    (t.startsWith('set ') && t.includes(' effect')) ||
    (t.startsWith('change ') && t.includes(' effect')) ||
    t === 'clear graphic effects' ||
    t.startsWith('switch costume') || t === 'next costume' ||
    t.startsWith('costume [') || t.startsWith('backdrop [') ||
    t.startsWith('switch backdrop') || t === 'next backdrop'
  ) return { color: '#9966FF' }

  if (t.startsWith('play sound') || t.startsWith('start sound') || t === 'stop all sounds') {
    return { color: '#CF63CF' }
  }

  if (t.startsWith('ask ') && t.endsWith(' and wait')) return { color: '#5CB1D6' }
  if (
    t === 'answer' || t === 'mouse down?' || t === 'touching edge?' ||
    (t.startsWith('touching ') && t.endsWith('?')) ||
    /^key\s+.+\s+pressed\?$/.test(t) ||
    t === 'timer' || t === 'reset timer' ||
    t.startsWith('distance to ')
  ) return { color: '#5CB1D6' }

  if (
    t === 'join' || t.startsWith('join ') ||
    t.startsWith('not ') ||
    t.startsWith('round ') ||
    t.startsWith('letter ') ||
    t.startsWith('length of') ||
    t.includes(' contains ') || t.endsWith(' contains') ||
    /\bmod\b/.test(t) ||
    /\s[+\-=<>*/]\s/.test(t) ||
    /\s(?:and|or)\s/.test(t) ||
    /\s[+\-=<>*/]\s/.test(unwrapped) ||
    /\s(?:and|or)\s/.test(unwrapped) ||
    /^(abs|floor|ceiling|sqrt|sin|cos|tan|asin|acos|atan|ln|log)\s+of\b/.test(t)
  ) return { color: '#59C059' }

  if (/^set\s+(?:\[[^\]]+\]|\S+)\s+to\b/.test(t)) return { color: '#FF8C1A' }
  if (/^change\s+(?:\[[^\]]+\]|\S+)\s+by\b/.test(t)) return { color: '#FF8C1A' }
  if (t.startsWith('show variable') || t.startsWith('hide variable')) return { color: '#FF8C1A' }

  return null
}

function renderBlockText(text) {
  const parts = text.split(/(<<\s*[^<>]*\s*>>|<\s*[^<>]*\s[=<>]\s[^<>]*>|\([^)]*\)|\[[^\]]*\]|\b\d+(?:\.\d+)?\b|"[^"]*"|'[^']*')/g)
  return parts.map((part, i) => {
    const isNum = /^\d+(?:\.\d+)?$/.test(part)
    const isStr = /^["'].*["']$/.test(part)
    const isInput = /^\([^)]*\)$/.test(part) || /^\[[^\]]*\]$/.test(part)
    const isCondition = /^<<\s*.*\s*>>$/.test(part) || /^<\s*.*\s[=<>]\s.*>$/.test(part)
    if (isNum || isStr || isInput || isCondition) {
      const label = isStr || isInput
        ? part.slice(1, -1)
        : isCondition
          ? part.replace(/^<+\s*/, '').replace(/\s*>+$/, '')
          : part
      const isAnswer = isInput && label.trim().toLowerCase() === 'answer'
      const background = isCondition ? '#59C059' : isAnswer ? '#5CB1D6' : 'rgba(255,255,255,0.28)'
      return (
        <span
          key={i}
          style={{
            background,
            color: isCondition || isAnswer ? '#fff' : '#1f2937',
            borderRadius: '999px',
            padding: isCondition ? '1px 8px' : '0 5px',
            margin: '0 1px',
            boxShadow: isCondition || isAnswer ? `0 2px 0 ${darkenColor(background)}` : undefined,
          }}
        >
          {isCondition ? renderBlockText(label) : label}
        </span>
      )
    }
    return part
  })
}

export function InlineScratchBlock({ text }) {
  const info = categorize(text) ?? { color: '#7c7c7c' }
  const shadow = darkenColor(info.color)
  const textColor = contrastTextColor(info.color)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        background: info.color,
        borderRadius: info.hat ? '10px 10px 2px 2px' : '3px',
        padding: '1px 8px',
        color: textColor,
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 700,
        fontSize: '0.82em',
        lineHeight: 1.5,
        boxShadow: `0 2px 0 ${shadow}`,
        verticalAlign: 'middle',
        cursor: 'default',
        userSelect: 'none',
        position: 'relative',
        top: '-1px',
      }}
    >
      {renderBlockText(text)}
      {info.c && <span style={{ opacity: 0.65, fontSize: '10px' }}>{'\u25be'}</span>}
    </span>
  )
}

function ScratchBlock({ text, color, hat, c }) {
  const shadow = darkenColor(color)
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: color,
        borderRadius: hat ? '18px 18px 3px 3px' : '3px',
        padding: '5px 12px',
        color: 'white',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 700,
        fontSize: '13px',
        lineHeight: 1.3,
        boxShadow: `0 3px 0 ${shadow}`,
        cursor: 'default',
        userSelect: 'none',
        flexWrap: 'wrap',
      }}
    >
      {!hat && (
        <span
          style={{
            position: 'absolute',
            top: -5,
            left: 10,
            width: 18,
            height: 6,
            background: color,
            borderRadius: '3px 3px 0 0',
          }}
        />
      )}
      {renderBlockText(text)}
      {c && (
        <span style={{ marginLeft: 4, opacity: 0.65, fontSize: '11px' }}>{'\u25be'}</span>
      )}
    </div>
  )
}

export function ScratchBlocks({ code }) {
  const lines = code.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '10px 0' }}>
      {lines.map((line, i) => {
        const text = line.trim()
        if (!text) return null
        const leadingSpaces = line.length - line.trimStart().length
        const indentLevel = Math.floor(leadingSpaces / 2)
        const info = categorize(text) ?? (text.toLowerCase() === 'end' ? null : { color: '#7c7c7c' })
        if (!info) return null
        return (
          <div key={i} style={{ paddingLeft: indentLevel > 0 ? indentLevel * 16 + 8 : 0 }}>
            <ScratchBlock text={text} color={info.color} hat={info.hat} c={info.c} />
          </div>
        )
      })}
    </div>
  )
}

export function looksLikeScratchBlocks(code) {
  const lines = code.split('\n').map(line => line.trim()).filter(Boolean)
  return lines.length > 0 && lines.every(line => line.toLowerCase() === 'end' || Boolean(categorize(line)))
}
