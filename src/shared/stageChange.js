// The change view of a Complete code stage (platform request 134; docs/authoring/python-tasks.md
// "Change view"): instead of the whole program, show only what to add (green, +), remove (red, -)
// and re-indent, each change anchored by the TEXT of an unchanged line beside it ("after this
// line" / "before this line"). Never line numbers: students add lines, so numbers shift.
//
// Worked out when the stage opens, against the student's own editor code (chooseChangeBase), and
// never stored. Pure and Node-safe apart from taskStages.js (no imports of its own).
//
// The steps: clean both sides (drop #@lock / #@slot / #> marker lines, trim trailing whitespace),
// ignore blank lines, line-diff the trimmed text (LCS), then call a line whose text matches but
// whose leading space differs an indent change. Changes next to each other form one hunk. A hunk
// with new lines needs an anchor that names one place in the code; one that only removes or
// re-indents lines is found by those lines themselves. Too much change falls back to the whole
// program with every changed line marked (`fullRows`), so no line a child must type is hidden.

import { getStageRole } from './taskStages.js'

export const CHANGE_LIMITS = {
  // More than this share of the Complete's lines new or re-indented: show the whole program.
  maxChangedShare: 0.5,
  // More than this many separate changes.
  maxHunks: 3,
  // A single block of more than this many new lines.
  maxAddedBlock: 8,
  // Line diff size cap (base lines x Complete lines, after the common start and end are trimmed).
  maxDiffCells: 250000,
  // Inline change (request 135): more than this share of the old or the new line's characters
  // changed keeps the red row and the green row.
  inlineMaxChangedShare: 0.5,
  // A changed line with this many separate changes or more keeps the red and green rows.
  inlineMaxChanges: 3,
  // A run of removed and added lines with more than this many on a side is not paired.
  inlineMaxRunLines: 12,
}

const TAB_WIDTH = 4

function isMarkerLine(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('#>') || /^#@(lock|slot)/.test(trimmed)
}

/** A code string as the lines the change view compares: markers dropped, trailing space trimmed. */
export function cleanCodeLines(code) {
  if (typeof code !== 'string' || code === '') return []
  return code
    .split(/\r?\n/)
    .filter((line) => !isMarkerLine(line))
    .map((line) => line.replace(/\s+$/, ''))
}

/** The line indexes (0-based, in `code`) of the lines cleanCodeLines keeps, in order. */
export function cleanCodeLineIndexes(code) {
  if (typeof code !== 'string' || code === '') return []
  const indexes = []
  code.split(/\r?\n/).forEach((line, index) => {
    if (!isMarkerLine(line)) indexes.push(index)
  })
  return indexes
}

function indentWidth(line) {
  let width = 0
  for (const ch of line) {
    if (ch === ' ') width += 1
    else if (ch === '\t') width += TAB_WIDTH - (width % TAB_WIDTH)
    else break
  }
  return width
}

/** The code the change view compares with: the student's editor code, else the starter. */
export function chooseChangeBase(editorCode, starterCode) {
  if (cleanCodeLines(editorCode).some((line) => line.trim())) return editorCode
  return typeof starterCode === 'string' ? starterCode : ''
}

/** Whether a stage asks for the change view: a Complete code stage with `show: 'change'`. */
export function stageShowsChange(stage) {
  return (
    !!stage &&
    getStageRole(stage) === 'complete' &&
    stage.show === 'change' &&
    typeof stage.code === 'string'
  )
}

// Line diff of two key lists: ops in order, each { op: 'same' | 'remove' | 'add', a, b } with the
// indexes it uses. Removes come before adds in a run, so a swap reads old then new.
function diffKeys(aKeys, bKeys) {
  let start = 0
  while (start < aKeys.length && start < bKeys.length && aKeys[start] === bKeys[start]) start += 1
  let endA = aKeys.length
  let endB = bKeys.length
  while (endA > start && endB > start && aKeys[endA - 1] === bKeys[endB - 1]) {
    endA -= 1
    endB -= 1
  }
  const ops = []
  for (let i = 0; i < start; i += 1) ops.push({ op: 'same', a: i, b: i })
  const n = endA - start
  const m = endB - start
  if (n * m > CHANGE_LIMITS.maxDiffCells) {
    for (let i = start; i < endA; i += 1) ops.push({ op: 'remove', a: i })
    for (let j = start; j < endB; j += 1) ops.push({ op: 'add', b: j })
  } else {
    // lcs[i][j]: the longest common run of a[start+i..endA) and b[start+j..endB).
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        lcs[i][j] =
          aKeys[start + i] === bKeys[start + j]
            ? lcs[i + 1][j + 1] + 1
            : Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n || j < m) {
      if (i < n && j < m && aKeys[start + i] === bKeys[start + j]) {
        ops.push({ op: 'same', a: start + i, b: start + j })
        i += 1
        j += 1
      } else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) {
        ops.push({ op: 'remove', a: start + i })
        i += 1
      } else {
        ops.push({ op: 'add', b: start + j })
        j += 1
      }
    }
  }
  for (let k = 0; endA + k < aKeys.length; k += 1)
    ops.push({ op: 'same', a: endA + k, b: endB + k })
  return ops
}

