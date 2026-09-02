import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ElectronicsWorkspace from '../ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, makeComponent } from '../circuit.js'

function potentiometerCircuit(componentOverrides = {}) {
  const pot = { ...makeComponent('potentiometer', 1, { row: 2, col: 2 }), ...componentOverrides }
  return {
    ...DEFAULT_CIRCUIT,
    components: [pot],
    controls: { [pot.id]: { value: 50 } },
  }
}

function dragSlider(handle) {
  fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(handle, { clientX: 116, clientY: 100 })
  fireEvent.pointerUp(handle, { clientX: 116, clientY: 100 })
}

describe('ElectronicsWorkspace — on-canvas potentiometer slider', () => {
  it('drags the slider handle to update the potentiometer value via the same onControl/update path', () => {
    const circuit = potentiometerCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const handle = document.querySelector('[data-component] circle[data-control-action]')
    expect(handle).toBeTruthy()

    dragSlider(handle)

    expect(onChange).toHaveBeenCalled()
    const lastCircuit = onChange.mock.calls.at(-1)[0]
    expect(lastCircuit.controls[circuit.components[0].id].value).toBe(75)
  })

  it('does not change the value when the workspace is read-only', () => {
    const circuit = potentiometerCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} readOnly />)

    const handle = document.querySelector('[data-component] circle[data-control-action]')
    dragSlider(handle)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('still turns a locked ("Fixed") potentiometer outside setup mode — the lock freezes structure, not operation', () => {
    const circuit = potentiometerCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} setupMode={false} />)

    const handle = document.querySelector('[data-component] circle[data-control-action]')
    dragSlider(handle)

    expect(onChange).toHaveBeenCalled()
    const lastCircuit = onChange.mock.calls.at(-1)[0]
    expect(lastCircuit.controls[circuit.components[0].id].value).toBe(75)
    // Operating it must not have moved or otherwise restructured the part.
    expect(lastCircuit.components[0].position).toEqual(circuit.components[0].position)
  })

  it('allows dragging a locked potentiometer while in setup mode (builder)', () => {
    const circuit = potentiometerCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} setupMode />)

    const handle = document.querySelector('[data-component] circle[data-control-action]')
    dragSlider(handle)

    expect(onChange).toHaveBeenCalled()
  })
})

function wireCircuit(locked) {
  const battery = makeComponent('battery', 1, { row: 1, col: 1 })
  const led = makeComponent('led', 1, { row: 2, col: 4 })
  return {
    ...DEFAULT_CIRCUIT,
    components: [battery, led],
    wires: [{ id: 'wire1', from: `${battery.id}.positive`, to: `${led.id}.anode`, color: '#ef4444', locked }],
  }
}

function selectWire() {
  const hit = document.querySelector('[data-wire-hit]')
  fireEvent.pointerDown(hit, { button: 0 })
}

