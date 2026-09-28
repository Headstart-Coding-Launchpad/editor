// Pure logic for the Binary activity: conversions, task validation, grading and hints. v1 modes
// (make_number, to_binary, to_decimal, add; plan step 2.6) plus the follow-ups (overflow, hex,
// ascii, pixels; step 2.7). Node-safe so the CLI and the Builder share validation. See
// docs/architecture/modular-activities-plan.md.

export const BINARY_MODES = [
  'make_number',
  'to_binary',
  'to_decimal',
  'add',
  'overflow',
  'hex',
  'ascii',
  'pixels',
]
export const MIN_BITS = 1
export const MAX_BITS = 16
export const DEFAULT_BITS = 8

export const HEX_BASES = ['binary', 'hex', 'decimal']
export const ASCII_DIRECTIONS = ['encode', 'decode']
export const ASCII_CODE_FORMATS = ['binary', 'decimal']
export const ASCII_MIN = 32
export const ASCII_MAX = 126
export const ASCII_MAX_TEXT = 16
export const PIXEL_DIRECTIONS = ['draw', 'encode']
export const MAX_PIXELS_SIDE = 16
// Serialised answers must stay well under the ~2 KB currentAnswer budget (activities.md).
export const MAX_STATE_CHARS = 1800

const BIT_STRING = /^[01]+$/
const HEX_STRING = /^[0-9a-f]+$/i

export const maxValue = (bits) => 2 ** bits - 1

export function toBits(value, bits) {
  return Math.trunc(value).toString(2).padStart(bits, '0').slice(-bits)
}

export function fromBits(bitString) {
  if (!BIT_STRING.test(String(bitString ?? ''))) return null
  return parseInt(bitString, 2)
}

// Place value of each column, left to right: 8 bits -> [128, 64, ..., 1].
export function placeValues(bits) {
  return Array.from({ length: bits }, (_, i) => 2 ** (bits - 1 - i))
}

// Carry INTO each column (left to right, same length as the result) when adding a + b. The
// rightmost column never receives a carry, so it is always '0'.
export function carriesFor(a, b) {
  const bits = a.length
  const carries = Array(bits).fill('0')
  let carry = 0
  for (let i = bits - 1; i >= 0; i -= 1) {
    carries[i] = String(carry)
    const sum = Number(a[i]) + Number(b[i]) + carry
    carry = sum >= 2 ? 1 : 0
  }
  return carries.join('')
}

function taskBits(task) {
  return task?.bits ?? DEFAULT_BITS
}

// ── hex helpers ──────────────────────────────────────────────────────────────

// Numeric value of a hex-mode item's `value` read in its `from` base, or null when invalid.
export function parseInBase(value, base) {
  const text = String(value ?? '').trim()
  if (base === 'binary') return BIT_STRING.test(text) ? parseInt(text, 2) : null
  if (base === 'hex') return HEX_STRING.test(text) ? parseInt(text, 16) : null
  if (base === 'decimal') return /^\d+$/.test(text) ? parseInt(text, 10) : null
  return null
}

export function formatInBase(number, base, bits) {
  if (base === 'binary') return toBits(number, bits)
  if (base === 'hex') return number.toString(16).toUpperCase()
  return String(number)
}

// ── ascii helpers ────────────────────────────────────────────────────────────

export function isPrintableAscii(text) {
  return [...String(text)].every((ch) => {
    const code = ch.codePointAt(0)
    return code >= ASCII_MIN && code <= ASCII_MAX
  })
}

export function asciiCode(ch, format) {
  const code = ch.charCodeAt(0)
  return format === 'decimal' ? String(code) : toBits(code, 8)
}

// Every printable character as { char, code, binary } for the lookup table.
export function asciiTable() {
  return Array.from({ length: ASCII_MAX - ASCII_MIN + 1 }, (_, i) => {
    const code = ASCII_MIN + i
    return { char: String.fromCharCode(code), code, binary: toBits(code, 8) }
  })
}

// How a character is named in hints and labels ("space" rather than an invisible " ").
export function charName(ch) {
  return ch === ' ' ? 'space' : `"${ch}"`
}

