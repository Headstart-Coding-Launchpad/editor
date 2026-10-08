// Block brackets for Python code: every line ending in `:` (if, elif, else, for, while, def,
// class, try, with …) gets a coloured bracket down the left of the lines it controls, and its
// colon takes the same colour. The colour comes from the header's depth, so an elif/else lined
// up with its if shares the if's colour. The bracket's position is the indent itself, so depth
// never relies on colour alone.
//
// findPythonBlocks is pure (lines in, blocks out) so the code_arrange indent mode can draw the
// same brackets from its own line list. blockGuidesExtension draws them in CodeMirror; the
// classroom editor adds it through CodeEditor's `blockGuides` prop (see PythonEditor.jsx).
import { EditorState } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { indentUnit } from '@codemirror/language'

// Readable on the editor's light background (#fafafa) and its active-line tint; cycles past
// five levels.
export const BLOCK_GUIDE_COLOURS = ['#7c3aed', '#0369a1', '#047857', '#b45309', '#be185d']

export function blockGuideColour(level) {
  const n = BLOCK_GUIDE_COLOURS.length
  return BLOCK_GUIDE_COLOURS[((level % n) + n) % n]
}

// The task flag: brackets show unless the author set `showBlocks: false`.
export function taskShowsBlocks(task) {
  return task?.showBlocks !== false
}

// The visual column of a line's first non-space character (tabs expand to the next tab stop).
function indentColumn(text, tabSize) {
  let column = 0
  for (const ch of text) {
    if (ch === ' ') column += 1
    else if (ch === '\t') column += tabSize - (column % tabSize)
    else break
  }
  return column
}

// Classifies each line, carrying bracket depth and triple-quoted strings across lines:
//   kind  'blank' (whitespace only), 'comment' (only a comment), 'continuation' (starts inside
//         an open bracket or a triple-quoted string), or 'code' (starts a logical line)
//   colon the index of a final `:` that ends a logical line outside any string or bracket
function scanLines(lines) {
  let depth = 0
  let triple = null
  return lines.map((text) => {
    const startsInside = depth > 0 || triple !== null
    let lastSignificant = -1
    let i = 0
    while (i < text.length) {
      const ch = text[i]
      if (triple) {
        if (text.startsWith(triple, i)) {
          lastSignificant = i + 2
          triple = null
          i += 3
        } else {
          i += ch === '\\' ? 2 : 1
        }
        continue
      }
      if (ch === '#') break
      if (ch === '"' || ch === "'") {
        if (text.startsWith(ch.repeat(3), i)) {
          triple = ch.repeat(3)
          i += 3
          continue
        }
        // A one-line string runs to its closing quote (or the line end if unclosed).
        let j = i + 1
        while (j < text.length && text[j] !== ch) j += text[j] === '\\' ? 2 : 1
        lastSignificant = Math.min(j, text.length - 1)
        i = j + 1
        continue
      }
      if ('([{'.includes(ch)) depth += 1
      else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1)
      if (ch !== ' ' && ch !== '\t') lastSignificant = i
      i += 1
    }
    const trimmed = text.trim()
    let kind = 'code'
    if (startsInside) kind = 'continuation'
    else if (trimmed === '') kind = 'blank'
    else if (trimmed.startsWith('#')) kind = 'comment'
    const endsLogicalLine = depth === 0 && triple === null
    const colon =
      endsLogicalLine && lastSignificant >= 0 && text[lastSignificant] === ':'
        ? lastSignificant
        : -1
    return { kind, colon }
  })
}

/**
 * The blocks in some Python source lines (an array of strings, no line breaks):
 * `[{ header, colon, column, level, from, to }]`, where `header` is the 1-based line holding
 * the `:` (the last line of a header split over several lines), `colon` its index in that line,
 * `column` the header's indent in columns, `level` that indent in indent steps (for the colour),
 * and `from`..`to` the 1-based lines the block controls. A header whose next code line is not
 * indented past it has no block, so a missing indent shows as a missing bracket.
 */
