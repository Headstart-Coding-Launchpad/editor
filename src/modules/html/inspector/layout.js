// Flexbox and grid guides for the HTML Inspector overlay: main and cross axes, gaps and grid
// lines. Pure maths on rects and computed-style strings, plus readLayout() which gathers them
// from a live element.
import { computeBoxes, readBoxSizes } from './boxModel.js'

function px(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** 'flex' | 'grid' | null from a computed `display` value. */
export function layoutKind(display) {
  const value = String(display ?? '')
  if (/\bgrid\b|inline-grid/.test(value)) return 'grid'
  if (/\bflex\b|inline-flex/.test(value)) return 'flex'
  return null
}

/**
 * The track sizes in px from a computed grid-template-columns / -rows value
 * ("100px 1fr" resolves to px in a browser; line names in [brackets] are dropped).
 * Returns [] for 'none' or anything it can't read.
 */
export function parseTrackList(text) {
  const value = String(text ?? '')
    .replace(/\[[^\]]*\]/g, ' ')
    .trim()
  if (!value || value === 'none') return []
  const tracks = value
    .split(/\s+/)
    .map((part) => (/^-?[\d.]+px$/.test(part) ? parseFloat(part) : NaN))
  return tracks.every(Number.isFinite) ? tracks : []
}

/**
 * Grid lines and gaps across a content box: { columns: [{ x, number }], rows: [{ y, number }],
 * gaps: [{ x, y, width, height, axis: 'column' | 'row', size }] }. Lines are numbered from 1, as
 * in `grid-column: 1 / 3`.
 */
export function computeGridLines(content, columnTracks, rowTracks, columnGap = 0, rowGap = 0) {
  const columns = []
  const rows = []
  const gaps = []
  let x = content.x
  columnTracks.forEach((track, i) => {
    columns.push({ x, number: i + 1 })
    x += track
    if (i < columnTracks.length - 1 && columnGap > 0) {
      gaps.push({
        x,
        y: content.y,
        width: columnGap,
        height: content.height,
        axis: 'column',
        size: columnGap,
      })
      x += columnGap
    }
  })
  if (columnTracks.length > 0) columns.push({ x, number: columnTracks.length + 1 })
  let y = content.y
  rowTracks.forEach((track, i) => {
    rows.push({ y, number: i + 1 })
    y += track
    if (i < rowTracks.length - 1 && rowGap > 0) {
      gaps.push({
        x: content.x,
        y,
        width: content.width,
        height: rowGap,
        axis: 'row',
        size: rowGap,
      })
      y += rowGap
    }
  })
  if (rowTracks.length > 0) rows.push({ y, number: rowTracks.length + 1 })
  return { columns, rows, gaps }
}

/**
 * Flexbox axes and gaps: { main: { x1, y1, x2, y2, label }, cross: {...}, gaps: [...] }.
 * `direction` is flex-direction, `wrap` flex-wrap; `childRects` the in-flow children's border
 * boxes in DOM order; `gap` the main-axis gap in px.
 */
export function computeFlexGuides(
  content,
  { direction = 'row', wrap = 'nowrap' } = {},
  childRects = [],
  gap = 0
) {
  const isRow = !String(direction).startsWith('column')
  const mainReversed = String(direction).endsWith('reverse')
  const crossReversed = wrap === 'wrap-reverse'
  const midX = content.x + content.width / 2
  const midY = content.y + content.height / 2
  const left = content.x
  const right = content.x + content.width
  const top = content.y
  const bottom = content.y + content.height
  const horizontal = (reversed) =>
    reversed
      ? { x1: right, y1: midY, x2: left, y2: midY }
      : { x1: left, y1: midY, x2: right, y2: midY }
  const vertical = (reversed) =>
    reversed
      ? { x1: midX, y1: bottom, x2: midX, y2: top }
      : { x1: midX, y1: top, x2: midX, y2: bottom }
  const main = {
    ...(isRow ? horizontal(mainReversed) : vertical(mainReversed)),
    label: 'main axis',
  }
  const cross = {
    ...(isRow ? vertical(crossReversed) : horizontal(crossReversed)),
    label: 'cross axis',
  }

  const gaps = []
  if (gap > 0) {
    for (let i = 0; i < childRects.length - 1; i += 1) {
      const a = childRects[i]
      const b = childRects[i + 1]
      if (isRow) {
        const sameLine = a.y < b.y + b.height && b.y < a.y + a.height
        if (!sameLine) continue
        const start = Math.min(a.x + a.width, b.x + b.width)
        const end = Math.max(a.x, b.x)
        if (end - start <= 0) continue
        const y = Math.min(a.y, b.y)
        gaps.push({
          x: start,
          y,
          width: end - start,
          height: Math.max(a.y + a.height, b.y + b.height) - y,
          size: gap,
        })
      } else {
        const sameLine = a.x < b.x + b.width && b.x < a.x + a.width
        if (!sameLine) continue
        const start = Math.min(a.y + a.height, b.y + b.height)
        const end = Math.max(a.y, b.y)
        if (end - start <= 0) continue
        const x = Math.min(a.x, b.x)
        gaps.push({
          x,
          y: start,
          width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: end - start,
          size: gap,
        })
      }
    }
  }
  return { main, cross, gaps, isRow }
}

function toRect(r) {
  return { x: r.x ?? r.left ?? 0, y: r.y ?? r.top ?? 0, width: r.width ?? 0, height: r.height ?? 0 }
}

/**
 * The layout guides for a live element, or null when it isn't a flex or grid container:
 * { kind: 'flex', ...computeFlexGuides, direction, wrap, justify, align, gap }
 * { kind: 'grid', ...computeGridLines, columnGap, rowGap, columnCount, rowCount }
 */
export function readLayout(el) {
  const win = el?.ownerDocument?.defaultView
  let style = null
  try {
    style = win?.getComputedStyle?.(el) ?? null
  } catch {
    style = null
  }
  if (!style) return null
  const kind = layoutKind(style.getPropertyValue('display'))
  if (!kind) return null
  const content = computeBoxes(toRect(el.getBoundingClientRect()), readBoxSizes(style)).content
  const columnGap = px(style.getPropertyValue('column-gap'))
  const rowGap = px(style.getPropertyValue('row-gap'))
  if (kind === 'grid') {
    const columnTracks = parseTrackList(style.getPropertyValue('grid-template-columns'))
    const rowTracks = parseTrackList(style.getPropertyValue('grid-template-rows'))
    return {
      kind,
      ...computeGridLines(content, columnTracks, rowTracks, columnGap, rowGap),
      columnGap,
      rowGap,
      columnCount: columnTracks.length,
      rowCount: rowTracks.length,
    }
  }
  const direction = style.getPropertyValue('flex-direction') || 'row'
  const wrap = style.getPropertyValue('flex-wrap') || 'nowrap'
  const children = Array.from(el.children ?? []).filter((child) => {
    try {
      const childStyle = win.getComputedStyle(child)
      return childStyle.display !== 'none' && !/absolute|fixed/.test(childStyle.position)
    } catch {
      return true
    }
  })
  const isRow = !direction.startsWith('column')
  const gap = isRow ? columnGap : rowGap
  return {
    kind,
    ...computeFlexGuides(
      content,
      { direction, wrap },
      children.map((child) => toRect(child.getBoundingClientRect())),
      gap
    ),
    direction,
    wrap,
    justify: style.getPropertyValue('justify-content') || 'normal',
    align: style.getPropertyValue('align-items') || 'normal',
    gap,
  }
}
