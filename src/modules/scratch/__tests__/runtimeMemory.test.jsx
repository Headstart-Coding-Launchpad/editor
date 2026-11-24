import React from 'react'
import { render, waitFor, fireEvent, act } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

  const move = async (props, x, after = (r) => r.unmount()) => {
    const r = render(<ScratchWorkspace initialStates={{}} {...props} />)
    await ready(r.container)
    fireEvent.change(r.container.querySelector('input[type="number"]'), { target: { value: x } })
    act(() => after(r))
  }
  const reopen = async (props) => {
    const r = render(<ScratchWorkspace initialStates={{}} {...props} />)
    await ready(r.container)
    return { r, spy: props.onSpriteStatesChange }
  }

  it('restores without broadcasting to the teacher', async () => {
    await move({ task, runtimeKey: 'k4' }, '77')
    const spy = vi.fn()
    const { r } = await reopen({ task, runtimeKey: 'k4', onSpriteStatesChange: spy })
    await waitFor(() => expect(numbers(r.container)[0]).toBe('77'))
    expect(spy).not.toHaveBeenCalled()
  }, 60000)

  it('remembers nothing without a key', async () => {
    await move({ task }, '77')
    const { r } = await reopen({ task })
    expect(numbers(r.container)[0]).toBe('10')
  }, 60000)

  it('never writes from a teacher-live mirror, even once the broadcast ends', async () => {
    const live = { spriteStates: { a: { x: 99, y: 1, direction: 90, size: 100, visible: true } } }
    const mirror = render(
      <ScratchWorkspace
        task={task}
        initialStates={{}}
        runtimeKey="k5"
        readOnly
        externalSpriteState={live}
      />
    )
    await ready(mirror.container)
    act(() => mirror.unmount())
    expect(numbers((await reopen({ task, runtimeKey: 'k5' })).r.container)[0]).toBe('10')

    await move({ task, runtimeKey: 'k6' }, '5', (r) => {
      r.rerender(
        <ScratchWorkspace
          task={task}
          initialStates={{}}
          runtimeKey="k6"
          readOnly
          externalSpriteState={live}
        />
      )
      r.rerender(<ScratchWorkspace task={task} initialStates={{}} runtimeKey="k6" />)
      r.unmount()
    })
    expect(numbers((await reopen({ task, runtimeKey: 'k6' })).r.container)[0]).toBe('10')
  }, 90000)

  it('restores a student-added sprite too', async () => {
    const added = { id: 'n1', name: 'n1', type: 'cat', x: 0, y: 0, studentAdded: true }
    const initialStates = { __meta__: { addedSprites: [added] } }
    const props = { task, initialStates, runtimeKey: 'k7', selectedSpriteId: 'n1' }
    await move(props, '-60')
    const r = render(<ScratchWorkspace {...props} />)
    await ready(r.container)
    await waitFor(() => expect(numbers(r.container)[0]).toBe('-60'))
  }, 60000)

  it('ignores a memory made for different authored sprites', async () => {
    await move({ task, runtimeKey: 'k8' }, '77')
    const changed = { id: 't1', sprites: [{ ...task.sprites[0], x: 10, y: 21 }] }
    expect(numbers((await reopen({ task: changed, runtimeKey: 'k8' })).r.container)[0]).toBe('10')
  }, 60000)

  it('Reset Stage puts the starter positions back for the next mount', async () => {
    await move({ task, runtimeKey: 'k9' }, '77', (r) => {
      fireEvent.click(r.getAllByText(/Reset Stage/)[0])
      r.unmount()
    })
    expect(numbers((await reopen({ task, runtimeKey: 'k9' })).r.container)[0]).toBe('10')
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