describe('ElectronicsWorkspace — lockable wires', () => {
  it('renders and connects a locked wire normally', () => {
    const circuit = wireCircuit(true)
    render(<ElectronicsWorkspace circuit={circuit} onChange={vi.fn()} />)

    expect(document.querySelectorAll('[data-wire-hit]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-pin-ref]').length).toBeGreaterThan(0)
  })

  it('blocks deleting a locked wire via the Delete key and the inspector button', () => {
    const circuit = wireCircuit(true)
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    selectWire()
    expect(screen.getByText('Wire')).toBeInTheDocument()
    const deleteButton = screen.getByText('Delete wire')
    expect(deleteButton).toBeDisabled()

    const board = document.querySelector('[tabindex]')
    fireEvent.keyDown(board, { key: 'Delete' })

    expect(onChange).not.toHaveBeenCalled()
    expect(document.querySelectorAll('[data-wire-hit]')).toHaveLength(1)
  })

  it('blocks recoloring a locked wire', () => {
    const circuit = wireCircuit(true)
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    selectWire()
    // The palette also renders a "Wire colour" select for new wires; the
    // inspector's select for the currently-selected wire renders after it.
    const colorSelect = screen.getAllByRole('combobox').at(-1)
    expect(colorSelect).toBeDisabled()

    fireEvent.change(colorSelect, { target: { value: '#111827' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('allows deleting and recoloring an unlocked wire', () => {
    const circuit = wireCircuit(false)
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    selectWire()
    const colorSelect = screen.getAllByRole('combobox').at(-1)
    expect(colorSelect).not.toBeDisabled()
    fireEvent.change(colorSelect, { target: { value: '#111827' } })
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)[0].wires[0].color).toBe('#111827')

    onChange.mockClear()
    const deleteButton = screen.getByText('Delete wire')
    expect(deleteButton).not.toBeDisabled()
    fireEvent.click(deleteButton)

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)[0].wires).toHaveLength(0)
  })

  it('shows a "Fixed for students" lock checkbox in the wire inspector during setup', () => {
    const circuit = wireCircuit(false)
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} setupMode />)

    selectWire()
    const lockCheckbox = screen.getByLabelText('Fixed for students')
    expect(lockCheckbox).not.toBeChecked()

    fireEvent.click(lockCheckbox)

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)[0].wires[0].locked).toBe(true)
  })
})

describe('ElectronicsWorkspace — onTabChange reporting (teacher live-status badge)', () => {
  it('reports the initial tab and each tab switch', () => {
    const onTabChange = vi.fn()
    render(
      <ElectronicsWorkspace
        circuit={DEFAULT_CIRCUIT}
        onChange={vi.fn()}
        showCodeTab
        onTabChange={onTabChange}
      />
    )

    expect(onTabChange).toHaveBeenCalledWith('breadboard')

    fireEvent.click(screen.getByRole('button', { name: 'MicroPython' }))
    expect(onTabChange).toHaveBeenLastCalledWith('code')

    fireEvent.click(screen.getByRole('button', { name: 'Breadboard' }))
    expect(onTabChange).toHaveBeenLastCalledWith('breadboard')
  })

  it('reports the externally controlled tab (teacher live view) without local clicks', () => {
    const onTabChange = vi.fn()
    const { rerender } = render(
      <ElectronicsWorkspace
        circuit={DEFAULT_CIRCUIT}
        onChange={vi.fn()}
        showCodeTab
        activeTab="breadboard"
        onTabChange={onTabChange}
      />
    )
    expect(onTabChange).toHaveBeenLastCalledWith('breadboard')

    rerender(
      <ElectronicsWorkspace
        circuit={DEFAULT_CIRCUIT}
        onChange={vi.fn()}
        showCodeTab
        activeTab="code"
        onTabChange={onTabChange}
      />
    )
    expect(onTabChange).toHaveBeenLastCalledWith('code')
  })
})

describe('ElectronicsWorkspace — highlightedTabs (teacher highlight)', () => {
  it('pulses only the tab button named in highlightedTabs', () => {
    render(
      <ElectronicsWorkspace
        circuit={DEFAULT_CIRCUIT}
        onChange={vi.fn()}
        showCodeTab
        highlightedTabs={['code']}
      />
    )

    expect(screen.getByRole('button', { name: 'Breadboard' })).not.toHaveClass('pane-highlight-pulse')
    expect(screen.getByRole('button', { name: 'MicroPython' })).toHaveClass('pane-highlight-pulse')
  })

  it('pulses nothing when highlightedTabs is omitted', () => {
    render(<ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} showCodeTab />)

    expect(screen.getByRole('button', { name: 'Breadboard' })).not.toHaveClass('pane-highlight-pulse')
    expect(screen.getByRole('button', { name: 'MicroPython' })).not.toHaveClass('pane-highlight-pulse')
  })
})