export function findPythonBlocks(lines, { tabSize = 4, indentSize = 4 } = {}) {
  const scanned = scanLines(lines)
  const columns = lines.map((text) => indentColumn(text, tabSize))
  const blocks = []
  let logicalStart = -1
  for (let i = 0; i < lines.length; i++) {
    const { kind, colon } = scanned[i]
    if (kind === 'code') logicalStart = i
    if (colon < 0 || logicalStart < 0 || (kind !== 'code' && kind !== 'continuation')) continue
    const column = columns[logicalStart]
    let end = i
    let hasBody = false
    for (let j = i + 1; j < lines.length; j++) {
      const next = scanned[j]
      if (next.kind === 'code' && columns[j] <= column) break
      if (next.kind === 'code') hasBody = true
      end = j
    }
    // Trailing blank lines, and comments back at (or left of) the header, sit outside it.
    while (
      end > i &&
      (scanned[end].kind === 'blank' || (scanned[end].kind === 'comment' && columns[end] <= column))
    ) {
      end -= 1
    }
    if (!hasBody) continue
    blocks.push({
      header: i + 1,
      colon,
      column,
      level: Math.floor(column / Math.max(1, indentSize)),
      from: i + 2,
      to: end + 1,
    })
  }
  return blocks
}

// Matches the `.cm-line` side padding in codemirror.js's headstartTheme.
const LINE_PADDING_PX = 14
const BAR_WIDTH = '2px'
const TICK_WIDTH = '0.7ch'

function barLayer(column, colour, last) {
  const x = `calc(${LINE_PADDING_PX}px + ${column + 0.25}ch)`
  const layers = [{ image: colour, size: `${BAR_WIDTH} 100%`, position: `${x} 0` }]
  // The bracket's foot: a short tick along the bottom of the block's last line.
  if (last)
    layers.push({ image: colour, size: `${TICK_WIDTH} ${BAR_WIDTH}`, position: `${x} 100%` })
  return layers
}

function lineStyle(layers) {
  return [
    `background-image:${layers.map((l) => `linear-gradient(${l.image},${l.image})`).join(',')}`,
    `background-size:${layers.map((l) => l.size).join(',')}`,
    `background-position:${layers.map((l) => l.position).join(',')}`,
    'background-repeat:no-repeat',
  ].join(';')
}

export function buildBlockGuideDecorations(state) {
  const { doc } = state
  const lines = []
  for (let n = 1; n <= doc.lines; n++) lines.push(doc.line(n).text)
  const blocks = findPythonBlocks(lines, {
    tabSize: state.tabSize,
    indentSize: state.facet(indentUnit).length,
  })
  const layersByLine = new Map()
  const ranges = []
  for (const block of blocks) {
    const colour = blockGuideColour(block.level)
    for (let n = block.from; n <= block.to; n++) {
      if (!layersByLine.has(n)) layersByLine.set(n, [])
      layersByLine.get(n).push(...barLayer(block.column, colour, n === block.to))
    }
    const colonAt = doc.line(block.header).from + block.colon
    ranges.push(
      Decoration.mark({
        class: 'cm-blockColon',
        attributes: { style: `color:${colour}` },
      }).range(colonAt, colonAt + 1)
    )
  }
  for (const [n, layers] of layersByLine) {
    ranges.push(
      Decoration.line({ class: 'cm-blockGuides', attributes: { style: lineStyle(layers) } }).range(
        doc.line(n).from
      )
    )
  }
  return Decoration.set(ranges, true)
}

const blockGuideDecorations = EditorView.decorations.compute(
  ['doc', EditorState.tabSize, indentUnit],
  buildBlockGuideDecorations
)

const blockGuideTheme = EditorView.baseTheme({
  '.cm-blockColon': { fontWeight: 'bold' },
})

/** The block-bracket extension for a Python editor. */
export function blockGuidesExtension() {
  return [blockGuideDecorations, blockGuideTheme]
}
