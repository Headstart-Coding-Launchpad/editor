import React from 'react'
import { findScratchBlock, scratchBlockBadgeIcon, scratchBlockTextWithoutIcon } from '../scratchBlockCatalog'

const BODY_H = 38
const HAT_H = 42
const INLINE_H = 36
const CONNECTOR_H = 7
const CONTENT_TOP_INSET = 4
const NOTCH_X = 17
const NOTCH_W = 30
const MOUTH_X = 15
const MOUTH_PAD_TOP = 2
const MOUTH_PAD_BOTTOM = 0
const MOUTH_MIN_H = 34
const ELSE_H = 33
const FOOTER_H = 13
const C_MIN_W = 185
const ROOT_GAP = 9
const C_CHILD_X = 14
const OPERATOR_COLOR = '#59C059'
const TEXT_SHADOW_OPERATORS = new Set(['operator_equals', 'operator_join', 'operator_contains'])
const ICON_BADGE_SIZE = 24
const INLINE_ICON_BADGE_SIZE = 20

function darkenColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 45)
  const g = Math.max(0, ((num >> 8) & 0xff) - 45)
  const b = Math.max(0, (num & 0xff) - 45)
  return `rgb(${r},${g},${b})`
}

function outlineFor(color) {
  return darkenColor(color)
}

function fieldColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - 22)
  const g = Math.max(0, ((num >> 8) & 0xff) - 22)
  const b = Math.max(0, (num & 0xff) - 22)
  return `rgb(${r},${g},${b})`
}

function fallbackInfo() {
  return { opcode: 'unknown', color: '#7c7c7c', shape: 'stack', category: 'Unknown' }
}

function scratchFont(size = '13px') {
  return {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.25,
  }
}

function estimateTextWidth(text, size = 13) {
  // Quicksand's rounded, bold glyphs are wider than a simple monospace-style
  // estimate. Leave a small safety margin so SVG block bodies never end before
  // their HTML text and input overlays.
  return String(text ?? '').length * size * 0.64
}

function findBalanced(text, start, open, close) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      if (open === '<' && close === '>' && /\s/.test(text[i - 1] ?? '') && /\s/.test(text[i + 1] ?? '')) {
        continue
      }
      depth--
      if (depth === 0) {
        return { content: text.slice(start + 1, i), end: i }
      }
    }
  }
  return null
}

function hostColorOf(hostInfo) {
  return typeof hostInfo === 'string' ? hostInfo : hostInfo?.color ?? '#7c7c7c'
}

function blockTextParts(text, depth = 0, hostInfo = fallbackInfo()) {
  const parts = []
  let buffer = ''
  const hostColor = hostColorOf(hostInfo)

  function flush() {
    if (buffer) {
      parts.push({ type: 'text', text: buffer })
      buffer = ''
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '[') {
      const found = findBalanced(text, i, '[', ']')
      if (found) {
        flush()
        parts.push({ type: 'slot', kind: 'dropdown', content: found.content, depth, hostColor, key: `slot-${i}` })
        i = found.end
        continue
      }
    }
    if (char === '(') {
      const found = findBalanced(text, i, '(', ')')
      if (found) {
        flush()
        parts.push({ type: 'slot', kind: 'value', content: found.content, depth, hostColor, key: `slot-${i}` })
        i = found.end
        continue
      }
    }
    if (char === '<') {
      const found = findBalanced(text, i, '<', '>')
      if (found) {
        flush()
        parts.push({ type: 'slot', kind: 'condition', content: found.content, depth, hostColor, key: `slot-${i}` })
        i = found.end
        continue
      }
    }
    buffer += char
  }

  flush()
  return parts
}

function booleanMinWidth(info, inline) {
  if (info?.opcode === 'operator_equals' || info?.opcode === 'operator_gt' || info?.opcode === 'operator_lt') {
    return inline ? 0 : 92
  }
  if (info?.opcode === 'operator_not') return inline ? 78 : 88
  if (info?.opcode === 'operator_and' || info?.opcode === 'operator_or') return inline ? 118 : 128
  if (info?.opcode === 'operator_contains') return inline ? 142 : 152
  return inline ? 96 : 106
}

