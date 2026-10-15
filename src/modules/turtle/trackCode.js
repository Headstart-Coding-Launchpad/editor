/**
 * Turtle course mode (./course.js): a track's optional `trackCode`, a short Turtle snippet whose
 * drawn lines become walls. Pure JS, no Pyodide: the snippet is read here, not run, so the track
 * can be drawn before the student's first Run, in the Builder and by `lessons validate`.
 *
 * It understands a small, fixed part of Turtle, enough to draw a track:
 * - forward/fd, backward/bk/back, left/lt, right/rt, goto/setpos/setposition, setheading/seth,
 *   home, penup/pu/up, pendown/pd/down and circle(radius, extent), with plain numbers;
 * - `for <name> in range(<n>):` with an indented block (nested loops too);
 * - `import turtle` / `from turtle import *` lines, blank lines and # comments are skipped;
 * - an optional `turtle.` (or any `name.`) before a command.
 * Anything else is an authoring error naming the line (validation reports it).
 *
 * The snippet's turtle starts at (0, 0) facing east with the pen down, like real turtle.
 */

const DEG2RAD = Math.PI / 180
export const TRACK_CODE_MAX_SEGMENTS = 2000
const MAX_STEPS = 20000

const COMMAND_ALIASES = {
  forward: 'forward',
  fd: 'forward',
  backward: 'backward',
  bk: 'backward',
  back: 'backward',
  left: 'left',
  lt: 'left',
  right: 'right',
  rt: 'right',
  goto: 'goto',
  setpos: 'goto',
  setposition: 'goto',
  setheading: 'setheading',
  seth: 'setheading',
  home: 'home',
  penup: 'penup',
  pu: 'penup',
  up: 'penup',
  pendown: 'pendown',
  pd: 'pendown',
  down: 'pendown',
  circle: 'circle',
}

const ARG_COUNTS = {
  forward: [1, 1],
  backward: [1, 1],
  left: [1, 1],
  right: [1, 1],
  goto: [2, 2],
  setheading: [1, 1],
  home: [0, 0],
  penup: [0, 0],
  pendown: [0, 0],
  circle: [1, 2],
}

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function stripComment(line) {
  const hash = line.indexOf('#')
  return (hash >= 0 ? line.slice(0, hash) : line).replace(/\s+$/, '')
}

function indentOf(line) {
  return line.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length
}

/** Reads the snippet into a tree of { kind: 'call' | 'loop', line, ... } nodes, or { error }. */
function parseLines(source) {
  const raw = String(source ?? '').split(/\r?\n/)
  const lines = []
  raw.forEach((text, index) => {
    const code = stripComment(text)
    if (!code.trim()) return
    const trimmed = code.trim()
    if (/^import\s+turtle\b/.test(trimmed) || /^from\s+turtle\s+import\b/.test(trimmed)) return
    lines.push({ indent: indentOf(code), text: trimmed, line: index + 1 })
  })

  let position = 0
  function block(indent) {
    const body = []
    while (position < lines.length) {
      const current = lines[position]
      if (current.indent < indent) break
      if (current.indent > indent) {
        return {
          error: `line ${current.line}: this line is indented but nothing above opens a loop`,
        }
      }
      position += 1
      const loop = current.text.match(/^for\s+[A-Za-z_]\w*\s+in\s+range\(\s*(\d+)\s*\)\s*:$/)
      if (loop) {
        const next = lines[position]
        if (!next || next.indent <= indent) {
          return { error: `line ${current.line}: the loop needs an indented line under it` }
        }
        const inner = block(next.indent)
        if (inner.error) return inner
        body.push({ kind: 'loop', line: current.line, times: Number(loop[1]), body: inner.body })
        continue
      }
      const call = current.text.match(/^(?:[A-Za-z_]\w*\.)?([A-Za-z_]\w*)\s*\((.*)\)$/)
      if (!call) {
        return {
          error: `line ${current.line}: "${current.text}" isn't a turtle command trackCode understands`,
        }
      }
      const command = COMMAND_ALIASES[call[1]]
      if (!command) {
        return { error: `line ${current.line}: trackCode can't use ${call[1]}()` }
      }
      const argText = call[2].trim()
      const args = argText ? argText.split(',').map((part) => part.trim()) : []
      if (args.some((arg) => !NUMBER.test(arg))) {
        return { error: `line ${current.line}: ${call[1]}() needs plain numbers, like 100 or -45` }
      }
      const [min, max] = ARG_COUNTS[command]
      if (args.length < min || args.length > max) {
        return {
          error: `line ${current.line}: ${call[1]}() takes ${min === max ? min : `${min} or ${max}`} number${max === 1 ? '' : 's'}`,
        }
      }
      body.push({ kind: 'call', line: current.line, command, args: args.map(Number) })
    }
    return { body }
  }

  const result = block(lines.length ? lines[0].indent : 0)
  if (result.error) return result
  if (position < lines.length) {
    return { error: `line ${lines[position].line}: this line's indentation doesn't match` }
  }
  return result
}

/**
 * The wall segments a trackCode snippet draws: { segments: [{ x1, y1, x2, y2 }] } or { error }.
 */
export function trackCodeSegments(source) {
  const parsed = parseLines(source)
  if (parsed.error) return { error: parsed.error }
  const segments = []
  let x = 0
  let y = 0
  let heading = 0
  let penDown = true
  let steps = 0
  let error = null

  function moveTo(nx, ny) {
    if (penDown && (nx !== x || ny !== y)) segments.push({ x1: x, y1: y, x2: nx, y2: ny })
    x = nx
    y = ny
  }

  function forward(distance) {
    moveTo(x + distance * Math.cos(heading * DEG2RAD), y + distance * Math.sin(heading * DEG2RAD))
  }

  function run(nodes) {
    for (const node of nodes) {
      if (error) return
      steps += 1
      if (steps > MAX_STEPS || segments.length > TRACK_CODE_MAX_SEGMENTS) {
        error = `trackCode draws too much (at most ${TRACK_CODE_MAX_SEGMENTS} lines)`
        return
      }
      if (node.kind === 'loop') {
        for (let i = 0; i < node.times && !error; i += 1) run(node.body)
        continue
      }
      const [a, b] = node.args
      switch (node.command) {
        case 'forward':
          forward(a)
          break
        case 'backward':
          forward(-a)
          break
        case 'left':
          heading += a
          break
        case 'right':
          heading -= a
          break
        case 'goto':
          moveTo(a, b)
          break
        case 'setheading':
          heading = a
          break
        case 'home':
          moveTo(0, 0)
          heading = 0
          break
        case 'penup':
          penDown = false
          break
        case 'pendown':
          penDown = true
          break
        case 'circle': {
          // As the Turtle shim draws it (./shim.js): short forward() steps with small turns.
          const radius = a
          const extent = b === undefined ? 360 : b
          if (!radius) break
          const count = Math.max(12, Math.min(60, Math.trunc(Math.abs(radius) / 3) + 12))
          const stepExtent = Math.abs(extent) / count
          const stepLength = 2 * Math.abs(radius) * Math.sin((stepExtent * DEG2RAD) / 2)
          const turn = radius > 0 ? stepExtent : -stepExtent
          for (let i = 0; i < count; i += 1) {
            forward(stepLength)
            heading += turn
          }
          break
        }
        default:
          break
      }
    }
  }

  run(parsed.body)
  if (error) return { error }
  return { segments }
}
