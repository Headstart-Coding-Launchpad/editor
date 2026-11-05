// The Python touch key row (request #125): symbols that are fiddly to reach on an on-screen
// keyboard but come up constantly in Python source, most-used first (the colon leads).
// One list for both the row PythonEditor draws and the `key:<symbol>` highlight targets a tutor
// (or a task's `highlight`) can make glow (request #126, python/definition.js).
// `name` is what a screen reader says: "Your tutor is pointing at the open bracket key".
export const PYTHON_KEY_ROW = Object.freeze([
  { symbol: ':', name: 'colon' },
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

// symbol → "open bracket key", for the highlight target's spoken text.
export const PYTHON_KEY_SPOKEN = Object.freeze(
  Object.fromEntries(PYTHON_KEY_ROW.map((key) => [key.symbol, `${key.name} key`]))
)