function booleanExtraWidth(info) {
  if (info?.opcode === 'operator_equals' || info?.opcode === 'operator_gt' || info?.opcode === 'operator_lt') return 28
  if (info?.opcode === 'operator_not') return 34
  return 42
}

function contentPaddingFor(shape, info) {
  if (shape !== 'boolean') return 13
  if (info?.opcode === 'operator_equals' || info?.opcode === 'operator_gt' || info?.opcode === 'operator_lt') return 14
  return 18
}

function contentTopFor(shape) {
  return shape === 'stack' || shape === 'hat' || shape === 'cap' || shape === 'c'
    ? CONTENT_TOP_INSET
    : 0
}

function minimumBlockWidth(shape, info, inline) {
  if (shape === 'boolean') return booleanMinWidth(info, inline)
  if (shape === 'hat') return inline ? 68 : 88
  if (shape === 'reporter') return inline ? 48 : 60
  return inline ? 48 : 60
}

function useMeasuredBlockWidth(rowRef, fallbackWidth, minimumWidth, horizontalPadding, dependencies) {
  const [width, setWidth] = React.useState(fallbackWidth)

  React.useLayoutEffect(() => {
    let active = true
    const measure = () => {
      // offsetWidth is an untransformed layout measurement. Quiz answers apply a
      // visual scale to their Scratch content; getBoundingClientRect() would
      // include that scale here and cause the SVG width to grow a second time.
      const rowWidth = rowRef.current?.offsetWidth ?? 0
      if (!rowWidth || !active) return
      const nextWidth = Math.max(minimumWidth, Math.ceil(rowWidth + horizontalPadding * 2))
      setWidth(current => current === nextWidth ? current : nextWidth)
    }

    measure()
    const fontsReady = typeof document !== 'undefined' ? document.fonts?.ready : null
    fontsReady?.then(measure).catch(() => {})

    return () => {
      active = false
    }
  }, dependencies)

  return width
}

function measureInlineBlock(text, info) {
  text = scratchBlockTextWithoutIcon(text, info)
  const shape = info.shape ?? 'stack'
  const bodyH = shape === 'hat' ? INLINE_H + 3 : INLINE_H
  const bottomTab = shape === 'stack' || shape === 'hat'
  const textWidth = iconBadgeMeasure(info, true) + measurePartsWidth(text, 12, 1, info)
  if (shape === 'reporter') return { width: Math.max(48, textWidth + 26), height: bodyH + 1, bodyH: bodyH + 1, bottomTab: false }
  if (shape === 'boolean') return { width: Math.max(booleanMinWidth(info, true), textWidth + booleanExtraWidth(info)), height: bodyH + 8, bodyH: bodyH + 8, bottomTab: false }
  if (shape === 'hat') return { width: Math.max(68, textWidth + 28), height: bodyH + CONNECTOR_H, bodyH, bottomTab: true }
  if (shape === 'cap') return { width: Math.max(48, textWidth + 28), height: bodyH, bodyH, bottomTab: false }
  return { width: Math.max(48, textWidth + 28), height: bodyH + CONNECTOR_H, bodyH, bottomTab }
}

function measureSimpleBlock(text, info, inline = false) {
  text = scratchBlockTextWithoutIcon(text, info)
  if (inline) return measureInlineBlock(text, info)
  const shape = info.shape ?? 'stack'
  const bodyH = shape === 'hat' ? HAT_H : BODY_H
  const bottomTab = shape === 'stack' || shape === 'hat'
  const textWidth = iconBadgeMeasure(info, false) + measurePartsWidth(text, 13, 0, info)
  if (shape === 'reporter') return { width: Math.max(60, textWidth + 30), height: 33, bodyH: 33, bottomTab: false }
  if (shape === 'boolean') return { width: Math.max(booleanMinWidth(info, false), textWidth + booleanExtraWidth(info)), height: 36, bodyH: 36, bottomTab: false }
  if (shape === 'cap') return { width: Math.max(60, textWidth + 30), height: BODY_H, bodyH: BODY_H, bottomTab: false }
  if (shape === 'hat') return { width: Math.max(88, textWidth + 32), height: bodyH + CONNECTOR_H, bodyH, bottomTab: true }
  return { width: Math.max(60, textWidth + 30), height: bodyH + CONNECTOR_H, bodyH, bottomTab: true }
}

