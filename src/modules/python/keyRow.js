// The Python touch key row (request #125): symbols that are fiddly to reach on an on-screen
// keyboard but come up constantly in Python source, most-used first (the colon leads).
// One list for both the row PythonEditor draws and the `key:<symbol>` highlight targets a tutor
// (or a task's `highlight`) can make glow (request #126, python/definition.js).
// `name` is what a screen reader says: "Your tutor is pointing at the open bracket key".
export const PYTHON_KEY_ROW = Object.freeze([
  { symbol: ':', name: 'colon' },
  // The Tab key: indents (not a typed symbol). It follows the colon, which ends the line it
  // indents the next one after. `label` is what the key shows, `title` its accessible name.
  { symbol: 'Tab', name: 'indent', label: '⇥', title: 'Indent (Tab)', indent: true },
  { symbol: '(', name: 'open bracket' },
  { symbol: ')', name: 'close bracket' },
  { symbol: '[', name: 'open square bracket' },
  { symbol: ']', name: 'close square bracket' },
  { symbol: '{', name: 'open curly bracket' },
  { symbol: '}', name: 'close curly bracket' },
  { symbol: '"', name: 'quote' },
  { symbol: "'", name: 'single quote' },
  { symbol: ',', name: 'comma' },
  { symbol: '=', name: 'equals' },
  { symbol: '#', name: 'hash' },
  { symbol: '\\', name: 'backslash' },
  { symbol: '%', name: 'percent' },
  { symbol: '+', name: 'plus' },
  { symbol: '-', name: 'minus' },
  { symbol: '*', name: 'star' },
  { symbol: '/', name: 'slash' },
  { symbol: '<', name: 'less than' },
  { symbol: '>', name: 'greater than' },
  { symbol: '!', name: 'exclamation mark' },
  { symbol: '.', name: 'full stop' },
  { symbol: '_', name: 'underscore' },
])

export const PYTHON_KEY_SYMBOLS = Object.freeze(PYTHON_KEY_ROW.map((key) => key.symbol))

// The calm code screen's key row (PythonEditor `calm`): one row of main keys and the rest behind
// "More keys". The common keys fill the main row after the task's own symbols; both rows are
// shown in this order.
export const PYTHON_COMMON_KEYS = Object.freeze(['Tab', '(', ')', '"', ',', '=', ':', '.'])
const KEY_DISPLAY_ORDER = Object.freeze([
  'Tab',
  '(',
  ')',
  '"',
  "'",
  ',',
  '=',
  ':',
  '.',
  '[',
  ']',
  '{',
  '}',
  '#',
  '%',
  '+',
  '-',
  '*',
  '/',
  '<',
  '>',
  '!',
  '_',
  '\\',
])
const byDisplayOrder = (a, b) => KEY_DISPLAY_ORDER.indexOf(a) - KEY_DISPLAY_ORDER.indexOf(b)
// The fewest main keys, however narrow the row.
const MIN_MAIN_KEYS = 4

// How often `code` uses a key's symbol (Tab: the lines it indents).
function keyUses(code, symbol) {
  if (symbol === 'Tab') return (code.match(/\n[ \t]+\S/g) ?? []).length
  return code.split(symbol).length - 1
}

/**
 * The text a task's key row is chosen from: its complete code, its code stages and its Type this
 * out text (the code the student is heading for), or '' without a task.
 */
export function taskKeyCode(task) {
  if (!task) return ''
  return [
    task.completeCode,
    ...(Array.isArray(task.codeStages) ? task.codeStages.map((stage) => stage?.code) : []),
    task.copyCode,
  ]
    .filter((text) => typeof text === 'string')
    .join('\n')
}

/**
 * Splits the key row for a task: `main` holds the symbols `code` uses (most used first, when
 * there are more than fit), then the common keys, at most `capacity` of them; `more` holds every
 * other key. Both in KEY_DISPLAY_ORDER.
 */
export function pythonKeyRows(code, capacity) {
  const text = String(code ?? '')
  const size = Math.max(MIN_MAIN_KEYS, Math.floor(capacity) || 0)
  const used = PYTHON_KEY_SYMBOLS.map((symbol) => ({ symbol, uses: keyUses(text, symbol) }))
    .filter((key) => key.uses > 0)
    .sort((a, b) => b.uses - a.uses || byDisplayOrder(a.symbol, b.symbol))
    .map((key) => key.symbol)
  const main = used.slice(0, size)
  for (const symbol of PYTHON_COMMON_KEYS) {
    if (main.length >= size) break
    if (!main.includes(symbol)) main.push(symbol)
  }
  main.sort(byDisplayOrder)
  const more = PYTHON_KEY_SYMBOLS.filter((symbol) => !main.includes(symbol)).sort(byDisplayOrder)
  return { main, more }
}

// symbol → "open bracket key", for the highlight target's spoken text.
export const PYTHON_KEY_SPOKEN = Object.freeze(
  Object.fromEntries(PYTHON_KEY_ROW.map((key) => [key.symbol, `${key.name} key`]))
)
