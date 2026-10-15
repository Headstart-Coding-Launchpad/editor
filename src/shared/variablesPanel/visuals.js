// Name-tag panel visuals (showVariables `visuals` / `stageLists`, docs/authoring/python.md
// "Name-Tag Panel"): which picture a captured value gets, chosen from the value alone. Pure and
// Node-safe, so the panel, the tutor's card and the tests share one reading.
//
// DISPLAY RULES (chooseVisual), in order:
//   visuals off, a plain value, a set or an empty collection   'plain' (today's tags)
//   a dict: every value a number                               'dictBars'
//           anything else                                      'cards' (a colour value adds a swatch)
//   a list (or tuple) the Stage's grid() drew in this run (node.g), by `stageLists`:
//     size (default)   'size'    the type and size only ("list, 8 × 8, drawn on the Stage")
//     tiles            'rows'    rows of tiles (or 'tiles' for a flat list)
//     picture          'picture' when every cell is a colour, see-through or a palette number;
//                                otherwise the rules below
//   a 2D list (equal-length rows, all read):
//     every cell a colour or see-through (at least one real colour)   'picture'
//     anything else                                                   'table'
//   a flat list: every item a colour the Stage knows                  'swatches'
//                every item a number                                  'bars'
//                anything else (text, emoji, mixed, nested)           'tiles'
// Whole numbers only count as palette numbers in a list grid() drew (they use its palette, or
// the 16 Arcade colours without one): a 2D list of numbers that was never drawn is a table.
// A value whose items were not all read (too long, too deep) still gets its flat-list visual for
// the items that were read; a 2D value missing rows or cells falls back to tiles.
import {
  PICO8_PALETTE,
  colourInWords,
  describeHex,
  isTransparentColour,
  parseColour,
} from '../stage/colours.js'
import {
  DEFAULT_STAGE_LISTS,
  STAGE_LISTS_OPTIONS,
  formatValue,
  hiddenItemCount,
  nodeItems,
  nodeLength,
} from './variablesPanel.js'

export { STAGE_LISTS_OPTIONS, DEFAULT_STAGE_LISTS }
// The biggest picture the panel draws, per side (the capture reads at most 50 items a list, and
// about 32 × 32 cells fit one variable's budget).
export const PICTURE_MAX_SIDE = 50

const isListLike = (node) => node?.t === 'list' || node?.t === 'tuple'

function fullyRead(node) {
  return !node?.cut && hiddenItemCount(node) === 0
}

/** The colour a value node names ('#rrggbb'), or null: text the Stage reads as a colour. */
export function nodeColour(node) {
  if (node?.t !== 'str' || typeof node.v !== 'string' || node.more > 0) return null
  if (isTransparentColour(node.v)) return null
  return parseColour(node.v)
}

/** A value node's number (int or float the browser can hold), or null. True/False are not. */
export function nodeNumber(node) {
  if ((node?.t === 'int' || node?.t === 'float') && Number.isFinite(node.v)) return node.v
  return null
}

// A colour said in words, from the node's own text when it has one.
function nodeColourWords(node, hex) {
  if (node?.t === 'str' && typeof node.v === 'string') return colourInWords(node.v)
  return hex ? describeHex(hex) : 'see-through'
}

// The rows of a 2D list: each row's item nodes, or null when it isn't one (every row a list
// or tuple, all the same length, nothing left unread).
export function rowsOf2D(node) {
  if (!isListLike(node) || !fullyRead(node)) return null
  const rows = nodeItems(node)
  if (rows.length === 0 || rows.length > PICTURE_MAX_SIDE) return null
  let cols = null
  for (const row of rows) {
    if (!isListLike(row) || !fullyRead(row)) return null
    const cells = nodeItems(row)
    if (cells.length === 0 || cells.length > PICTURE_MAX_SIDE) return null
    if (cols == null) cols = cells.length
    else if (cells.length !== cols) return null
  }
  return rows.map((row) => nodeItems(row))
}

// A grid()'s palette (node.gp, colour words) as [{ hex, words }] (hex null = see-through).
function drawnPalette(node) {
  if (!Array.isArray(node?.gp) || node.gp.length === 0) return null
  return node.gp.map((word) => {
    const hex = typeof word !== 'string' || isTransparentColour(word) ? null : parseColour(word)
    return { hex, words: hex ? colourInWords(word) : 'see-through' }
  })
}

const PICO8_ENTRIES = PICO8_PALETTE.map((hex) => ({ hex, words: describeHex(hex) }))

