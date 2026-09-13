import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CopyCodePanel from '../CopyCodePanel'

describe('CopyCodePanel', () => {
  it('renders formatted code without clipboard controls', () => {
    const code = 'for i in range(3):\n    print(i)'

    render(<CopyCodePanel code={code} language="python" />)

    expect(screen.getByLabelText('Python reference code')).toBeInTheDocument()
    expect(screen.getByLabelText('Python reference code').querySelector('code')?.textContent).toBe(
      code
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('blocks copy and selection-adjacent browser actions', () => {
    render(<CopyCodePanel code="print('hello')" language="python" />)

    const panel = screen.getByLabelText('Python reference code')
    const copyEvent = createEvent.copy(panel)
    const cutEvent = createEvent.cut(panel)
    const dragEvent = createEvent.dragStart(panel)
    const contextEvent = createEvent.contextMenu(panel)

    fireEvent(panel, copyEvent)
    fireEvent(panel, cutEvent)
    fireEvent(panel, dragEvent)
    fireEvent(panel, contextEvent)

    expect(copyEvent.defaultPrevented).toBe(true)
    expect(cutEvent.defaultPrevented).toBe(true)
    expect(dragEvent.defaultPrevented).toBe(true)
    expect(contextEvent.defaultPrevented).toBe(true)
  })

  it('renders nothing for blank snippets', () => {
    const { container } = render(<CopyCodePanel code="   " language="html" />)

    expect(container).toBeEmptyDOMElement()
  })
})