function measurePartsWidth(text, size, depth, hostInfo) {
  return blockTextParts(text, depth, hostInfo).reduce((width, part) => {
    if (part.type === 'text') return width + estimateTextWidth(part.text, size)
    return width + measureSlot(part.content, part.kind, part.depth, hostInfo, size).width
  }, 0)
}

function measureSlot(content, kind, depth, hostInfo, fontSize = 13) {
  const trimmed = content.trim()
  const nested = depth < 4 ? findScratchBlock(trimmed) : null
  if (nested && (nested.shape === 'reporter' || nested.shape === 'boolean')) {
    return measureInlineBlock(trimmed, nested)
  }
  const label = trimmed || (kind === 'condition' ? ' ' : '')
  const baseWidth = estimateTextWidth(label, fontSize)
  if (kind === 'dropdown') return { width: Math.max(38, baseWidth + 29), height: 21 }
  if (kind === 'condition') return { width: Math.max(66, baseWidth + 38), height: 24 }
  if (kind === 'value' && hostInfo?.category === 'Operators') {
    const hasQuotes = TEXT_SHADOW_OPERATORS.has(hostInfo.opcode)
    return { width: Math.max(hasQuotes ? 56 : 42, baseWidth + (hasQuotes ? 50 : 31)), height: 23 }
  }
  return { width: Math.max(32, baseWidth + 21), height: 21 }
}

function stackedSize(children) {
  if (!children.length) return { width: 0, height: 0 }
  const sizes = children.map(measureNode)
  return {
    width: Math.max(...sizes.map(size => size.width)),
    height: sizes.reduce((sum, size) => sum + size.height, 0) - CONNECTOR_H * Math.max(0, sizes.length - 1),
  }
}

function measureCBlock(node) {
  const header = measureSimpleBlock(node.text, { ...node.info, shape: 'stack' }, false)
  const childSize = stackedSize(node.children)
  const elseChildSize = stackedSize(node.elseChildren)
  const mouthH = Math.max(MOUTH_MIN_H, childSize.height + MOUTH_PAD_TOP + MOUTH_PAD_BOTTOM)
  const elseMouthH = node.hasElse ? Math.max(MOUTH_MIN_H, elseChildSize.height + MOUTH_PAD_TOP + MOUTH_PAD_BOTTOM) : 0
  const mouthW = Math.max(childSize.width, elseChildSize.width) + MOUTH_X + 12
  const width = Math.ceil(Math.max(C_MIN_W, header.width, mouthW))
  const bodyH = BODY_H + mouthH + (node.hasElse ? ELSE_H + elseMouthH : 0) + FOOTER_H
  const bottomTab = node.info.opcode !== 'control_forever'
  return {
    width,
    height: bodyH + (bottomTab ? CONNECTOR_H : 0),
    bodyH,
    bottomTab,
    mouthH,
    elseMouthH,
  }
}

function measureNode(node) {
  if (node.info.shape === 'c') return measureCBlock(node)
  return measureSimpleBlock(node.text, node.info, false)
}

