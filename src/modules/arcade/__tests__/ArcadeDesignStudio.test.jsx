import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArcadeDesignStudio from '../ArcadeDesignStudio.jsx'
import { createArcadeDesign, createArcadeSprite } from '../design.js'

function designWithOneSprite() {
  return createArcadeDesign({ sprites: [createArcadeSprite([], { id: 'sprite-1' })] })
}

function Harness({ initialDesign = designWithOneSprite(), task = { arcadeTools: 'sprites' } }) {
  const [design, setDesign] = useState(initialDesign)
  return <ArcadeDesignStudio task={task} design={design} onChange={setDesign} />
}

function pixelButtons() {
  return screen.getAllByTitle('Drag to paint; right-click to erase')
}

function isPainted(button) {
  return button.style.background !== ''
}

describe('ArcadeDesignStudio undo/redo', () => {
  it('undoes a single pixel paint and redoes it', () => {
    render(<Harness />)
    const pixels = pixelButtons()
    expect(isPainted(pixels[0])).toBe(false)

    fireEvent.pointerDown(pixels[0], { button: 0 })
    expect(isPainted(pixelButtons()[0])).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(isPainted(pixelButtons()[0])).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Redo/ }))
    expect(isPainted(pixelButtons()[0])).toBe(true)
  })

  it('disables Undo/Redo when there is nothing to undo/redo', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Redo/ })).toBeDisabled()

    fireEvent.pointerDown(pixelButtons()[0], { button: 0 })
    expect(screen.getByRole('button', { name: /Undo/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Redo/ })).toBeDisabled()
  })

  it('coalesces a whole paint-drag stroke into a single undo step', () => {
    render(<Harness />)
    const pixels = pixelButtons()

    fireEvent.pointerDown(pixels[0], { button: 0 })
    fireEvent.pointerEnter(pixels[1])
    fireEvent.pointerEnter(pixels[2])
    fireEvent.pointerEnter(pixels[3])

    const painted = pixelButtons().filter(isPainted)
    expect(painted.length).toBe(4)

    // One undo reverts the entire stroke, not just the last pixel touched.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(pixelButtons().filter(isPainted).length).toBe(0)
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled()
  })

  it('supports Ctrl+Z / Ctrl+Shift+Z from within the design studio', () => {
    render(<Harness />)
    const pixels = pixelButtons()
    fireEvent.pointerDown(pixels[0], { button: 0 })
    pixels[0].focus()
    expect(isPainted(pixelButtons()[0])).toBe(true)

    fireEvent.keyDown(pixels[0], { key: 'z', ctrlKey: true })
    expect(isPainted(pixelButtons()[0])).toBe(false)

    fireEvent.keyDown(pixels[0], { key: 'z', ctrlKey: true, shiftKey: true })
    expect(isPainted(pixelButtons()[0])).toBe(true)
  })

  it('drops history when the design changes externally (e.g. switching tasks)', () => {
    const { rerender } = render(<Harness />)
    fireEvent.pointerDown(pixelButtons()[0], { button: 0 })
    expect(screen.getByRole('button', { name: /Undo/ })).toBeEnabled()

    // A brand-new design object arrives from outside (task switch) rather than from this
    // component's own onChange — the stale history must not carry over.
    rerender(<ArcadeDesignStudio task={{ arcadeTools: 'sprites' }} design={designWithOneSprite()} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled()
  })
})
