import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PaintApp from '../PaintApp.jsx'
import { makeDefaultDesktop } from '../../../desktopState.js'

const FAKE_DATA_URL = 'data:image/png;base64,FAKE'

function stubCanvas() {
  const ctx = {
    fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), drawImage: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(FAKE_DATA_URL)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 640, height: 420 })
  return ctx
}

function setup(overrides = {}) {
  let state = makeDefaultDesktop(['paint'])
  const win = { ...state.windows[0], appId: 'paint', ...overrides }
  state = { ...state, windows: [win] }
  const onStateChange = vi.fn()
  const onInteraction = vi.fn()
  render(<PaintApp win={win} state={state} onStateChange={onStateChange} disabled={false} onInteraction={onInteraction} />)
  return { state, win, onStateChange, onInteraction }
}

describe('PaintApp', () => {
  beforeEach(() => stubCanvas())
  afterEach(() => vi.restoreAllMocks())

  it('shows Untitled with no dirty dot for a fresh window', () => {
    setup()
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('Save on an untitled window opens the Save As dialog', () => {
    setup()
    fireEvent.click(screen.getByText('💾 Save'))
    expect(screen.getByRole('dialog', { name: 'Save As' })).toBeInTheDocument()
  })

  it('Save As writes the canvas snapshot into fs at the chosen path', () => {
    const { onStateChange } = setup()
    fireEvent.click(screen.getByText('Save As…'))
    fireEvent.change(screen.getByLabelText(/File name/), { target: { value: 'drawing.png' } })
    fireEvent.click(screen.getByText('Save'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.fs['/drawing.png']).toEqual({ type: 'file', content: FAKE_DATA_URL })
    expect(nextState.windows[0].filePath).toBe('/drawing.png')
  })

  it('Save on an existing file commits directly without a dialog', () => {
    let state = makeDefaultDesktop(['paint'])
    state = { ...state, fs: { ...state.fs, '/drawing.png': { type: 'file', content: 'data:image/png;base64,OLD' } } }
    const win = { ...state.windows[0], appId: 'paint', filePath: '/drawing.png' }
    const onStateChange = vi.fn()
    render(<PaintApp win={win} state={{ ...state, windows: [win] }} onStateChange={onStateChange} disabled={false} />)
    fireEvent.click(screen.getByText('💾 Save'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.fs['/drawing.png'].content).toBe(FAKE_DATA_URL)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('drawing a stroke marks the window dirty and enables Undo', () => {
    const { onStateChange } = setup()
    const canvas = screen.getByLabelText('Paint canvas')
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 })
    expect(screen.getByText('↶ Undo')).not.toBeDisabled()
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 })
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 })
    const nextState = onStateChange.mock.calls.at(-1)[0]
    expect(nextState.windows[0].draftContent).toBe(FAKE_DATA_URL)
  })

  it('Open only accepts a file whose content is a data:image URL', () => {
    let state = makeDefaultDesktop(['paint'])
    state = {
      ...state,
      fs: {
        ...state.fs,
        '/good.png': { type: 'file', content: FAKE_DATA_URL },
        '/bad.png': { type: 'file', content: 'not an image' },
      },
    }
    const win = { ...state.windows[0], appId: 'paint' }
    const onStateChange = vi.fn()
    render(<PaintApp win={win} state={{ ...state, windows: [win] }} onStateChange={onStateChange} disabled={false} />)

    fireEvent.click(screen.getByText('📂 Open'))
    fireEvent.click(screen.getByText('bad.png'))
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText(/isn't a drawing Paint can open/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('good.png'))
    fireEvent.click(screen.getByText('Open'))
    const nextState = onStateChange.mock.calls.at(-1)[0]
    expect(nextState.windows[0].filePath).toBe('/good.png')
  })

  it('Clear pushes an undo snapshot and marks the window dirty', () => {
    const { onStateChange } = setup()
    fireEvent.click(screen.getByText('🧹 Clear'))
    expect(screen.getByText('↶ Undo')).not.toBeDisabled()
    const nextState = onStateChange.mock.calls.at(-1)[0]
    expect(nextState.windows[0].draftContent).toBe(FAKE_DATA_URL)
  })
})