function stackPath(width, bodyH, { topNotch = true, bottomTab = true, roundedBottom = false } = {}) {
  const r = 5
  const tabX = NOTCH_X
  const tabW = NOTCH_W
  const tabMidW = 13
  const parts = []

  parts.push(`M ${r} 0`)
  parts.push(`H ${topNotch ? NOTCH_X : width - r}`)
  if (topNotch) {
    parts.push(`c 3 0 4 ${CONNECTOR_H} 8 ${CONNECTOR_H}`)
    parts.push(`h ${NOTCH_W - 16}`)
    parts.push(`c 4 0 5 -${CONNECTOR_H} 8 -${CONNECTOR_H}`)
    parts.push(`H ${width - r}`)
  }

  parts.push(`Q ${width} 0 ${width} ${r}`)
  parts.push(`V ${bodyH - r}`)
  parts.push(`Q ${width} ${bodyH} ${width - r} ${bodyH}`)

  if (bottomTab) {
    parts.push(`H ${tabX + tabW}`)
    parts.push(`c -3 0 -4 ${CONNECTOR_H} -8 ${CONNECTOR_H}`)
    parts.push(`h -${tabMidW}`)
    parts.push(`c -4 0 -5 -${CONNECTOR_H} -8 -${CONNECTOR_H}`)
    parts.push(`H ${r}`)
  } else {
    parts.push(`H ${roundedBottom ? r : 0}`)
  }

  if (roundedBottom) {
    parts.push(`Q 0 ${bodyH} 0 ${bodyH - r}`)
  } else {
    parts.push(`Q 0 ${bodyH} 0 ${bodyH - r}`)
  }
  parts.push(`V ${r}`)
  parts.push(`Q 0 0 ${r} 0`)
  parts.push('Z')
  return parts.join(' ')
}

function reporterPath(width, height) {
  const r = height / 2
  return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
}

function booleanPath(width, height) {
  const bevel = Math.min(18, height / 2 + 4)
  return `M ${bevel} 0 H ${width - bevel} L ${width} ${height / 2} L ${width - bevel} ${height} H ${bevel} L 0 ${height / 2} Z`
}

function shapePath(shape, width, bodyH, bottomTab) {
  if (shape === 'reporter') return reporterPath(width, bodyH)
  if (shape === 'boolean') return booleanPath(width, bodyH)
  if (shape === 'hat') return stackPath(width, bodyH, { topNotch: false, bottomTab })
  if (shape === 'cap') return stackPath(width, bodyH, { topNotch: true, bottomTab: false, roundedBottom: true })
  return stackPath(width, bodyH, { topNotch: true, bottomTab })
}

function mouthCutoutPath(x, y, w, h) {
  const r = 4
  const notchX = x + NOTCH_X
  const notchW = NOTCH_W
  const notchMidW = 13
  const bottomY = y + h
  return [
    `M ${x + r} ${y}`,
    `H ${notchX}`,
    `c 3 0 4 ${CONNECTOR_H} 8 ${CONNECTOR_H}`,
    `h ${notchMidW}`,
    `c 4 0 5 -${CONNECTOR_H} 8 -${CONNECTOR_H}`,
    `H ${x + w}`,
    `V ${bottomY}`,
    `H ${notchX + notchW}`,
    `c -3 0 -4 ${CONNECTOR_H} -8 ${CONNECTOR_H}`,
    `h -${notchMidW}`,
    `c -4 0 -5 -${CONNECTOR_H} -8 -${CONNECTOR_H}`,
    `H ${x + r}`,
    `Q ${x} ${bottomY} ${x} ${bottomY - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ')
}

function cBlockPath(width, size) {
  const outer = stackPath(width, size.bodyH, {
    topNotch: true,
    bottomTab: size.bottomTab,
    roundedBottom: !size.bottomTab,
  })
  const mouthW = width - MOUTH_X + 2
  const mouth1 = mouthCutoutPath(MOUTH_X, BODY_H, mouthW, size.mouthH)
  if (!size.elseMouthH) return `${outer} ${mouth1}`
  const mouth2Y = BODY_H + size.mouthH + ELSE_H
  const mouth2 = mouthCutoutPath(MOUTH_X, mouth2Y, mouthW, size.elseMouthH)
  return `${outer} ${mouth1} ${mouth2}`
}

function cBlockOuterPath(width, size) {
  return stackPath(width, size.bodyH, {
    topNotch: true,
    bottomTab: size.bottomTab,
    roundedBottom: !size.bottomTab,
  })
}

function mouthStrokePath(x, y, w, h) {
  const r = 4
  const notchX = x + NOTCH_X
  const notchW = NOTCH_W
  const notchMidW = 13
  const bottomY = y + h
  return [
    `M ${x + r} ${y}`,
    `H ${notchX}`,
    `c 3 0 4 ${CONNECTOR_H} 8 ${CONNECTOR_H}`,
    `h ${notchMidW}`,
    `c 4 0 5 -${CONNECTOR_H} 8 -${CONNECTOR_H}`,
    `H ${x + w}`,
    `M ${x + w} ${bottomY}`,
    `H ${notchX + notchW}`,
    `c -3 0 -4 ${CONNECTOR_H} -8 ${CONNECTOR_H}`,
    `h -${notchMidW}`,
    `c -4 0 -5 -${CONNECTOR_H} -8 -${CONNECTOR_H}`,
    `H ${x + r}`,
    `Q ${x} ${bottomY} ${x} ${bottomY - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
  ].join(' ')
}

function cBlockMouthStrokePath(width, size) {
  const mouthW = width - MOUTH_X + 2
  const mouth1 = mouthStrokePath(MOUTH_X, BODY_H, mouthW, size.mouthH)
  if (!size.elseMouthH) return mouth1
  const mouth2Y = BODY_H + size.mouthH + ELSE_H
  return `${mouth1} ${mouthStrokePath(MOUTH_X, mouth2Y, mouthW, size.elseMouthH)}`
}

function SlotArrow({ tone = 'light' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: `5px solid ${tone === 'dark' ? 'rgba(87,94,117,0.95)' : 'rgba(255,255,255,0.9)'}`,
        marginLeft: 4,
        marginTop: 2,
      }}
    />
  )
}