function codeFormatOf(task) {
  return task?.codeFormat ?? 'binary'
}

// ── solutions ────────────────────────────────────────────────────────────────

// The correct answer for one item, in the form the student produces it.
export function solutionFor(task, item) {
  const bits = taskBits(task)
  switch (task?.mode) {
    case 'make_number':
    case 'to_binary':
      return { bits: toBits(item.target, bits) }
    case 'to_decimal':
      return { answer: String(fromBits(item.value)) }
    case 'add': {
      const sum = (fromBits(item.a) + fromBits(item.b)) % 2 ** bits
      return { bits: toBits(sum, bits), carries: carriesFor(item.a, item.b) }
    }
    case 'overflow': {
      const sum = (fromBits(item.a) + fromBits(item.b)) % 2 ** bits
      return { bits: toBits(sum, bits), carries: carriesFor(item.a, item.b), overflow: 'yes' }
    }
    case 'hex': {
      const number = parseInBase(item.value, item.from)
      if (number == null) return {}
      return item.to === 'binary'
        ? { bits: toBits(number, bits) }
        : { answer: formatInBase(number, item.to, bits) }
    }
    case 'ascii': {
      const text = String(item.text ?? '')
      return item.direction === 'decode'
        ? { answer: text }
        : { codes: [...text].map((ch) => asciiCode(ch, codeFormatOf(task))) }
    }
    case 'pixels': {
      const rows = Array.isArray(item.rows) ? item.rows.map(String) : []
      return item.direction === 'encode' ? { rows } : { cells: rows }
    }
    default:
      return {}
  }
}

// ── validation ───────────────────────────────────────────────────────────────

function validateHexItem(item, label, bits, errors) {
  if (!HEX_BASES.includes(item?.from) || !HEX_BASES.includes(item?.to) || item.from === item.to) {
    errors.push(`${label}: from and to must be two different bases: binary, hex or decimal.`)
    return
  }
  const text = String(item.value ?? '').trim()
  if (item.from === 'binary') {
    if (!BIT_STRING.test(text) || text.length !== bits) {
      errors.push(`${label}: value must be ${bits} binary digits (0s and 1s).`)
    }
  } else if (item.from === 'hex') {
    const number = parseInBase(text, 'hex')
    if (number == null || number > maxValue(bits)) {
      errors.push(
        `${label}: value must be a hex number (0-9, A-F) from 0 to ${formatInBase(maxValue(bits), 'hex')}.`
      )
    }
  } else {
    const number = parseInBase(text, 'decimal')
    if (number == null || number > maxValue(bits)) {
      errors.push(`${label}: value must be a whole number from 0 to ${maxValue(bits)}.`)
    }
  }
}

function validateAsciiItem(item, label, errors) {
  if (!ASCII_DIRECTIONS.includes(item?.direction)) {
    errors.push(`${label}: ascii direction must be encode or decode.`)
  }
  const text = item?.text
  if (
    typeof text !== 'string' ||
    text.length === 0 ||
    text.length > ASCII_MAX_TEXT ||
    !isPrintableAscii(text)
  ) {
    errors.push(
      `${label}: text must be 1 to ${ASCII_MAX_TEXT} printable ASCII characters (letters, digits, spaces and symbols).`
    )
  }
}

function validatePixelsItem(item, label, width, height, errors) {
  if (!PIXEL_DIRECTIONS.includes(item?.direction)) {
    errors.push(`${label}: pixels direction must be draw or encode.`)
  }
  const rows = item?.rows
  const ok =
    Array.isArray(rows) &&
    rows.length === height &&
    rows.every((row) => typeof row === 'string' && BIT_STRING.test(row) && row.length === width)
  if (!ok) {
    errors.push(`${label}: rows must be ${height} rows of ${width} binary digits (0s and 1s).`)
  }
}