describe('ElectronicsWorkspace — forcedTab (teacher force-switch)', () => {
  it('jumps to the forced tab once, then lets the student navigate away freely afterward', () => {
    const { rerender } = render(
      <ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} showCodeTab forcedTab="code" forcedTabToken={1} />
    )
    expect(screen.getByRole('button', { name: 'MicroPython' })).toHaveClass('is-active')

    fireEvent.click(screen.getByRole('button', { name: 'Breadboard' }))
    expect(screen.getByRole('button', { name: 'Breadboard' })).toHaveClass('is-active')

    // Re-rendering with the SAME token must not snap it back to "code" — a force isn't a lock.
    rerender(
      <ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} showCodeTab forcedTab="code" forcedTabToken={1} />
    )
    expect(screen.getByRole('button', { name: 'Breadboard' })).toHaveClass('is-active')

    // A genuinely new token (different pushedAt) does jump again.
    rerender(
      <ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} showCodeTab forcedTab="code" forcedTabToken={2} />
    )
    expect(screen.getByRole('button', { name: 'MicroPython' })).toHaveClass('is-active')
  })

  it('does not force-jump while activeTab is actively controlling the tab (teacher live view)', () => {
    render(
      <ElectronicsWorkspace
        circuit={DEFAULT_CIRCUIT}
        onChange={vi.fn()}
        showCodeTab
        activeTab="breadboard"
        forcedTab="code"
        forcedTabToken={1}
      />
    )
    expect(screen.getByRole('button', { name: 'Breadboard' })).toHaveClass('is-active')
  })
})

describe('ElectronicsWorkspace — breadboard zoom', () => {
  it('starts at 100% and zooms in/out via the toolbar buttons, clamped to the 50–150% range', () => {
    render(<ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} />)

    expect(screen.getByText('100%')).toBeInTheDocument()

    const zoomIn = screen.getByLabelText('Zoom in')
    const zoomOut = screen.getByLabelText('Zoom out')

    for (let i = 0; i < 10; i++) fireEvent.click(zoomIn)
    expect(screen.getByText('150%')).toBeInTheDocument()

    for (let i = 0; i < 20; i++) fireEvent.click(zoomOut)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('zooms with Ctrl+wheel but leaves plain wheel scrolling alone', () => {
    render(<ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} />)

    const boardWrap = document.querySelector('[tabindex]').parentElement.parentElement

    fireEvent.wheel(boardWrap, { deltaY: -100, ctrlKey: true })
    expect(screen.getByText('110%')).toBeInTheDocument()

    fireEvent.wheel(boardWrap, { deltaY: 100 })
    expect(screen.getByText('110%')).toBeInTheDocument()
  })

  it('resets to 100% via the Reset button, which only appears when zoomed', () => {
    render(<ElectronicsWorkspace circuit={DEFAULT_CIRCUIT} onChange={vi.fn()} />)

    expect(screen.queryByText('Reset')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Zoom in'))
    const resetBtn = screen.getByText('Reset')
    fireEvent.click(resetBtn)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.queryByText('Reset')).not.toBeInTheDocument()
  })
})

function buttonCircuit(componentOverrides = {}) {
  const button = { ...makeComponent('push_button', 1, { row: 2, col: 2 }), ...componentOverrides }
  return { ...DEFAULT_CIRCUIT, components: [button], controls: {} }
}

