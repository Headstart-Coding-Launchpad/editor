const MAX_STREAMED_OUTPUT = 20_000
const MAX_DISPLAY_LINES = 100
export const OUTPUT_TRUNCATED_MESSAGE = '[Output truncated - stop the program to continue]'

export function collapseStudentOutputForDisplay(output, maxLines = MAX_DISPLAY_LINES) {
  const lines = output.split('\n')
  if (lines.length <= maxLines) return output
  const hidden = lines.length - maxLines
  return `[${hidden} earlier lines hidden]\n` + lines.slice(-maxLines).join('\n')
}

export function createStudentOutputBuffer(output = '', options = {}) {
  const maxDisplayLines = options.maxDisplayLines ?? MAX_DISPLAY_LINES
  return {
    raw: output,
    display: collapseStudentOutputForDisplay(output, maxDisplayLines),
    capReached: false,
  }
}

export function appendStudentOutput(buffer, text, options = {}) {
  if (buffer.capReached) return buffer

  const maxStreamedOutput = options.maxStreamedOutput ?? MAX_STREAMED_OUTPUT
  const maxDisplayLines = options.maxDisplayLines ?? MAX_DISPLAY_LINES
  let raw = buffer.raw + text
  let capReached = false

  if (raw.length > maxStreamedOutput) {
    raw = raw.slice(0, maxStreamedOutput) + `\n${OUTPUT_TRUNCATED_MESSAGE}`
    capReached = true
  }

  return {
    raw,
    display: collapseStudentOutputForDisplay(raw, maxDisplayLines),
    capReached,
  }
}
