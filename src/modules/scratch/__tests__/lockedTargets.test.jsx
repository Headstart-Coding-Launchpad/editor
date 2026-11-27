import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import ScratchWorkspace, { filterCheckableSpriteWorkspaces } from '../ScratchWorkspace.jsx'

// jsdom gaps (as in lazyInject.test.jsx): canvas 2D context.
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

const sprite = (id, extra = {}) => ({ id, name: id, type: 'cat', x: 0, y: 0, ...extra })
const sprites = [sprite('cat'), sprite('gem', { x: 120, y: -60, studentEditable: false })]
const goToGem = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'event_whenflagclicked',
        id: 'h1',
        x: 0,
        y: 0,
        next: { block: { type: 'motion_goto', id: 'g1', fields: { TO: 'gem' } } },
      },
    ],
  },
}

describe('Scratch locked sprites with no blocks', () => {
  it('can still be the target of "go to"', async () => {
    const onStates = vi.fn()
    const props = {
      task: { id: 't1', sprites },
      respectStudentEditable: true,
      initialStates: { cat: goToGem },
      onSpriteStatesChange: onStates,
    }
    const { container } = render(<ScratchWorkspace {...props} />)
    // Run does nothing until Blockly is ready, so press until the sprite states are published.
    await waitFor(
      () => {
        fireEvent.click(container.querySelector('[title="Run green flag scripts"]'))
        expect(onStates).toHaveBeenCalled()
      },
      { timeout: 30000, interval: 500 }
    )
    await waitFor(() => expect(onStates.mock.lastCall[0].cat).toMatchObject({ x: 120, y: -60 }), {
      timeout: 10000,
    })
    // The mount saving stays: only the editable sprite has a Blockly workspace.
    expect(container.querySelectorAll('.injectionDiv')).toHaveLength(1)
  }, 60000)

  it('leaves checkable sprites with a real or absent workspace field alone', () => {
    const list = [{ id: 'a' }, { id: 'b', studentAdded: true }]
    expect(filterCheckableSpriteWorkspaces(list)).toEqual([{ id: 'a' }])
  })
})
