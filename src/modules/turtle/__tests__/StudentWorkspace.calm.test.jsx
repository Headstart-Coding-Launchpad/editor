import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

// The calm Turtle screen (sketch OK'd 23 Nov 2026): one big ▶ Draw, Emoji and Blocks beside it,
// Reset / Map editor / Slow-mo / Topic library behind one "More", and the console as a one-line
// strip under the picture that opens ITSELF when the program prints or crashes, so a child never
// misses an error.

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}))
})

vi.mock('../../python/PythonEditor', () => ({
  default: ({ code, calm }) => <div data-calm={String(!!calm)}>python-editor:{code}</div>,
}))

vi.mock('../draw.js', async (importOriginal) => ({
  ...(await importOriginal()),
  drawTurtleCommands: () => {},
  sizeCanvasToDisplay: () => false,
}))

vi.mock('../../../shared/resultPane/useWorkspaceLayout.js', () => ({
  useWorkspaceLayout: ({ isMobile }) => ({
    ref: () => {},
    layout: isMobile ? 'below' : 'side',
    inset: 0,
  }),
}))

function makeCs(overrides = {}) {
  return {
    code: 'import turtle\nturtle.forward(10)',
    running: false,
    pyodideStatus: 'ready',
    output: '',
    runStatus: null,
    checkPassed: false,
    checkAttempted: false,
    errorLine: null,
    inPersonalSandbox: false,
    turtleResult: null,
    handleRun: vi.fn(),
    handleStop: vi.fn(),
    handleCodeChange: vi.fn(),
    handleResetCode: vi.fn(),
    readSavedTaskCode: vi.fn(),
    ...overrides,
  }
}

const MAP = '#####\n#>.G#\n#####'
const ws = (props) => <StudentWorkspace task={{ id: 1 }} isMobile={false} {...props} />

describe('Turtle calm screen: the big Draw button', () => {
  it('one big ▶ Draw is the primary action, carries the run highlight and starts a run', () => {
    const cs = makeCs()
    render(ws({ cs }))
    const draw = screen.getByRole('button', { name: 'Draw' })
    expect(draw).toHaveClass('btn-primary', 'btn-primary--big')
    expect(draw).toHaveAttribute('data-highlight-target', 'run stop')
    fireEvent.click(draw)
    expect(cs.handleRun).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
  })

  it('turns into Stop in the same slot while the drawing runs', () => {
    const cs = makeCs({ running: true })
    render(ws({ cs }))
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop).toHaveAttribute('data-highlight-target', 'run stop')
    fireEvent.click(stop)
    expect(cs.handleStop).toHaveBeenCalledTimes(1)
  })

  it('keeps Emoji and Blocks in the code row and gives the editor the calm key row', () => {
    render(ws({ cs: makeCs() }))
    const row = screen.getByRole('group', { name: 'Code' })
    expect(within(row).getByRole('button', { name: 'Insert emoji' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Blocks' })).toBeInTheDocument()
    expect(screen.getByText(/python-editor:/)).toHaveAttribute('data-calm', 'true')
  })
})

describe('Turtle calm screen: More', () => {
  it('puts Reset code, Map editor and Topic library behind one More menu', () => {
    const cs = makeCs()
    const onOpenTopicLibrary = vi.fn()
    render(
      ws({
        cs,
        task: { id: 3, course: { type: 'grid', vehicle: 'rover', map: MAP, studentMap: true } },
        onOpenTopicLibrary,
      })
    )
    expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Map editor/ })).toBeNull()
    const more = screen.getByRole('button', { name: /More/ })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['↺ Reset code', '🧱 Map editor', '📚 Topic library'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Reset code/ }))
    expect(cs.handleResetCode).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(more)
    fireEvent.click(screen.getByRole('menuitem', { name: /Map editor/ }))
    expect(screen.getByRole('dialog', { name: 'Map editor' })).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(ws({ cs: makeCs() }))
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Turtle calm screen: the console strip opens itself', () => {
  it('starts as a one-line strip, and a Draw that prints nothing leaves it shut', () => {
    const cs = makeCs()
    const { rerender } = render(ws({ cs }))
    const strip = screen.getByRole('button', { name: /Console/ })
    expect(strip).toHaveTextContent('nothing printed yet')
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
    rerender(ws({ cs: { ...cs, running: true } }))
    rerender(ws({ cs: { ...cs, runStatus: 'success', output: '' } }))
    // The picture keeps the room: the console is still the strip.
    expect(screen.getByRole('button', { name: /Console/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Collapse Output' })).toBeNull()
  })

  it('opens by itself when the program prints', () => {
    const cs = makeCs()
    const { rerender } = render(ws({ cs }))
    rerender(ws({ cs: { ...cs, runStatus: 'success', output: 'Hello\n' } }))
    expect(screen.getByRole('button', { name: 'Collapse Output' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Console/ })).toBeNull()
  })

  it('opens by itself on an error, so a child never misses it', () => {
    const cs = makeCs()
    const { rerender } = render(ws({ cs }))
    rerender(
      ws({ cs: { ...cs, runStatus: 'error', output: 'NameError: name "t" is not defined\n' } })
    )
    expect(screen.getByRole('button', { name: 'Collapse Output' })).toBeInTheDocument()
  })

  it('folds back to the strip, showing the last line printed', () => {
    const cs = makeCs({ runStatus: 'success', output: 'one\ntwo\n' })
    render(ws({ cs }))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Output' }))
    expect(screen.getByRole('button', { name: /Console/ })).toHaveTextContent('two')
  })

  it('on a tablet (editor above the picture) the picture and the strip show, no tabs', () => {
    render(ws({ cs: makeCs(), isMobile: true }))
    expect(screen.queryByRole('tab', { name: 'Console' })).toBeNull()
    expect(screen.getByRole('button', { name: /Console/ })).toBeInTheDocument()
  })
})
