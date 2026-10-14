// Pure logic for the Keyboard activity's type_code mode: the student types a multi-line block
// of real code (Python or HTML), indentation included. Node-safe.
//
// The student's text only ever grows or shrinks at the end (there is no cursor to move), so
// each typed character is marked right or wrong by its position in the target, newlines and
// indentation included. At the start of a line Tab types spaces up to the next tab stop
// (4 for Python, 2 for HTML) and Backspace removes back to the previous one, as a code editor
// does; Enter types a newline with no auto-indent.
//
// Per-item result (also the shape typing history reads for every typing mode):
//   { mode: 'type_code', typed, accuracy, cpm, wpm, corrections, timeMs, source, done }

export const TYPE_CODE_LANGUAGES = ['python', 'html']
export const DEFAULT_TYPE_CODE_LANGUAGE = 'python'
export const TAB_WIDTH = { python: 4, html: 2 }
export const MAX_CODE_LENGTH = 1000
export const MAX_CODE_LINES = 30
// type_code forgives a slip or two by default; type_text defaults to exact.
export const DEFAULT_TYPE_CODE_ACCURACY = 0.9

export function tabWidthFor(language) {
  return TAB_WIDTH[language] ?? TAB_WIDTH[DEFAULT_TYPE_CODE_LANGUAGE]
}

// The block students type: Windows line endings made plain, tabs in the indentation turned
// into spaces (a tab stop per tab), trailing spaces and the YAML block's final newline dropped.
export function normaliseCode(code, language = DEFAULT_TYPE_CODE_LANGUAGE) {
  const width = tabWidthFor(language)
  return String(code ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const indent = line.match(/^[ \t]*/)[0]
      let columns = 0
      for (const char of indent)
        columns = char === '\t' ? (Math.floor(columns / width) + 1) * width : columns + 1
      return (' '.repeat(columns) + line.slice(indent.length)).replace(/[ \t]+$/, '')
    })
    .join('\n')
    .replace(/\n+$/, '')
}

// Validation messages for one type_code item (`label` is "Task N item M").
export function validateTypeCodeItem(item, label, isTypeable) {
  const errors = []
  if (typeof item?.code !== 'string' || item.code.trim() === '') {
    errors.push(`${label}: code is required.`)
    return errors
  }
  const lines = item.code.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
  if (item.code.length > MAX_CODE_LENGTH) {
    errors.push(`${label}: code must be at most ${MAX_CODE_LENGTH} characters.`)
  } else if (lines.length > MAX_CODE_LINES) {
    errors.push(`${label}: code must be at most ${MAX_CODE_LINES} lines.`)
  }
  if (lines.some((line) => /\S[^\t]*\t/.test(line))) {
    errors.push(
      `${label}: code has a Tab after the start of a line. Use spaces there; Tab only works for indentation.`
    )
  }
  const untypeable = [
    ...new Set(
      [...item.code].filter((c) => c !== '\n' && c !== '\r' && c !== '\t' && !isTypeable(c))
    ),
  ]
  if (untypeable.length) {
    errors.push(`${label}: code has characters that can't be typed: ${untypeable.join(' ')}`)
  }
  return errors
}

// True when `typed` ends inside the leading indentation of its current line.
function inIndentation(typed) {
  const lineStart = typed.lastIndexOf('\n') + 1
  return /^ *$/.test(typed.slice(lineStart))
}

// Applies one normalised keydown ({ key, mods }) to the typed text. Returns
// { typed, correction } or null when the key isn't a typing key (the browser keeps it).
export function applyTypeCodeKey(typed, event, language = DEFAULT_TYPE_CODE_LANGUAGE) {
  const { key } = event
  const width = tabWidthFor(language)
  if (event.mods?.mod || event.mods?.alt) return null
  if (key === 'Enter') return { typed: `${typed}\n`, correction: false }
  if (key === 'Tab') {
    // Tab only indents; anywhere else it does nothing (but stays in the typing area).
    if (event.mods?.shift || !inIndentation(typed)) return { typed, correction: false }
    const column = typed.length - (typed.lastIndexOf('\n') + 1)
    const stop = (Math.floor(column / width) + 1) * width
    return { typed: typed + ' '.repeat(stop - column), correction: false }
  }
  if (key === 'Backspace') {
    if (!typed) return { typed, correction: false }
    const column = typed.length - (typed.lastIndexOf('\n') + 1)
    if (column > 0 && inIndentation(typed)) {
      // In the indentation, Backspace takes off a whole tab stop, as an editor does.
      const stop = Math.floor((column - 1) / width) * width
      return { typed: typed.slice(0, typed.length - (column - stop)), correction: true }
    }
    return { typed: typed.slice(0, -1), correction: true }
  }
  if (key.length === 1) return { typed: typed + key, correction: false }
  return null
}

// Each typed character marked against the target: 'ok' or 'bad', by position.
export function markTypedCode(target, typed) {
  return [...String(typed ?? '')].map((char, i) => (char === target[i] ? 'ok' : 'bad'))
}

// Accuracy, characters a minute (correct characters only) and words a minute (cpm / 5).
export function typeCodeStats(target, typed, timeMs) {
  const text = String(typed ?? '')
  let correct = 0
  for (let i = 0; i < text.length; i += 1) if (text[i] === target[i]) correct += 1
  const accuracy = text.length ? correct / text.length : 1
  const minutes = timeMs > 0 ? timeMs / 60000 : 0
  const cpm = minutes > 0 ? Math.round(correct / minutes) : 0
  return {
    correct,
    accuracy: Math.round(accuracy * 1000) / 1000,
    cpm,
    wpm: Math.round((cpm / 5) * 10) / 10,
  }
}