describe('ElectronicsWorkspace — locked ("Fixed") parts stay operable', () => {
  it('presses and releases a locked push button on the canvas', () => {
    const circuit = buttonCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const cap = document.querySelector('[data-component] rect[data-control-action]')
    expect(cap).toBeTruthy()

    fireEvent.pointerDown(cap, { button: 0 })
    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].pressed).toBe(true)

    fireEvent.pointerUp(cap, { button: 0 })
    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].pressed).toBe(false)
  })

  it('leaves the inspector Pressed toggle enabled for a locked push button but keeps Rotate/Delete disabled', () => {
    const circuit = buttonCircuit({ locked: true })
    render(<ElectronicsWorkspace circuit={circuit} onChange={vi.fn()} />)

    fireEvent.click(document.querySelector('[data-component]'))

    expect(screen.getByLabelText('Pressed')).not.toBeDisabled()
    expect(screen.getByText('Rotate 90 deg')).toBeDisabled()
    expect(screen.getByText('Delete part')).toBeDisabled()
  })

  it('still refuses to drag a locked part even though its controls respond', () => {
    const circuit = buttonCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const part = document.querySelector('[data-component]')
    const board = document.querySelector('[tabindex]')
    fireEvent.pointerDown(part, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(board, { clientX: 260, clientY: 220 })
    fireEvent.pointerUp(board, { clientX: 260, clientY: 220 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps a read-only workspace fully inert — controls included', () => {
    const circuit = buttonCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} readOnly />)

    const cap = document.querySelector('[data-component] rect[data-control-action]')
    fireEvent.pointerDown(cap, { button: 0 })
    fireEvent.pointerUp(cap, { button: 0 })

    expect(onChange).not.toHaveBeenCalled()
  })
})

function switchCircuit(componentOverrides = {}, controls = {}) {
  const sw = { ...makeComponent('slide_switch', 1, { row: 2, col: 2 }), ...componentOverrides }
  return { ...DEFAULT_CIRCUIT, components: [sw], controls: { [sw.id]: controls } }
}

function switchBody() {
  return document.querySelector('[data-component] g[data-control-action]')
}

describe('ElectronicsWorkspace — slide switch hit target', () => {
  it('toggles when the grey body is clicked, not just the small knob', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const track = switchBody().querySelector('rect')
    expect(track).toBeTruthy()
    fireEvent.click(track)

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].closed).toBe(true)
  })

  it('still toggles when the knob itself is clicked, and does not double-toggle', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    fireEvent.click(switchBody().querySelector('circle'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].closed).toBe(true)
  })

  it('toggles back off from the body when already closed', () => {
    const circuit = switchCircuit({}, { closed: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    fireEvent.click(switchBody().querySelector('rect'))

    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].closed).toBe(false)
  })

  it('toggles a locked ("Fixed") switch from its body', () => {
    const circuit = switchCircuit({ locked: true })
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    fireEvent.click(switchBody().querySelector('rect'))

    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].closed).toBe(true)
  })

  it('toggles from the keyboard via Enter and Space', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    fireEvent.keyDown(switchBody(), { key: 'Enter' })
    expect(onChange.mock.calls.at(-1)[0].controls[circuit.components[0].id].closed).toBe(true)

    fireEvent.keyDown(switchBody(), { key: ' ' })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('does not toggle in a read-only workspace', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} readOnly />)

    fireEvent.click(switchBody().querySelector('rect'))
    fireEvent.keyDown(switchBody(), { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  // Positive control for the two "did not drag" assertions above and in the
  // locked-parts block: proves the drag machinery does fire in this environment,
  // so those tests cannot pass simply because dragging never works under jsdom.
  it('does drag an unlocked part when the press lands outside any control', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const part = document.querySelector('[data-component]')
    const board = document.querySelector('[tabindex]')
    fireEvent.pointerDown(part, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(board, { clientX: 300, clientY: 300 })
    fireEvent.pointerUp(board, { clientX: 300, clientY: 300 })

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)[0].components[0].position)
      .not.toEqual(circuit.components[0].position)
  })

  it('does not start a component drag when the switch body is pressed', () => {
    const circuit = switchCircuit()
    const onChange = vi.fn()
    render(<ElectronicsWorkspace circuit={circuit} onChange={onChange} />)

    const track = switchBody().querySelector('rect')
    const board = document.querySelector('[tabindex="0"][style]') ?? document.querySelector('[tabindex]')
    fireEvent.pointerDown(track, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(board, { clientX: 300, clientY: 300 })
    fireEvent.pointerUp(board, { clientX: 300, clientY: 300 })

    // Dragging never engaged, so the part did not move.
    expect(onChange).not.toHaveBeenCalled()
  })
})