function sizeOk(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_PIXELS_SIDE
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
export function validateBinaryTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const bits = taskBits(task)
  if (!BINARY_MODES.includes(task?.mode)) {
    errors.push(`${where}: binary mode must be one of ${BINARY_MODES.join(', ')}.`)
    return errors
  }
  if (!Number.isInteger(bits) || bits < MIN_BITS || bits > MAX_BITS) {
    errors.push(`${where}: binary bits must be a whole number from ${MIN_BITS} to ${MAX_BITS}.`)
    return errors
  }
  if (task.mode === 'pixels' && (!sizeOk(task.width) || !sizeOk(task.height))) {
    errors.push(
      `${where}: binary pixels width and height must be whole numbers from 1 to ${MAX_PIXELS_SIDE}.`
    )
    return errors
  }
  if (
    task.mode === 'ascii' &&
    task.codeFormat != null &&
    !ASCII_CODE_FORMATS.includes(task.codeFormat)
  ) {
    errors.push(`${where}: binary codeFormat must be binary or decimal.`)
  }
  const items = Array.isArray(task.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: binary task needs at least one item.`)
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    const id = item?.id
    if (id == null || id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(id))) errors.push(`${label}: id "${id}" is used more than once.`)
    seen.add(String(id))
    const bitStringOk = (value) => BIT_STRING.test(String(value ?? '')) && value.length === bits
    if (task.mode === 'make_number' || task.mode === 'to_binary') {
      if (!Number.isInteger(item?.target) || item.target < 0 || item.target > maxValue(bits)) {
        errors.push(`${label}: target must be a whole number from 0 to ${maxValue(bits)}.`)
      }
    } else if (task.mode === 'to_decimal') {
      if (!bitStringOk(item?.value)) {
        errors.push(`${label}: value must be ${bits} binary digits (0s and 1s).`)
      }
    } else if (task.mode === 'add' || task.mode === 'overflow') {
      if (!bitStringOk(item?.a) || !bitStringOk(item?.b)) {
        errors.push(`${label}: a and b must each be ${bits} binary digits (0s and 1s).`)
      } else if (task.mode === 'add' && fromBits(item.a) + fromBits(item.b) > maxValue(bits)) {
        errors.push(`${label}: a + b is too big for ${bits} bits (use mode: overflow for that).`)
      } else if (
        task.mode === 'overflow' &&
        fromBits(item.a) + fromBits(item.b) <= maxValue(bits)
      ) {
        errors.push(`${label}: a + b fits in ${bits} bits, so it does not overflow.`)
      }
    } else if (task.mode === 'hex') {
      validateHexItem(item, label, bits, errors)
    } else if (task.mode === 'ascii') {
      validateAsciiItem(item, label, errors)
    } else if (task.mode === 'pixels') {
      validatePixelsItem(item, label, task.width, task.height, errors)
    }
  })
  // The newer modes carry longer answers (codes, pixel rows): keep a finished task's saved
  // answers inside the live-sync budget.
  if (errors.length === 0 && ['ascii', 'pixels', 'hex', 'overflow'].includes(task.mode)) {
    const size = JSON.stringify({
      v: 1,
      items: Object.fromEntries(items.map((item) => [item.id, solutionFor(task, item)])),
    }).length
    if (size > MAX_STATE_CHARS) {
      errors.push(
        `${where}: binary task has too much to save (${size} characters of answers, limit ${MAX_STATE_CHARS}). Use fewer or smaller items.`
      )
    }
  }
  return errors
}

// ── grading ──────────────────────────────────────────────────────────────────

function firstWrongPlace(bits, expected) {
  const places = placeValues(bits.length)
  const index = [...bits].findIndex((bit, i) => bit !== expected[i])
  return index === -1 ? null : { place: places[index], shouldBe: expected[index] }
}

const LOST_CARRY_HINT =
  'The last carry had no column left to go into, so it was lost. That is an overflow.'

function gradeOverflow(task, item, itemState, solution) {
  const bits = taskBits(task)
  const entered = itemState.bits ?? '0'.repeat(bits)
  const carriesOk = !task.requireCarries || itemState.carries === solution.carries
  const answered = itemState.overflow === 'yes' || itemState.overflow === 'no'
  if (entered === solution.bits && carriesOk && itemState.overflow === 'yes') {
    return { correct: true, hint: null }
  }
  if (entered !== solution.bits) {
    const wrong = firstWrongPlace(entered, solution.bits)
    return {
      correct: false,
      hint: `Check the ${wrong.place} column. Remember 1 + 1 = 10 in binary, so carry the 1. Only ${bits} bits fit in the answer.`,
    }
  }
  if (!carriesOk) {
    return { correct: false, hint: 'Your answer is right. Now fill in the carries too.' }
  }
  if (!answered) {
    return { correct: false, hint: 'Your bits are right. Now answer: did it overflow?' }
  }
  return { correct: false, hint: LOST_CARRY_HINT }
}

function normaliseHex(answer) {
  return String(answer ?? '')
    .trim()
    .replace(/^0x/i, '')
}

function gradeHex(task, item, itemState, solution) {
  const bits = taskBits(task)
  if (item.to === 'binary') {
    const entered = itemState.bits ?? '0'.repeat(bits)
    if (entered === solution.bits) return { correct: true, hint: null }
    const wrong = firstWrongPlace(entered, solution.bits)
    return {
      correct: false,
      hint:
        item.from === 'hex'
          ? `Not quite. Each hex digit makes a group of 4 bits. Check the ${wrong.place} column.`
          : `Not quite. Check the ${wrong.place} column.`,
    }
  }
  if (item.to === 'hex') {
    const answer = normaliseHex(itemState.answer)
    if (!HEX_STRING.test(answer)) {
      return { correct: false, hint: 'Type a hex number using 0-9 and A-F.' }
    }
    if (parseInt(answer, 16) === parseInt(solution.answer, 16)) return { correct: true, hint: null }
    return {
      correct: false,
      hint:
        item.from === 'binary'
          ? 'Not quite. Split the bits into groups of 4 from the right. Each group is one hex digit (1010 = A, 1111 = F).'
          : 'Not quite. Each hex digit is worth 16 times the digit to its right. A = 10, B = 11 … F = 15.',
    }
  }
  const answer = String(itemState.answer ?? '').trim()
  if (!/^\d+$/.test(answer)) return { correct: false, hint: 'Type a whole number.' }
  if (parseInt(answer, 10) === parseInt(solution.answer, 10)) return { correct: true, hint: null }
  return {
    correct: false,
    hint:
      item.from === 'hex'
        ? 'Not quite. Multiply each hex digit by its place value (1, 16, 256 …) and add them up. A = 10 … F = 15.'
        : 'Not quite. Add up the place values of the columns with a 1.',
  }
}

function gradeAscii(task, item, itemState, solution) {
  const text = String(item.text ?? '')
  const format = codeFormatOf(task)
  if (item.direction === 'decode') {
    const answer = String(itemState.answer ?? '')
    if (answer === text) return { correct: true, hint: null }
    if (answer.length !== text.length) {
      return {
        correct: false,
        hint: `There are ${text.length} codes, so your answer needs ${text.length} characters (a space counts too).`,
      }
    }
    const index = [...answer].findIndex((ch, i) => ch !== text[i])
    const caseOnly = answer.toLowerCase() === text.toLowerCase()
    return {
      correct: false,
      hint: caseOnly
        ? `Check character ${index + 1}. Capital and small letters have different codes.`
        : `Check character ${index + 1}. Look up its code${task.showTable ? ' in the table' : ''}.`,
    }
  }
  const codes = Array.isArray(itemState.codes) ? itemState.codes : []
  const valueOf = (code) =>
    format === 'decimal'
      ? /^\d+$/.test(String(code ?? '').trim())
        ? parseInt(String(code).trim(), 10)
        : null
      : fromBits(String(code ?? '').trim())
  const index = solution.codes.findIndex((expected, i) => valueOf(codes[i]) !== valueOf(expected))
  if (index === -1) return { correct: true, hint: null }
  if (String(codes[index] ?? '').trim() === '') {
    return { correct: false, hint: `Fill in a code for every character.` }
  }
  return {
    correct: false,
    hint: task.showTable
      ? `Check the code for ${charName(text[index])}. Find it in the ASCII table.`
      : `Check the code for ${charName(text[index])}. Capital A is 65, and each letter after it is one more.`,
  }
}

function gradePixels(task, item, itemState, solution) {
  const width = task.width
  if (item.direction === 'encode') {
    const rows = Array.isArray(itemState.rows) ? itemState.rows : []
    const index = solution.rows.findIndex((row, i) => String(rows[i] ?? '').trim() !== row)
    if (index === -1) return { correct: true, hint: null }
    const entered = String(rows[index] ?? '').trim()
    if (entered.length !== width) {
      return {
        correct: false,
        hint: `Row ${index + 1} needs ${width} digits, one for each square.`,
      }
    }
    return {
      correct: false,
      hint: `Check row ${index + 1}. Write 1 for a filled square and 0 for an empty one, left to right.`,
    }
  }
  const cells = Array.isArray(itemState.cells) ? itemState.cells : []
  const index = solution.cells.findIndex((row, i) => cells[i] !== row)
  if (index === -1) return { correct: true, hint: null }
  return {
    correct: false,
    hint: `Check row ${index + 1}. Each 1 is a filled square and each 0 is an empty one.`,
  }
}

// Grade one item. itemState is what the student has entered: { bits } for make_number,
// to_binary and add (plus { carries } for add), { answer } for to_decimal; overflow adds
// { overflow: 'yes' | 'no' }; hex is { bits } (to binary) or { answer }; ascii is { codes }
// (encode) or { answer } (decode); pixels is { cells } (draw) or { rows } (encode). Hints use
// plain words for 8-14 year olds and never give the whole answer away.
export function gradeItem(task, item, itemState = {}) {
  const bits = taskBits(task)
  const solution = solutionFor(task, item)
  switch (task?.mode) {
    case 'make_number':
    case 'to_binary': {
      const entered = itemState.bits ?? '0'.repeat(bits)
      if (entered === solution.bits) return { correct: true, hint: null }
      const value = fromBits(entered)
      const wrong = firstWrongPlace(entered, solution.bits)
      const direction = value < item.target ? 'too small' : 'too big'
      return {
        correct: false,
        hint:
          task.mode === 'make_number'
            ? `Your bits make ${value}, which is ${direction}. Check the ${wrong.place} column.`
            : `Not quite. Check the ${wrong.place} column.`,
      }
    }
    case 'to_decimal': {
      const answer = String(itemState.answer ?? '').trim()
      if (answer === solution.answer) return { correct: true, hint: null }
      if (!/^\d+$/.test(answer)) return { correct: false, hint: 'Type a whole number.' }
      return {
        correct: false,
        hint: 'Not quite. Add up the place values of the columns with a 1.',
      }
    }
    case 'add': {
      const entered = itemState.bits ?? '0'.repeat(bits)
      const carriesOk = !task.requireCarries || itemState.carries === solution.carries
      if (entered === solution.bits && carriesOk) return { correct: true, hint: null }
      if (entered === solution.bits) {
        return { correct: false, hint: 'Your answer is right. Now fill in the carries too.' }
      }
      const wrong = firstWrongPlace(entered, solution.bits)
      return {
        correct: false,
        hint: `Check the ${wrong.place} column. Remember 1 + 1 = 10 in binary, so carry the 1.`,
      }
    }
    case 'overflow':
      return gradeOverflow(task, item, itemState ?? {}, solution)
    case 'hex':
      return gradeHex(task, item, itemState ?? {}, solution)
    case 'ascii':
      return gradeAscii(task, item, itemState ?? {}, solution)
    case 'pixels':
      return gradePixels(task, item, itemState ?? {}, solution)
    default:
      return { correct: false, hint: null }
  }
}

// Whole-task progress for the teacher card and completion: { total, correct, done }.
export function gradeTask(task, state = {}) {
  const items = task?.items ?? []
  const results = items.map((item) => gradeItem(task, item, state.items?.[item.id]))
  const correct = results.filter((r) => r.correct).length
  return { total: items.length, correct, done: items.length > 0 && correct === items.length }
}