// Wrong characters that are spaces at the start of a line (indentation slips).
function indentationSlips(target, typed) {
  let lineStart = true
  let slips = 0
  for (let i = 0; i < typed.length; i += 1) {
    if (lineStart && (typed[i] === ' ' || target[i] === ' ') && typed[i] !== target[i]) slips += 1
    if (typed[i] === '\n') lineStart = true
    else if (typed[i] !== ' ') lineStart = false
  }
  return slips
}

// Grade one type_code item from its stored result.
export function gradeTypeCodeItem(task, item, result = {}) {
  const target = normaliseCode(item?.code, task?.language)
  const typed = String(result.typed ?? '')
  if (typed.length < target.length) {
    return { correct: false, hint: 'Keep going: type the whole block, line by line.' }
  }
  const minAccuracy = task?.minAccuracy ?? DEFAULT_TYPE_CODE_ACCURACY
  if ((result.accuracy ?? typeCodeStats(target, typed, 0).accuracy) < minAccuracy) {
    const width = tabWidthFor(task?.language)
    return {
      correct: false,
      hint:
        indentationSlips(target, typed) > 0
          ? `Check the spaces at the start of each line. Press Tab once for each step in (${width} spaces).`
          : 'Look for the red letters and symbols, then try again a little slower.',
    }
  }
  if (task?.targetCpm && (result.cpm ?? 0) < task.targetCpm) {
    return {
      correct: false,
      hint: `Nearly! Try again a little faster (aim for ${task.targetCpm} characters a minute).`,
    }
  }
  if (item?.hardwareOnly && result.source === 'virtual') {
    return { correct: false, hint: 'Use a real keyboard for this one.' }
  }
  return { correct: true, hint: null }
}

export function typeCodeSolution(task, item) {
  const typed = normaliseCode(item?.code, task?.language)
  const cpm = task?.targetCpm ?? 0
  return {
    mode: 'type_code',
    typed,
    accuracy: 1,
    cpm,
    wpm: Math.round((cpm / 5) * 10) / 10,
    corrections: 0,
    timeMs: 0,
    source: 'hardware',
    done: true,
  }
}

// ─── Syntax colouring (display only) ─────────────────────────────────────────
// One class per character of `code`: 'kw' keyword, 'str' string, 'com' comment, 'num' number,
// 'tag' HTML tag name or bracket, 'attr' HTML attribute name, or '' for plain text. A small
// tokeniser on purpose: it only colours the block students copy, so it never needs to be exact.

const PYTHON_KEYWORDS = new Set(
  'False None True and as assert break class continue def del elif else except finally for from global if import in is lambda not or pass print input range return while with yield len int str float'.split(
    ' '
  )
)

function colourPython(code) {
  const classes = new Array(code.length).fill('')
  const fill = (from, to, cls) => {
    for (let i = from; i < to; i += 1) classes[i] = cls
  }
  let i = 0
  while (i < code.length) {
    const char = code[i]
    if (char === '#') {
      const end = code.indexOf('\n', i)
      const stop = end === -1 ? code.length : end
      fill(i, stop, 'com')
      i = stop
    } else if (char === '"' || char === "'") {
      let j = i + 1
      while (j < code.length && code[j] !== char && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
      fill(i, Math.min(j + 1, code.length), 'str')
      i = j + 1
    } else if (/[0-9]/.test(char) && !/[A-Za-z_]/.test(code[i - 1] ?? '')) {
      let j = i
      while (j < code.length && /[0-9.]/.test(code[j])) j += 1
      fill(i, j, 'num')
      i = j
    } else if (/[A-Za-z_]/.test(char)) {
      let j = i
      while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) j += 1
      if (PYTHON_KEYWORDS.has(code.slice(i, j))) fill(i, j, 'kw')
      i = j
    } else {
      i += 1
    }
  }
  return classes
}

function colourHtml(code) {
  const classes = new Array(code.length).fill('')
  let i = 0
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i)
      const stop = end === -1 ? code.length : end + 3
      for (let k = i; k < stop; k += 1) classes[k] = 'com'
      i = stop
    } else if (code[i] === '<') {
      const end = code.indexOf('>', i)
      const stop = end === -1 ? code.length : end + 1
      let k = i
      // '<' or '</' and the tag name
      while (k < stop && !/\s/.test(code[k]) && code[k] !== '>') classes[k++] = 'tag'
      while (k < stop) {
        if (code[k] === '"' || code[k] === "'") {
          const quote = code[k]
          const close = code.indexOf(quote, k + 1)
          const until = close === -1 || close >= stop ? stop - 1 : close + 1
          while (k < until) classes[k++] = 'str'
        } else if (/[A-Za-z-]/.test(code[k])) {
          while (k < stop && /[A-Za-z0-9-]/.test(code[k])) classes[k++] = 'attr'
        } else {
          if (code[k] === '>' || code[k] === '/') classes[k] = 'tag'
          k += 1
        }
      }
      i = stop
    } else {
      i += 1
    }
  }
  return classes
}

export function codeColourClasses(code, language = DEFAULT_TYPE_CODE_LANGUAGE) {
  const text = String(code ?? '')
  return language === 'html' ? colourHtml(text) : colourPython(text)
}