function iconBadgeMeasure(info, inline) {
  return info?.icon ? (inline ? INLINE_ICON_BADGE_SIZE + 5 : ICON_BADGE_SIZE + 6) : 0
}

function ScratchIconBadge({ icon, inline = false }) {
  if (!icon) return null
  const size = inline ? INLINE_ICON_BADGE_SIZE : ICON_BADGE_SIZE
  return (
    <span
      aria-hidden="true"
      data-scratch-icon-badge="true"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: inline ? 5 : 6,
        color: '#0f172a',
        background: '#fff',
        borderRadius: '50%',
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.22), 0 1px 1px rgba(15,23,42,0.18)',
        fontSize: inline ? 16 : 21,
        lineHeight: 1,
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      }}
    >
      {icon}
    </span>
  )
}

function usesLightDropdown(hostInfo) {
  const opcode = hostInfo?.opcode ?? ''
  return hostInfo?.category === 'Events' ||
    opcode.startsWith('looks_say') ||
    opcode.startsWith('looks_think') ||
    opcode === 'sensing_askandwait' ||
    opcode === 'operator_join' ||
    opcode === 'operator_letter_of' ||
    opcode === 'operator_length' ||
    opcode === 'operator_contains'
}

function slotStyle(kind, hostInfo = fallbackInfo()) {
  const hostColor = hostColorOf(hostInfo)
  const dropdownColor = fieldColor(hostColor)
  const isDropdown = kind === 'dropdown'
  const isCondition = kind === 'condition'
  const isValue = kind === 'value'
  const isLightDropdown = isDropdown && usesLightDropdown(hostInfo)
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isCondition ? 23 : 19,
    minWidth: isValue ? 22 : undefined,
    padding: isCondition ? '1px 11px' : isDropdown ? '0 7px 0 8px' : '0 7px',
    margin: '0 1px',
    color: isLightDropdown ? '#334155' : isDropdown || isCondition ? '#fff' : '#1f2937',
    background: isLightDropdown ? '#fff' : isDropdown ? dropdownColor : isCondition ? OPERATOR_COLOR : '#fff',
    borderRadius: isDropdown ? 4 : isCondition ? 3 : 999,
    boxShadow: isLightDropdown
      ? 'inset 0 0 0 1px rgba(0,0,0,0.22), inset 0 -1px 0 rgba(0,0,0,0.08)'
      : isDropdown
        ? `inset 0 0 0 1px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.16)`
      : isCondition
        ? `inset 0 0 0 1px ${outlineFor(OPERATOR_COLOR)}`
        : 'inset 0 0 0 1px rgba(0,0,0,0.2)',
    clipPath: isCondition
      ? 'polygon(11px 0, calc(100% - 11px) 0, 100% 50%, calc(100% - 11px) 100%, 11px 100%, 0 50%)'
      : undefined,
    whiteSpace: 'nowrap',
  }
}