function countOf(keys, key) {
  let count = 0
  for (const k of keys) if (k === key) count += 1
  return count
}

function pairCountOf(keys, first, second) {
  let count = 0
  for (let i = 0; i + 1 < keys.length; i += 1) {
    if (keys[i] === first && keys[i + 1] === second) count += 1
  }
  return count
}

// The clearest unchanged line(s) naming where a hunk goes, by text: the line before it if that
// text is unique (in the student's code and the Complete), else the line after it, else the two
// lines before it as a pair. `before`/`after` are Complete item indexes (or -1 / past the end).
function findAnchor(beforeIndex, afterIndex, items, baseKeys, targetKeys, { allowAfterLine }) {
  const unique = (key) => countOf(baseKeys, key) === 1 && countOf(targetKeys, key) === 1
  if (beforeIndex >= 0 && unique(items[beforeIndex].key)) {
    return { lines: [items[beforeIndex].text], position: 'after' }
  }
  if (allowAfterLine && afterIndex < items.length && unique(items[afterIndex].key)) {
    return { lines: [items[afterIndex].text], position: 'before' }
  }
  if (beforeIndex >= 1) {
    const first = items[beforeIndex - 1].key
    const second = items[beforeIndex].key
    if (
      pairCountOf(baseKeys, first, second) === 1 &&
      pairCountOf(targetKeys, first, second) === 1
    ) {
      return { lines: [items[beforeIndex - 1].text, items[beforeIndex].text], position: 'after' }
    }
  }
  return null
}

function indentNote(lines) {
  if (!lines.length) return null
  const shifts = lines.map(({ from, to }) => to - from)
  const direction = shifts.every((d) => d > 0) ? 'in' : shifts.every((d) => d < 0) ? 'out' : 'mixed'
  const spaces = shifts.every((d) => d === shifts[0]) ? Math.abs(shifts[0]) : null
  return { lines: lines.map(({ text }) => text), direction, spaces }
}

/**
 * The change from `baseCode` (the student's code) to `targetCode` (the Complete stage):
 * - kind 'same': nothing to do ("Your code already matches this step").
 * - kind 'changes': `hunks`, each { anchor: { lines, position: 'after'|'before' } | null,
 *   rows: [{ type: 'add'|'remove', text }], indent: { lines, direction, spaces } | null }.
 * - kind 'fallback' (with `reason`: 'most' | 'many' | 'big-add' | 'no-anchor'): show the whole
 *   program instead; `hunks` is [].
 * `fullRows` (always): the whole Complete as [{ type: 'same'|'add'|'remove'|'indent', text }],
 * removed lines in place, for the fall-back and "Show all the code". Its rows other than
 * 'remove' are the Complete's cleaned lines in order (cleanCodeLineIndexes gives their places).
 */