// One picture cell: { ok, hex, words } (hex null = see-through), or { ok: false }.
function pictureCell(cell, { drawn, palette }) {
  if (cell?.t === 'none') return { ok: true, hex: null, words: 'see-through', named: false }
  if (cell?.t === 'str' && typeof cell.v === 'string') {
    if (isTransparentColour(cell.v) || !cell.v.trim()) {
      return { ok: true, hex: null, words: 'see-through', named: false }
    }
    const hex = nodeColour(cell)
    return hex ? { ok: true, hex, words: colourInWords(cell.v), named: true } : { ok: false }
  }
  if (drawn && (cell?.t === 'int' || cell?.t === 'bool')) {
    const index = cell.t === 'bool' ? (cell.v ? 1 : 0) : cell.v
    const list = palette ?? PICO8_ENTRIES
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return { ok: false }
    const entry = list[index]
    return { ok: true, hex: entry?.hex ?? null, words: entry?.words ?? 'see-through', named: true }
  }
  return { ok: false }
}

/**
 * A 2D list as a picture: `{ rows, cols, cells: [[{ hex, words }]], colours: [{ words, hex,
 * count }] }` (colours in first-seen order, see-through included), or null when a cell is not a
 * colour. Whole numbers count only when `drawn` (they index the grid's palette).
 */
export function pictureOf(rows, { drawn = false, palette = null } = {}) {
  if (!rows) return null
  const counts = new Map()
  let named = false
  const cells = []
  for (const row of rows) {
    const out = []
    for (const cell of row) {
      const read = pictureCell(cell, { drawn, palette })
      if (!read.ok) return null
      if (read.named) named = true
      const key = read.hex ?? 'none'
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { words: read.words, hex: read.hex, count: 1 })
      out.push({ hex: read.hex, words: read.words })
    }
    cells.push(out)
  }
  if (!named && !drawn) return null
  return { rows: cells.length, cols: cells[0]?.length ?? 0, cells, colours: [...counts.values()] }
}

/**
 * The visual for one value node: `{ kind, … }` (see DISPLAY RULES above). `options`:
 * `{ visuals = true, stageLists = 'size' }` (the task's showVariables).
 */
export function chooseVisual(node, { visuals = true, stageLists = DEFAULT_STAGE_LISTS } = {}) {
  if (!node || typeof node !== 'object' || visuals === false) return { kind: 'plain' }
  const items = nodeItems(node)
  if (node.t === 'dict') {
    if (items.length === 0) return { kind: 'plain' }
    const numbers = items.map((entry) => nodeNumber(entry?.v))
    if (numbers.every((value) => value != null)) {
      const scale = Math.max(0, ...numbers.map((value) => Math.abs(value)))
      return {
        kind: 'dictBars',
        entries: items.map((entry, i) => ({
          key: entry?.k ?? null,
          value: entry?.v ?? null,
          number: numbers[i],
          fraction: scale > 0 ? Math.abs(numbers[i]) / scale : 0,
        })),
        notRead: hiddenItemCount(node),
      }
    }
    return {
      kind: 'cards',
      entries: items.map((entry) => ({
        key: entry?.k ?? null,
        value: entry?.v ?? null,
        hex: nodeColour(entry?.v),
      })),
      notRead: hiddenItemCount(node),
    }
  }
  if (!isListLike(node) || items.length === 0) return { kind: 'plain' }

  const rows = rowsOf2D(node)
  if (node.g) {
    const lists = STAGE_LISTS_OPTIONS.includes(stageLists) ? stageLists : DEFAULT_STAGE_LISTS
    if (lists === 'size') {
      const cols = Math.max(0, ...items.map((row) => (isListLike(row) ? nodeLength(row) : 0)))
      return { kind: 'size', rows: nodeLength(node), cols }
    }
    if (lists === 'tiles') {
      return items.every(isListLike)
        ? { kind: 'rows', rows: items.map((row) => ({ node: row, cells: nodeItems(row) })) }
        : { kind: 'tiles' }
    }
    const picture = pictureOf(rows, { drawn: true, palette: drawnPalette(node) })
    if (picture) return { kind: 'picture', ...picture }
  }
  if (rows) {
    const picture = pictureOf(rows)
    if (picture) return { kind: 'picture', ...picture }
    return { kind: 'table', rows, cols: rows[0].length }
  }
  if (items.some(isListLike)) return { kind: 'tiles' }
  const colours = items.map(nodeColour)
  if (colours.every(Boolean)) {
    return {
      kind: 'swatches',
      items: items.map((item, index) => ({
        index,
        node: item,
        hex: colours[index],
        words: nodeColourWords(item, colours[index]),
      })),
      notRead: hiddenItemCount(node),
    }
  }
  const numbers = items.map(nodeNumber)
  if (numbers.every((value) => value != null)) {
    const scale = Math.max(0, ...numbers.map((value) => Math.abs(value)))
    return {
      kind: 'bars',
      items: items.map((item, index) => ({
        index,
        node: item,
        number: numbers[index],
        fraction: scale > 0 ? Math.abs(numbers[index]) / scale : 0,
      })),
      notRead: hiddenItemCount(node),
    }
  }
  return { kind: 'tiles' }
}