function GreenFlagIcon() {
  return (
    <svg
      aria-hidden="true"
      data-scratch-flag="true"
      width="13"
      height="14"
      viewBox="0 0 13 14"
      style={{ display: 'inline-block', margin: '0 1px 0 2px', verticalAlign: '-2px', flex: '0 0 auto' }}
    >
      <path d="M2 1.2v11.6" stroke="#4d4d4d" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 1.8c2.2-1 4 .7 6.6-.2v6.1c-2.6.9-4.4-.8-6.6.2z" fill="#40BF4A" stroke="#219635" strokeWidth="0.7" />
    </svg>
  )
}

function renderFlagBlockText(hostInfo) {
  if (hostInfo?.opcode !== 'event_whenflagclicked') return null
  return (
    <>
      when <GreenFlagIcon /> clicked
    </>
  )
}

function OperatorValueSlot({ label, hostInfo }) {
  const hasQuotes = TEXT_SHADOW_OPERATORS.has(hostInfo?.opcode)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: hasQuotes ? 3 : 0,
        minHeight: 23,
        padding: hasQuotes ? '1px 5px' : '1px 4px',
        margin: '0 1px',
        color: '#fff',
        background: fieldColor(OPERATOR_COLOR),
        borderRadius: 999,
        boxShadow: `inset 0 0 0 1px ${outlineFor(OPERATOR_COLOR)}, inset 0 -1px 0 rgba(255,255,255,0.12)`,
        whiteSpace: 'nowrap',
      }}
      data-scratch-slot="value"
      data-scratch-slot-shadow={hasQuotes ? 'text' : 'number'}
    >
      {hasQuotes && <span style={{ opacity: 0.9, fontSize: 15, lineHeight: 1 }}>"</span>}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 18,
          minHeight: 18,
          padding: '0 5px',
          color: '#334155',
          background: '#fff',
          borderRadius: 4,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)',
        }}
        data-scratch-slot-field="true"
      >
        {label}
      </span>
      {hasQuotes && <span style={{ opacity: 0.9, fontSize: 15, lineHeight: 1 }}>"</span>}
    </span>
  )
}

function renderSlot(content, kind, key, depth, hostInfo) {
  const trimmed = content.trim()
  const nested = depth < 4 ? findScratchBlock(trimmed) : null
  if (nested && (nested.shape === 'reporter' || nested.shape === 'boolean')) {
    return <ScratchBlockBody key={key} text={trimmed} info={nested} inline depth={depth + 1} />
  }

  const label = trimmed || (kind === 'condition' ? ' ' : '')
  if (kind === 'value' && hostInfo?.category === 'Operators') {
    return <OperatorValueSlot key={key} label={label} hostInfo={hostInfo} />
  }

  const isLightDropdown = kind === 'dropdown' && usesLightDropdown(hostInfo)
  return (
    <span
      key={key}
      style={slotStyle(kind, hostInfo)}
      data-scratch-slot={kind}
      data-scratch-slot-tone={isLightDropdown ? 'light' : undefined}
    >
      {kind === 'condition' ? renderBlockText(label, depth + 1, { color: OPERATOR_COLOR, category: 'Operators' }) : label}
      {kind === 'dropdown' && <SlotArrow tone={isLightDropdown ? 'dark' : 'light'} />}
    </span>
  )
}

function renderBlockText(text, depth = 0, hostInfo = fallbackInfo()) {
  const flagText = renderFlagBlockText(hostInfo)
  if (flagText) return flagText

  return blockTextParts(text, depth, hostInfo).map((part, index) => {
    if (part.type === 'text') return <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
    return renderSlot(part.content, part.kind, part.key, part.depth, hostInfo)
  })
}