export function computeStageChange(baseCode, targetCode) {
  const toItems = (code) =>
    cleanCodeLines(code)
      .map((text, index) => ({ text, index, key: text.trim(), width: indentWidth(text) }))
      .filter((item) => item.key !== '')
  const targetLines = cleanCodeLines(targetCode)
  const baseItems = toItems(baseCode)
  const targetItems = toItems(targetCode)
  const baseKeys = baseItems.map((item) => item.key)
  const targetKeys = targetItems.map((item) => item.key)
  const ops = diffKeys(baseKeys, targetKeys).map((op) =>
    op.op === 'same' && baseItems[op.a].width !== targetItems[op.b].width
      ? { ...op, op: 'indent' }
      : op
  )

  // The whole Complete, marked, with its own blank lines kept in place (trailing ones dropped).
  const fullRows = []
  let cursor = 0
  const typeOf = { same: 'same', indent: 'indent', add: 'add' }
  for (const op of ops) {
    if (op.op === 'remove') {
      fullRows.push({ type: 'remove', text: baseItems[op.a].text })
      continue
    }
    const item = targetItems[op.b]
    for (; cursor < item.index; cursor += 1)
      fullRows.push({ type: 'same', text: targetLines[cursor] })
    fullRows.push({ type: typeOf[op.op], text: item.text })
    cursor = item.index + 1
  }

  // Hunks: runs of changed ops, with the Complete item indexes either side of them.
  // Every op but a remove uses one Complete item, in order.
  const runs = []
  let open = null
  let targetSeen = 0
  for (const op of ops) {
    if (op.op === 'same') {
      open = null
      targetSeen += 1
      continue
    }
    if (!open) {
      open = { ops: [], before: targetSeen - 1 }
      runs.push(open)
    }
    open.ops.push(op)
    if (op.op !== 'remove') targetSeen += 1
    open.after = targetSeen
  }

  const result = (kind, hunks, reason = null) => ({ kind, reason, hunks, fullRows })
  if (!runs.length) return result('same', [])

  const changedTarget = ops.filter((op) => op.op === 'add' || op.op === 'indent').length
  const hunks = runs.map((run) => {
    const adds = run.ops.filter((op) => op.op === 'add')
    const removes = run.ops.filter((op) => op.op === 'remove')
    const rows = run.ops
      .filter((op) => op.op === 'add' || op.op === 'remove')
      .map((op) =>
        op.op === 'add'
          ? { type: 'add', text: targetItems[op.b].text }
          : { type: 'remove', text: baseItems[op.a].text }
      )
    const indent = indentNote(
      run.ops
        .filter((op) => op.op === 'indent')
        .map((op) => ({
          text: targetItems[op.b].text,
          from: baseItems[op.a].width,
          to: targetItems[op.b].width,
        }))
    )
    // New lines need a place. A swap's red line, or re-indented lines, are found by their own
    // text, so their anchor (the line before) is a help, not a must, and a swap never uses the
    // line after: the red line is already the "this line changes" row.
    const needsAnchor = adds.length > 0 && removes.length === 0
    const anchor =
      adds.length > 0 || removes.length > 0
        ? findAnchor(run.before, run.after, targetItems, baseKeys, targetKeys, {
            allowAfterLine: needsAnchor,
          })
        : null
    return { hunk: { anchor, rows, indent }, adds: adds.length, needsAnchor }
  })

  // A fall-back shows only the whole program (`fullRows`), so it has no hunks: a hunk there
  // could be a new line with no place.
  if (targetItems.length && changedTarget / targetItems.length > CHANGE_LIMITS.maxChangedShare) {
    return result('fallback', [], 'most')
  }
  if (!targetItems.length && baseItems.length) return result('fallback', [], 'most')
  if (hunks.length > CHANGE_LIMITS.maxHunks) return result('fallback', [], 'many')
  if (hunks.some(({ adds }) => adds > CHANGE_LIMITS.maxAddedBlock)) {
    return result('fallback', [], 'big-add')
  }
  if (hunks.some(({ hunk, needsAnchor }) => needsAnchor && !hunk.anchor)) {
    return result('fallback', [], 'no-anchor')
  }
  return result(
    'changes',
    hunks.map(({ hunk }) => hunk)
  )
}

// ---- Inline change inside a line (platform request 135) ----
// A changed line that only gains text, or has a small swap, shows once with only the changed part
// marked. The line is split into tokens (names, numbers, whole strings, whitespace, single
// punctuation), the tokens are diffed, and neighbouring changed tokens make one change. A string
// swapped for one that shares its start or end (whole words) shows only the words that differ.