const MAX_SUMMARY_COLOURS = 8

/**
 * The screen-reader summary of a picture, e.g. "pixels: 8 by 8 picture, 5 colours: red 12,
 * white 40, …".
 */
export function describePicture(name, picture) {
  const colours = picture.colours ?? []
  const listed = colours
    .slice(0, MAX_SUMMARY_COLOURS)
    .map((entry) => `${entry.words} ${entry.count}`)
    .join(', ')
  const more = colours.length > MAX_SUMMARY_COLOURS ? ', …' : ''
  const count = colours.filter((entry) => entry.hex).length
  return `${name}: ${picture.rows} by ${picture.cols} picture, ${count} ${
    count === 1 ? 'colour' : 'colours'
  }: ${listed}${more}`
}

// "list, 8 × 8, drawn on the Stage" (a stageLists: size tag).
export function sizeText(node, visual) {
  const kind = node?.t === 'tuple' ? 'tuple' : 'list'
  return visual.cols > 0
    ? `${kind}, ${visual.rows} × ${visual.cols}, drawn on the Stage`
    : `${kind} of ${visual.rows}, drawn on the Stage`
}

/**
 * The screen-reader text for one item of a visual, e.g. "palette, item 0: red",
 * "scores, item 2: 7", "ages, "Sam": 12".
 */
export function describeItem(name, visual, item) {
  if (visual.kind === 'swatches') return `${name}, item ${item.index}: ${item.words}`
  if (visual.kind === 'bars') return `${name}, item ${item.index}: ${formatValue(item.node)}`
  if (visual.kind === 'cards' || visual.kind === 'dictBars') {
    const value = formatValue(item.value, { maxChars: 80 })
    const colour = item.hex ? ` (${colourInWords(item.value?.v)})` : ''
    return `${name}, ${formatValue(item.key, { maxChars: 40 })}: ${value}${colour}`
  }
  return ''
}

// ─── Change marks ────────────────────────────────────────────────────────────

// The key a changed item is marked by (see changedItemKeys in variablesPanel.js).
export const itemKey = (index) => String(index)
export const cellKey = (row, col) => `${row},${col}`
export const dictKey = (keyNode) => `k:${formatValue(keyNode)}`

// ─── Target values (target mode) ─────────────────────────────────────────────

/**
 * A target value written in the lesson (YAML/JSON) as a value node, so targets get the same
 * visuals: text, numbers (whole numbers as int), True/False/None, lists and dicts.
 */
export function targetToNode(value) {
  if (value === null || value === undefined) return { t: 'none' }
  if (typeof value === 'boolean') return { t: 'bool', v: value }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { t: 'int', v: value }
      : { t: 'float', v: value, r: String(value) }
  }
  if (typeof value === 'string') return { t: 'str', v: value }
  if (Array.isArray(value)) {
    return { t: 'list', len: value.length, items: value.map(targetToNode) }
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    return {
      t: 'dict',
      len: entries.length,
      items: entries.map(([key, item]) => ({ k: { t: 'str', v: key }, v: targetToNode(item) })),
    }
  }
  return { t: 'obj', type: typeof value, r: String(value) }
}

// ─── Tutor card ──────────────────────────────────────────────────────────────

const CARD_KINDS = new Set(['swatches', 'picture', 'bars'])

/**
 * The visuals worth a thumbnail on the tutor's student card: up to `limit` variables of the
 * shown snapshot whose visual is swatches, a picture or bars, as `[{ name, visual }]`.
 */
export function cardVisuals(vars, options, limit = 2) {
  const out = []
  for (const entry of Array.isArray(vars) ? vars : []) {
    const visual = chooseVisual(entry?.v, options)
    if (!CARD_KINDS.has(visual.kind)) continue
    out.push({ name: entry.n, node: entry.v, visual })
    if (out.length >= limit) break
  }
  return out
}