function ShapeSvg({ shape, color, width, bodyH, height, bottomTab }) {
  const path = shapePath(shape, width, bodyH, bottomTab)
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      <path
        d={path}
        fill={outlineFor(color)}
        opacity="0.45"
        transform="translate(0 2)"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill={color}
        stroke={outlineFor(color)}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        transform="translate(0 1)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ScratchBlockBody({ text, info, inline = false, depth = 0, shapeOverride = null }) {
  const shape = shapeOverride ?? info.shape ?? 'stack'
  const displayText = scratchBlockTextWithoutIcon(text, info)
  const size = measureSimpleBlock(displayText, { ...info, shape }, inline)
  const bodyH = size.bodyH ?? size.height
  const contentTop = contentTopFor(shape)
  const contentHeight = Math.max(0, bodyH - contentTop)
  const contentPadding = contentPaddingFor(shape, info)
  const contentRowRef = React.useRef(null)
  const width = useMeasuredBlockWidth(
    contentRowRef,
    size.width,
    minimumBlockWidth(shape, info, inline),
    contentPadding,
    [displayText, info.opcode, inline, shape, size.width, contentPadding],
  )

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height: size.height,
        verticalAlign: 'middle',
        cursor: 'default',
        userSelect: 'none',
        color: '#fff',
        ...scratchFont(inline ? '0.82em' : '13px'),
      }}
      data-scratch-opcode={info.opcode}
      data-scratch-shape={shape}
      data-scratch-content-top={contentTop}
      data-scratch-unknown={info.opcode === 'unknown' ? 'true' : undefined}
    >
      <ShapeSvg
        shape={shape}
        color={info.color}
        width={width}
        bodyH={bodyH}
        height={size.height}
        bottomTab={Boolean(size.bottomTab)}
      />
      <span
        style={{
          position: 'absolute',
          zIndex: 1,
          inset: `${contentTop}px 0 auto 0`,
          height: contentHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          lineHeight: 1,
          padding: `0 ${contentPadding}px`,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
        }}
        data-scratch-block-content="true"
      >
        <span
          ref={contentRowRef}
          style={{ display: 'inline-flex', alignItems: 'center', width: 'max-content', lineHeight: 1 }}
          data-scratch-block-row="true"
        >
          <ScratchIconBadge icon={scratchBlockBadgeIcon(info)} inline={inline} />
          {renderBlockText(displayText, depth, info)}
        </span>
      </span>
    </span>
  )
}

function EmptyMouth() {
  return <div style={{ minHeight: MOUTH_MIN_H - MOUTH_PAD_TOP - MOUTH_PAD_BOTTOM }} />
}

function RenderNodeList({ nodes }) {
  if (!nodes.length) return <EmptyMouth />
  return nodes.map((child, index) => (
    <div key={child.id} style={{ marginTop: index === 0 ? 0 : -CONNECTOR_H }}>
      <ScratchNode node={child} />
    </div>
  ))
}

