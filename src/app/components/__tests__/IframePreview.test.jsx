import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IframePreview from '../IframePreview'

describe('IframePreview', () => {
  it('reports console errors for the current preview source', () => {
    const onConsoleError = vi.fn()
    render(<IframePreview src="blob:preview-1" onConsoleError={onConsoleError} />)

    fireEvent(window, new MessageEvent('message', {
      data: { source: 'hsc-console', level: 'error', args: ['Unexpected token'] },
    }))

    expect(onConsoleError).toHaveBeenCalledWith('blob:preview-1')
  })
})
