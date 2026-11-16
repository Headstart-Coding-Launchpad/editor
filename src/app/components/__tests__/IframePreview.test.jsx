import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IframePreview from '../IframePreview'

function post(container, data, fromFrame = true) {
  const source = fromFrame ? container.querySelector('iframe').contentWindow : window
  fireEvent(window, new MessageEvent('message', { data, source }))
}

describe('IframePreview', () => {
  it('ignores console messages that do not come from its own iframe', () => {
    const onConsoleError = vi.fn()
    const { container } = render(
      <IframePreview src="blob:preview-1" onConsoleError={onConsoleError} />
    )
    post(container, { source: 'hsc-console', level: 'error', args: ['forged'] }, false)
    expect(onConsoleError).not.toHaveBeenCalled()
  })

  it('reports console errors for the current preview source', () => {
    const onConsoleError = vi.fn()
    const { container } = render(
      <IframePreview src="blob:preview-1" onConsoleError={onConsoleError} />
    )

    post(container, { source: 'hsc-console', level: 'error', args: ['Unexpected token'] })

    expect(onConsoleError).toHaveBeenCalledWith('blob:preview-1', {
      filename: undefined,
      lineno: undefined,
      loadId: undefined,
      message: 'Unexpected token',
    })
  })

  it('forwards the error location (filename/lineno/loadId) to onConsoleError', () => {
    const onConsoleError = vi.fn()
    const { container } = render(
      <IframePreview src="blob:preview-1" onConsoleError={onConsoleError} />
    )

    post(container, {
      source: 'hsc-console',
      level: 'error',
      args: ['boom (line 6)'],
      filename: 'blob:preview-1',
      lineno: 6,
      colno: 3,
      id: 'load-abc',
    })

    expect(onConsoleError).toHaveBeenCalledWith('blob:preview-1', {
      filename: 'blob:preview-1',
      lineno: 6,
      loadId: 'load-abc',
      message: 'boom (line 6)',
    })
  })

  it('does not forward a location for non-error console levels', () => {
    const onConsoleError = vi.fn()
    const { container } = render(
      <IframePreview src="blob:preview-1" onConsoleError={onConsoleError} />
    )

    post(container, { source: 'hsc-console', level: 'log', args: ['hello'] })

    expect(onConsoleError).not.toHaveBeenCalled()
  })
})