function ScratchCBlock({ node }) {
  const size = measureCBlock(node)
  const color = node.info.color
  const displayText = scratchBlockTextWithoutIcon(node.text, node.info)
  const elseY = BODY_H + size.mouthH
  const secondMouthY = elseY + ELSE_H
  const headerContentTop = contentTopFor('c')

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size.width,
        height: size.height,
        cursor: 'default',
        userSelect: 'none',
        color: '#fff',
        ...scratchFont('13px'),
      }}
      data-scratch-opcode={node.info.opcode}
      data-scratch-shape="c"
      data-scratch-mouths={node.hasElse ? 2 : 1}
    >
      <svg
        aria-hidden="true"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <path
          d={cBlockPath(size.width, size)}
          fill={outlineFor(color)}
          fillRule="evenodd"
          opacity="0.45"
          transform="translate(0 2)"
          data-scratch-c-path="shadow"
        />
        <path
          d={cBlockPath(size.width, size)}
          fill={color}
          fillRule="evenodd"
          data-scratch-c-path="fill"
        />
        <path
          d={cBlockOuterPath(size.width, size)}
          fill="none"
          stroke={outlineFor(color)}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          data-scratch-c-path="outer"
        />
        <path
          d={cBlockOuterPath(size.width, size)}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          transform="translate(0 1)"
          vectorEffect="non-scaling-stroke"
          data-scratch-c-path="highlight"
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          left: 13,
          top: headerContentTop,
          height: BODY_H - headerContentTop,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        <ScratchIconBadge icon={scratchBlockBadgeIcon(node.info)} />
        {renderBlockText(displayText, 0, node.info)}
      </div>

      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          left: C_CHILD_X,
          top: BODY_H + MOUTH_PAD_TOP,
          width: size.width - C_CHILD_X - 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
        data-scratch-mouth-stack="children"
      >
        <RenderNodeList nodes={node.children} />
      </div>

      {node.hasElse && (
        <>
          <div
            style={{
              position: 'absolute',
              zIndex: 1,
              left: 13,
              top: elseY,
              height: ELSE_H,
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
            data-scratch-else="true"
          >
            else
          </div>
          <div
            style={{
              position: 'absolute',
              zIndex: 1,
              left: C_CHILD_X,
              top: secondMouthY + MOUTH_PAD_TOP,
              width: size.width - C_CHILD_X - 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
            data-scratch-mouth-stack="else"
          >
            <RenderNodeList nodes={node.elseChildren} />
          </div>
        </>
      )}
    </div>
  )
}

function ScratchNode({ node }) {
  if (node.info.shape === 'c') return <ScratchCBlock node={node} />
  return <ScratchBlockBody text={node.text} info={node.info} />
}

function parseScratchStack(code) {
  const roots = []
  const stack = []
  let id = 0

  function addNode(node) {
    const parent = stack[stack.length - 1]
    if (!parent) roots.push(node)
    else if (parent.branch === 'else') parent.node.elseChildren.push(node)
    else parent.node.children.push(node)
  }

  for (const line of String(code ?? '').split('\n')) {
    const text = line.trim()
    if (!text) continue
    const indent = Math.floor((line.length - line.trimStart().length) / 2)
    const lower = text.toLowerCase()

    if (lower === 'end') {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      continue
    }

    if (lower === 'else') {
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop()
      const targetIndex = stack.findLastIndex(entry => entry.indent === indent && entry.node.info.shape === 'c')
      if (targetIndex >= 0) {
        stack.length = targetIndex + 1
        stack[targetIndex].node.hasElse = true
        stack[targetIndex].branch = 'else'
      }
      continue
    }

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()

    const info = findScratchBlock(text)
    if (!info && /^[a-z_][\w -]*$/i.test(text)) continue
    const node = {
      id: id++,
      text,
      info: info ?? fallbackInfo(),
      children: [],
      elseChildren: [],
      hasElse: false,
    }
    addNode(node)

    if (node.info.shape === 'c') {
      stack.push({ indent, node, branch: 'children' })
    }
  }

  return roots
}

function rootMarginTop(nodes, index) {
  if (index === 0) return 0
  if (nodes[index].info.shape === 'hat') return ROOT_GAP
  return nodes[index - 1]?.info.shape === 'c' ? -(CONNECTOR_H + 3) : -CONNECTOR_H
}

export function InlineScratchBlock({ text }) {
  const info = findScratchBlock(text) ?? fallbackInfo()
  return <ScratchBlockBody text={text} info={info} inline />
}

export function ScratchBlocks({ code }) {
  const nodes = parseScratchStack(code)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        margin: '6px 0',
      }}
      data-scratch-stack="true"
    >
      {nodes.map((node, index) => (
        <div key={node.id} style={{ marginTop: rootMarginTop(nodes, index) }}>
          <ScratchNode node={node} />
        </div>
      ))}
    </div>
  )
}

export function looksLikeScratchBlocks(code) {
  const lines = String(code ?? '').split('\n').map(line => line.trim()).filter(Boolean)
  return lines.length > 0 && lines.every(line => {
    const lower = line.toLowerCase()
    return lower === 'end' || lower === 'else' || Boolean(findScratchBlock(line))
  })
}