const LINE_TOKEN =
  /[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|\s+|[^]/gu

function lineTokens(text) {
  return text.match(LINE_TOKEN) ?? []
}

const isBlank = (text) => text.trim() === ''
const isWordChar = (ch) => ch !== undefined && /[\p{L}\p{N}_]/u.test(ch)
const isStringToken = (token) => token.length >= 2 && /^(["'])[^]*\1$/.test(token)

// One string swapped for another: [prefix, old middle, new middle, suffix], cut only between
// words, or null when they share no more than their quotes.
function splitStrings(oldString, newString) {
  if (!isStringToken(oldString) || !isStringToken(newString) || oldString[0] !== newString[0]) {
    return null
  }
  const shorter = Math.min(oldString.length, newString.length)
  const cutsWord = (text, at) => isWordChar(text[at - 1]) && isWordChar(text[at])
  let start = 0
  while (start < shorter && oldString[start] === newString[start]) start += 1
  while (start > 1 && (cutsWord(oldString, start) || cutsWord(newString, start))) start -= 1
  let end = 0
  while (
    end < shorter - start &&
    oldString[oldString.length - 1 - end] === newString[newString.length - 1 - end]
  ) {
    end += 1
  }
  while (
    end > 1 &&
    (cutsWord(oldString, oldString.length - end) || cutsWord(newString, newString.length - end))
  ) {
    end -= 1
  }
  if (start <= 1 && end <= 1) return null
  return [
    oldString.slice(0, start),
    oldString.slice(start, oldString.length - end),
    newString.slice(start, newString.length - end),
    newString.slice(newString.length - end),
  ]
}

// Every change view pairs its removed and added lines on each render, so the answers are kept.
const inlineCache = new Map()
const INLINE_CACHE_SIZE = 500

/**
 * The change from `oldLine` to `newLine` inside the line, or null when the two lines should stay a
 * red row and a green row: the lines match, their indent widths differ, only spaces changed, more
 * than about half the characters of either line changed, or there are 3 or more separate changes.
 * Returns { kind: 'insert' | 'change', pieces: [{ type: 'same' | 'add' | 'remove', text }] }:
 * 'insert' when the line only gains text. The pieces spell the new line (with its own indent) once
 * the 'remove' pieces are left out; each change is its 'remove' piece, then its 'add' piece.
 */
export function inlineLineChange(oldLine, newLine) {
  if (typeof oldLine !== 'string' || typeof newLine !== 'string') return null
  const key = `${oldLine}\u0000${newLine}`
  if (inlineCache.has(key)) return inlineCache.get(key)
  const found = computeInlineChange(oldLine, newLine)
  if (inlineCache.size >= INLINE_CACHE_SIZE) inlineCache.clear()
  inlineCache.set(key, found)
  return found
}

function computeInlineChange(oldLine, newLine) {
  if (indentWidth(oldLine) !== indentWidth(newLine)) return null
  const oldText = oldLine.trim()
  const lead = newLine.match(/^\s*/)[0]
  const newText = newLine.trim()
  if (!oldText || !newText || oldText === newText) return null
  const share = CHANGE_LIMITS.inlineMaxChangedShare
  // Cheap checks first: one line much longer than the other always changes over the share, and a
  // line sharing neither its first nor its last token is a new line.
  const longer = Math.max(oldText.length, newText.length)
  if (Math.abs(oldText.length - newText.length) > longer * share) return null
  const oldTokens = lineTokens(oldText)
  const newTokens = lineTokens(newText)
  if (oldTokens[0] !== newTokens[0] && oldTokens.at(-1) !== newTokens.at(-1)) return null
  const ops = diffKeys(oldTokens, newTokens)

  const pieces = []
  let changes = 0
  let group = null
  const push = (type, text) => {
    if (text === '') return
    const last = pieces.at(-1)
    if (last?.type === type && type === 'same') last.text += text
    else pieces.push({ type, text })
  }
  const closeGroup = () => {
    if (!group) return
    const { remove, add, removeTokens, addTokens } = group
    group = null
    // Only spaces changed here: show the new spacing as it is, not as a change.
    if (isBlank(remove) && isBlank(add)) {
      push('same', add)
      return
    }
    changes += 1
    const strings =
      removeTokens.length === 1 && addTokens.length === 1
        ? splitStrings(removeTokens[0], addTokens[0])
        : null
    if (strings) {
      push('same', strings[0])
      push('remove', strings[1])
      push('add', strings[2])
      push('same', strings[3])
      return
    }
    push('remove', remove)
    push('add', add)
  }
  push('same', lead)
  for (const op of ops) {
    if (op.op === 'same') {
      closeGroup()
      push('same', newTokens[op.b])
      continue
    }
    if (!group) group = { remove: '', add: '', removeTokens: [], addTokens: [] }
    if (op.op === 'remove') {
      group.remove += oldTokens[op.a]
      group.removeTokens.push(oldTokens[op.a])
    } else {
      group.add += newTokens[op.b]
      group.addTokens.push(newTokens[op.b])
    }
  }
  closeGroup()

  if (!changes || changes >= CHANGE_LIMITS.inlineMaxChanges) return null
  const removed = changedLength(pieces, 'remove')
  const added = changedLength(pieces, 'add')
  if (removed / oldText.length > share || added / newText.length > share) return null
  return { kind: removed === 0 ? 'insert' : 'change', pieces }
}

function changedLength(pieces, type) {
  return pieces.reduce((sum, piece) => sum + (piece.type === type ? piece.text.length : 0), 0)
}

// The share of the two lines an inline change touches (lower: the closer pair).
function changedShare(inline, oldLine, newLine) {
  const changed = changedLength(inline.pieces, 'remove') + changedLength(inline.pieces, 'add')
  return changed / (oldLine.trim().length + newLine.trim().length)
}

/**
 * Change-view rows (ChangeHunk's `rows`, or the whole-program `fullRows`) with each removed line
 * and the new line that only extends it, or swaps a small piece of it, made one row: the new
 * line's row, with `inline` (inlineLineChange) and type 'add' (it only gains text) or 'change'.
 * Pairs only inside a run of removed and added rows, in order, each new line with the removed line
 * it changes least. A run with more than CHANGE_LIMITS.inlineMaxRunLines on a side, and every
 * other row, is kept as it is.
 */
export function pairInlineRows(rows) {
  const out = []
  let index = 0
  while (index < rows.length) {
    if (rows[index].type !== 'remove' && rows[index].type !== 'add') {
      out.push(rows[index])
      index += 1
      continue
    }
    const run = []
    while (index < rows.length && (rows[index].type === 'remove' || rows[index].type === 'add')) {
      run.push(rows[index])
      index += 1
    }
    const removeCount = run.filter((row) => row.type === 'remove').length
    const limit = CHANGE_LIMITS.inlineMaxRunLines
    if (!removeCount || removeCount > limit || run.length - removeCount > limit) {
      out.push(...run)
      continue
    }
    const merged = new Map()
    const dropped = new Set()
    let lastRemove = -1
    run.forEach((row, at) => {
      if (row.type !== 'add') return
      let best = null
      for (let r = lastRemove + 1; r < run.length; r += 1) {
        if (run[r].type !== 'remove') continue
        const inline = inlineLineChange(run[r].text, row.text)
        if (!inline) continue
        const share = changedShare(inline, run[r].text, row.text)
        if (!best || share < best.share) best = { r, inline, share }
      }
      if (!best) return
      dropped.add(best.r)
      lastRemove = best.r
      const type = best.inline.kind === 'insert' ? 'add' : 'change'
      merged.set(at, { ...row, type, inline: best.inline })
    })
    run.forEach((row, at) => {
      if (!dropped.has(at)) out.push(merged.get(at) ?? row)
    })
  }
  return out
}

/**
 * The Copy the Code panel's anchored look (`copyAfter` / `copyBefore`): { anchor, rows } with the
 * typed lines as adds, or null when neither field names a line (the panel looks as today).
 * `copyAfter` wins when both are set (the validator flags that). With `starter` (the task's
 * starter code, starterCodeOf), a typed line that only extends the anchor line, or the starter
 * line on the typed side of it (right after a copyAfter, right before a copyBefore), shows only
 * the extension (an 'add' row with `inline`); any other line stays all green.
 */
export function copyAnchorRows({ code, after, before, starter = '' }) {
  const named = (value) => typeof value === 'string' && value.trim() !== ''
  const position = named(after) ? 'after' : named(before) ? 'before' : null
  if (!position) return null
  const anchorText = (position === 'after' ? after : before).replace(/\s+$/, '')
  const typed = String(code ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
  while (typed.length && typed.at(-1) === '') typed.pop()
  const candidates = extensionCandidates(starter, anchorText, position)
  const extension = (text) => {
    if (!candidates.length || !text.trim()) return null
    const found = candidates
      .map((line) => inlineLineChange(line, text))
      .filter((inline) => inline?.kind === 'insert')
    return found.length === 1 ? found[0] : null
  }
  return {
    anchor: { lines: [anchorText], position },
    rows: typed.map((text) => {
      const inline = extension(text)
      return inline ? { type: 'add', text, inline } : { type: 'add', text }
    }),
  }
}

// The starter lines a typed line may extend: the anchor line (when its text names one line) and
// the next non-blank line on the side the typed lines go.
function extensionCandidates(starter, anchorText, position) {
  const lines = cleanCodeLines(starter).filter((line) => line.trim())
  const key = anchorText.trim()
  const matches = lines.flatMap((line, at) => (line.trim() === key ? [at] : []))
  if (matches.length !== 1) return []
  const at = matches[0]
  const next = lines[position === 'after' ? at + 1 : at - 1]
  return next === undefined ? [lines[at]] : [lines[at], next]
}
