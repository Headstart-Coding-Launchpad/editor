// Large pastes into a student's code editor are flagged to the teacher (StudentCard,
// StudentModal, session report) rather than blocked. Short snippets — a variable
// name, one line of an example — don't count.
export const PASTE_FLAG_MIN_CHARS = 40
export const PASTE_FLAG_MIN_LINES = 3

function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

export function measurePaste(text) {
  const normalized = normalize(text)
  return { chars: normalized.length, lines: normalized ? normalized.split('\n').length : 0 }
}

export function isFlaggablePaste(text) {
  const { chars, lines } = measurePaste(text)
  return chars >= PASTE_FLAG_MIN_CHARS || lines >= PASTE_FLAG_MIN_LINES
}

// Moving your own code around (copy/cut then paste in the same editor) isn't copying.
export function isSamePasteText(a, b) {
  return normalize(a) !== '' && normalize(a) === normalize(b)
}
