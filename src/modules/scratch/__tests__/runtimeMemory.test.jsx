import React from 'react'
import { render, waitFor, fireEvent, act } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ScratchWorkspace from '../ScratchWorkspace.jsx'

// A student's own Scratch workspace unmounts while they look at a classmate's shared work and
// mounts again on "Back to my work": the sprites must come back where they were left.
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    return kind === '2d'
      ? new Proxy(
          { canvas: this },
          {
            get: (t, p) => (p in t ? t[p] : p === 'measureText' ? () => ({ width: 0 }) : () => {}),
            set: (t, p, v) => ((t[p] = v), true),
          }
        )
      : null
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

const task = { id: 't1', sprites: [{ id: 'a', name: 'a', type: 'cat', x: 10, y: 20 }] }
const numbers = (c) => [...c.querySelectorAll('input[type="number"]')].map((i) => i.value)
const ready = (c) => waitFor(() => expect(numbers(c).length).toBeGreaterThan(1), { timeout: 30000 })

describe('Scratch sprites survive a remount', () => {
  it('shows the sprites where they were left after a remount with the same runtimeKey', async () => {
    const first = render(<ScratchWorkspace task={task} initialStates={{}} runtimeKey="k1" />)
    await ready(first.container)
    const [x] = first.container.querySelectorAll('input[type="number"]')
    fireEvent.change(x, { target: { value: '-120' } })
    expect(numbers(first.container)[0]).toBe('-120')
    act(() => first.unmount())

    const again = render(<ScratchWorkspace task={task} initialStates={{}} runtimeKey="k1" />)
    await ready(again.container)
    await waitFor(() => expect(numbers(again.container)[0]).toBe('-120'))
    expect(numbers(again.container)[1]).toBe('20')
  }, 60000)

  it('does not carry them to a different key (another student, another task)', async () => {
    const first = render(<ScratchWorkspace task={task} initialStates={{}} runtimeKey="k2" />)
    await ready(first.container)
    fireEvent.change(first.container.querySelector('input[type="number"]'), {
      target: { value: '50' },
    })
    act(() => first.unmount())
    const other = render(<ScratchWorkspace task={task} initialStates={{}} runtimeKey="k3" />)
    await ready(other.container)
    expect(numbers(other.container)[0]).toBe('10')
  }, 60000)
})
