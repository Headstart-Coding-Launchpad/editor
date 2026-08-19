import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../ScratchWorkspace.jsx', () => ({
  default: vi.fn(props => <div data-testid="scratch-workspace" data-props={JSON.stringify(props)} />),
}))

import ScratchWorkspace from '../ScratchWorkspace.jsx'
import ScratchTeacherLiveView from '../TeacherLiveView.jsx'

describe('ScratchTeacherLiveView', () => {
  it('always forces the compact Blocks/Stage layout and wires live-mirror props through, regardless of viewport', () => {
    render(
      <ScratchTeacherLiveView
        task={{ id: 't1' }}
        lesson={{ assetsPath: 'lessons/demo' }}
        scratchState={{ sprite1: { xml: '<xml/>' } }}
        spriteState={{ spriteStates: {} }}
        cursorState={{ target: 'stage', x: 1, y: 2, at: 123 }}
        blockDragState={{ spriteId: 'sprite1', blockId: 'b1', x: 3, y: 4, at: 123 }}
        isSessionSandbox
      />,
    )

    expect(screen.getByTestId('scratch-workspace')).toBeInTheDocument()
    const props = ScratchWorkspace.mock.calls[0][0]
    expect(props.forceCompact).toBe(true)
    expect(props.readOnly).toBe(true)
    expect(props.hideStage).toBeUndefined()
    expect(props.initialState).toEqual({ sprite1: { xml: '<xml/>' } })
    expect(props.externalState).toEqual({ sprite1: { xml: '<xml/>' } })
    expect(props.externalSpriteState).toEqual({ spriteStates: {} })
    expect(props.externalCursor).toEqual({ target: 'stage', x: 1, y: 2, at: 123 })
    expect(props.externalBlockDrag).toEqual({ spriteId: 'sprite1', blockId: 'b1', x: 3, y: 4, at: 123 })
    expect(props.unrestricted).toBe(true)
  })

  it('defaults to read-only', () => {
    render(<ScratchTeacherLiveView task={{ id: 't1' }} lesson={{}} scratchState={null} />)
    expect(ScratchWorkspace.mock.calls.at(-1)[0].readOnly).toBe(true)
  })
})
