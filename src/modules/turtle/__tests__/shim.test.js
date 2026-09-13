import { describe, it, expect } from 'vitest'
import { TURTLE_SHIM, buildTurtleProgram } from '../shim.js'

// The shim itself can only really be verified by running it through Pyodide
// (not done in unit tests anywhere in this codebase — see ../../electronics's
// MICROPYTHON_SHIM, which has no equivalent test either). These are structural
// checks plus a manual-verification reminder for anyone changing it.
describe('TURTLE_SHIM', () => {
  it('registers a fake turtle module in sys.modules', () => {
    expect(TURTLE_SHIM).toContain('sys.modules["turtle"] = _module')
  })

  it('defines the Phase 1 command surface', () => {
    for (const method of [
      'def forward',
      'def backward',
      'def left',
      'def right',
      'def penup',
      'def pendown',
      'def pencolor',
      'def goto',
      'def setheading',
      'def home',
      'def reset',
      'def position',
      'def heading',
      'def isdown',
    ]) {
      expect(TURTLE_SHIM).toContain(method)
    }
  })

  it('defines the Phase 2 command surface (fill/circle/stamp/write/bgcolor/colormode)', () => {
    for (const method of [
      'def begin_fill',
      'def end_fill',
      'def fillcolor',
      'def color',
      'def circle',
      'def stamp',
      'def write',
      '_bgcolor',
      '_colormode',
    ]) {
      expect(TURTLE_SHIM).toContain(method)
    }
  })

  it('exposes bgcolor and colormode at module level, not just via Screen', () => {
    expect(TURTLE_SHIM).toContain('_module.bgcolor = _bgcolor')
    expect(TURTLE_SHIM).toContain('_module.colormode = _colormode')
  })

  it('routes colormode entirely through the shim, never crossing into JS as a concept', () => {
    expect(TURTLE_SHIM).toContain('_format_color')
    expect(TURTLE_SHIM).toContain('_colormode_state')
  })
})

describe('buildTurtleProgram', () => {
  it('prepends the shim exec call before the student code, matching electronics MICROPYTHON_SHIM style', () => {
    const program = buildTurtleProgram('turtle.forward(10)')
    const lines = program.split('\n')
    expect(lines[0]).toBe(`exec(${JSON.stringify(TURTLE_SHIM)}, globals())`)
    expect(lines[1]).toBe('')
    expect(lines.slice(2).join('\n')).toBe('turtle.forward(10)')
  })

  it('keeps the shim on a single source line so student error line numbers are unaffected', () => {
    const program = buildTurtleProgram('raise ValueError("boom")')
    expect(program.split('\n')[0]).not.toContain('\n')
  })
})
