// Pure logic for the Binary activity: conversions, task validation, grading and hints for the
// first four modes (make_number, to_binary, to_decimal, add). Node-safe so the CLI and the
// Builder share validation. See docs/architecture/modular-activities-plan.md (Phase 2.6).

export const BINARY_MODES = ['make_number', 'to_binary', 'to_decimal', 'add']
export const MIN_BITS = 1
export const MAX_BITS = 16
export const DEFAULT_BITS = 8

const BIT_STRING = /^[01]+$/

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
    default:
      return {}
  }
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
    } else if (task.mode === 'add') {
      if (!bitStringOk(item?.a) || !bitStringOk(item?.b)) {
        errors.push(`${label}: a and b must each be ${bits} binary digits (0s and 1s).`)
      } else if (fromBits(item.a) + fromBits(item.b) > maxValue(bits)) {
        errors.push(`${label}: a + b is too big for ${bits} bits (overflow comes in a later mode).`)
      }
    }
  })
  return errors
}

function firstWrongPlace(bits, expected) {
  const places = placeValues(bits.length)
  const index = [...bits].findIndex((bit, i) => bit !== expected[i])
  return index === -1 ? null : { place: places[index], shouldBe: expected[index] }
}

// Grade one item. itemState is what the student has entered: { bits } for make_number,
// to_binary and add (plus { carries } for add), { answer } for to_decimal. Hints use plain
// words for 8-14 year olds and never give the whole answer away.
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
