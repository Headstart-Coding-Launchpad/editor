import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CopyCodePanel from '../CopyCodePanel'

describe('CopyCodePanel', () => {
  it('renders formatted code without clipboard controls', () => {
    const code = 'for i in range(3):\n    print(i)'

    render(<CopyCodePanel code={code} language="python" />)

    expect(screen.getByText('⌨️ Type this out')).toBeInTheDocument()
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

  it('keeps long lines on one line so the box scrolls sideways (no wrapping)', () => {
    const long = `print("${'word '.repeat(40)}")`
    const { container } = render(
      <CopyCodePanel code={`x = 1\n${long}`} after="x = 1" language="python" />
    )
    const rows = [...container.querySelectorAll('[role="listitem"]')]
    expect(rows.length).toBeGreaterThan(1)
    rows.forEach((row) => {
      const text = row.children[1]
      expect(text.style.whiteSpace).toBe('pre')
      expect(text.style.overflowWrap).not.toBe('anywhere')
    })
    const list = rows[0].parentElement.parentElement
    expect(list.style.width).toBe('max-content')
    expect(list.style.minWidth).toBe('100%')
    // The Add / "after this line" tags stay in view: sticky, outside the code element, opaque.
    const cells = [...container.querySelectorAll('[data-testid="change-tag-cell"]')]
    expect(cells.length).toBe(rows.length)
    cells.forEach((cell) => {
      expect(cell.style.position).toBe('sticky')
      expect(cell.style.right).toBe('0px')
      expect(cell.style.background).not.toBe('transparent')
      expect(rows.some((row) => row.children[1].contains(cell))).toBe(false)
    })
  })

  it('the calm What to change plain text also does not wrap', () => {
    const { container } = render(<CopyCodePanel code={'a = 1\nb = 2'} calm />)
    expect(container.querySelector('pre').style.whiteSpace).toBe('pre')
  })
})
